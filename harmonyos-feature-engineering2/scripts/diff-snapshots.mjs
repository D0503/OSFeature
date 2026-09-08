#!/usr/bin/env node
// 冻结快照 vs sessions/latest（上次审查）比较：
// - 逐页哈希相同 → unchanged
// - 不同 → 行级 diff 并分类：api-signature / version / deletion / content（前三类为高危）
// - 新增页 → new（高危）；页面消失 → removed（高危）
// 输出 diff-report.json：{status: clean|changed, pages, highRisk}

import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { loadCapability } from "./lib/capability-tools.mjs"
import { readFrozenSnapshot } from "./lib/fetch-official.mjs"

const VERSION_PATTERN = /(?:\d+\.\d+\.\d+|API\s?\d+|起始版本|起始API|minAPI|targetAPI|targetSDK|compatibleSDK)/i
const API_SIGNATURE_PATTERN = /(?:[A-Za-z][A-Za-z0-9_]*\s*\(|\b(?:interface|enum|参数名|返回值|默认值|可选|必填|SystemCapability)\b|materialType|materialLevel|systemMaterial|systemMaterialEffect)/i

function normalize(text) {
  return text.replace(/\r\n/g, "\n").replace(/\ufeff/g, "").replace(/[ \t]+$/gm, "")
}

function diffLines(before, after) {
  const beforeLines = normalize(before).split("\n")
  const afterLines = normalize(after).split("\n")
  const beforeSet = new Map()
  for (const line of beforeLines) if (line.trim()) beforeSet.set(line, (beforeSet.get(line) ?? 0) + 1)
  const afterSet = new Map()
  for (const line of afterLines) if (line.trim()) afterSet.set(line, (afterSet.get(line) ?? 0) + 1)
  const removed = []
  for (const line of beforeLines) {
    if (!line.trim()) continue
    const count = beforeSet.get(line) ?? 0
    const live = afterSet.get(line) ?? 0
    if (live < count) removed.push(line)
    else beforeSet.set(line, 0)
  }
  const added = []
  for (const line of afterLines) {
    if (!line.trim()) continue
    const count = afterSet.get(line) ?? 0
    const old = beforeSet.get(line) ?? 0
    if (count > old) added.push(line)
    else afterSet.set(line, 0)
  }
  return { removed, added }
}

function classifyChange(removed, added) {
  const removedText = removed.join("\n")
  const addedText = added.join("\n")
  if (VERSION_PATTERN.test(removedText) || VERSION_PATTERN.test(addedText)) return "version"
  if (API_SIGNATURE_PATTERN.test(removedText) || API_SIGNATURE_PATTERN.test(addedText)) return "api-signature"
  if (removed.length > added.length && removed.length >= 3) return "deletion"
  return "content"
}

const HIGH_RISK = new Set(["api-signature", "version", "deletion", "new", "removed"])

function parseArgs(argv) {
  const valued = new Set(["frozen", "skill-root", "output"])
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) throw new Error(`未知参数: ${token}`)
    const key = token.slice(2)
    if (!valued.has(key)) throw new Error(`未知参数: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    result[key] = value
    index += 1
  }
  return result
}

export async function diffAgainstLatest(capability, frozenDirectory) {
  const { frozen, bodies } = await readFrozenSnapshot(frozenDirectory)
  const latest = capability.session
  const pages = []
  const highRisk = []
  if (!latest) {
    for (const snapshot of frozen.snapshots) {
      pages.push({ snapshotId: snapshot.snapshotId, status: "new", category: "new", addedLines: bodies.get(snapshot.snapshotId).split("\n").filter((line) => line.trim()).length, removedLines: 0, detail: "无上次审查记录（首次运行）。" })
      highRisk.push({ snapshotId: snapshot.snapshotId, category: "new", reason: "首次冻结，全部内容需现提判据。" })
    }
    return { status: "changed", frozenAt: frozen.frozenAt, pages, highRisk }
  }
  const latestSnapshots = new Map(latest.snapshots.map((item) => [item.snapshotId, item]))
  const latestBodies = new Map()
  for (const snapshot of latest.snapshots) {
    try {
      const { readFile } = await import("node:fs/promises")
      latestBodies.set(snapshot.snapshotId, await readFile(resolve(capability.packageRoot, "sessions/latest/snapshots", `${snapshot.snapshotId}.md`), "utf8"))
    } catch { /* 正文缺失在包校验已报 */ }
  }
  for (const snapshot of frozen.snapshots) {
    const previous = latestSnapshots.get(snapshot.snapshotId)
    if (!previous) {
      pages.push({ snapshotId: snapshot.snapshotId, status: "new", category: "new", addedLines: 0, removedLines: 0, detail: "上次审查没有此页（新增入口）。" })
      highRisk.push({ snapshotId: snapshot.snapshotId, category: "new", reason: "新增入口，需整体现提判据。" })
      continue
    }
    if (previous.contentSha256.toLowerCase() === snapshot.contentSha256.toLowerCase()) {
      pages.push({ snapshotId: snapshot.snapshotId, status: "unchanged", category: null, addedLines: 0, removedLines: 0, detail: "与上次审查一致。" })
      continue
    }
    const before = latestBodies.get(snapshot.snapshotId) ?? ""
    const after = bodies.get(snapshot.snapshotId) ?? ""
    const { removed, added } = diffLines(before, after)
    const category = classifyChange(removed, added)
    pages.push({
      snapshotId: snapshot.snapshotId,
      status: "changed",
      category,
      addedLines: added.length,
      removedLines: removed.length,
      removedExcerpt: removed.slice(0, 15).map((line) => line.slice(0, 160)),
      addedExcerpt: added.slice(0, 15).map((line) => line.slice(0, 160)),
    })
    if (HIGH_RISK.has(category)) highRisk.push({ snapshotId: snapshot.snapshotId, category, reason: category === "version" ? "版本声明发生变化" : category === "api-signature" ? "API 签名/参数/默认值特征变化" : category === "deletion" ? "内容以删除为主，能力可能被移除" : "新增入口页" })
  }
  // 场景级 diff 只比较本次冻结集内的页面；"页面消失"（官网下线）由 freeze 阶段抓取失败暴露，
  // 全量入口健康由发布周期的 links 检测负责，不在单场景 diff 中推断。
  return { status: highRisk.length || pages.some((page) => page.status === "changed") ? "changed" : "clean", frozenAt: frozen.frozenAt, pages, highRisk }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.frozen) throw new Error("用法: node diff-snapshots.mjs --frozen <冻结目录> [--output <目录>]")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot)
  const report = await diffAgainstLatest(capability, resolve(args.frozen))
  if (args.output) {
    const { mkdir, writeFile } = await import("node:fs/promises")
    await mkdir(args.output, { recursive: true })
    await writeFile(resolve(args.output, "diff-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8")
  }
  process.stdout.write(`${JSON.stringify({ status: report.status, frozenAt: report.frozenAt, pages: report.pages.map(({ removedExcerpt, addedExcerpt, ...page }) => page), highRiskCount: report.highRisk.length }, null, 2)}\n`)
  if (report.status !== "clean") process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

#!/usr/bin/env node
// 能力包来源对勘与链接检测：
// - crosscheck：把每条事实与其锁定快照原文逐条对勘（文件存在、哈希一致、按 locator 抽取原文行）。
// - links：重新抓取锁中登记的官网 URL，比对正文哈希，报告漂移；只报告，不改锁。

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadCapability } from "./lib/capability-tools.mjs"
import { resolveReportOutputDirectory } from "./lib/report-output.mjs"

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function snapshotFileName(officialUrl) {
  const segments = new URL(officialUrl).pathname.split("/").filter(Boolean)
  return `${segments[segments.length - 1]}.md`
}

// 从自由文本 locator 中抽取全部行号区间，如 "L9,L67-L71"、"TitleBarStyleOptions L1437-L1484"。
function parseLocatorRanges(locator) {
  const ranges = []
  const pattern = /L(\d+)(?:\s*-\s*L?(\d+))?/g
  let match
  while ((match = pattern.exec(String(locator ?? ""))) !== null) {
    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : start
    if (Number.isInteger(start) && Number.isInteger(end) && end >= start) ranges.push([start, end])
  }
  return ranges
}

function excerptLines(lines, ranges, maxLines = 12) {
  const picked = []
  for (const [start, end] of ranges) {
    for (let index = start; index <= end && picked.length < maxLines; index += 1) {
      if (lines[index - 1] !== undefined) picked.push({ line: index, text: lines[index - 1] })
    }
  }
  return picked
}

export async function crosscheckCapabilitySources(capability, snapshotDirectory) {
  if (!isAbsolute(snapshotDirectory)) throw new Error("snapshots 必须是绝对目录")
  const lockedSources = new Map(capability.lock.sourceDocuments.map((source) => [source.snapshotId, source]))
  const entries = []
  const counters = { crosschecked: 0, hash_mismatch: 0, file_missing: 0, manual_review: 0, url_missing: 0 }
  for (const fact of capability.factsData.facts) {
    for (const source of fact.sources) {
      const locked = lockedSources.get(source.snapshotId)
      if (!locked) {
        counters.url_missing += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, status: "url_missing", detail: "快照未登记到锁文件。" })
        continue
      }
      if (!locked.officialUrl) {
        counters.url_missing += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, status: "url_missing", detail: "锁条目缺少官网 URL。" })
        continue
      }
      const fileName = snapshotFileName(locked.officialUrl)
      const filePath = join(snapshotDirectory, fileName)
      let content
      try {
        content = await readFile(filePath, "utf8")
      } catch {
        counters.file_missing += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, file: fileName, status: "file_missing", detail: "快照目录中未找到原文文件。" })
        continue
      }
      const contentHashes = new Set([digest(content), digest(`${content.replace(/\r\n/g, "\n")}`), digest(`${content.replace(/\r\n/g, "\n")}\n`)])
      if (!contentHashes.has(locked.sha256.toLowerCase())) {
        counters.hash_mismatch += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, file: fileName, status: "hash_mismatch", locator: source.locator, statement: fact.statement, detail: "快照文件哈希与锁不一致，能力包来源不可信。" })
        continue
      }
      const ranges = parseLocatorRanges(source.locator)
      if (!ranges.length) {
        counters.manual_review += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, file: fileName, status: "manual_review", locator: source.locator, statement: fact.statement, detail: "locator 无行号，需人工对勘原文。" })
        continue
      }
      const lines = content.split(/\r?\n/)
      const excerpt = excerptLines(lines, ranges)
      counters.crosschecked += 1
      entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, file: fileName, status: "crosschecked", locator: source.locator, statement: fact.statement, excerpt })
    }
  }
  return { status: counters.hash_mismatch || counters.file_missing || counters.url_missing ? "failed" : "passed", counters, entries }
}

async function fetchOnce(url, workDirectory) {
  const outputFile = join(workDirectory, `fetch-${digest(url).slice(0, 12)}.json`)
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "fetch-doc.mjs")
  const result = await new Promise((resolveResult) => {
    const child = spawn(process.execPath, [script, url, "--output", outputFile], { shell: false, windowsHide: true, timeout: 60_000 })
    child.on("error", (error) => resolveResult({ ok: false, error: error.message }))
    child.on("close", (code) => resolveResult({ ok: code === 0, code }))
  })
  if (!result.ok) return { reachable: false, detail: `抓取失败（${result.error ?? `退出码 ${result.code}`}）。` }
  try {
    const payload = JSON.parse(await readFile(outputFile, "utf8"))
    return { reachable: true, payload, detail: null }
  } catch (error) {
    return { reachable: false, detail: `结果不可解析: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export async function checkCapabilityLinks(capability) {
  const workDirectory = join(tmpdir(), `cap-links-${Date.now()}`)
  await mkdir(workDirectory, { recursive: true })
  const results = []
  try {
    for (const source of capability.lock.sourceDocuments) {
      if (!source.officialUrl) { results.push({ snapshotId: source.snapshotId, officialUrl: null, status: "url_missing" }); continue }
      const fetched = await fetchOnce(source.officialUrl, workDirectory)
      if (!fetched.reachable) { results.push({ snapshotId: source.snapshotId, officialUrl: source.officialUrl, status: "unreachable", detail: fetched.detail }); continue }
      const live = fetched.payload.contentSha256 ?? null
      const matched = live !== null && [live, digest(`${fetched.payload.contentMarkdown ?? ""}\n`)].includes(source.sha256.toLowerCase())
      results.push({
        snapshotId: source.snapshotId,
        officialUrl: source.officialUrl,
        status: matched ? "ok" : "drifted",
        lockedSha256: source.sha256,
        liveContentSha256: live,
        title: fetched.payload.title ?? null,
        documentStatus: fetched.payload.documentStatus ?? null,
        updatedDate: fetched.payload.updatedDate ?? null,
        warnings: fetched.payload.warnings ?? [],
        detail: matched ? "当前线上正文与锁定快照一致。" : "当前线上正文与锁定快照不一致；官网可能已更新，需重新审查后再更新能力包，不得直接改锁。",
      })
    }
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
  const counters = results.reduce((accumulator, item) => { accumulator[item.status] = (accumulator[item.status] ?? 0) + 1; return accumulator }, {})
  return { status: (counters.drifted ?? 0) || (counters.unreachable ?? 0) || (counters.url_missing ?? 0) ? "attention" : "ok", counters, results }
}

function parseArgs(argv) {
  const valued = new Set(["snapshots", "skill-root", "output"])
  const [mode, ...rest] = argv
  if (mode !== "crosscheck" && mode !== "links") throw new Error("用法: node verify-capability-sources.mjs <crosscheck|links> [--snapshots <快照目录>] [--output <目录>] [--skill-root <根>]")
  const result = { mode }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith("--")) throw new Error(`未知参数: ${token}`)
    const key = token.slice(2)
    if (!valued.has(key)) throw new Error(`未知参数: ${token}`)
    const value = rest[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    result[key] = value
    index += 1
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot)
  let result
  if (args.mode === "crosscheck") {
    if (!args.snapshots || !isAbsolute(args.snapshots)) throw new Error("crosscheck 需要 --snapshots <绝对快照目录>")
    result = await crosscheckCapabilitySources(capability, args.snapshots)
  } else {
    result = await checkCapabilityLinks(capability)
  }
  if (args.output) {
    const output = resolveReportOutputDirectory(args.output)
    await mkdir(output, { recursive: true })
    const fileName = args.mode === "crosscheck" ? "capability-source-crosscheck.json" : "capability-link-check.json"
    await writeFile(join(output, fileName), `${JSON.stringify(result, null, 2)}\n`, "utf8")
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status !== "passed" && result.status !== "ok") process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

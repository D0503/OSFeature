#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { extname, isAbsolute, join, relative, resolve } from "node:path"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"
import { validateDevelopmentReport, validateDevelopmentReportCollection } from "./validate-development-report.mjs"
import { resolveReportOutputDirectory } from "./lib/report-output.mjs"

function text(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

function implementationMarkdown(report) {
  if (!report.implementation) return []
  const { implementation, normativeBasis } = report
  const status = { applied: "已实施", partial: "部分实施", not_applied: "未实施" }
  const lines = ["## 代码实现步骤与依据", "",
    `- 实施记录：${{ recorded: "已记录", missing: "实施记录缺失", not_started: "未实施代码变更" }[implementation.recordStatus]}`,
    `- 基线对照：${implementation.baselineAvailable ? "已提供" : "基线缺失，无法确认本次代码变化"}`, ""]
  for (const step of implementation.steps) {
    lines.push(`### ${step.id} · ${status[step.status]}`, "", step.description, "")
    for (const location of step.locations) lines.push(`- 位置：\`${location.path}:${location.lineStart}-${location.lineEnd}\`（${location.version === "before" ? "修改前" : "修改后"}；${location.correlation === "matched" ? "已对应 diff" : "未确认变更"}）`)
    for (const basis of step.basis) {
      if (basis.type === "criteria") {
        lines.push(`- 判据依据（${basis.status ?? "fresh"}）：${basis.reason}`)
        const criterion = normativeBasis.find((item) => item.id === basis.criteriaId)
        if (criterion) {
          lines.push(`  - ${criterion.id}：${criterion.statement}`)
          for (const source of criterion.sources) lines.push(`    - ${source.officialUrl ? `[${source.title ?? source.snapshotId}](${source.officialUrl})` : `${source.snapshotId}（官网链接缺失）`} · 锚点：${source.anchor} · SHA-256：\`${source.sha256}\``)
        }
      } else lines.push(`- ${basis.type === "engineering_choice" ? "工程配套选择" : "依据待确认"}：${basis.reason}`)
    }
    for (const issue of step.issues) lines.push(`- 待确认：${issue}`)
    lines.push("")
  }
  if (normativeBasis.length) lines.push("以上判据来自本次冻结快照（官网现网页）；SDK、构建和设备结果见分层验证证据。", "")
  const conflicts = normativeBasis.filter((item) => item.normativeStatus === "conflicting")
  if (conflicts.length) {
    lines.push("冲突规范与待验证预期：", "")
    for (const item of conflicts) {
      lines.push(`- ${item.id}（${item.usage === "direct" ? "步骤引用" : "关联冲突"}）：${item.statement}`)
      for (const source of item.sources) lines.push(`  - ${source.officialUrl ? `[${source.title ?? source.snapshotId}](${source.officialUrl})` : `${source.snapshotId}（官网链接缺失）`} · 锚点：${source.anchor} · SHA-256：\`${source.sha256}\``)
    }
    lines.push("", "上述预期仍需逐项对照实际行为；步骤中的实施选择不裁决规范真值。", "")
  }
  if (implementation.uncoveredChanges.length) lines.push("未被实施步骤覆盖的变更文件：", "", ...implementation.uncoveredChanges.map((path) => `- \`${path}\``), "")
  return lines
}

export function developmentReportMarkdown(report, outputDirectory) {
  const lines = [
    "# 代码开发验证报告",
    "",
    `- 总结果：\`${report.verdict.status}\``,
    `- 能力：${report.capabilityPackage.featureId}`,
    `- 技术路线：${report.capabilityPackage.route}`,
    `- 场景：${report.capabilityPackage.scenarioId}（判据策略：${report.capabilityPackage.criteriaStrategy}，冻结于 ${report.capabilityPackage.frozenAt ?? "未知"}）`,
    `- 工程：${report.input.project}`,
    `- 目标：${report.input.goal}`,
    "",
    report.verdict.summary,
    "",
    ...implementationMarkdown(report),
    "## 兼容性",
    "",
    `状态：\`${report.compatibility.status}\`。${report.compatibility.reasons.join("；") || "无阻塞原因。"}`,
    "",
    "## 分层检查",
    "",
    "| 层级 | 必需 | 状态 | 结论 |",
    "|---|---:|---|---|",
  ]
  for (const [level, item] of Object.entries(report.checks)) lines.push(`| ${level} | ${item.required ? "是" : "否"} | ${item.status} | ${item.summary.replaceAll("|", "\\|")} |`)
  lines.push("", "## 代码变化", "")
  if (!report.changes.length) lines.push("未记录触及文件。")
  for (const change of report.changes) {
    lines.push(`### ${change.path}`, "", `- 状态：${change.status}`, `- before：\`${text(change.beforeSha256)}\``, `- after：\`${text(change.afterSha256)}\``)
    if (change.diff) lines.push("", "```diff", change.diff.trimEnd(), "```")
    lines.push("")
  }
  lines.push("## 待验证", "")
  if (!report.pendingVerifications.length) lines.push("无。")
  else for (const item of report.pendingVerifications) lines.push(`- ${item.id} [${item.level}] ${item.reason}`)
  lines.push("", "## 证据", "")
  if (!report.evidence.length) lines.push("无。")
  else for (const item of report.evidence) {
    lines.push(`- ${item.id} [${item.type}] ${item.summary}${item.path ? ` — ${item.path}` : ""}`)
    if (item.type === "screenshot") {
      if (item.previewMissing || !item.path) lines.push("", "截图文件缺失，无法预览。", "")
      else {
        const path = outputDirectory ? relative(outputDirectory, item.path) : item.path
        const url = path.replaceAll("\\", "/").split("/").map(encodeURIComponent).join("/")
        const caption = String(item.summary || "设备截图").replace(/[\[\]\r\n]/g, " ")
        lines.push("", `![${caption}](<${url}>)`, "")
      }
    }
  }
  if (report.capabilityPackage.conflictingCriteriaRefs?.length) {
    lines.push("", "## 规范冲突披露", "", `本次判据集保留冲突判据：${report.capabilityPackage.conflictingCriteriaRefs.join("、")}。本次匹配：${report.verdict.matchedCriteriaRefs.join("、") || "未确定"}。`)
  }
  return `${lines.join("\n")}\n`
}

export function developmentReportCollectionMarkdown(collection, outputDirectory) {
  const cell = (value) => String(value).replaceAll("|", "\\|").replace(/[\r\n]+/g, " ")
  const lines = ["# 代码开发验证报告", "", `- 工程：${collection.project}`, `- 开发目标数：${collection.reports.length}`, "",
    "## 验证结果总览", "", "| 开发目标 | 技术路线 | 结果 |", "|---|---|---|"]
  for (const report of collection.reports) lines.push(`| ${cell(report.input.goal)} | ${cell(report.capabilityPackage.route)} | ${cell(report.verdict.status)} |`)
  for (const report of collection.reports) {
    lines.push("", `## ${cell(report.input.goal)}`, "")
    const detail = developmentReportMarkdown(report, outputDirectory).split("\n").slice(2)
      .filter((line) => !line.startsWith("- 场景：") && !line.startsWith("- 工程：") && !line.startsWith("- 目标："))
      .map((line) => /^(#{2,3}) /.test(line) ? `#${line}` : line)
    lines.push(`- 判据策略：${report.capabilityPackage.criteriaStrategy}，冻结于 ${report.capabilityPackage.frozenAt ?? "未知"}`, "", ...detail)
  }
  return `${lines.join("\n").trimEnd()}\n`
}

function reportKey(report) {
  return JSON.stringify([report.capabilityPackage.featureId, report.capabilityPackage.route, report.capabilityPackage.scenarioId,
    report.input.goal, report.input.target ?? null, report.input.module ?? null])
}

async function readExisting(path) {
  try { return JSON.parse(await readFile(path, "utf8")) }
  catch (error) { if (error.code === "ENOENT") return null; throw error }
}

async function preserveScreenshots(report, output) {
  for (const evidence of report.evidence) {
    if (evidence.type !== "screenshot") continue
    if (!evidence.path) { evidence.previewMissing = true; continue }
    const source = isAbsolute(evidence.path) ? evidence.path : resolve(report.input.project, evidence.path)
    let bytes
    try { bytes = await readFile(source) }
    catch (error) { if (error.code === "ENOENT") { evidence.previewMissing = true; continue }; throw error }
    const hash = createHash("sha256").update(bytes).digest("hex")
    if (evidence.sha256 && evidence.sha256.toLowerCase() !== hash) throw new Error(`截图内容与证据哈希不一致: ${source}`)
    const images = join(output, "evidence", "images")
    const suffix = extname(source).toLowerCase()
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(suffix)) throw new Error(`截图文件格式不支持 Markdown 预览: ${source}`)
    await mkdir(images, { recursive: true })
    const destination = join(images, `${hash}${suffix}`)
    await writeFile(destination, bytes)
    evidence.path = destination
    evidence.sha256 = hash
    delete evidence.previewMissing
  }
}

async function renderMergedReport(report, outputDirectory) {
  const output = resolveReportOutputDirectory(outputDirectory)
  const jsonPath = join(output, "development-verification-report.json")
  const markdownPath = join(output, "development-verification-report.md")
  const incoming = report?.collectionVersion ? report.reports : [report]
  const validation = report?.collectionVersion ? validateDevelopmentReportCollection(report) : validateDevelopmentReport(report)
  if (!validation.valid) throw new Error(validation.errors.join("; "))
  const existing = await readExisting(jsonPath)
  if (existing) {
    const valid = existing.collectionVersion ? validateDevelopmentReportCollection(existing) : validateDevelopmentReport(existing)
    if (!valid.valid) throw new Error(`已有报告无效: ${valid.errors.join("; ")}`)
  }
  const project = incoming[0].input.project
  const merged = new Map()
  for (const item of [...(existing ? (existing.collectionVersion ? existing.reports : [existing]) : []), ...incoming]) {
    const normalized = (path) => process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path)
    if (normalized(item.input.project) !== normalized(project)) throw new Error("不能在同一报告中合并不同工程")
    merged.set(reportKey(item), structuredClone(item))
  }
  const collection = { collectionVersion: "1.0", mode: "code-development-validation", project, reports: [...merged.values()] }
  await mkdir(output, { recursive: true })
  for (const item of collection.reports) await preserveScreenshots(item, output)
  await writeFile(jsonPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8")
  await writeFile(markdownPath, developmentReportCollectionMarkdown(collection, output), "utf8")
  return { jsonPath, markdownPath, reportCount: collection.reports.length }
}

const pendingRenders = new Map()
export async function renderDevelopmentReport(report, outputDirectory) {
  const key = resolveReportOutputDirectory(outputDirectory)
  const previous = pendingRenders.get(key) ?? Promise.resolve()
  const current = previous.catch(() => {}).then(() => renderMergedReport(report, key))
  pendingRenders.set(key, current)
  try { return await current }
  finally { if (pendingRenders.get(key) === current) pendingRenders.delete(key) }
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input) throw new Error("用法: node render-development-report.mjs <report.json> [output-directory]")
  const result = await renderDevelopmentReport(JSON.parse(await readFile(input, "utf8")), output)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { pathToFileURL } from "node:url"
import { validateDevelopmentReport } from "./validate-development-report.mjs"

function text(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

export function developmentReportMarkdown(report) {
  const lines = [
    "# 代码开发验证报告",
    "",
    `- 总结果：\`${report.verdict.status}\``,
    `- 能力：${report.capabilityPackage.featureId} ${report.capabilityPackage.version}`,
    `- 场景：${report.capabilityPackage.scenarioId}`,
    `- 工程：${report.input.project}`,
    `- 目标：${report.input.goal}`,
    `- 能力包摘要：\`${report.capabilityPackage.digest}\``,
    "",
    report.verdict.summary,
    "",
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
  else for (const item of report.evidence) lines.push(`- ${item.id} [${item.type}] ${item.summary}${item.path ? ` — ${item.path}` : ""}`)
  if (report.capabilityPackage.conflictingFactRefs.length) {
    lines.push("", "## 规范冲突披露", "", `能力包保留冲突事实：${report.capabilityPackage.conflictingFactRefs.join("、")}。本次匹配：${report.verdict.matchedFactRefs.join("、") || "未确定"}。`)
  }
  return `${lines.join("\n")}\n`
}

export async function renderDevelopmentReport(report, outputDirectory) {
  const validation = validateDevelopmentReport(report)
  if (!validation.valid) throw new Error(validation.errors.join("; "))
  if (!isAbsolute(outputDirectory)) throw new Error("输出目录必须是绝对路径")
  await mkdir(outputDirectory, { recursive: true })
  const jsonPath = join(outputDirectory, "development-verification-report.json")
  const markdownPath = join(outputDirectory, "development-verification-report.md")
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  await writeFile(markdownPath, developmentReportMarkdown(report), "utf8")
  return { jsonPath, markdownPath }
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error("用法: node render-development-report.mjs <report.json> <绝对输出目录>")
  const result = await renderDevelopmentReport(JSON.parse(await readFile(input, "utf8")), output)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

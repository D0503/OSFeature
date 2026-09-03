#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"
import { validateReport } from "./validate-report.mjs"

function escapeCell(value) {
  return String(value ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")
}

function mdLink(value) {
  if (/^https:\/\//i.test(value)) return `[${escapeCell(value)}](${value})`
  return `\`${String(value).replace(/`/g, "\\`")}\``
}

export function renderMarkdown(report) {
  const lines = [
    "# HarmonyOS 文档质量审查报告",
    "",
    `- 结论：${report.verdict.label}`,
    `- 总分：${report.verdict.score ?? "证据不足，未评分"}`,
    `- 接入门禁：\`${report.integrationGate}\``,
    `- 输入：${mdLink(report.input.value)}`,
    `- 审查来源数：${report.input.reviewedSources}`,
    "",
    report.verdict.summary,
    "",
    "## 源完整性",
    "",
    `状态：\`${report.sourceIntegrity.status}\`；使用内部快照索引：${report.sourceIntegrity.manifestUsed ? "是" : "否"}。`,
  ]
  if (report.sourceIntegrity.warnings.length) {
    lines.push("", ...report.sourceIntegrity.warnings.map((item) => `- ${item}`))
  }
  lines.push("", "## 维度评分", "", "| 维度 | 权重 | 得分 | 说明 |", "|---|---:|---:|---|")
  for (const item of report.dimensions) lines.push(`| ${escapeCell(item.name)} | ${item.weight} | ${item.score ?? "—"} | ${escapeCell(item.notes)} |`)

  lines.push("", "## Findings", "")
  if (!report.findings.length) lines.push("未发现问题。")
  for (const finding of report.findings) {
    lines.push(
      `### ${finding.id} · ${finding.title}`,
      "",
      `- 维度：\`${finding.dimension}\``,
      `- 状态 / 严重度 / 置信度：\`${finding.status}\` / \`${finding.severity}\` / \`${finding.confidence}\``,
      `- 位置：${mdLink(finding.location.source)} · ${finding.location.section}${finding.location.line ? `:${finding.location.line}` : ""}`,
      `- 原文：${finding.location.quote}`,
      `- 被检验主张：${finding.claim}`,
      `- 证据：${finding.evidenceRefs.map((item) => `\`${item}\``).join("、")}`,
      "",
      finding.analysis,
      "",
      `影响：${finding.impact}`,
      "",
      `建议：${finding.recommendation}`,
    )
    if (finding.suggestedRewrite) lines.push("", `建议改写：${finding.suggestedRewrite}`)
    lines.push("")
  }

  lines.push("## 待确认项", "")
  if (!report.pendingVerifications.length) lines.push("无。")
  else {
    lines.push("| ID | 优先级 | 主张 | 原因 | 所需证据 |", "|---|---|---|---|---|")
    for (const item of report.pendingVerifications) {
      lines.push(`| ${escapeCell(item.id)} | ${escapeCell(item.priority)} | ${escapeCell(item.claim)} | ${escapeCell(item.reason)} | ${escapeCell(item.requiredEvidence)} |`)
    }
  }

  lines.push("", "## 证据索引", "", "| ID | 类型 | 来源 | 定位 | 版本 | 抓取/验证时间 |", "|---|---|---|---|---|---|")
  for (const item of report.evidence) {
    lines.push(`| ${item.id} | ${item.type} | ${mdLink(item.source)} | ${escapeCell(item.locator)} | ${escapeCell(item.version)} | ${escapeCell(item.capturedAt)} |`)
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}

export async function renderReport(report, outputDirectory) {
  const validation = validateReport(report)
  if (!validation.valid) throw new Error(`报告校验失败:\n- ${validation.errors.join("\n- ")}`)
  if (!outputDirectory || typeof outputDirectory !== "string") throw new Error("必须显式指定输出目录")
  const output = resolve(outputDirectory)
  await mkdir(output, { recursive: true })
  const jsonPath = join(output, "review-report.json")
  const markdownPath = join(output, "review-report.md")
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  await writeFile(markdownPath, renderMarkdown(report), "utf8")
  return { jsonPath, markdownPath }
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error("用法: node render-report.mjs <review-report.json> <explicit-output-directory>")
  const report = JSON.parse(await readFile(input, "utf8"))
  const result = await renderReport(report, output)
  process.stdout.write(`${JSON.stringify({ status: "rendered", ...result })}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

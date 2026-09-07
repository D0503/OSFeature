#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { validateDevelopmentReport } from "./validate-development-report.mjs"
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
      if (basis.type === "capability_fact") {
        lines.push(`- 能力包依据（${report.capabilityPackage.version}）：${basis.reason}`)
        for (const id of basis.factRefs) {
          const fact = normativeBasis.find((item) => item.id === id)
          lines.push(`  - ${id}：${fact.statement}（${fact.normativeStatus}）`)
          for (const source of fact.sources) lines.push(`    - ${source.officialUrl ? `[${source.title ?? source.snapshotId}](${source.officialUrl})` : `${source.snapshotId}（官网链接缺失）`} · ${source.locator} · SHA-256：\`${source.sha256}\``)
        }
      } else lines.push(`- ${basis.type === "engineering_choice" ? "工程配套选择" : "依据待确认"}：${basis.reason}`)
    }
    for (const issue of step.issues) lines.push(`- 待确认：${issue}`)
    lines.push("")
  }
  if (normativeBasis.length) lines.push("以上规范依据来自能力包收录的官网快照；SDK、构建和设备结果见分层验证证据。", "")
  const conflicts = normativeBasis.filter((fact) => fact.normativeStatus === "conflicting")
  if (conflicts.length) {
    lines.push("冲突规范与待验证预期：", "")
    for (const fact of conflicts) {
      lines.push(`- ${fact.id}（${fact.usage === "direct" ? "步骤引用" : "关联冲突"}）：${fact.statement}`)
      for (const source of fact.sources) lines.push(`  - ${source.officialUrl ? `[${source.title ?? source.snapshotId}](${source.officialUrl})` : `${source.snapshotId}（官网链接缺失）`} · ${source.locator} · SHA-256：\`${source.sha256}\``)
    }
    lines.push("", "上述预期仍需逐项对照实际行为；步骤中的实施选择不裁决规范真值。", "")
  }
  if (implementation.uncoveredChanges.length) lines.push("未被实施步骤覆盖的变更文件：", "", ...implementation.uncoveredChanges.map((path) => `- \`${path}\``), "")
  return lines
}

export function developmentReportMarkdown(report) {
  const lines = [
    "# 代码开发验证报告",
    "",
    `- 总结果：\`${report.verdict.status}\``,
    `- 能力：${report.capabilityPackage.featureId} ${report.capabilityPackage.version}`,
    `- 技术路线：${report.capabilityPackage.route}`,
    `- 场景：${report.capabilityPackage.scenarioId}`,
    `- 工程：${report.input.project}`,
    `- 目标：${report.input.goal}`,
    `- 能力包摘要：\`${report.capabilityPackage.digest}\``,
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
  else for (const item of report.evidence) lines.push(`- ${item.id} [${item.type}] ${item.summary}${item.path ? ` — ${item.path}` : ""}`)
  if (report.capabilityPackage.conflictingFactRefs.length) {
    lines.push("", "## 规范冲突披露", "", `能力包保留冲突事实：${report.capabilityPackage.conflictingFactRefs.join("、")}。本次匹配：${report.verdict.matchedFactRefs.join("、") || "未确定"}。`)
  }
  return `${lines.join("\n")}\n`
}

export async function renderDevelopmentReport(report, outputDirectory) {
  const validation = validateDevelopmentReport(report)
  if (!validation.valid) throw new Error(validation.errors.join("; "))
  const output = resolveReportOutputDirectory(outputDirectory)
  await mkdir(output, { recursive: true })
  const jsonPath = join(output, "development-verification-report.json")
  const markdownPath = join(output, "development-verification-report.md")
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  await writeFile(markdownPath, developmentReportMarkdown(report), "utf8")
  return { jsonPath, markdownPath }
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

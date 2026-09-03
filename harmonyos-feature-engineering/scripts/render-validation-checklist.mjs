#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { validateChecklistWithReview } from "./validate-validation-checklist.mjs"

function escapeCell(value) {
  return String(value ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")
}

function mdSource(value) {
  if (/^https:\/\//i.test(value)) return `[${escapeCell(value)}](${value})`
  return `\`${String(value).replace(/`/g, "\\`")}\``
}

function numbered(items) {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["无。"]
}

export function renderValidationMarkdown(checklist) {
  const lines = [
    "# HarmonyOS 代码开发验证清单",
    "",
    "> 本文件是验证计划，不是验证结果；所有条目的初始状态只能是 `not_run` 或 `blocked`。",
    "",
    `- 特性：${checklist.input.feature}`,
    `- 文档输入：${mdSource(checklist.input.value)}`,
    `- 审查报告：${mdSource(checklist.input.reviewReport)}`,
    `- 审查门禁：\`${checklist.reviewGate}\``,
    `- 目标工程：${checklist.scope.targetProject ? mdSource(checklist.scope.targetProject) : "未指定"}`,
    `- 范围：${checklist.scope.description}`,
    "",
    "## 汇总",
    "",
    "| 工程事实 | 需开发验证 | 验证项 | 就绪 | 阻塞 |",
    "|---:|---:|---:|---:|---:|",
    `| ${checklist.summary.totalFacts} | ${checklist.summary.developmentFacts} | ${checklist.summary.checklistItems} | ${checklist.summary.readyItems} | ${checklist.summary.blockedItems} |`,
    "",
    "## 工程事实台账",
    "",
    "| ID | 角色 | 一致性 | 需开发验证 | 工程事实 | 来源 |",
    "|---|---|---|---|---|---|",
  ]
  for (const fact of checklist.engineeringFacts) {
    const sources = fact.sourceRefs.map((ref) => `${mdSource(ref.source)} · ${escapeCell(ref.section)}${ref.line ? `:${ref.line}` : ""}`).join("<br>")
    lines.push(`| ${fact.id} | ${fact.role} | ${fact.consistencyStatus} | ${fact.developmentValidationRequired ? "是" : "否"} | ${escapeCell(fact.statement)} | ${sources} |`)
  }

  lines.push("", "## 执行顺序", "")
  if (!checklist.executionOrder.length) lines.push("无需要代码开发验证的条目。")
  else for (const id of checklist.executionOrder) {
    const item = checklist.items.find((candidate) => candidate.id === id)
    lines.push(`- \`${id}\` ${item.title}（${item.environment}，${item.readiness}/${item.executionStatus}）`)
  }

  lines.push("", "## 验证项", "")
  for (const id of checklist.executionOrder) {
    const item = checklist.items.find((candidate) => candidate.id === id)
    lines.push(
      `### ${item.id} · ${item.title}`,
      "",
      `- 目的 / 类别：\`${item.purpose}\` / \`${item.category}\``,
      `- 环境：\`${item.environment}\``,
      `- 事实：${item.factRefs.map((ref) => `\`${ref}\``).join("、")}`,
      `- 审查问题：${item.reviewFindingRefs.length ? item.reviewFindingRefs.map((ref) => `\`${ref}\``).join("、") : "无"}`,
      `- 依赖：${item.dependencies.length ? item.dependencies.map((ref) => `\`${ref}\``).join("、") : "无"}`,
      `- 就绪 / 状态：\`${item.readiness}\` / \`${item.executionStatus}\``,
      `- 阻塞原因：${item.blockedBy.length ? item.blockedBy.map((reason) => `\`${reason}\``).join("、") : "无"}`,
      `- 失败是否阻断接入：${item.blocking ? "是" : "否"}`,
      "",
      "前置条件：",
      "",
      ...numbered(item.preconditions),
      "",
      "实现步骤：",
      "",
      ...numbered(item.implementationSteps),
      "",
      "负向用例：",
      "",
      ...numbered(item.negativeCases),
      "",
      "| 层级 | 目标 | 操作 | 文档预期 | 采集证据 |",
      "|---|---|---|---|---|",
    )
    for (const verification of item.verifications) {
      lines.push(`| ${verification.level} | ${escapeCell(verification.objective)} | ${escapeCell(verification.procedure)} | ${escapeCell(verification.expectedResult)} | ${escapeCell(verification.evidenceToCollect)} |`)
    }
    lines.push("")
  }

  lines.push(
    "## 覆盖与排除",
    "",
    `- 来源内容单元：${checklist.coverage.sourceUnits}`,
    `- 已进入事实台账：${checklist.coverage.representedSourceUnits}`,
    `- 需开发验证事实 / 已覆盖：${checklist.coverage.factsRequiringValidation} / ${checklist.coverage.factsCoveredByChecklist}`,
    "",
  )
  if (!checklist.coverage.exclusions.length) lines.push("无排除内容。")
  else {
    lines.push("| 来源 | 定位 | 单元数 | 排除理由 |", "|---|---|---:|---|")
    for (const item of checklist.coverage.exclusions) lines.push(`| ${mdSource(item.source)} | ${escapeCell(item.locator)} | ${item.unitCount} | ${escapeCell(item.reason)} |`)
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}

export async function renderValidationChecklist(checklist, outputDirectory) {
  const validation = await validateChecklistWithReview(checklist)
  if (!validation.valid) throw new Error(`验证清单校验失败:\n- ${validation.errors.join("\n- ")}`)
  if (!outputDirectory || typeof outputDirectory !== "string") throw new Error("必须显式指定输出目录")
  const output = resolve(outputDirectory)
  await mkdir(output, { recursive: true })
  const jsonPath = join(output, "development-validation-checklist.json")
  const markdownPath = join(output, "development-validation-checklist.md")
  await writeFile(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8")
  await writeFile(markdownPath, renderValidationMarkdown(checklist), "utf8")
  return { jsonPath, markdownPath }
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error("用法: node render-validation-checklist.mjs <development-validation-checklist.json> <explicit-output-directory>")
  const checklist = JSON.parse(await readFile(input, "utf8"))
  const result = await renderValidationChecklist(checklist, output)
  process.stdout.write(`${JSON.stringify({ status: "rendered", ...result })}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

#!/usr/bin/env node
// Validate the machine-readable review report contract. Zero dependencies.

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const VERDICTS = new Set(["合理", "基本合理但需小修", "需要修订", "不合理/高风险", "证据不足无法判断"])
const STATUSES = new Set(["confirmed", "likely", "ambiguous", "version_caveat", "editorial", "pending"])
const SEVERITIES = new Set(["Blocker", "High", "Medium", "Low", "Suggestion"])
const CONFIDENCES = new Set(["certain", "high", "medium", "low"])

function add(errors, condition, path, message) {
  if (!condition) errors.push({ path, message })
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

function validate(report) {
  const errors = []
  add(errors, report && typeof report === "object" && !Array.isArray(report), "$", "必须是 JSON 对象")
  if (!report || typeof report !== "object" || Array.isArray(report)) return errors
  add(errors, report.reportVersion === "1.0", "$.reportVersion", "当前只支持 1.0")
  add(errors, report.document && typeof report.document === "object", "$.document", "缺少文档元数据")
  if (report.document) {
    add(errors, nonEmpty(report.document.title), "$.document.title", "标题不能为空")
    add(errors, nonEmpty(report.document.source), "$.document.source", "来源不能为空")
    add(errors, nonEmpty(report.document.docType), "$.document.docType", "文档类型不能为空")
    add(errors, nonEmpty(report.document.versionContext), "$.document.versionContext", "版本上下文不能为空；未知时填写 unknown")
    add(errors, /^\d{4}-\d{2}-\d{2}$/.test(report.document.reviewedAt ?? ""), "$.document.reviewedAt", "必须为 YYYY-MM-DD")
  }
  add(errors, report.verdict && typeof report.verdict === "object", "$.verdict", "缺少结论")
  if (report.verdict) {
    add(errors, VERDICTS.has(report.verdict.label), "$.verdict.label", "结论枚举无效")
    add(errors, report.verdict.score === null || (Number.isFinite(report.verdict.score) && report.verdict.score >= 0 && report.verdict.score <= 100), "$.verdict.score", "必须为 0-100 或 null")
    add(errors, nonEmpty(report.verdict.rationale), "$.verdict.rationale", "必须说明结论依据")
    add(errors, Array.isArray(report.verdict.limitations), "$.verdict.limitations", "必须是数组")
    if (report.verdict.label === "证据不足无法判断") add(errors, report.verdict.score === null, "$.verdict.score", "证据不足时分数应为 null")
  }
  add(errors, Array.isArray(report.dimensions), "$.dimensions", "必须是数组")
  if (Array.isArray(report.dimensions)) {
    report.dimensions.forEach((item, index) => {
      add(errors, nonEmpty(item?.name), `$.dimensions[${index}].name`, "维度名不能为空")
      add(errors, item?.score === null || (Number.isFinite(item?.score) && item.score >= 0 && item.score <= 100), `$.dimensions[${index}].score`, "必须为 0-100 或 null")
      add(errors, nonEmpty(item?.notes), `$.dimensions[${index}].notes`, "必须说明评分依据")
    })
  }
  add(errors, Array.isArray(report.findings), "$.findings", "必须是数组")
  const ids = new Set()
  if (Array.isArray(report.findings)) {
    report.findings.forEach((finding, index) => {
      const base = `$.findings[${index}]`
      add(errors, /^DOC-\d{3,}$/.test(finding?.id ?? ""), `${base}.id`, "必须使用 DOC-001 格式")
      add(errors, !ids.has(finding?.id), `${base}.id`, "finding id 重复")
      ids.add(finding?.id)
      for (const field of ["title", "dimension", "analysis", "impact", "recommendation"]) add(errors, nonEmpty(finding?.[field]), `${base}.${field}`, "不能为空")
      add(errors, STATUSES.has(finding?.status), `${base}.status`, "状态枚举无效")
      add(errors, SEVERITIES.has(finding?.severity), `${base}.severity`, "严重度枚举无效")
      add(errors, CONFIDENCES.has(finding?.confidence), `${base}.confidence`, "置信度枚举无效")
      add(errors, finding?.location && nonEmpty(finding.location.section), `${base}.location.section`, "必须提供章节定位")
      add(errors, finding?.location && typeof finding.location.quote === "string", `${base}.location.quote`, "quote 必须是字符串，可为空")
      add(errors, Array.isArray(finding?.evidence), `${base}.evidence`, "必须是数组")
      if (Array.isArray(finding?.evidence)) {
        finding.evidence.forEach((evidence, evidenceIndex) => {
          for (const field of ["source", "locator", "claim"]) add(errors, nonEmpty(evidence?.[field]), `${base}.evidence[${evidenceIndex}].${field}`, "不能为空")
        })
      }
      if (finding?.status === "confirmed") {
        add(errors, ["certain", "high"].includes(finding?.confidence), `${base}.confidence`, "confirmed 需要 certain 或 high")
        add(errors, Array.isArray(finding?.evidence) && finding.evidence.length > 0, `${base}.evidence`, "confirmed 至少需要一条证据")
      }
      if (finding?.confidence === "low") add(errors, finding?.status !== "confirmed", `${base}.status`, "low 置信度不能标为 confirmed")
    })
  }
  add(errors, Array.isArray(report.pendingVerifications), "$.pendingVerifications", "必须是数组")
  return errors
}

async function main() {
  const input = process.argv[2]
  if (!input || process.argv.length !== 3) {
    process.stderr.write("用法: node validate-report.mjs <report.json>\n")
    process.exit(2)
  }
  let report
  try {
    report = JSON.parse(await readFile(resolve(input), "utf8"))
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "invalid", errors: [{ path: "$", message: error instanceof Error ? error.message : String(error) }] }, null, 2)}\n`)
    process.exit(2)
  }
  const errors = validate(report)
  const result = { status: errors.length ? "invalid" : "valid", findings: Array.isArray(report.findings) ? report.findings.length : 0, errors }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exit(errors.length ? 1 : 0)
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "invalid", errors: [{ path: "$", message: error instanceof Error ? error.stack ?? error.message : String(error) }] }, null, 2)}\n`)
  process.exit(2)
})


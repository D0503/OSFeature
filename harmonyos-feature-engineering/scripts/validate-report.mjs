#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

export const DIMENSIONS = [
  ["technical_correctness", "技术正确性", 25],
  ["version_compatibility", "版本兼容性", 12],
  ["completeness", "完整性", 10],
  ["consistency", "一致性", 10],
  ["context_clarity", "上下文清晰与歧义", 10],
  ["logic_information_architecture", "行文逻辑与信息架构", 10],
  ["developer_usability", "开发者易用性与可复现性", 15],
  ["links_resources", "链接资源", 5],
  ["security_compliance", "安全合规", 3],
]

export const REVIEW_VERSION = "1.1"

const STATUS = new Set(["confirmed", "likely", "ambiguous", "version_caveat", "editorial", "pending"])
const SEVERITY = new Set(["Blocker", "High", "Medium", "Low", "Suggestion"])
const CONFIDENCE = new Set(["certain", "high", "medium", "low"])
const CLAIM_SCOPE = new Set(["internal_consistency", "external_technical", "editorial"])
const EVIDENCE_TYPE = new Set(["target", "internal", "official_api", "official_guide", "sdk", "build", "simulator", "device"])
const EXTERNAL_EVIDENCE = new Set(["official_api", "official_guide", "sdk", "build", "simulator", "device"])
const VERDICT = new Set(["不合格", "证据不足", "基本合格但需修改", "合格但有提示", "合格"])
const GATE = new Set(["blocked", "insufficient_evidence", "pass_with_warnings", "pass"])
const GATE_VERDICTS = {
  blocked: new Set(["不合格"]),
  insufficient_evidence: new Set(["证据不足"]),
  pass_with_warnings: new Set(["基本合格但需修改", "合格但有提示"]),
  pass: new Set(["合格"]),
}
const INTERNAL_SCOPE_AXES = ["version", "mode", "component", "condition", "environment", "lifecycle"]

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function requiredString(value, path, errors) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${path} 必须是非空字符串`)
}

function nullableIsoDate(value, path, errors) {
  if (value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) errors.push(`${path} 必须是 ISO 日期字符串或 null`)
}

function nullableHash(value, path, errors) {
  if (value !== null && (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value))) errors.push(`${path} 必须是 64 位 SHA-256 或 null`)
}

function referencedEvidence(finding, evidenceById) {
  return Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs.map((id) => evidenceById.get(id)).filter(Boolean) : []
}

function normalizedText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function validateInternalConflict(finding, path, evidenceById, errors) {
  const conflict = finding.internalConflict
  if (!object(conflict)) {
    errors.push(`${path} 的 confirmed 内部冲突必须提供 internalConflict`)
    return
  }
  requiredString(conflict.subject, `${path}.internalConflict.subject`, errors)
  requiredString(conflict.incompatibility, `${path}.internalConflict.incompatibility`, errors)

  const sides = {}
  for (const sideName of ["left", "right"]) {
    const sidePath = `${path}.internalConflict.${sideName}`
    const side = conflict[sideName]
    sides[sideName] = side
    if (!object(side)) {
      errors.push(`${sidePath} 必须是对象`)
      continue
    }
    requiredString(side.evidenceRef, `${sidePath}.evidenceRef`, errors)
    requiredString(side.statement, `${sidePath}.statement`, errors)
    requiredString(side.outcome, `${sidePath}.outcome`, errors)
    if (typeof side.evidenceRef === "string") {
      if (!finding.evidenceRefs.includes(side.evidenceRef)) errors.push(`${sidePath}.evidenceRef 必须包含在 finding.evidenceRefs 中`)
      const evidence = evidenceById.get(side.evidenceRef)
      if (!evidence || !["target", "internal"].includes(evidence.type)) errors.push(`${sidePath}.evidenceRef 必须引用 target/internal 证据`)
      else if (normalizedText(side.statement) !== normalizedText(evidence.claim)) errors.push(`${sidePath}.statement 必须与所引内部证据的原子主张一致`)
    }
    if (!object(side.scope)) {
      errors.push(`${sidePath}.scope 必须是对象`)
      continue
    }
    for (const axis of INTERNAL_SCOPE_AXES) {
      if (!(axis in side.scope)) errors.push(`${sidePath}.scope.${axis} 必须显式提供字符串或 null`)
      else if (side.scope[axis] !== null) requiredString(side.scope[axis], `${sidePath}.scope.${axis}`, errors)
    }
  }

  const left = sides.left
  const right = sides.right
  if (!object(left) || !object(right)) return
  if (left.evidenceRef === right.evidenceRef) errors.push(`${path}.internalConflict 两侧必须引用不同证据`)
  if (object(left.scope) && object(right.scope)) {
    for (const axis of INTERNAL_SCOPE_AXES) {
      if (!(axis in left.scope) || !(axis in right.scope)) continue
      const leftValue = left.scope[axis] === null ? null : normalizedText(left.scope[axis])
      const rightValue = right.scope[axis] === null ? null : normalizedText(right.scope[axis])
      if (leftValue !== rightValue) errors.push(`${path}.internalConflict.scope.${axis} 未对齐，不能标记 confirmed/internal_consistency`)
    }
  }
  if (normalizedText(left.outcome) === normalizedText(right.outcome)) errors.push(`${path}.internalConflict 两侧结果必须互斥`)
  const locationQuote = normalizedText(finding.location?.quote)
  if (locationQuote && ![left.statement, right.statement].some((statement) => normalizedText(statement).includes(locationQuote))) {
    errors.push(`${path}.location.quote 必须锚定 internalConflict 的一侧原子主张`)
  }
}

export function deriveIntegrationGate(report) {
  const findings = Array.isArray(report.findings) ? report.findings : []
  if (
    findings.some((item) => item.status === "confirmed" && item.severity === "Blocker") ||
    findings.some((item) => item.integrationAffecting === true && item.severity === "High" && ["confirmed", "likely"].includes(item.status))
  ) return "blocked"

  const evidenceById = new Map((Array.isArray(report.evidence) ? report.evidence : []).map((item) => [item.id, item]))
  const technical = (Array.isArray(report.dimensions) ? report.dimensions : []).find((item) => item.id === "technical_correctness")
  const insufficient = report.sourceIntegrity?.status === "failed" || technical?.score === null || findings.some((item) => {
    if (item.coreTechnicalClaim !== true || item.claimScope !== "external_technical") return false
    const external = referencedEvidence(item, evidenceById).filter((evidence) => EXTERNAL_EVIDENCE.has(evidence.type))
    return item.status !== "confirmed" && !external.some((evidence) => evidence.version !== null)
  }) || (Array.isArray(report.pendingVerifications) && report.pendingVerifications.some((item) => item.priority === "high"))
  if (insufficient) return "insufficient_evidence"

  if (findings.some((item) => ["High", "Medium", "Low"].includes(item.severity) || ["pending", "ambiguous", "version_caveat"].includes(item.status))) {
    return "pass_with_warnings"
  }
  return "pass"
}

export function validateReport(report) {
  const errors = []
  if (!object(report)) return { valid: false, errors: ["报告根节点必须是对象"] }
  if (report.reviewVersion !== REVIEW_VERSION) errors.push(`reviewVersion 必须为 ${REVIEW_VERSION}`)
  if (report.mode !== "document-review") errors.push("mode 必须为 document-review")

  if (!object(report.input)) errors.push("input 必须是对象")
  else {
    if (!["file", "directory", "url"].includes(report.input.kind)) errors.push("input.kind 枚举无效")
    requiredString(report.input.value, "input.value", errors)
    if (!Number.isInteger(report.input.reviewedSources) || report.input.reviewedSources < 1) errors.push("input.reviewedSources 必须是正整数")
  }

  if (!object(report.sourceIntegrity)) errors.push("sourceIntegrity 必须是对象")
  else {
    if (!["verified", "partial", "failed"].includes(report.sourceIntegrity.status)) errors.push("sourceIntegrity.status 枚举无效")
    if (typeof report.sourceIntegrity.manifestUsed !== "boolean") errors.push("sourceIntegrity.manifestUsed 必须是布尔值")
    if (!Array.isArray(report.sourceIntegrity.items)) errors.push("sourceIntegrity.items 必须是数组")
    else report.sourceIntegrity.items.forEach((item, index) => {
      if (!object(item)) {
        errors.push(`sourceIntegrity.items[${index}] 必须是对象`)
        return
      }
      requiredString(item.source, `sourceIntegrity.items[${index}].source`, errors)
      nullableIsoDate(item.capturedAt, `sourceIntegrity.items[${index}].capturedAt`, errors)
      nullableHash(item.sha256, `sourceIntegrity.items[${index}].sha256`, errors)
    })
    if (!Array.isArray(report.sourceIntegrity.warnings)) errors.push("sourceIntegrity.warnings 必须是数组")
  }

  if (!object(report.verdict)) errors.push("verdict 必须是对象")
  else {
    if (!VERDICT.has(report.verdict.label)) errors.push("verdict.label 枚举无效")
    if (report.verdict.score !== null && (!Number.isInteger(report.verdict.score) || report.verdict.score < 0 || report.verdict.score > 100)) {
      errors.push("verdict.score 必须是 0–100 的整数或 null")
    }
    requiredString(report.verdict.summary, "verdict.summary", errors)
  }

  if (!GATE.has(report.integrationGate)) errors.push("integrationGate 枚举无效")

  if (!Array.isArray(report.dimensions) || report.dimensions.length !== DIMENSIONS.length) errors.push("dimensions 必须恰好包含九个维度")
  else {
    report.dimensions.forEach((item, index) => {
      const expected = DIMENSIONS[index]
      if (!object(item)) {
        errors.push(`dimensions[${index}] 必须是对象`)
        return
      }
      if (item.id !== expected[0]) errors.push(`dimensions[${index}].id 必须为 ${expected[0]}`)
      if (item.name !== expected[1]) errors.push(`dimensions[${index}].name 必须为 ${expected[1]}`)
      if (item.weight !== expected[2]) errors.push(`dimensions[${index}].weight 必须为 ${expected[2]}`)
      if (item.score !== null && (typeof item.score !== "number" || item.score < 0 || item.score > 100)) errors.push(`dimensions[${index}].score 超出范围`)
      requiredString(item.notes, `dimensions[${index}].notes`, errors)
    })
    if (report.dimensions.every((item) => typeof item?.score === "number")) {
      const expectedScore = Math.round(report.dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / 100)
      if (report.verdict?.score !== expectedScore) errors.push(`verdict.score 应为加权总分 ${expectedScore}`)
    } else if (report.verdict?.score !== null) errors.push("存在未评分维度时 verdict.score 必须为 null")
  }

  const evidenceById = new Map()
  if (!Array.isArray(report.evidence)) errors.push("evidence 必须是数组")
  else report.evidence.forEach((item, index) => {
    const path = `evidence[${index}]`
    if (!object(item)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof item.id !== "string" || !/^EVID-\d{3,}$/.test(item.id)) errors.push(`${path}.id 格式无效`)
    else if (evidenceById.has(item.id)) errors.push(`${path}.id 重复`)
    else evidenceById.set(item.id, item)
    if (!EVIDENCE_TYPE.has(item.type)) errors.push(`${path}.type 枚举无效`)
    requiredString(item.source, `${path}.source`, errors)
    requiredString(item.locator, `${path}.locator`, errors)
    requiredString(item.claim, `${path}.claim`, errors)
    if (item.version !== null) requiredString(item.version, `${path}.version`, errors)
    nullableIsoDate(item.capturedAt, `${path}.capturedAt`, errors)
    nullableHash(item.sha256, `${path}.sha256`, errors)
  })

  const findingIds = new Set()
  if (!Array.isArray(report.findings)) errors.push("findings 必须是数组")
  else report.findings.forEach((item, index) => {
    const path = `findings[${index}]`
    if (!object(item)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof item.id !== "string" || !/^DOC-\d{3,}$/.test(item.id)) errors.push(`${path}.id 格式无效`)
    else if (findingIds.has(item.id)) errors.push(`${path}.id 重复`)
    else findingIds.add(item.id)
    requiredString(item.title, `${path}.title`, errors)
    if (!DIMENSIONS.some(([id]) => id === item.dimension)) errors.push(`${path}.dimension 枚举无效`)
    if (!STATUS.has(item.status)) errors.push(`${path}.status 枚举无效`)
    if (!SEVERITY.has(item.severity)) errors.push(`${path}.severity 枚举无效`)
    if (!CONFIDENCE.has(item.confidence)) errors.push(`${path}.confidence 枚举无效`)
    if (typeof item.integrationAffecting !== "boolean") errors.push(`${path}.integrationAffecting 必须是布尔值`)
    if (typeof item.coreTechnicalClaim !== "boolean") errors.push(`${path}.coreTechnicalClaim 必须是布尔值`)
    if (!CLAIM_SCOPE.has(item.claimScope)) errors.push(`${path}.claimScope 枚举无效`)
    if (!object(item.location)) errors.push(`${path}.location 必须是对象`)
    else {
      requiredString(item.location.source, `${path}.location.source`, errors)
      requiredString(item.location.section, `${path}.location.section`, errors)
      if (item.location.line !== null && (!Number.isInteger(item.location.line) || item.location.line < 1)) errors.push(`${path}.location.line 必须是正整数或 null`)
      requiredString(item.location.quote, `${path}.location.quote`, errors)
    }
    for (const field of ["claim", "analysis", "impact", "recommendation"]) requiredString(item[field], `${path}.${field}`, errors)
    if (item.suggestedRewrite !== undefined) requiredString(item.suggestedRewrite, `${path}.suggestedRewrite`, errors)
    if (!Array.isArray(item.evidenceRefs) || !item.evidenceRefs.length) errors.push(`${path}.evidenceRefs 必须是非空数组`)
    else {
      for (const id of item.evidenceRefs) if (!evidenceById.has(id)) errors.push(`${path}.evidenceRefs 引用了不存在的 ${id}`)
      const linked = item.evidenceRefs.map((id) => evidenceById.get(id)).filter(Boolean)
      if (item.status === "confirmed" && item.claimScope === "external_technical") {
        const external = linked.filter((evidence) => EXTERNAL_EVIDENCE.has(evidence.type))
        if (!external.length) errors.push(`${path} 的 confirmed 外部技术结论缺少独立证据`)
        if (!external.some((evidence) => evidence.version !== null)) errors.push(`${path} 的 confirmed 外部技术结论缺少同版本证据`)
      }
      if (item.status === "confirmed" && item.claimScope === "internal_consistency") {
        const internal = linked.filter((evidence) => ["target", "internal"].includes(evidence.type))
        const uniqueLocations = new Set(internal.map((evidence) => `${evidence.source}#${evidence.locator}`))
        if (uniqueLocations.size < 2) errors.push(`${path} 的 confirmed 内部冲突需要两个独立原文位置`)
        validateInternalConflict(item, path, evidenceById, errors)
      }
    }
    if (item.internalConflict !== undefined && !(item.status === "confirmed" && item.claimScope === "internal_consistency")) {
      errors.push(`${path}.internalConflict 仅用于 confirmed/internal_consistency`)
    }
  })

  if (!Array.isArray(report.pendingVerifications)) errors.push("pendingVerifications 必须是数组")
  else report.pendingVerifications.forEach((item, index) => {
    const path = `pendingVerifications[${index}]`
    if (!object(item)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    requiredString(item.id, `${path}.id`, errors)
    for (const field of ["claim", "reason", "requiredEvidence"]) requiredString(item[field], `${path}.${field}`, errors)
    if (!["high", "medium", "low"].includes(item.priority)) errors.push(`${path}.priority 枚举无效`)
  })

  if (GATE.has(report.integrationGate)) {
    const expectedGate = deriveIntegrationGate(report)
    if (report.integrationGate !== expectedGate) errors.push(`integrationGate 应为 ${expectedGate}`)
    if (VERDICT.has(report.verdict?.label) && !GATE_VERDICTS[report.integrationGate].has(report.verdict.label)) {
      errors.push(`verdict.label 与 ${report.integrationGate} 门禁不一致`)
    }
  }
  return { valid: errors.length === 0, errors }
}

async function main() {
  const input = process.argv[2]
  if (!input) throw new Error("用法: node validate-report.mjs <review-report.json>")
  const report = JSON.parse(await readFile(input, "utf8"))
  const result = validateReport(report)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.valid) process.exitCode = 1
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error instanceof Error ? error.message : String(error)] }, null, 2)}\n`)
    process.exitCode = 2
  })
}

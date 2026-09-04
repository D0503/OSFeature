#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { isAbsolute } from "node:path"
import { pathToFileURL } from "node:url"
import { isDeepStrictEqual } from "node:util"
import { validateReport } from "./validate-report.mjs"

export const FACT_ROLES = new Set([
  "requirement", "constraint", "configuration", "api_contract", "code_example",
  "expected_behavior", "exception", "diagnostic", "context", "resource",
])
export const CONSISTENCY = new Set(["consistent", "conflicting", "ambiguous", "pending_review"])
export const PURPOSES = new Set([
  "normative_resolution", "sdk_conformance", "integration_validation",
  "compatibility_validation", "nonfunctional_validation",
])
export const CATEGORIES = new Set([
  "document_conflict", "api_availability", "configuration", "component_integration",
  "state_transition", "visual_behavior", "compatibility", "fallback", "performance",
  "recovery", "regression",
])
export const VERIFICATION_LEVELS = new Set(["static", "sdk", "build", "simulator", "device"])

const INPUT_KINDS = new Set(["file", "directory", "url"])
const INTEGRITY = new Set(["verified", "partial", "failed"])
const GATES = new Set(["blocked", "insufficient_evidence", "pass_with_warnings", "pass"])
const ENVIRONMENTS = new Set(["minimal_project", "target_project"])
const READINESS = new Set(["ready", "blocked"])
const FACT_GATE_STATUS = new Set(["usable", "requires_resolution"])
const RESOLUTION_PURPOSES = new Set(["normative_resolution", "sdk_conformance", "compatibility_validation"])
const BLOCKED_BY = new Set(["fact_gate", "target_project", "sdk", "device"])
const EXECUTION_STATUS = new Set(["not_run", "blocked"])
const SDK_REQUIRED = new Set(["api_availability", "configuration", "compatibility"])
const RUNTIME_REQUIRED = new Set(["component_integration", "state_transition", "visual_behavior", "fallback", "recovery", "regression"])
const EXTERNAL_EVIDENCE = new Set(["official_api", "official_guide", "sdk", "build", "simulator", "device"])
const INTERNAL_PROMPT_ID = /\b(?:DEVVAL|FACT|DOC)-\d{3,}\b|\bIL-[FSO]\d{3,}\b/i
const INTERNAL_PROMPT_TERMS = /审查报告|验证清单|工程事实编号|审查问题编号|能力包场景(?:编号|ID)|reviewFindingRefs|resolutionFactRefs|expectedOutcomes|factRefs/i
const CONTEXT_DEPENDENT_PROMPT = /(?:根据|按照|执行|参考)(?:上述|上面的|前述|本清单|该清单|本条目|该条目|本验证项|该验证项)/

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function requiredString(value, path, errors) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${path} 必须是非空字符串`)
}

function validateDeveloperPrompt(value, path, errors) {
  requiredString(value, path, errors)
  if (typeof value !== "string") return
  const prompt = value.trim()
  if (prompt.length < 12) errors.push(`${path} 必须是可独立理解的自然开发请求，不能过短`)
  if (prompt.length > 500) errors.push(`${path} 不得超过 500 个字符`)
  if (INTERNAL_PROMPT_ID.test(prompt)) errors.push(`${path} 不得包含 DEVVAL/FACT/DOC 或能力包内部场景 ID`)
  if (INTERNAL_PROMPT_TERMS.test(prompt)) errors.push(`${path} 不得包含评测内部字段或产物名称`)
  if (CONTEXT_DEPENDENT_PROMPT.test(prompt)) errors.push(`${path} 不得依赖未随提示词发送的清单或条目上下文`)
}

function stringArray(value, path, errors, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} 必须是数组`)
    return
  }
  if (nonEmpty && value.length === 0) errors.push(`${path} 必须是非空数组`)
  value.forEach((item, index) => requiredString(item, `${path}[${index}]`, errors))
}

function nullableIsoDate(value, path, errors) {
  if (value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) errors.push(`${path} 必须是 ISO 日期字符串或 null`)
}

function nullableHash(value, path, errors) {
  if (value !== null && (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value))) errors.push(`${path} 必须是 64 位 SHA-256 或 null`)
}

function validateSourceRef(item, path, errors) {
  if (!object(item)) {
    errors.push(`${path} 必须是对象`)
    return
  }
  requiredString(item.source, `${path}.source`, errors)
  requiredString(item.section, `${path}.section`, errors)
  if (item.line !== null && (!Number.isInteger(item.line) || item.line < 1)) errors.push(`${path}.line 必须是正整数或 null`)
  requiredString(item.quote, `${path}.quote`, errors)
  nullableHash(item.sha256, `${path}.sha256`, errors)
}

function validateSourceIntegrity(sourceIntegrity, errors) {
  if (!object(sourceIntegrity)) {
    errors.push("sourceIntegrity 必须是对象")
    return
  }
  if (!INTEGRITY.has(sourceIntegrity.status)) errors.push("sourceIntegrity.status 枚举无效")
  if (typeof sourceIntegrity.manifestUsed !== "boolean") errors.push("sourceIntegrity.manifestUsed 必须是布尔值")
  if (!Array.isArray(sourceIntegrity.items)) errors.push("sourceIntegrity.items 必须是数组")
  else sourceIntegrity.items.forEach((item, index) => {
    const path = `sourceIntegrity.items[${index}]`
    if (!object(item)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    requiredString(item.source, `${path}.source`, errors)
    nullableIsoDate(item.capturedAt, `${path}.capturedAt`, errors)
    nullableHash(item.sha256, `${path}.sha256`, errors)
  })
  stringArray(sourceIntegrity.warnings, "sourceIntegrity.warnings", errors)
}

function hasCycle(itemsById) {
  const visiting = new Set()
  const visited = new Set()
  const visit = (id) => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const item = itemsById.get(id)
    for (const dependency of item?.dependencies ?? []) if (itemsById.has(dependency) && visit(dependency)) return true
    visiting.delete(id)
    visited.add(id)
    return false
  }
  return [...itemsById.keys()].some(visit)
}

function uniqueInOrder(values) {
  return [...new Set(values)]
}

function linkedFindingIds(fact) {
  return Array.isArray(fact?.reviewFindingRefs) ? fact.reviewFindingRefs : []
}

function findingBlocksFact(finding, evidenceById) {
  if (!object(finding)) return false
  if (finding.status === "confirmed" && finding.severity === "Blocker") return true
  if (finding.integrationAffecting === true && finding.severity === "High" && ["confirmed", "likely"].includes(finding.status)) return true
  if (finding.coreTechnicalClaim !== true || finding.claimScope !== "external_technical" || finding.status === "confirmed") return false
  const versionedExternalEvidence = (finding.evidenceRefs ?? [])
    .map((id) => evidenceById.get(id))
    .some((evidence) => evidence && EXTERNAL_EVIDENCE.has(evidence.type) && evidence.version !== null)
  return !versionedExternalEvidence
}

function deriveFactGate(fact, report, findingsById, evidenceById) {
  const technical = (report.dimensions ?? []).find((item) => item.id === "technical_correctness")
  const globalEvidenceFailure = report.sourceIntegrity?.status === "failed" || technical?.score === null
  const unresolvedConsistency = ["conflicting", "ambiguous", "pending_review"].includes(fact.consistencyStatus)
  const blockingFindingRefs = uniqueInOrder(linkedFindingIds(fact).filter((id) => unresolvedConsistency || findingBlocksFact(findingsById.get(id), evidenceById)))
  return {
    status: globalEvidenceFailure || unresolvedConsistency || blockingFindingRefs.length ? "requires_resolution" : "usable",
    findingRefs: blockingFindingRefs,
  }
}

export function validateValidationChecklist(checklist) {
  const errors = []
  if (!object(checklist)) return { valid: false, errors: ["清单根节点必须是对象"] }
  if (checklist.checklistVersion !== "1.2") errors.push("checklistVersion 必须为 1.2")
  if (checklist.mode !== "development-validation-planning") errors.push("mode 必须为 development-validation-planning")

  if (!object(checklist.input)) errors.push("input 必须是对象")
  else {
    if (!INPUT_KINDS.has(checklist.input.kind)) errors.push("input.kind 枚举无效")
    requiredString(checklist.input.value, "input.value", errors)
    requiredString(checklist.input.feature, "input.feature", errors)
    requiredString(checklist.input.reviewReport, "input.reviewReport", errors)
    if (typeof checklist.input.reviewReport === "string" && !isAbsolute(checklist.input.reviewReport)) errors.push("input.reviewReport 必须是绝对路径")
    nullableHash(checklist.input.reviewReportSha256, "input.reviewReportSha256", errors)
  }

  validateSourceIntegrity(checklist.sourceIntegrity, errors)
  if (!GATES.has(checklist.reviewGate)) errors.push("reviewGate 枚举无效")

  if (!object(checklist.scope)) errors.push("scope 必须是对象")
  else {
    requiredString(checklist.scope.description, "scope.description", errors)
    if (checklist.scope.targetProject !== null) {
      requiredString(checklist.scope.targetProject, "scope.targetProject", errors)
      if (typeof checklist.scope.targetProject === "string" && !isAbsolute(checklist.scope.targetProject)) errors.push("scope.targetProject 必须是绝对路径或 null")
    }
    if (!Array.isArray(checklist.scope.environments) || !checklist.scope.environments.length) errors.push("scope.environments 必须是非空数组")
    else {
      const unique = new Set(checklist.scope.environments)
      if (unique.size !== checklist.scope.environments.length) errors.push("scope.environments 不得重复")
      for (const environment of unique) if (!ENVIRONMENTS.has(environment)) errors.push(`scope.environments 包含无效值 ${environment}`)
    }
    stringArray(checklist.scope.requestedFocus, "scope.requestedFocus", errors)
  }

  const factsById = new Map()
  if (!Array.isArray(checklist.engineeringFacts)) errors.push("engineeringFacts 必须是数组")
  else checklist.engineeringFacts.forEach((fact, index) => {
    const path = `engineeringFacts[${index}]`
    if (!object(fact)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof fact.id !== "string" || !/^FACT-\d{3,}$/.test(fact.id)) errors.push(`${path}.id 格式无效`)
    else if (factsById.has(fact.id)) errors.push(`${path}.id 重复`)
    else factsById.set(fact.id, fact)
    requiredString(fact.statement, `${path}.statement`, errors)
    if (!FACT_ROLES.has(fact.role)) errors.push(`${path}.role 枚举无效`)
    if (!CONSISTENCY.has(fact.consistencyStatus)) errors.push(`${path}.consistencyStatus 枚举无效`)
    stringArray(fact.reviewFindingRefs, `${path}.reviewFindingRefs`, errors)
    if (Array.isArray(fact.reviewFindingRefs)) for (const id of fact.reviewFindingRefs) if (!/^DOC-\d{3,}$/.test(id)) errors.push(`${path}.reviewFindingRefs 中 ${id} 格式无效`)
    if (fact.consistencyStatus === "conflicting" && !fact.reviewFindingRefs?.length) errors.push(`${path} 的 conflicting 事实必须关联审查 finding`)
    if (!object(fact.gate)) errors.push(`${path}.gate 必须是对象`)
    else {
      if (!FACT_GATE_STATUS.has(fact.gate.status)) errors.push(`${path}.gate.status 枚举无效`)
      stringArray(fact.gate.findingRefs, `${path}.gate.findingRefs`, errors)
      if (Array.isArray(fact.gate.findingRefs)) {
        if (new Set(fact.gate.findingRefs).size !== fact.gate.findingRefs.length) errors.push(`${path}.gate.findingRefs 不得重复`)
        for (const id of fact.gate.findingRefs) {
          if (!/^DOC-\d{3,}$/.test(id)) errors.push(`${path}.gate.findingRefs 中 ${id} 格式无效`)
          if (!fact.reviewFindingRefs?.includes(id)) errors.push(`${path}.gate.findingRefs 中 ${id} 未包含在该事实的 reviewFindingRefs 中`)
        }
      }
      requiredString(fact.gate.reason, `${path}.gate.reason`, errors)
      if (["conflicting", "ambiguous", "pending_review"].includes(fact.consistencyStatus) && fact.gate.status !== "requires_resolution") errors.push(`${path} 的未决一致性状态必须使用 requires_resolution 事实门禁`)
      if (fact.gate.status === "usable" && fact.gate.findingRefs?.length) errors.push(`${path} usable 时 gate.findingRefs 必须为空`)
    }
    if (!Array.isArray(fact.sourceRefs) || !fact.sourceRefs.length) errors.push(`${path}.sourceRefs 必须是非空数组`)
    else fact.sourceRefs.forEach((item, sourceIndex) => validateSourceRef(item, `${path}.sourceRefs[${sourceIndex}]`, errors))
    if (typeof fact.developmentValidationRequired !== "boolean") errors.push(`${path}.developmentValidationRequired 必须是布尔值`)
    requiredString(fact.validationRationale, `${path}.validationRationale`, errors)
  })

  const itemsById = new Map()
  const coveredFacts = new Set()
  if (!Array.isArray(checklist.items)) errors.push("items 必须是数组")
  else checklist.items.forEach((item, index) => {
    const path = `items[${index}]`
    if (!object(item)) {
      errors.push(`${path} 必须是对象`)
      return
    }
    if (typeof item.id !== "string" || !/^DEVVAL-\d{3,}$/.test(item.id)) errors.push(`${path}.id 格式无效`)
    else if (itemsById.has(item.id)) errors.push(`${path}.id 重复`)
    else itemsById.set(item.id, item)
    requiredString(item.title, `${path}.title`, errors)
    validateDeveloperPrompt(item.developerPrompt, `${path}.developerPrompt`, errors)
    if (!PURPOSES.has(item.purpose)) errors.push(`${path}.purpose 枚举无效`)
    if (!CATEGORIES.has(item.category)) errors.push(`${path}.category 枚举无效`)
    if (!Array.isArray(item.factRefs) || !item.factRefs.length) errors.push(`${path}.factRefs 必须是非空数组`)
    else {
      if (new Set(item.factRefs).size !== item.factRefs.length) errors.push(`${path}.factRefs 不得重复`)
      for (const id of item.factRefs) {
        if (!factsById.has(id)) errors.push(`${path}.factRefs 引用了不存在的 ${id}`)
        else if (factsById.get(id).developmentValidationRequired) coveredFacts.add(id)
      }
    }
    stringArray(item.resolutionFactRefs, `${path}.resolutionFactRefs`, errors)
    if (Array.isArray(item.resolutionFactRefs)) {
      if (new Set(item.resolutionFactRefs).size !== item.resolutionFactRefs.length) errors.push(`${path}.resolutionFactRefs 不得重复`)
      for (const id of item.resolutionFactRefs) {
        if (!item.factRefs?.includes(id)) errors.push(`${path}.resolutionFactRefs 中 ${id} 必须同时出现在 factRefs 中`)
        else if (factsById.get(id)?.gate?.status !== "requires_resolution") errors.push(`${path}.resolutionFactRefs 中 ${id} 不是待裁决事实`)
      }
      if (item.resolutionFactRefs.length && !RESOLUTION_PURPOSES.has(item.purpose)) errors.push(`${path}.purpose 不允许通过 resolutionFactRefs 绕过事实门禁`)
      if (item.purpose === "normative_resolution" && !item.resolutionFactRefs.length) errors.push(`${path} 的 normative_resolution 必须声明 resolutionFactRefs`)
    }
    stringArray(item.reviewFindingRefs, `${path}.reviewFindingRefs`, errors)
    if (Array.isArray(item.reviewFindingRefs)) for (const id of item.reviewFindingRefs) if (!/^DOC-\d{3,}$/.test(id)) errors.push(`${path}.reviewFindingRefs 中 ${id} 格式无效`)
    if (!ENVIRONMENTS.has(item.environment)) errors.push(`${path}.environment 枚举无效`)
    else if (Array.isArray(checklist.scope?.environments) && !checklist.scope.environments.includes(item.environment)) errors.push(`${path}.environment 未包含在 scope.environments 中`)
    stringArray(item.preconditions, `${path}.preconditions`, errors, { nonEmpty: true })
    stringArray(item.implementationSteps, `${path}.implementationSteps`, errors, { nonEmpty: true })
    stringArray(item.negativeCases, `${path}.negativeCases`, errors)
    stringArray(item.dependencies, `${path}.dependencies`, errors)
    if (typeof item.blocking !== "boolean") errors.push(`${path}.blocking 必须是布尔值`)
    if (!READINESS.has(item.readiness)) errors.push(`${path}.readiness 枚举无效`)
    if (!Array.isArray(item.blockedBy)) errors.push(`${path}.blockedBy 必须是数组`)
    else {
      const unique = new Set(item.blockedBy)
      if (unique.size !== item.blockedBy.length) errors.push(`${path}.blockedBy 不得重复`)
      for (const reason of unique) if (!BLOCKED_BY.has(reason)) errors.push(`${path}.blockedBy 包含无效值 ${reason}`)
    }
    if (!EXECUTION_STATUS.has(item.executionStatus)) errors.push(`${path}.executionStatus 只能为 not_run 或 blocked`)
    if (item.readiness === "ready" && (item.blockedBy?.length !== 0 || item.executionStatus !== "not_run")) errors.push(`${path} ready 时 blockedBy 必须为空且 executionStatus 必须为 not_run`)
    if (item.readiness === "blocked" && (!item.blockedBy?.length || item.executionStatus !== "blocked")) errors.push(`${path} blocked 时必须提供 blockedBy 且 executionStatus 为 blocked`)
    const resolutionFacts = new Set(item.resolutionFactRefs ?? [])
    const unresolvedConsumedFacts = (item.factRefs ?? []).filter((id) => factsById.get(id)?.gate?.status === "requires_resolution" && !resolutionFacts.has(id))
    if (unresolvedConsumedFacts.length && !item.blockedBy?.includes("fact_gate")) errors.push(`${path} 消费了未裁决事实 ${unresolvedConsumedFacts.join(", ")}，必须由 fact_gate 阻塞`)
    if (!unresolvedConsumedFacts.length && item.blockedBy?.includes("fact_gate")) errors.push(`${path} 未消费未裁决事实，不得由 fact_gate 扩大阻塞范围`)
    if (item.environment === "target_project" && checklist.scope?.targetProject === null && !item.blockedBy?.includes("target_project")) errors.push(`${path} 缺少目标工程路径时必须由 target_project 阻塞`)

    const levels = new Set()
    if (!Array.isArray(item.verifications) || !item.verifications.length) errors.push(`${path}.verifications 必须是非空数组`)
    else item.verifications.forEach((verification, verificationIndex) => {
      const verificationPath = `${path}.verifications[${verificationIndex}]`
      if (!object(verification)) {
        errors.push(`${verificationPath} 必须是对象`)
        return
      }
      if (!VERIFICATION_LEVELS.has(verification.level)) errors.push(`${verificationPath}.level 枚举无效`)
      else levels.add(verification.level)
      for (const field of ["objective", "procedure", "expectedResult", "evidenceToCollect"]) requiredString(verification[field], `${verificationPath}.${field}`, errors)
    })
    for (const required of ["static", "build"]) if (!levels.has(required)) errors.push(`${path} 缺少 ${required} 验证层`)
    if (SDK_REQUIRED.has(item.category) && !levels.has("sdk")) errors.push(`${path} 的 ${item.category} 缺少 sdk 验证层`)
    if (RUNTIME_REQUIRED.has(item.category) && !levels.has("simulator") && !levels.has("device")) errors.push(`${path} 的 ${item.category} 缺少模拟器或真机验证层`)
    if (item.category === "performance" && !levels.has("device")) errors.push(`${path} 的 performance 必须包含 device 验证层`)
    if (item.category === "state_transition" && (!Array.isArray(item.negativeCases) || !item.negativeCases.length)) errors.push(`${path} 的 state_transition 必须包含负向用例`)
    if (item.category === "document_conflict") {
      if (item.purpose !== "normative_resolution") errors.push(`${path} 的 document_conflict 必须用于 normative_resolution`)
      if (item.environment !== "minimal_project") errors.push(`${path} 的 document_conflict 必须使用 minimal_project`)
      if (!item.reviewFindingRefs?.length) errors.push(`${path} 的 document_conflict 必须关联审查 finding`)
      const linkedFacts = (item.factRefs ?? []).map((id) => factsById.get(id)).filter(Boolean)
      if (linkedFacts.filter((fact) => fact.consistencyStatus === "conflicting").length < 2) errors.push(`${path} 的 document_conflict 必须引用至少两个 conflicting 事实`)
      const conflictingFactIds = linkedFacts.filter((fact) => fact.consistencyStatus === "conflicting").map((fact) => fact.id)
      if (conflictingFactIds.some((id) => !item.resolutionFactRefs?.includes(id))) errors.push(`${path} 的 document_conflict 必须在 resolutionFactRefs 中包含全部 conflicting 事实`)
      const locations = new Set(linkedFacts.flatMap((fact) => fact.sourceRefs ?? []).map((ref) => `${ref.source}#${ref.section}#${ref.line ?? ""}`))
      if (locations.size < 2) errors.push(`${path} 的 document_conflict 必须包含两个独立原文位置`)
    }
  })

  if (itemsById.size) {
    for (const [id, item] of itemsById) for (const dependency of item.dependencies ?? []) {
      if (!itemsById.has(dependency)) errors.push(`${id}.dependencies 引用了不存在的 ${dependency}`)
      if (dependency === id) errors.push(`${id} 不得依赖自身`)
    }
    if (hasCycle(itemsById)) errors.push("items.dependencies 存在循环依赖")
  }

  if (!Array.isArray(checklist.executionOrder)) errors.push("executionOrder 必须是数组")
  else {
    const order = checklist.executionOrder
    if (new Set(order).size !== order.length) errors.push("executionOrder 不得重复")
    if (order.length !== itemsById.size || order.some((id) => !itemsById.has(id)) || [...itemsById.keys()].some((id) => !order.includes(id))) errors.push("executionOrder 必须恰好包含全部验证项")
    const indexById = new Map(order.map((id, index) => [id, index]))
    for (const [id, item] of itemsById) for (const dependency of item.dependencies ?? []) {
      if (indexById.has(dependency) && indexById.get(dependency) >= indexById.get(id)) errors.push(`executionOrder 中依赖项 ${dependency} 必须排在 ${id} 之前`)
    }
  }

  const requiredFacts = new Set([...factsById].filter(([, fact]) => fact.developmentValidationRequired).map(([id]) => id))
  const uncovered = [...requiredFacts].filter((id) => !coveredFacts.has(id)).sort()
  if (uncovered.length) errors.push(`存在未被验证项覆盖的工程事实: ${uncovered.join(", ")}`)

  if (!object(checklist.coverage)) errors.push("coverage 必须是对象")
  else {
    for (const field of ["sourceUnits", "representedSourceUnits", "factsRequiringValidation", "factsCoveredByChecklist"]) {
      if (!Number.isInteger(checklist.coverage[field]) || checklist.coverage[field] < 0) errors.push(`coverage.${field} 必须是非负整数`)
    }
    if (!Array.isArray(checklist.coverage.exclusions)) errors.push("coverage.exclusions 必须是数组")
    let excludedUnits = 0
    if (Array.isArray(checklist.coverage.exclusions)) checklist.coverage.exclusions.forEach((item, index) => {
      const path = `coverage.exclusions[${index}]`
      if (!object(item)) {
        errors.push(`${path} 必须是对象`)
        return
      }
      requiredString(item.source, `${path}.source`, errors)
      requiredString(item.locator, `${path}.locator`, errors)
      requiredString(item.reason, `${path}.reason`, errors)
      if (!Number.isInteger(item.unitCount) || item.unitCount < 1) errors.push(`${path}.unitCount 必须是正整数`)
      else excludedUnits += item.unitCount
    })
    if (Number.isInteger(checklist.coverage.sourceUnits) && Number.isInteger(checklist.coverage.representedSourceUnits) && checklist.coverage.sourceUnits !== checklist.coverage.representedSourceUnits + excludedUnits) errors.push("coverage.sourceUnits 必须等于 representedSourceUnits 与 exclusions.unitCount 之和")
    if (checklist.coverage.factsRequiringValidation !== requiredFacts.size) errors.push(`coverage.factsRequiringValidation 应为 ${requiredFacts.size}`)
    if (checklist.coverage.factsCoveredByChecklist !== coveredFacts.size) errors.push(`coverage.factsCoveredByChecklist 应为 ${coveredFacts.size}`)
    if (!Array.isArray(checklist.coverage.uncoveredFactRefs)) errors.push("coverage.uncoveredFactRefs 必须是数组")
    else {
      const declared = [...checklist.coverage.uncoveredFactRefs].sort()
      if (JSON.stringify(declared) !== JSON.stringify(uncovered)) errors.push("coverage.uncoveredFactRefs 与实际覆盖情况不一致")
      if (declared.length) errors.push("coverage.uncoveredFactRefs 必须为空")
    }
  }

  if (!object(checklist.summary)) errors.push("summary 必须是对象")
  else {
    const expected = {
      totalFacts: factsById.size,
      developmentFacts: requiredFacts.size,
      checklistItems: itemsById.size,
      readyItems: [...itemsById.values()].filter((item) => item.readiness === "ready").length,
      blockedItems: [...itemsById.values()].filter((item) => item.readiness === "blocked").length,
    }
    for (const [field, value] of Object.entries(expected)) if (checklist.summary[field] !== value) errors.push(`summary.${field} 应为 ${value}`)
  }

  return { valid: errors.length === 0, errors }
}

export async function validateChecklistWithReview(checklist) {
  const structural = validateValidationChecklist(checklist)
  const errors = [...structural.errors]
  if (!object(checklist?.input) || typeof checklist.input.reviewReport !== "string" || !isAbsolute(checklist.input.reviewReport)) return { valid: false, errors }
  try {
    const raw = await readFile(checklist.input.reviewReport, "utf8")
    const report = JSON.parse(raw)
    const reportValidation = validateReport(report)
    if (!reportValidation.valid) errors.push(...reportValidation.errors.map((item) => `关联审查报告: ${item}`))
    const findingsById = new Map((report.findings ?? []).map((item) => [item.id, item]))
    const reportFindingIds = new Set(findingsById.keys())
    const evidenceById = new Map((report.evidence ?? []).map((item) => [item.id, item]))
    for (const fact of checklist.engineeringFacts ?? []) for (const id of fact.reviewFindingRefs ?? []) if (!reportFindingIds.has(id)) errors.push(`${fact.id}.reviewFindingRefs 引用了关联审查报告中不存在的 ${id}`)
    for (const item of checklist.items ?? []) for (const id of item.reviewFindingRefs ?? []) if (!reportFindingIds.has(id)) errors.push(`${item.id}.reviewFindingRefs 引用了关联审查报告中不存在的 ${id}`)
    const checklistFactsById = new Map((checklist.engineeringFacts ?? []).map((fact) => [fact.id, fact]))
    for (const fact of checklist.engineeringFacts ?? []) {
      const expectedGate = deriveFactGate(fact, report, findingsById, evidenceById)
      if (fact.gate?.status !== expectedGate.status) errors.push(`${fact.id}.gate.status 应为 ${expectedGate.status}`)
      if (!isDeepStrictEqual(fact.gate?.findingRefs, expectedGate.findingRefs)) errors.push(`${fact.id}.gate.findingRefs 与关联审查报告的阻断 finding 不一致`)
    }
    for (const item of checklist.items ?? []) {
      const expectedFindingRefs = uniqueInOrder((item.factRefs ?? []).flatMap((id) => linkedFindingIds(checklistFactsById.get(id))))
      if (!isDeepStrictEqual(item.reviewFindingRefs, expectedFindingRefs)) errors.push(`${item.id}.reviewFindingRefs 必须等于其 factRefs 关联 finding 的并集`)
    }
    if (report.integrationGate !== checklist.reviewGate) errors.push("reviewGate 与关联审查报告的 integrationGate 不一致")
    if (report.input?.kind !== checklist.input.kind || report.input?.value !== checklist.input.value) errors.push("input.kind/value 与关联审查报告不一致")
    if (!isDeepStrictEqual(report.sourceIntegrity, checklist.sourceIntegrity)) errors.push("sourceIntegrity 必须原样复制关联审查报告")
    if (checklist.input.reviewReportSha256 === null) errors.push("持久化验证清单必须记录 reviewReportSha256")
    else {
      const digest = createHash("sha256").update(raw).digest("hex")
      if (digest.toLowerCase() !== checklist.input.reviewReportSha256.toLowerCase()) errors.push("input.reviewReportSha256 与关联审查报告不匹配")
    }
  } catch (error) {
    errors.push(`无法读取关联审查报告: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { valid: errors.length === 0, errors }
}

async function main() {
  const [input] = process.argv.slice(2)
  if (!input) throw new Error("用法: node validate-validation-checklist.mjs <development-validation-checklist.json>")
  const checklist = JSON.parse(await readFile(input, "utf8"))
  const result = await validateChecklistWithReview(checklist)
  process.stdout.write(`${JSON.stringify({ status: result.valid ? "valid" : "invalid", errors: result.errors }, null, 2)}\n`)
  if (!result.valid) process.exitCode = 2
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

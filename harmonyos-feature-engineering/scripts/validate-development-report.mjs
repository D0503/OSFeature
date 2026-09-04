#!/usr/bin/env node

import { isAbsolute } from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { CHECK_LEVELS, LAYER_STATUSES, VERDICTS } from "./lib/capability-tools.mjs"

const CHECK_KEYS = ["static", "sdk", "build", "install", "runtime", "visual"]
const COMPATIBILITY = new Set(["supported", "upgrade_required", "blocked", "insufficient_context"])
const EVIDENCE_TYPES = new Set(["baseline", "diff", "static", "sdk_declaration", "build_log", "device_log", "screenshot", "recording", "user_observation"])
const VISUAL_EVIDENCE = new Set(["screenshot", "recording", "user_observation"])

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function string(value) {
  return typeof value === "string" && value.trim().length > 0
}

function hash(value) {
  return value === null || /^[a-f0-9]{64}$/i.test(value ?? "")
}

export function deriveDevelopmentVerdict(report) {
  if (report?.compatibility?.status !== "supported") return "blocked"
  const required = new Set(report?.capabilityPackage?.requiredChecks ?? [])
  const statuses = [...required].map((level) => report?.checks?.[level]?.status)
  if (statuses.includes("failed")) return "failed"
  for (const level of ["static", "sdk", "build"]) {
    if (required.has(level) && ["blocked", "not_run", undefined].includes(report?.checks?.[level]?.status)) return "blocked"
  }
  if (statuses.includes("inconclusive")) return "inconclusive"
  const pendingRuntime = ["install", "runtime", "visual"].some((level) =>
    required.has(level) && ["not_run", "blocked"].includes(report?.checks?.[level]?.status)
  )
  if (pendingRuntime && ["static", "sdk", "build"].every((level) => !required.has(level) || report.checks[level].status === "passed")) {
    return "build_passed_runtime_pending"
  }
  if (statuses.some((status) => status !== "passed")) return "blocked"

  const conflicts = new Set(report?.capabilityPackage?.conflictingFactRefs ?? [])
  if (conflicts.size) {
    const matched = new Set((report?.verdict?.matchedFactRefs ?? []).filter((id) => conflicts.has(id)))
    if (matched.size === 0) return "failed"
    if (matched.size > 1) return "inconclusive"
    return "passed_with_spec_conflict"
  }
  return "passed"
}

export function validateDevelopmentReport(report) {
  const errors = []
  if (!object(report)) return { valid: false, errors: ["报告根节点必须是对象"] }
  if (report.verificationVersion !== "1.0") errors.push("verificationVersion 必须为 1.0")
  if (report.mode !== "code-development-validation") errors.push("mode 必须为 code-development-validation")
  if (!object(report.input)) errors.push("input 必须是对象")
  else {
    for (const field of ["feature", "project", "goal"]) if (!string(report.input[field])) errors.push(`input.${field} 必须是非空字符串`)
    if (string(report.input.project) && !isAbsolute(report.input.project)) errors.push("input.project 必须是绝对路径")
    for (const forbidden of ["document", "url", "reviewReport", "checklist", "manifest"]) if (forbidden in report.input) errors.push(`input 不得包含 ${forbidden}`)
    if (!Array.isArray(report.input.targetFiles)) errors.push("input.targetFiles 必须是数组")
  }

  if (!object(report.capabilityPackage)) errors.push("capabilityPackage 必须是对象")
  else {
    for (const field of ["featureId", "version", "scenarioId", "route"]) if (!string(report.capabilityPackage[field])) errors.push(`capabilityPackage.${field} 必须是非空字符串`)
    if (!/^[a-f0-9]{64}$/i.test(report.capabilityPackage.digest ?? "")) errors.push("capabilityPackage.digest 必须是 SHA-256")
    if (!Array.isArray(report.capabilityPackage.requiredChecks) || !report.capabilityPackage.requiredChecks.length) errors.push("capabilityPackage.requiredChecks 必须是非空数组")
    else for (const level of report.capabilityPackage.requiredChecks) if (!CHECK_LEVELS.has(level)) errors.push(`无效必需层 ${level}`)
    if (!Array.isArray(report.capabilityPackage.factRefs) || !report.capabilityPackage.factRefs.length) errors.push("capabilityPackage.factRefs 必须是非空数组")
    if (!Array.isArray(report.capabilityPackage.conflictingFactRefs)) errors.push("capabilityPackage.conflictingFactRefs 必须是数组")
  }

  if (!object(report.projectBaseline)) errors.push("projectBaseline 必须是对象")
  if (!Array.isArray(report.changes)) errors.push("changes 必须是数组")
  else report.changes.forEach((change, index) => {
    const path = `changes[${index}]`
    if (!string(change?.path)) errors.push(`${path}.path 必须是非空字符串`)
    if (!["added", "modified", "deleted", "unchanged"].includes(change?.status)) errors.push(`${path}.status 无效`)
    if (!hash(change?.beforeSha256) || !hash(change?.afterSha256)) errors.push(`${path} 哈希无效`)
    if (change?.status !== "unchanged" && !string(change?.diff)) errors.push(`${path} 变化文件必须包含 diff`)
  })

  if (!object(report.compatibility) || !COMPATIBILITY.has(report.compatibility?.status)) errors.push("compatibility.status 无效")
  else {
    if (!Array.isArray(report.compatibility.reasons)) errors.push("compatibility.reasons 必须是数组")
    if (!Array.isArray(report.compatibility.authorizationRequired)) errors.push("compatibility.authorizationRequired 必须是数组")
  }

  const evidenceIds = new Set()
  const evidenceById = new Map()
  if (!Array.isArray(report.evidence)) errors.push("evidence 必须是数组")
  else report.evidence.forEach((item, index) => {
    const path = `evidence[${index}]`
    if (!/^EVID-\d{3,}$/.test(item?.id ?? "")) errors.push(`${path}.id 格式无效`)
    else if (evidenceIds.has(item.id)) errors.push(`${path}.id 重复`)
    else { evidenceIds.add(item.id); evidenceById.set(item.id, item) }
    if (!EVIDENCE_TYPES.has(item?.type)) errors.push(`${path}.type 无效`)
    if (!string(item?.summary)) errors.push(`${path}.summary 必须是非空字符串`)
    if (!hash(item?.sha256)) errors.push(`${path}.sha256 无效`)
    if (item?.path !== null && item?.path !== undefined && (!string(item.path) || !isAbsolute(item.path))) errors.push(`${path}.path 必须是绝对路径或 null`)
    if (item?.capturedAt !== null && item?.capturedAt !== undefined && Number.isNaN(Date.parse(item.capturedAt))) errors.push(`${path}.capturedAt 必须是 ISO 日期或 null`)
  })

  if (!object(report.checks)) errors.push("checks 必须是对象")
  else {
    const keys = Object.keys(report.checks).sort()
    if (JSON.stringify(keys) !== JSON.stringify([...CHECK_KEYS].sort())) errors.push("checks 必须恰好包含六个固定层")
    for (const level of CHECK_KEYS) {
      const check = report.checks[level]
      if (!object(check)) { errors.push(`checks.${level} 必须是对象`); continue }
      if (typeof check.required !== "boolean") errors.push(`checks.${level}.required 必须是布尔值`)
      if (!LAYER_STATUSES.has(check.status)) errors.push(`checks.${level}.status 无效`)
      if (!string(check.summary)) errors.push(`checks.${level}.summary 必须是非空字符串`)
      if (!Array.isArray(check.evidenceRefs)) errors.push(`checks.${level}.evidenceRefs 必须是数组`)
      else {
        for (const id of check.evidenceRefs) if (!evidenceIds.has(id)) errors.push(`checks.${level} 引用了不存在的证据 ${id}`)
        if (check.required && check.status === "passed" && check.evidenceRefs.length === 0) errors.push(`通过的必需层 ${level} 必须有证据`)
      }
    }
    if (report.checks.visual?.status === "passed") {
      const visualTypes = (report.checks.visual.evidenceRefs ?? []).map((id) => evidenceById.get(id)?.type)
      if (!visualTypes.some((type) => VISUAL_EVIDENCE.has(type))) errors.push("visual passed 必须有截图、录屏或用户观察证据")
    }
    if (report.checks.build?.status === "passed") {
      const buildEvidence = (report.checks.build.evidenceRefs ?? []).map((id) => evidenceById.get(id)).filter(Boolean)
      if (!buildEvidence.some((item) => item.type === "build_log" && item.exitCode === 0)) errors.push("build passed 必须有 exitCode=0 的 build_log")
    }
    const repairAttempts = report.checks.build?.repairAttempts
    if (repairAttempts !== undefined && (!Number.isInteger(repairAttempts) || repairAttempts < 0 || repairAttempts > 2)) errors.push("checks.build.repairAttempts 必须是 0 到 2")
  }

  if (!Array.isArray(report.pendingVerifications)) errors.push("pendingVerifications 必须是数组")
  else report.pendingVerifications.forEach((item, index) => {
    if (!string(item?.id) || !CHECK_LEVELS.has(item?.level) || !string(item?.reason) || typeof item?.required !== "boolean") errors.push(`pendingVerifications[${index}] 无效`)
  })
  if (!object(report.verdict) || !VERDICTS.has(report.verdict?.status) || !string(report.verdict?.summary)) errors.push("verdict 无效")
  else {
    if (!Array.isArray(report.verdict.matchedFactRefs)) errors.push("verdict.matchedFactRefs 必须是数组")
    const expected = deriveDevelopmentVerdict(report)
    if (report.verdict.status !== expected) errors.push(`verdict.status 应为 ${expected}`)
  }
  return { valid: errors.length === 0, errors }
}

async function main() {
  const [input] = process.argv.slice(2)
  if (!input) throw new Error("用法: node validate-development-report.mjs <development-verification-report.json>")
  const report = JSON.parse(await readFile(input, "utf8"))
  const result = validateDevelopmentReport(report)
  process.stdout.write(`${JSON.stringify({ status: result.valid ? "valid" : "invalid", errors: result.errors }, null, 2)}\n`)
  if (!result.valid) process.exitCode = 2
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

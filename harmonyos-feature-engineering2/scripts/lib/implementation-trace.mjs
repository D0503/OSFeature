import { isAbsolute } from "node:path"

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const string = (value) => typeof value === "string" && value.trim().length > 0
const hash = (value) => /^[a-f0-9]{64}$/i.test(value ?? "")
const safePath = (value) => string(value) && !isAbsolute(value) && !value.includes("\\") && !value.split("/").some((part) => ["", ".", ".."].includes(part))

export function validateImplementationRecord(record) {
  const errors = []
  if (!object(record) || !Array.isArray(record.steps)) return ["implementation.steps 必须是数组"]
  const ids = new Set()
  record.steps.forEach((step, index) => {
    const label = `implementation.steps[${index}]`
    if (!object(step)) { errors.push(`${label} 必须是对象`); return }
    if (!string(step.id) || ids.has(step.id)) errors.push(`${label}.id 缺失或重复`)
    ids.add(step.id)
    if (!string(step.description)) errors.push(`${label}.description 缺失`)
    if (!["applied", "partial", "not_applied"].includes(step.status)) errors.push(`${label}.status 无效`)
    if (!Array.isArray(step.locations) || !step.locations.length) errors.push(`${label}.locations 必须非空`)
    else for (const location of step.locations) {
      if (!safePath(location?.path) || !["before", "after"].includes(location?.version) || !Number.isInteger(location?.lineStart) || location.lineStart < 1 || !Number.isInteger(location?.lineEnd) || location.lineEnd < location.lineStart) errors.push(`${label}.locations 路径、版本或行号无效`)
    }
    if (!Array.isArray(step.basis) || !step.basis.length) errors.push(`${label}.basis 必须非空`)
    else for (const basis of step.basis) {
      if (!object(basis) || !["criteria", "engineering_choice", "unresolved"].includes(basis.type) || !string(basis.reason)) errors.push(`${label}.basis 类型或理由无效`)
      if (basis?.type === "criteria" && !string(basis?.criteriaId)) errors.push(`${label}.basis.criteriaId 必填`)
      if (basis?.type !== "criteria" && basis?.criteriaId !== undefined) errors.push(`${label} 非判据依据不得声明 criteriaId`)
    }
  })
  return errors
}

// 只统计 diff 中实际新增/删除的行；上下文行不能证明步骤已经实施。
function changedLines(diff, version) {
  const result = new Set()
  let before = 0
  let after = 0
  let inHunk = false
  for (const row of (diff ?? "").split(/\r?\n/)) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row)
    if (hunk) { before = Number(hunk[1]); after = Number(hunk[2]); inHunk = true; continue }
    if (!inHunk) continue
    if (row.startsWith("-")) { if (version === "before") result.add(before); before += 1 }
    else if (row.startsWith("+")) { if (version === "after") result.add(after); after += 1 }
    else if (row.startsWith(" ")) { before += 1; after += 1 }
  }
  return result
}

function matchesChange(location, change) {
  if (!change || change.status === "unchanged" || !hash(change[`${location.version}Sha256`])) return false
  return [...changedLines(change.diff, location.version)].some((line) => line >= location.lineStart && line <= location.lineEnd)
}

export function buildImplementationTrace(criteriaDocument, record, changes, baselineAvailable) {
  if (record !== null && record !== undefined) {
    const errors = validateImplementationRecord(record)
    if (errors.length) throw new Error(errors.join("; "))
  }
  const criteria = new Map((criteriaDocument?.criteria ?? []).map((criterion) => [criterion.id, criterion]))
  const snapshots = new Map((criteriaDocument?.snapshots ?? []).map((snapshot) => [snapshot.snapshotId, snapshot]))
  const byPath = new Map(changes.map((change) => [change.path, change]))
  const referenced = new Set()
  const covered = new Set()
  const steps = (record?.steps ?? []).map((input) => {
    const step = structuredClone(input)
    step.issues = []
    step.locations = input.locations.map((location) => {
      const change = byPath.get(location.path)
      const matched = baselineAvailable && matchesChange(location, change)
      if (!matched && step.status !== "not_applied") step.issues.push(`${location.path}:${location.lineStart}-${location.lineEnd} 无可对应的基线差异，实施情况待确认。`)
      if (matched && step.status !== "not_applied") covered.add(location.path)
      return { ...location, correlation: matched ? "matched" : "unverified", beforeSha256: change?.beforeSha256 ?? null, afterSha256: change?.afterSha256 ?? null }
    })
    if (step.status === "applied" && step.issues.length) step.status = "partial"
    for (const basis of step.basis) if (basis.type === "criteria") {
      if (!criteria.has(basis.criteriaId)) throw new Error(`实施依据引用了本次判据集中不存在的判据 ${basis.criteriaId}`)
      referenced.add(basis.criteriaId)
    }
    return step
  })
  const conflictGroups = new Set([...referenced].map((id) => criteria.get(id).conflictGroup).filter(Boolean))
  const selected = [...criteria.values()].filter((criterion) => referenced.has(criterion.id) || (criterion.conflictGroup && conflictGroups.has(criterion.conflictGroup)))
  const normativeBasis = selected.map((criterion) => {
    const snapshot = snapshots.get(criterion.snapshotId)
    if (!snapshot) throw new Error(`判据 ${criterion.id} 的快照来源不在本次冻结集内`)
    return {
      id: criterion.id, statement: criterion.statement,
      normativeStatus: criterion.conflictGroup ? "conflicting" : "clear",
      derivation: criterion.status ?? "fresh",
      conflictGroup: criterion.conflictGroup ?? null,
      usage: referenced.has(criterion.id) ? "direct" : "conflict_context",
      sources: [{ snapshotId: criterion.snapshotId, anchor: criterion.anchor, lines: criterion.lines ?? null, sha256: snapshot.contentSha256, officialUrl: snapshot.officialUrl, title: snapshot.title, frozenAt: criteriaDocument.frozenAt ?? null }],
    }
  })
  return {
    implementation: {
      recordStatus: record?.steps?.length ? "recorded" : changes.some((change) => change.status !== "unchanged") || !baselineAvailable ? "missing" : "not_started",
      baselineAvailable: Boolean(baselineAvailable), steps,
      uncoveredChanges: changes.filter((change) => change.status !== "unchanged" && !covered.has(change.path)).map((change) => change.path),
    },
    normativeBasis,
  }
}

export function validateImplementationTrace(report) {
  const errors = validateImplementationRecord(report.implementation)
  const implementation = report.implementation
  if (!object(implementation)) return errors
  if (!["recorded", "missing", "not_started"].includes(implementation.recordStatus) || typeof implementation.baselineAvailable !== "boolean") errors.push("implementation 记录状态或基线状态无效")
  if (!Array.isArray(implementation.uncoveredChanges)) errors.push("implementation.uncoveredChanges 必须是数组")
  if (errors.length) return errors
  const changes = new Map((Array.isArray(report.changes) ? report.changes : []).filter(object).map((change) => [change.path, change]))
  const covered = new Set()
  const refs = new Set()
  for (const step of implementation.steps) {
    if (!Array.isArray(step.issues) || step.issues.some((item) => !string(item))) errors.push(`${step.id}.issues 必须是字符串数组`)
    for (const location of step.locations) {
      const change = changes.get(location.path)
      const matched = implementation.baselineAvailable && matchesChange(location, change)
      if (location.correlation !== (matched ? "matched" : "unverified")) errors.push(`${step.id} 位置关联状态与 diff 不一致`)
      if (location.beforeSha256 !== (change?.beforeSha256 ?? null) || location.afterSha256 !== (change?.afterSha256 ?? null)) errors.push(`${step.id} 位置哈希与 changes 不一致`)
      if (step.status === "applied" && !matched) errors.push(`${step.id} 缺少实际变更证据，不得标为 applied`)
      if (step.status !== "not_applied" && matched) covered.add(location.path)
    }
    for (const basis of step.basis) if (string(basis?.criteriaId)) refs.add(basis.criteriaId)
  }
  const expectedUncovered = [...changes.values()].filter((change) => change.status !== "unchanged" && !covered.has(change.path)).map((change) => change.path)
  if (JSON.stringify(expectedUncovered) !== JSON.stringify(implementation.uncoveredChanges)) errors.push("implementation.uncoveredChanges 与实际覆盖不一致")
  const expectedStatus = implementation.steps.length ? "recorded" : expectedUncovered.length || !implementation.baselineAvailable ? "missing" : "not_started"
  if (implementation.recordStatus !== expectedStatus) errors.push("implementation.recordStatus 与步骤及变更不一致")
  if (!Array.isArray(report.normativeBasis)) return [...errors, "normativeBasis 必须是数组"]
  const ids = new Set()
  const directGroups = new Set(report.normativeBasis.filter((item) => item?.usage === "direct" && item?.conflictGroup).map((item) => item.conflictGroup))
  for (const item of report.normativeBasis) {
    if (!object(item)) { errors.push("normativeBasis 判据必须是对象"); continue }
    if (!string(item?.id) || ids.has(item.id) || !string(item?.statement) || !["clear", "conflicting", "ambiguous"].includes(item?.normativeStatus)) errors.push("normativeBasis 判据无效或重复")
    ids.add(item?.id)
    if (item?.usage === "direct" ? !refs.has(item.id) : item?.usage !== "conflict_context" || !item.conflictGroup || !directGroups.has(item.conflictGroup)) errors.push("normativeBasis 包含未使用或无关联冲突的判据")
    if (!Array.isArray(item?.sources) || !item.sources.length) errors.push("normativeBasis.sources 必须非空")
    else for (const source of item.sources) {
      if (!object(source)) { errors.push("规范来源必须是对象"); continue }
      if (!string(source?.snapshotId) || !string(source?.anchor) || !hash(source?.sha256)) errors.push("规范来源锚点或哈希无效")
      if (source?.officialUrl !== null) {
        try { const url = new URL(source.officialUrl); if (url.protocol !== "https:" || url.hostname !== "developer.huawei.com" || url.username || url.password) throw new Error() } catch { errors.push("规范来源官网 URL 无效") }
      }
      if (source.title !== null && !string(source.title)) errors.push("规范来源标题无效")
    }
  }
  return errors
}

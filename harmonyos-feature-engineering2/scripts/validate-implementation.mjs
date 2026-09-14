#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { compareFileBaseline } from "./snapshot-project-files.mjs"
import { validateImplementationRecord } from "./lib/implementation-trace.mjs"

const text = (value) => typeof value === "string" && Boolean(value.trim())
const hash = (value) => createHash("sha256").update(value).digest("hex")
const array = (value) => Array.isArray(value) ? value : []
const safePath = (value) => text(value) && !isAbsolute(value) && !value.includes("\\") && !value.split("/").some((part) => ["", ".", ".."].includes(part))

// Source hashes establish provenance only; semantic comparisons remain explicit model observations.
export async function validateImplementation({ project, criteria, frozenDirectory, implementation: record, baseline, phase = "applied" }) {
  const errors = []
  if (!["plan", "applied"].includes(phase)) errors.push("phase 必须是 plan 或 applied")
  if (!isAbsolute(project ?? "")) errors.push("project 必须是绝对路径")
  if (!["demo", "existing_project"].includes(record?.developmentMode)) errors.push("developmentMode 必须是 demo 或 existing_project；历史实施记录须补齐")
  if (!array(criteria?.criteria).length) errors.push("缺少判据集")
  if (!array(record?.requirements).length) errors.push("requirements 必须非空")
  if (!array(record?.steps).length) errors.push("steps 必须非空")
  if (phase === "applied") {
    errors.push(...validateImplementationRecord(record))
    if (!baseline || resolve(baseline.projectRoot ?? "") !== resolve(project ?? "")) errors.push("applied 需要属于目标工程的 baseline")
  }
  if (errors.length) return { valid: false, phase, errors }
  let frozen
  try { frozen = JSON.parse(await readFile(join(frozenDirectory, "frozen.json"), "utf8")) }
  catch { return { valid: false, phase, errors: ["无法读取本次 frozen.json"] } }
  if (frozen.frozenAt !== criteria.frozenAt) errors.push("判据与冻结批次不一致")
  const snapshots = new Map(array(frozen.snapshots).map((s) => [s.snapshotId, s]))
  const criterionMap = new Map(criteria.criteria.map((c) => [c.id, c]))
  const bodies = new Map()
  const checkSource = async (source, label) => {
    const snapshot = snapshots.get(source?.snapshotId)
    const declared = array(criteria.snapshots).find((s) => s.snapshotId === source?.snapshotId)
    if (!snapshot || !declared || !/^[\w-]+$/.test(source.snapshotId)) { errors.push(`${label} 快照不属于本次判据集`); return }
    try {
      const url = new URL(snapshot.officialUrl)
      if (url.protocol !== "https:" || url.hostname !== "developer.huawei.com" || url.username || url.password || declared.officialUrl !== snapshot.officialUrl) throw new Error()
      if (!bodies.has(source.snapshotId)) bodies.set(source.snapshotId, await readFile(join(frozenDirectory, "snapshots", `${source.snapshotId}.md`), "utf8"))
      const body = bodies.get(source.snapshotId)
      if (hash(body) !== snapshot.contentSha256 || declared.contentSha256 !== snapshot.contentSha256) { errors.push(`${label} 冻结正文哈希不匹配`); return }
      const lines = body.split(/\r?\n/)
      if (!Number.isInteger(source.lineStart) || !Number.isInteger(source.lineEnd) || source.lineStart < 1 || source.lineEnd < source.lineStart || source.lineEnd > lines.length) { errors.push(`${label} 原文行范围无效`); return }
      if (hash(lines.slice(source.lineStart - 1, source.lineEnd).join("\n")) !== source.sha256) errors.push(`${label} 片段哈希不匹配`)
    } catch { errors.push(`${label} 官网来源无法读取或无效`) }
  }
  const seen = new Set()
  for (const req of record.requirements) {
    const id = req?.criteriaId
    if (!criterionMap.has(id) || seen.has(id)) errors.push(`requirements 判据 ${id} 无效或重复`)
    seen.add(id)
    if (!["required", "recommendation", "example"].includes(req?.strength)) errors.push(`${id} strength 无效`)
    if (!text(req?.approach) || !array(req?.sources).length) errors.push(`${id} 缺少实现方式或官方契约来源`)
    for (const source of array(req?.sources)) await checkSource(source, id)
    if (!["implement", "not_applicable", "conflict_context"].includes(req?.disposition)) errors.push(`${id} disposition 无效`)
    if (req?.disposition !== "implement" && !text(req?.reason)) errors.push(`${id} 非实施项须说明依据`)
    if (req?.disposition === "conflict_context" && !criterionMap.get(id)?.conflictGroup) errors.push(`${id} 不是冲突判据`)
    if (phase === "applied" && (req?.review?.status !== "passed" || !text(req?.review?.basis))) errors.push(`${id} 契约对照未完成或存在未解决问题`)
    for (const sample of array(req?.samples)) {
      if (!["adopted", "reference"].includes(sample?.usage) || !text(sample?.scope)) errors.push(`${id} 示例用法或适用范围缺失`)
      await checkSource(sample?.source, `${id} 示例`)
      if (record.developmentMode === "demo" && sample?.usage === "adopted") {
        if (!array(sample.keyPoints).length) errors.push(`${id} 采用示例须记录关键点`)
        for (const point of array(sample.keyPoints)) {
          if (!text(point?.description) || !text(point?.adaptation)) errors.push(`${id} 示例关键点或适配说明缺失`)
          if (phase === "applied" && (point?.review?.status !== "passed" || !text(point?.review?.basis))) errors.push(`${id} 示例关键点未完成对照`)
        }
      }
    }
  }
  for (const id of criterionMap.keys()) if (!seen.has(id)) errors.push(`${id} 缺少判据落实记录`)
  const covered = new Set()
  const stepIds = new Set()
  for (const step of record.steps) {
    if (!text(step?.id) || stepIds.has(step.id)) errors.push("实施步骤 id 缺失或重复")
    stepIds.add(step?.id)
    const refs = array(step?.basis).filter((b) => b?.type === "criteria").map((b) => b.criteriaId)
    if (!refs.length) errors.push(`${step?.id} 必须关联官方判据；工程选择不能替代契约`)
    for (const id of refs) {
      if (!criterionMap.has(id)) errors.push(`${step?.id} 引用了不存在的判据 ${id}`)
      covered.add(id)
    }
    for (const basis of array(step?.basis)) {
      if (basis?.type === "unresolved") errors.push(`${step.id} 依据尚未解决`)
      if (basis?.type === "engineering_choice" && !text(basis.constraint)) errors.push(`${step.id} 工程选择缺少具体 constraint`)
    }
    if (phase === "applied" && !["applied", "existing"].includes(step.status)) errors.push(`${step.id} 实施尚未完成`)
  }
  for (const req of record.requirements) if (req.disposition === "implement" && !covered.has(req.criteriaId)) errors.push(`${req.criteriaId} 没有对应实施步骤`)
  if (phase === "applied" && !errors.length) {
    const { changes } = await compareFileBaseline(baseline)
    for (const step of record.steps) for (const location of step.locations) {
      if (!safePath(location.path)) { errors.push(`${step.id} 路径越界`); continue }
      const original = baseline.files.find((f) => f.path === location.path)
      if (!original) { errors.push(`${location.path} 未纳入开发前基线`); continue }
      let content = original.content
      if (location.version === "after") { try { content = await readFile(resolve(project, location.path), "utf8") } catch { content = null } }
      if (content === null || location.lineEnd > content.split(/\r?\n/).length) errors.push(`${step.id} 实际代码行范围不存在`)
      if (step.status === "existing" && (location.version !== "after" || changes.find((c) => c.path === location.path)?.status !== "unchanged")) errors.push(`${step.id} existing 只能引用未修改文件的现有代码`)
    }
    for (const change of changes) {
      let before = 0, after = 0
      for (const row of change.diff.split(/\r?\n/)) {
        const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row)
        if (hunk) { before = Number(hunk[1]); after = Number(hunk[2]); continue }
        if (!before || row.startsWith("---") || row.startsWith("+++")) continue
        const version = row.startsWith("-") ? "before" : row.startsWith("+") ? "after" : null
        const line = version === "before" ? before : after
        // The baseline diff represents a nonexistent side as one empty line.
        const nonexistentSide = (change.status === "added" && version === "before") || (change.status === "deleted" && version === "after")
        if (version && !nonexistentSide && !record.steps.some((step) => step.status === "applied" && step.locations.some((loc) => loc.path === change.path && loc.version === version && loc.lineStart <= line && loc.lineEnd >= line))) errors.push(`${change.path}:${version}:${line} 变更未登记`)
        if (version !== "after") before++
        if (version !== "before") after++
      }
    }
  }
  return { valid: errors.length === 0, phase, errors, developmentMode: record.developmentMode }
}

async function main() {
  const args = {}
  const allowed = new Set(["project", "criteria", "frozen", "implementation", "baseline", "phase"])
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].slice(2), value = process.argv[i + 1]
    if (!process.argv[i].startsWith("--") || !allowed.has(key) || !value || value.startsWith("--")) throw new Error("参数无效；需要 --project --criteria --implementation --phase plan|applied [--frozen] [--baseline]")
    args[key] = value
  }
  const json = async (path) => JSON.parse(await readFile(path, "utf8"))
  const result = await validateImplementation({ project: args.project, criteria: await json(args.criteria), implementation: await json(args.implementation), baseline: args.baseline ? await json(args.baseline) : null, frozenDirectory: args.frozen ?? join(args.project, "ohos-feature-engineering", "frozen"), phase: args.phase })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.valid) process.exitCode = 3
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

#!/usr/bin/env node
// 判据现提编排：
// - materials：clean → 直接产出复用判据集（criteria.json, strategy=reuse）；
//              changed → 产出材料包（变化段原文 + 判据骨架 + 冲突监测点 + 高危确认清单），由模型现提草稿
// - validate：校验草稿（骨架覆盖/锚点命中本次冻结正文/冲突监测结论/高危确认），未覆盖 topic 自动补 reused 判据，
//             通过后产出最终 criteria.json（strategy=fresh）
// 判据权威来源始终是本次冻结快照；上次判据仅作复用缓存与对照。

import { fileURLToPath, pathToFileURL } from "node:url"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { loadCapability } from "./lib/capability-tools.mjs"
import { readFrozenSnapshot } from "./lib/fetch-official.mjs"
import { diffAgainstLatest } from "./diff-snapshots.mjs"

function anchorLocation(content, anchor) {
  const index = content.indexOf(anchor)
  if (index < 0) return null
  const lines = content.split(/\r?\n/)
  let consumed = 0
  for (let line = 0; line < lines.length; line += 1) {
    if (consumed + lines[line].length >= index) return { lineStart: line + 1, lineEnd: line + 1 }
    consumed += lines[line].length + 1
  }
  return null
}

function contextAround(content, anchor, contextLines = 4) {
  const location = anchorLocation(content, anchor)
  if (!location) return []
  const lines = content.split(/\r?\n/)
  const start = Math.max(0, location.lineStart - 1 - contextLines)
  const end = Math.min(lines.length - 1, location.lineStart - 1 + contextLines)
  return lines.slice(start, end + 1).map((text, offset) => ({ line: start + offset + 1, text: text.slice(0, 400) }))
}

function parseArgs(argv) {
  const valued = new Set(["scenario", "frozen", "diff", "draft", "skill-root", "output"])
  const [mode, ...rest] = argv
  if (mode !== "materials" && mode !== "validate") throw new Error("用法: node derive-criteria.mjs <materials|validate> --scenario IL-SXXX --frozen <冻结目录> [--draft <草稿>] [--diff <diff-report>] [--output <目录>]")
  const result = { mode }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith("--")) throw new Error(`未知参数: ${token}`)
    const key = token.slice(2)
    if (!valued.has(key)) throw new Error(`未知参数: ${token}`)
    const value = rest[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    result[key] = value
    index += 1
  }
  return result
}

export async function deriveMaterials(capability, scenarioId, frozenDirectory, diffReport) {
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`场景不存在: ${scenarioId}`)
  const { frozen, bodies } = await readFrozenSnapshot(frozenDirectory)
  const diff = diffReport ?? (await diffAgainstLatest(capability, frozenDirectory))
  const latestCriteria = capability.session?.criteria ?? []
  const latestResolutions = capability.session?.conflictResolutions ?? []

  if (diff.status === "clean") {
    const criteria = []
    const stale = []
    for (const criterion of latestCriteria) {
      if (!scenario.criteriaSpec.required.some((topic) => topic.topic === criterion.topic)) continue
      const body = bodies.get(criterion.snapshotId)
      const location = body ? anchorLocation(body, criterion.anchor) : null
      if (!location) { stale.push(criterion); continue }
      criteria.push({ ...criterion, status: "reused", lines: [location.lineStart, location.lineEnd] })
    }
    const missingTopics = scenario.criteriaSpec.required.filter((topic) => !criteria.some((item) => item.topic === topic.topic)).map((topic) => topic.topic)
    if (missingTopics.length || stale.length) {
      return {
        status: "degraded_reuse",
        reason: `上次判据无法完整复用：缺失主题 ${missingTopics.join("、") || "无"}；锚点失效 ${stale.map((item) => item.id).join("、") || "无"}。需按 changed 流程现提。`,
        diff,
      }
    }
    return {
      status: "reuse_ready",
      criteriaDocument: {
        schemaVersion: "1.0",
        scenarioId,
        frozenAt: frozen.frozenAt,
        validatedAt: new Date().toISOString(),
        strategy: "reuse",
        snapshots: frozen.snapshots.map(({ snapshotId, officialUrl, title, contentSha256, updatedDate }) => ({ snapshotId, officialUrl, title, contentSha256, updatedDate })),
        criteria,
        conflictResolutions: latestResolutions,
        confirmations: [],
      },
    }
  }

  const changedPages = diff.pages.filter((page) => page.status === "changed" || page.status === "new")
  const materials = {
    schemaVersion: "1.0",
    scenarioId,
    frozenAt: frozen.frozenAt,
    strategy: "fresh",
    instructions: [
      "逐条阅读变化段与冻结正文，为骨架 required 的每个 topic 现提至少一条判据：statement 忠实原文（不扩大范围、不改建议为强制），anchor 取原文特征短句（必须逐字存在）。",
      "对每个 conflictProbes 输出结论：persists（矛盾仍在）/ resolved（已解决）/ changed（表述变化），并给出 basis（引用两侧原文）。",
      "冲突监测点结论为 persists 时，必须为两侧表述分别现提判据，并给两条判据标注相同的 conflictGroup（取监测点 id），保留多预期。",
      "高危变化（api-signature/version/deletion/new/removed）必须先向用户确认后再写入 confirmations；未确认不得继续。",
      "判据只能引用本次冻结快照正文；上次判据仅供对照。",
    ],
    requiredTopics: scenario.criteriaSpec.required,
    conflictProbes: (scenario.criteriaSpec.conflictProbes ?? []).map((probe) => ({
      ...probe,
      lastResolution: latestResolutions.find((item) => item.probeId === probe.id) ?? null,
    })),
    highRisk: diff.highRisk,
    changedPages: changedPages.map((page) => ({
      snapshotId: page.snapshotId,
      category: page.category,
      removedExcerpt: page.removedExcerpt ?? [],
      addedExcerpt: page.addedExcerpt ?? [],
      detail: page.detail ?? null,
    })),
    unchangedPages: diff.pages.filter((page) => page.status === "unchanged").map((page) => page.snapshotId),
    lastCriteriaForReference: latestCriteria.filter((criterion) => scenario.sources.includes(criterion.snapshotId)).map((criterion) => ({ id: criterion.id, topic: criterion.topic, statement: criterion.statement, snapshotId: criterion.snapshotId, anchor: criterion.anchor, conflictGroup: criterion.conflictGroup ?? null })),
  }
  return { status: "materials_ready", materials, diff }
}

export async function validateDraft(capability, scenarioId, frozenDirectory, draft, diffReport) {
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`场景不存在: ${scenarioId}`)
  const { frozen, bodies } = await readFrozenSnapshot(frozenDirectory)
  const diff = diffReport ?? (await diffAgainstLatest(capability, frozenDirectory))
  const invalid = []
  if (draft?.schemaVersion !== "1.0") invalid.push("schemaVersion 必须为 1.0")
  if (draft?.scenarioId !== scenarioId) invalid.push(`scenarioId 必须为 ${scenarioId}`)
  const criteria = Array.isArray(draft?.criteria) ? draft.criteria : []
  const ids = new Set()
  for (const [index, criterion] of criteria.entries()) {
    const label = `criteria[${index}]`
    if (!nonEmpty(criterion?.id)) invalid.push(`${label}.id 必填`)
    else if (ids.has(criterion.id)) invalid.push(`${label}.id 重复`)
    else ids.add(criterion.id)
    if (!nonEmpty(criterion?.topic)) invalid.push(`${label}.topic 必填`)
    if (!nonEmpty(criterion?.statement)) invalid.push(`${label}.statement 必填`)
    if (!nonEmpty(criterion?.snapshotId) || !bodies.has(criterion?.snapshotId)) invalid.push(`${label}.snapshotId 不在本次冻结集内`)
    else {
      const location = anchorLocation(bodies.get(criterion.snapshotId), criterion?.anchor)
      if (!location) invalid.push(`${label}.anchor 未命中本次冻结正文`)
    }
  }
  const resolutions = Array.isArray(draft?.conflictResolutions) ? draft.conflictResolutions : []
  for (const probe of scenario.criteriaSpec.conflictProbes ?? []) {
    const resolution = resolutions.find((item) => item.probeId === probe.id)
    if (!resolution) invalid.push(`冲突监测点 ${probe.id} 缺少结论`)
    else if (!["persists", "resolved", "changed"].includes(resolution.verdict)) invalid.push(`冲突监测点 ${probe.id}.verdict 无效`)
    else if (!nonEmpty(resolution.basis)) invalid.push(`冲突监测点 ${probe.id}.basis 必填`)
  }
  const confirmations = Array.isArray(draft?.confirmations) ? draft.confirmations : []
  for (const risk of diff.highRisk ?? []) {
    if (!confirmations.some((item) => item.snapshotId === risk.snapshotId && item.category === risk.category)) {
      invalid.push(`高危变化 ${risk.snapshotId}(${risk.category}) 缺少用户确认记录`)
    }
  }
  for (const [index, confirmation] of confirmations.entries()) {
    if (!nonEmpty(confirmation?.snapshotId) || !nonEmpty(confirmation?.category) || !nonEmpty(confirmation?.userDecision) || !nonEmpty(confirmation?.note)) invalid.push(`confirmations[${index}] 结构无效`)
  }
  if (invalid.length) return { status: "invalid", invalid }

  const finalCriteria = criteria.map((criterion) => {
    const location = anchorLocation(bodies.get(criterion.snapshotId), criterion.anchor)
    return { ...criterion, status: "fresh", lines: location ? [location.lineStart, location.lineEnd] : null }
  })
  // 自动补齐：草稿未覆盖但上次判据仍锚定本次正文的 topic → 标 reused 并入
  const coveredTopics = new Set(finalCriteria.map((criterion) => criterion.topic))
  const latestCriteria = capability.session?.criteria ?? []
  for (const topic of scenario.criteriaSpec.required) {
    if (coveredTopics.has(topic.topic)) continue
    const reusable = latestCriteria.filter((criterion) => criterion.topic === topic.topic && bodies.has(criterion.snapshotId))
    for (const criterion of reusable) {
      if (!anchorLocation(bodies.get(criterion.snapshotId), criterion.anchor)) continue
      const location = anchorLocation(bodies.get(criterion.snapshotId), criterion.anchor)
      finalCriteria.push({ ...criterion, status: "reused", lines: [location.lineStart, location.lineEnd] })
      coveredTopics.add(topic.topic)
      break
    }
  }
  const stillMissing = scenario.criteriaSpec.required.filter((topic) => !coveredTopics.has(topic.topic)).map((topic) => topic.topic)
  if (stillMissing.length) return { status: "invalid", invalid: [`骨架主题未被覆盖且无可复用判据: ${stillMissing.join("、")}`] }

  return {
    status: "validated",
    criteriaDocument: {
      schemaVersion: "1.0",
      scenarioId,
      frozenAt: frozen.frozenAt,
      validatedAt: new Date().toISOString(),
      strategy: "fresh",
      snapshots: frozen.snapshots.map(({ snapshotId, officialUrl, title, contentSha256, updatedDate }) => ({ snapshotId, officialUrl, title, contentSha256, updatedDate })),
      criteria: finalCriteria,
      conflictResolutions: resolutions,
      confirmations,
    },
  }
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

async function readJsonFile(path, label) {
  try { return JSON.parse(await readFile(path, "utf8")) } catch (error) { throw new Error(`无法读取 ${label}: ${error.message}`) }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.scenario || !args.frozen) throw new Error("必须提供 --scenario 与 --frozen")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot)
  const frozenDirectory = resolve(args.frozen)
  const output = resolve(args.output ?? ".")
  await mkdir(output, { recursive: true })

  if (args.mode === "materials") {
    const diffReport = args.diff ? await readJsonFile(resolve(args.diff), "diff-report") : undefined
    const result = await deriveMaterials(capability, args.scenario, frozenDirectory, diffReport)
    if (result.status === "reuse_ready") {
      await writeFile(resolve(output, "criteria.json"), `${JSON.stringify(result.criteriaDocument, null, 2)}\n`, "utf8")
      process.stdout.write(`${JSON.stringify({ status: "reuse_ready", criteriaCount: result.criteriaDocument.criteria.length, output: resolve(output, "criteria.json") }, null, 2)}\n`)
      return
    }
    if (result.status === "degraded_reuse") {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      process.exitCode = 3
      return
    }
    await writeFile(resolve(output, "materials.json"), `${JSON.stringify(result.materials, null, 2)}\n`, "utf8")
    process.stdout.write(`${JSON.stringify({ status: "materials_ready", highRiskCount: result.materials.highRisk.length, changedPages: result.materials.changedPages.map((page) => page.snapshotId), output: resolve(output, "materials.json") }, null, 2)}\n`)
    return
  }

  if (!args.draft) throw new Error("validate 必须提供 --draft <草稿文件>")
  const draft = await readJsonFile(resolve(args.draft), "criteria-draft")
  const diffReport = args.diff ? await readJsonFile(resolve(args.diff), "diff-report") : undefined
  const result = await validateDraft(capability, args.scenario, frozenDirectory, draft, diffReport)
  if (result.status === "invalid") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = 3
    return
  }
  await writeFile(resolve(output, "criteria.json"), `${JSON.stringify(result.criteriaDocument, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({ status: "validated", criteriaCount: result.criteriaDocument.criteria.length, reusedCount: result.criteriaDocument.criteria.filter((item) => item.status === "reused").length, output: resolve(output, "criteria.json") }, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

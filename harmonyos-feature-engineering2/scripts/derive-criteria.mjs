#!/usr/bin/env node
// 判据现提编排：
// 每次从本轮官网冻结快照提取材料并校验草稿，不读取历史基线。

import { fileURLToPath, pathToFileURL } from "node:url"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { loadCapability } from "./lib/capability-tools.mjs"
import { readFrozenSnapshot } from "./lib/fetch-official.mjs"
import { resolveArtifactsRoot } from "./lib/artifacts-dir.mjs"

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

function parseArgs(argv) {
  const valued = new Set(["scenario", "feature", "frozen", "draft", "skill-root", "output", "project"])
  const [mode, ...rest] = argv
  if (mode !== "materials" && mode !== "validate") throw new Error("用法: node derive-criteria.mjs <materials|validate> --feature <特性ID> --scenario <场景ID> --frozen <冻结目录> [--draft <草稿>] [--project <目标工程绝对路径> | --output <目录>]")
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

export async function deriveMaterials(capability, scenarioId, frozenDirectory) {
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`场景不存在: ${scenarioId}`)
  const { frozen } = await readFrozenSnapshot(frozenDirectory)
  const materials = {
    schemaVersion: "1.0",
    featureId: capability.feature.id,
    scenarioId,
    frozenAt: frozen.frozenAt,
    strategy: "fresh",
    instructions: [
      "逐条阅读本轮冻结正文，为骨架 required 的每个 topic 现提至少一条判据：statement 忠实原文（不扩大范围、不改建议为强制），anchor 取原文特征短句（必须逐字存在）。",
      "对每个 conflictProbes 输出结论：persists（矛盾仍在）/ resolved（已解决）/ changed（表述变化），并给出 basis（引用两侧原文）。",
      "冲突监测点结论为 persists 时，必须为两侧表述分别现提判据，并给两条判据标注相同的 conflictGroup（取监测点 id），保留多预期。",
      "判据只能引用本轮冻结快照正文。",
    ],
    requiredTopics: scenario.criteriaSpec.required,
    conflictProbes: scenario.criteriaSpec.conflictProbes ?? [],
    snapshots: frozen.snapshots.filter((snapshot) => scenario.sources.includes(snapshot.snapshotId)),
  }
  return { status: "materials_ready", materials }
}

export async function validateDraft(capability, scenarioId, frozenDirectory, draft) {
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`场景不存在: ${scenarioId}`)
  const { frozen, bodies } = await readFrozenSnapshot(frozenDirectory)
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
  if (invalid.length) return { status: "invalid", invalid }

  const finalCriteria = criteria.map((criterion) => {
    const location = anchorLocation(bodies.get(criterion.snapshotId), criterion.anchor)
    return { ...criterion, status: "fresh", lines: location ? [location.lineStart, location.lineEnd] : null }
  })
  const coveredTopics = new Set(finalCriteria.map((criterion) => criterion.topic))
  const stillMissing = scenario.criteriaSpec.required.filter((topic) => !coveredTopics.has(topic.topic)).map((topic) => topic.topic)
  if (stillMissing.length) return { status: "invalid", invalid: [`骨架主题未被本轮判据覆盖: ${stillMissing.join("、")}`] }

  return {
    status: "validated",
    criteriaDocument: {
      schemaVersion: "1.0",
      featureId: capability.feature.id,
      scenarioId,
      frozenAt: frozen.frozenAt,
      validatedAt: new Date().toISOString(),
      strategy: "fresh",
      snapshots: frozen.snapshots.map(({ snapshotId, officialUrl, title, contentSha256, updatedDate }) => ({ snapshotId, officialUrl, title, contentSha256, updatedDate })),
      criteria: finalCriteria,
      conflictResolutions: resolutions,
      confirmations: [],
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
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot, args.feature ?? "immersive-light")
  const frozenDirectory = resolve(args.frozen)
  let output
  if (args.output) output = resolve(args.output)
  else if (args.project) output = resolveArtifactsRoot(args.project)
  else throw new Error("必须提供 --project <目标工程绝对路径>（产物默认写入 <工程>/ohos-feature-engineering）或 --output <目录>")
  await mkdir(output, { recursive: true })
  // 按场景命名，避免多场景相互覆盖产生重复产物
  const criteriaFileName = `criteria-${args.scenario}.json`
  const materialsFileName = `materials-${args.scenario}.json`

  if (args.mode === "materials") {
    const result = await deriveMaterials(capability, args.scenario, frozenDirectory)
    await writeFile(resolve(output, materialsFileName), `${JSON.stringify(result.materials, null, 2)}\n`, "utf8")
    process.stdout.write(`${JSON.stringify({ status: "materials_ready", snapshotCount: result.materials.snapshots.length, output: resolve(output, materialsFileName) }, null, 2)}\n`)
    return
  }

  if (!args.draft) throw new Error("validate 必须提供 --draft <草稿文件>")
  const draft = await readJsonFile(resolve(args.draft), "criteria-draft")
  const result = await validateDraft(capability, args.scenario, frozenDirectory, draft)
  if (result.status === "invalid") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = 3
    return
  }
  await writeFile(resolve(output, criteriaFileName), `${JSON.stringify(result.criteriaDocument, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({ status: "validated", criteriaCount: result.criteriaDocument.criteria.length, output: resolve(output, criteriaFileName) }, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

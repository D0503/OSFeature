#!/usr/bin/env node
// 运行成功后归档：按 topic/snapshotId 合并本次冻结快照与判据到 sessions/latest，
// 成为下次的“上次审查”基线（其他场景未触及的判据与快照保留）。归档前校验判据锚点命中本次快照。

import { fileURLToPath, pathToFileURL } from "node:url"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { loadCapability } from "./lib/capability-tools.mjs"

function parseArgs(argv) {
  const valued = new Set(["frozen", "criteria", "skill-root"])
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) throw new Error(`未知参数: ${token}`)
    const key = token.slice(2)
    if (!valued.has(key)) throw new Error(`未知参数: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    result[key] = value
    index += 1
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.frozen || !args.criteria) throw new Error("用法: node archive-session.mjs --frozen <冻结目录> --criteria <criteria.json>")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot)
  const frozen = JSON.parse(await readFile(join(resolve(args.frozen), "frozen.json"), "utf8"))
  const criteriaDocument = JSON.parse(await readFile(resolve(args.criteria), "utf8"))
  if (!criteriaDocument.frozenAt || criteriaDocument.frozenAt !== frozen.frozenAt) throw new Error("criteria 与冻结快照不属于同一次冻结")

  const frozenIds = new Set(frozen.snapshots.map((item) => item.snapshotId))
  const bodies = new Map()
  for (const snapshot of frozen.snapshots) {
    bodies.set(snapshot.snapshotId, await readFile(join(resolve(args.frozen), "snapshots", `${snapshot.snapshotId}.md`), "utf8"))
  }
  const broken = []
  for (const criterion of criteriaDocument.criteria) {
    const body = bodies.get(criterion.snapshotId)
    if (!body || !body.includes(criterion.anchor)) broken.push(`${criterion.id}（${criterion.snapshotId}）`)
  }
  if (broken.length) throw new Error(`判据锚点未命中本次快照，禁止归档：${broken.join("、")}`)

  const latest = capability.session
  const latestRoot = join(capability.packageRoot, "sessions", "latest")
  await mkdir(join(latestRoot, "snapshots"), { recursive: true })

  // 快照合并：本次冻结页替换同名旧页，未触及页保留
  const mergedSnapshots = []
  for (const snapshot of latest?.snapshots ?? []) {
    if (frozenIds.has(snapshot.snapshotId)) continue
    mergedSnapshots.push(snapshot)
  }
  for (const snapshot of frozen.snapshots) {
    await copyFile(join(resolve(args.frozen), "snapshots", `${snapshot.snapshotId}.md`), join(latestRoot, "snapshots", `${snapshot.snapshotId}.md`))
    mergedSnapshots.push(snapshot)
  }

  // 判据合并：按 topic 覆盖；conflictResolutions 按 probeId 覆盖；confirmations 追加
  const incomingTopics = new Set(criteriaDocument.criteria.map((criterion) => criterion.topic))
  const mergedCriteria = [
    ...(latest?.criteria ?? []).filter((criterion) => !incomingTopics.has(criterion.topic)),
    ...criteriaDocument.criteria,
  ]
  const incomingProbes = new Set((criteriaDocument.conflictResolutions ?? []).map((item) => item.probeId))
  const mergedResolutions = [
    ...(latest?.conflictResolutions ?? []).filter((item) => !incomingProbes.has(item.probeId)),
    ...(criteriaDocument.conflictResolutions ?? []),
  ]
  const mergedConfirmations = [...(latest?.confirmations ?? []), ...(criteriaDocument.confirmations ?? [])]

  const session = {
    archivedAt: new Date().toISOString(),
    frozenAt: frozen.frozenAt,
    snapshots: mergedSnapshots,
    criteria: mergedCriteria,
    conflictResolutions: mergedResolutions,
    confirmations: mergedConfirmations,
  }
  await writeFile(join(latestRoot, "session.json"), `${JSON.stringify(session, null, 2)}\n`, "utf8")
  process.stdout.write(`${JSON.stringify({ status: "archived", archivedAt: session.archivedAt, snapshots: session.snapshots.length, criteria: session.criteria.length, updatedTopics: [...incomingTopics].length }, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

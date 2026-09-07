#!/usr/bin/env node
// 按场景官网入口实时抓取并冻结本次快照：evidence/frozen/{frozen.json, snapshots/*.md}
// 任一入口不可达即整体失败（网页唯一真值，不回退缓存）。

import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { loadCapability2, resolveScenario2 } from "./lib/capability2-tools.mjs"
import { fetchOfficialDocument, writeFrozenSnapshot } from "./lib/fetch-official.mjs"

function parseArgs(argv) {
  const valued = new Set(["scenario", "sources", "skill-root", "output"])
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
  if (!args.scenario && !args.sources) throw new Error("用法: node freeze-snapshot.mjs --scenario IL-SXXX（或 --sources enable,overview） [--output <目录>]")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability2(args["skill-root"] ?? scriptRoot)

  let snapshotIds
  if (args.scenario) {
    const resolution = resolveScenario2(capability, args.scenario === "all" ? "" : "")
    const scenario = capability.scenariosData.scenarios.find((item) => item.id === args.scenario)
    if (!scenario) throw new Error(`场景不存在: ${args.scenario}`)
    snapshotIds = scenario.sources
  } else {
    snapshotIds = args.sources.split(",").map((item) => item.trim()).filter(Boolean)
    const entryIds = new Set(capability.scenariosData.entryPoints.map((item) => item.snapshotId))
    for (const id of snapshotIds) if (!entryIds.has(id)) throw new Error(`未登记的官网入口: ${id}`)
  }

  const entryById = new Map(capability.scenariosData.entryPoints.map((item) => [item.snapshotId, item]))
  const pages = []
  const failures = []
  for (const snapshotId of snapshotIds) {
    const entry = entryById.get(snapshotId)
    const fetched = await fetchOfficialDocument(entry.officialUrl)
    if (!fetched.ok || !fetched.contentSha256) {
      failures.push({ snapshotId, officialUrl: entry.officialUrl, detail: fetched.detail ?? "正文哈希缺失" })
      continue
    }
    pages.push({ snapshotId, officialUrl: entry.officialUrl, contentSha256: fetched.contentSha256, contentMarkdown: fetched.contentMarkdown, title: fetched.title ?? entry.title, updatedDate: fetched.updatedDate })
  }
  if (failures.length) {
    process.stdout.write(`${JSON.stringify({ status: "failed", failures }, null, 2)}\n`)
    process.exitCode = 3
    return
  }
  const outputDirectory = resolve(args.output ?? "evidence/frozen")
  const frozen = await writeFrozenSnapshot(outputDirectory, pages)
  process.stdout.write(`${JSON.stringify({ status: "frozen", outputDirectory, frozenAt: frozen.frozenAt, snapshots: frozen.snapshots.map((item) => ({ snapshotId: item.snapshotId, contentSha256: item.contentSha256.slice(0, 12), title: item.title })) }, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

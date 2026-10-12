#!/usr/bin/env node
// 按场景官网入口实时抓取并冻结本次快照：<工程>/ohos-feature-engineering/frozen/{frozen.json, snapshots/*.md}
// 任一入口不可达即整体失败（网页唯一真值，不回退缓存）。

import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join, resolve } from "node:path"
import { loadCapability } from "./lib/capability-tools.mjs"
import { fetchOfficialBatch, writeFrozenSnapshot } from "./lib/fetch-official.mjs"
import { resolveArtifactsRoot } from "./lib/artifacts-dir.mjs"

function parseArgs(argv) {
  const valued = new Set(["scenario", "sources", "feature", "skill-root", "output", "project", "work-dir", "concurrency"])
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
  if (!args.scenario && !args.sources) throw new Error("用法: node freeze-snapshot.mjs --feature <特性ID> --scenario <场景ID>（或 --sources <入口ID列表>） --project <目标工程绝对路径> [--output <目录>]")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot, args.feature ?? "immersive-light")

  let snapshotIds
  if (args.scenario) {
    snapshotIds = [...new Set(args.scenario.split(',').flatMap(id => {
      const scenario = capability.scenariosData.scenarios.find(item => item.id === id.trim())
      if (!scenario) throw new Error(`场景不存在: ${id}`)
      return scenario.sources
    }))]
  } else {
    snapshotIds = args.sources.split(",").map((item) => item.trim()).filter(Boolean)
    const entryIds = new Set(capability.scenariosData.entryPoints.map((item) => item.snapshotId))
    for (const id of snapshotIds) if (!entryIds.has(id)) throw new Error(`未登记的官网入口: ${id}`)
  }

  const entryById = new Map(capability.scenariosData.entryPoints.map((item) => [item.snapshotId, item]))
  const pages = []
  const failures = []
  const fetchedPages = await fetchOfficialBatch([...new Set(snapshotIds)].map(id => entryById.get(id)), {
    concurrency: Number(args.concurrency ?? 4), workDirectory: args['work-dir'] ? resolve(args['work-dir']) : undefined,
  })
  for (const fetched of fetchedPages) {
    const snapshotId = fetched.snapshotId
    const entry = entryById.get(snapshotId)
    if (!fetched.ok || !fetched.contentSha256) {
      failures.push({ snapshotId, officialUrl: entry.officialUrl, detail: fetched.detail ?? "正文哈希缺失" })
      continue
    }
    pages.push({ snapshotId, officialUrl: entry.officialUrl, contentSha256: fetched.contentSha256, contentMarkdown: fetched.contentMarkdown, title: fetched.title ?? entry.title, updatedDate: fetched.updatedDate, fetchedAt: fetched.fetchedAt })
  }
  if (failures.length) {
    process.stdout.write(`${JSON.stringify({ status: "failed", failures }, null, 2)}\n`)
    process.exitCode = 3
    return
  }
  let outputDirectory
  if (args.output) outputDirectory = resolve(args.output)
  else if (args.project) outputDirectory = join(resolveArtifactsRoot(args.project), "frozen")
  else throw new Error("必须提供 --project <目标工程绝对路径>（产物默认写入 <工程>/ohos-feature-engineering/frozen）或 --output <目录>")
  const frozen = await writeFrozenSnapshot(outputDirectory, pages)
  process.stdout.write(`${JSON.stringify({ status: "frozen", outputDirectory, frozenAt: frozen.frozenAt, snapshots: frozen.snapshots.map((item) => ({ snapshotId: item.snapshotId, contentSha256: item.contentSha256.slice(0, 12), title: item.title })) }, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

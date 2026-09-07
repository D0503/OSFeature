#!/usr/bin/env node
// Web-first 能力包来源对勘与链接检测：
// - crosscheck：对所选场景的事实实时抓取官网现网页，先做漂移门禁（officialBodySha256 比对），
//   再做锚点定位，产出“statement vs 现网原文”对勘材料包，供忠实性判定使用。
// - links：抓取锁中全部官网 URL 比对哈希，输出漂移报告与受影响事实/场景清单；只报告，不改锁。

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadCapability } from "./lib/capability-tools.mjs"
import { resolveReportOutputDirectory } from "./lib/report-output.mjs"

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

async function defaultFetcher(url) {
  const workDirectory = join(tmpdir(), `cap-fetch-${digest(url).slice(0, 12)}`)
  await mkdir(workDirectory, { recursive: true })
  const outputFile = join(workDirectory, "fetch.json")
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "fetch-doc.mjs")
  try {
    const outcome = await new Promise((resolveResult) => {
      const child = spawn(process.execPath, [script, url, "--output", outputFile], { shell: false, windowsHide: true, timeout: 90_000 })
      child.on("error", (error) => resolveResult({ ok: false, detail: error.message }))
      child.on("close", (code) => resolveResult({ ok: code === 0, code }))
    })
    let payload = null
    try { payload = JSON.parse(await readFile(outputFile, "utf8")) } catch { payload = null }
    if (!outcome.ok && !payload) return { ok: false, detail: `抓取失败（${outcome.detail ?? `退出码 ${outcome.code}`}）` }
    if (!payload) return { ok: false, detail: "抓取结果不可解析。" }
    // fetch-doc 对内容过短等场景以非零退出码输出 review_required；页面可达且正文完整时仍视为可用。
    return { ok: true, contentSha256: payload.contentSha256 ?? null, contentMarkdown: payload.contentMarkdown ?? "", payload }
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

function excerptAround(content, anchor, contextLines = 3) {
  const index = content.indexOf(anchor)
  if (index < 0) return []
  const lines = content.split(/\r?\n/)
  let consumed = 0
  for (let line = 0; line < lines.length; line += 1) {
    if (consumed + lines[line].length >= index) {
      const start = Math.max(0, line - contextLines)
      const end = Math.min(lines.length - 1, line + contextLines)
      return lines.slice(start, end + 1).map((text, offset) => ({ line: start + offset + 1, text }))
    }
    consumed += lines[line].length + 1
  }
  return []
}

export async function crosscheckCapabilitySources(capability, options = {}) {
  const fetcher = options.fetcher ?? defaultFetcher
  const scenarios = capability.scenariosData.scenarios
  let targetFacts = capability.factsData.facts
  if (options.scenarioId) {
    const scenario = scenarios.find((item) => item.id === options.scenarioId)
    if (!scenario) throw new Error(`场景不存在: ${options.scenarioId}`)
    const refs = new Set(scenario.factRefs)
    targetFacts = targetFacts.filter((fact) => refs.has(fact.id))
  } else if (options.factIds) {
    const refs = new Set(options.factIds)
    targetFacts = targetFacts.filter((fact) => refs.has(fact.id))
    for (const id of refs) if (!targetFacts.some((fact) => fact.id === id)) throw new Error(`事实不存在: ${id}`)
  }
  const lockedSources = new Map(capability.lock.sourceDocuments.map((source) => [source.snapshotId, source]))
  const cache = new Map()
  const entries = []
  const counters = { crosschecked: 0, drifted: 0, unreachable: 0, anchor_not_found: 0, url_missing: 0 }
  for (const fact of targetFacts) {
    for (const source of fact.sources) {
      const locked = lockedSources.get(source.snapshotId)
      if (!locked?.officialUrl || !locked.officialBodySha256) {
        counters.url_missing += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, status: "url_missing", detail: "锁条目缺少官网 URL 或现网正文哈希。" })
        continue
      }
      if (!cache.has(locked.officialUrl)) cache.set(locked.officialUrl, await fetcher(locked.officialUrl))
      const fetched = cache.get(locked.officialUrl)
      if (!fetched.ok) {
        counters.unreachable += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, status: "unreachable", detail: fetched.detail ?? "官网不可达；按网页唯一真值策略阻塞。" })
        continue
      }
      if (fetched.contentSha256?.toLowerCase() !== locked.officialBodySha256.toLowerCase()) {
        counters.drifted += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, status: "drifted", detail: "现网正文哈希与锁不一致：官网已更新，能力包需重新审查。" })
        continue
      }
      if (!source.anchor || !fetched.contentMarkdown.includes(source.anchor)) {
        counters.anchor_not_found += 1
        entries.push({ factId: fact.id, snapshotId: source.snapshotId, officialUrl: locked.officialUrl, status: "anchor_not_found", anchor: source.anchor ?? null, statement: fact.statement, detail: "锚点未在现网正文命中。" })
        continue
      }
      counters.crosschecked += 1
      entries.push({
        factId: fact.id,
        snapshotId: source.snapshotId,
        officialUrl: locked.officialUrl,
        status: "ready_for_judgment",
        statement: fact.statement,
        normativeStatus: fact.normativeStatus,
        anchor: source.anchor,
        excerpt: excerptAround(fetched.contentMarkdown, source.anchor),
      })
    }
  }
  const failed = counters.drifted || counters.unreachable || counters.anchor_not_found || counters.url_missing
  return { status: failed ? "failed" : "passed", scenarioId: options.scenarioId ?? null, counters, entries }
}

export async function checkCapabilityLinks(capability, options = {}) {
  const fetcher = options.fetcher ?? defaultFetcher
  const factsBySnapshot = new Map()
  for (const fact of capability.factsData.facts) {
    for (const source of fact.sources) {
      if (!factsBySnapshot.has(source.snapshotId)) factsBySnapshot.set(source.snapshotId, new Set())
      factsBySnapshot.get(source.snapshotId).add(fact.id)
    }
  }
  const results = []
  const changedPendingReview = []
  for (const source of capability.lock.sourceDocuments) {
    if (!source.officialUrl || !source.officialBodySha256) { results.push({ snapshotId: source.snapshotId, status: "url_missing" }); continue }
    const fetched = await fetcher(source.officialUrl)
    if (!fetched.ok) { results.push({ snapshotId: source.snapshotId, officialUrl: source.officialUrl, status: "unreachable", detail: fetched.detail ?? "官网不可达。" }); continue }
    const matched = fetched.contentSha256?.toLowerCase() === source.officialBodySha256.toLowerCase()
    const affectedFactRefs = [...(factsBySnapshot.get(source.snapshotId) ?? [])]
    const affectedScenarios = capability.scenariosData.scenarios.filter((scenario) => scenario.factRefs.some((id) => affectedFactRefs.includes(id))).map((scenario) => scenario.id)
    const item = {
      snapshotId: source.snapshotId,
      officialUrl: source.officialUrl,
      status: matched ? "ok" : "drifted",
      affectedFactRefs,
      affectedScenarios,
      detail: matched ? "现网正文与锁定内容一致。" : "现网正文与锁定内容不一致：官网可能已更新，需重新审查后再更新能力包，不得直接改锁。",
    }
    results.push(item)
    if (!matched) changedPendingReview.push({ snapshotId: source.snapshotId, officialUrl: source.officialUrl, affectedFactRefs, affectedScenarios })
  }
  const counters = results.reduce((accumulator, item) => { accumulator[item.status] = (accumulator[item.status] ?? 0) + 1; return accumulator }, {})
  return { status: (counters.drifted ?? 0) || (counters.unreachable ?? 0) || (counters.url_missing ?? 0) ? "attention" : "ok", counters, changedPendingReview, results }
}

function parseArgs(argv) {
  const valued = new Set(["scenario", "facts", "skill-root", "output"])
  const [mode, ...rest] = argv
  if (mode !== "crosscheck" && mode !== "links") throw new Error("用法: node verify-capability-sources.mjs <crosscheck|links> [--scenario IL-SXXX | --facts IL-F001,IL-F002] [--output <目录>] [--skill-root <根>]")
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const capability = await loadCapability(args["skill-root"] ?? scriptRoot)
  let result
  if (args.mode === "crosscheck") {
    result = await crosscheckCapabilitySources(capability, {
      scenarioId: args.scenario,
      factIds: args.facts ? args.facts.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
    })
  } else {
    result = await checkCapabilityLinks(capability)
  }
  if (args.output) {
    const output = resolveReportOutputDirectory(args.output)
    await mkdir(output, { recursive: true })
    const fileName = args.mode === "crosscheck" ? "faithfulness-material.json" : "capability-link-check.json"
    await writeFile(join(output, fileName), `${JSON.stringify(result, null, 2)}\n`, "utf8")
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status !== "passed" && result.status !== "ok") process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

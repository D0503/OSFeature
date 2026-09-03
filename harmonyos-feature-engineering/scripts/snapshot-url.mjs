#!/usr/bin/env node

import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises"
import { join, dirname, resolve } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { validateOfficialFinalUrl, validateOfficialPageUrl } from "./lib/official-url.mjs"

const execFileAsync = promisify(execFile)
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_MAX_PAGES = 12
const MAX_BUFFER = 8 * 1024 * 1024

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function documentKey(value) {
  const parsed = new URL(validateOfficialFinalUrl(value))
  parsed.hash = ""
  parsed.search = ""
  return parsed.toString()
}

function documentRoute(value) {
  const parsed = new URL(documentKey(value))
  const segments = parsed.pathname.split("/").filter(Boolean)
  if (segments.length < 5 || segments[0] !== "consumer" || segments[2] !== "doc") return null
  return { language: segments[1], catalog: segments[3], documentId: segments.slice(4).join("/") }
}

function eligibleFeatureUrl(value, rootRoute) {
  if (!rootRoute) return false
  let route
  try {
    validateOfficialPageUrl(value)
    route = documentRoute(value)
  } catch {
    return false
  }
  return route && route.language === rootRoute.language && route.catalog === rootRoute.catalog &&
    (route.documentId === rootRoute.documentId || route.documentId.startsWith(`${rootRoute.documentId}-`))
}

function safeId(value, index) {
  const route = documentRoute(value)
  const raw = route?.documentId ?? new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? `document-${index + 1}`
  const normalized = raw.replace(/[^A-Za-z0-9._~-]+/g, "-").replace(/^-+|-+$/g, "")
  return normalized || `document-${index + 1}`
}

function normalizeSnapshotMarkdown(fetched, canonicalUrl) {
  const parts = []
  if (!/(?:原文|来源)\s*[：:]\s*https:\/\//i.test(fetched.contentMarkdown)) parts.push(`> 原文：${canonicalUrl}`)
  if (!/^#\s+\S+/m.test(fetched.contentMarkdown) && fetched.title) parts.push(`# ${fetched.title}`)
  parts.push(fetched.contentMarkdown.trim())
  return `${parts.filter(Boolean).join("\n\n")}\n`
}

function rewriteCapturedLinks(markdown, filenames) {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (whole, prefix, target, suffix) => {
    let parsed
    try {
      parsed = new URL(target.replace(/^<|>$/g, ""))
    } catch {
      return whole
    }
    const fragment = parsed.hash
    parsed.hash = ""
    parsed.search = ""
    let key
    try {
      key = documentKey(parsed.toString())
    } catch {
      return whole
    }
    const filename = filenames.get(key)
    return filename ? `${prefix}./${filename}${fragment}${suffix}` : whole
  })
}

function categoryFor(url) {
  const path = new URL(url).pathname
  if (path.includes("/harmonyos-references/")) return "api-reference"
  if (path.includes("/design-guides/")) return "design-guide"
  return "development-guide"
}

function declaredVersions(markdown) {
  const versions = []
  for (const line of markdown.split("\n")) {
    if (!/(?:API|SDK|HarmonyOS|版本)/i.test(line)) continue
    for (const match of line.matchAll(/\b\d+(?:\.\d+){0,2}\b/g)) versions.push(match[0])
  }
  return [...new Set(versions)]
}

async function defaultFetcher(url) {
  let stdout
  try {
    ;({ stdout } = await execFileAsync(process.execPath, [join(SCRIPT_DIR, "fetch-doc.mjs"), url], {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    }))
  } catch (error) {
    if ([0, 1].includes(error?.code) && typeof error.stdout === "string") stdout = error.stdout
    else throw new Error(String(error?.stderr || error?.message || error).trim())
  }
  return JSON.parse(stdout)
}

async function prepareOutputDirectory(requested) {
  if (!requested) return { path: await mkdtemp(join(tmpdir(), "harmonyos-source-snapshot-")), temporary: true }
  const path = requested
  try {
    const info = await stat(path)
    if (!info.isDirectory()) throw new Error(`输出位置不是目录: ${path}`)
    if ((await readdir(path)).length) throw new Error(`输出目录必须为空，拒绝覆盖已有内容: ${path}`)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
    await mkdir(path, { recursive: true })
  }
  return { path, temporary: false }
}

function parseArgs(argv) {
  const args = [...argv]
  const url = args.shift()
  let outputDirectory = null
  let maxPages = DEFAULT_MAX_PAGES
  let includeLinkedPages = true
  while (args.length) {
    const option = args.shift()
    if (option === "--output-dir" && args.length) outputDirectory = resolve(args.shift())
    else if (option === "--max-pages" && args.length) maxPages = Number(args.shift())
    else if (option === "--single-page") includeLinkedPages = false
    else throw new Error("用法: node snapshot-url.mjs <official-url> [--output-dir <empty-directory>] [--max-pages 12] [--single-page]")
  }
  if (!url || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw new Error("URL 缺失，或 --max-pages 必须是 1–50 的整数")
  return { url, outputDirectory, maxPages, includeLinkedPages }
}

export async function snapshotOfficialUrl(rawUrl, options = {}) {
  const initialUrl = documentKey(validateOfficialPageUrl(rawUrl))
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES
  const includeLinkedPages = options.includeLinkedPages ?? true
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw new Error("maxPages 必须是 1–50 的整数")
  const output = await prepareOutputDirectory(options.outputDirectory ?? null)
  const fetcher = options.fetcher ?? defaultFetcher
  const rootRoute = documentRoute(initialUrl)
  const queue = [initialUrl]
  const queued = new Set(queue)
  const fetchedByUrl = new Map()
  const failures = []

  while (queue.length && fetchedByUrl.size < maxPages) {
    const requestedUrl = queue.shift()
    try {
      const fetched = await fetcher(requestedUrl)
      const canonicalUrl = documentKey(fetched.canonicalUrl ?? fetched.pageUrl ?? requestedUrl)
      fetchedByUrl.set(canonicalUrl, { requestedUrl, canonicalUrl, fetched })
      if (!includeLinkedPages) continue
      for (const link of fetched.links ?? []) {
        if (!eligibleFeatureUrl(link.url, rootRoute)) continue
        const key = documentKey(link.url)
        if (!queued.has(key) && !fetchedByUrl.has(key) && queued.size < maxPages) {
          queued.add(key)
          queue.push(key)
        }
      }
    } catch (error) {
      failures.push({ url: requestedUrl, error: error instanceof Error ? error.message : String(error) })
      if (requestedUrl === initialUrl) throw new Error(`入口页面抓取失败: ${failures.at(-1).error}`)
    }
  }

  const records = [...fetchedByUrl.values()]
  const usedIds = new Set()
  const filenames = new Map()
  for (let index = 0; index < records.length; index += 1) {
    let id = safeId(records[index].canonicalUrl, index)
    if (usedIds.has(id)) id = `${id}-${digest(records[index].canonicalUrl).slice(0, 8)}`
    usedIds.add(id)
    records[index].id = id
    records[index].filename = `${id}.md`
    filenames.set(records[index].canonicalUrl, records[index].filename)
  }

  const evidenceDirectory = join(output.path, "evidence", "fetch")
  await mkdir(evidenceDirectory, { recursive: true })
  const snapshotItems = []
  const officialReferenceMap = new Map()
  const mediaReferenceMap = new Map()

  for (const record of records) {
    const normalized = normalizeSnapshotMarkdown(record.fetched, record.canonicalUrl)
    const markdown = rewriteCapturedLinks(normalized, filenames)
    const markdownBytes = Buffer.from(markdown, "utf8")
    const fetchJson = `${JSON.stringify(record.fetched, null, 2)}\n`
    const fetchEvidencePath = join("evidence", "fetch", `${record.id}.json`).replace(/\\/g, "/")
    await writeFile(join(output.path, record.filename), markdownBytes)
    await writeFile(join(output.path, fetchEvidencePath), fetchJson, "utf8")

    const navigationOnly = record.fetched.contentText?.length < 200 && (record.fetched.links?.length ?? 0) > 0
    snapshotItems.push({
      id: record.id,
      title: record.fetched.title ?? record.id,
      category: categoryFor(record.canonicalUrl),
      officialUrl: record.canonicalUrl,
      requestedUrl: record.requestedUrl,
      localPath: record.filename,
      bytes: markdownBytes.length,
      sha256: digest(markdownBytes),
      capturedAt: record.fetched.retrievedAt ?? null,
      updatedAt: record.fetched.updatedDate ?? record.fetched.displayUpdateTime ?? null,
      retrievalMethod: record.fetched.retrievalMethod ?? "unknown",
      contentStatus: navigationOnly ? "navigation-only" : "page-body-present",
      declaredApiVersions: declaredVersions(markdown),
      fetchEvidencePath,
      fetchEvidenceSha256: digest(fetchJson),
    })

    for (const link of record.fetched.links ?? []) {
      let parsed
      try {
        parsed = new URL(link.url)
      } catch {
        continue
      }
      if (parsed.hostname.toLowerCase() !== "developer.huawei.com") continue
      const exactUrl = parsed.toString()
      const key = exactUrl
      const identity = documentKey(exactUrl)
      const item = officialReferenceMap.get(key) ?? {
        url: exactUrl,
        category: categoryFor(exactUrl),
        snapshotStatus: filenames.has(identity) ? "snapshotted" : "not-snapshotted",
        snapshotId: records.find((entry) => entry.canonicalUrl === identity)?.id ?? null,
        occurrences: 0,
        linkTexts: [],
        referencedBy: [],
      }
      item.occurrences += 1
      if (link.text && !item.linkTexts.includes(link.text)) item.linkTexts.push(link.text)
      if (!item.referencedBy.includes(record.id)) item.referencedBy.push(record.id)
      officialReferenceMap.set(key, item)
    }
    for (const match of markdown.matchAll(/https:\/\/media:[^)\s]+/g)) {
      const url = match[0]
      const item = mediaReferenceMap.get(url) ?? { url, status: "internal-reference-unresolved", occurrences: 0, referencedBy: [] }
      item.occurrences += 1
      if (!item.referencedBy.includes(record.id)) item.referencedBy.push(record.id)
      mediaReferenceMap.set(url, item)
    }
  }

  const completedAt = new Date().toISOString()
  const readme = [
    `# ${records[0]?.fetched.title ?? "HarmonyOS 官方文档快照"}`,
    "",
    `> 入口：${initialUrl}`,
    `> 快照完成时间：${completedAt}`,
    `> 抓取范围：${includeLinkedPages ? `同目录且文档 ID 以 ${rootRoute?.documentId ?? "入口"} 为前缀的页面` : "仅入口页面"}`,
    "",
    "## 文档",
    "",
    ...snapshotItems.map((item) => `- [${item.title}](./${item.localPath})`),
    "",
    "## 完整性",
    "",
    `- 成功快照：${snapshotItems.length}`,
    `- 抓取失败：${failures.length}`,
    `- 未快照官方引用：${[...officialReferenceMap.values()].filter((item) => item.snapshotStatus !== "snapshotted").length}`,
    `- 未解析媒体引用：${mediaReferenceMap.size}`,
    "",
  ].join("\n")
  await writeFile(join(output.path, "README.md"), readme, "utf8")

  const readmeBytes = Buffer.from(readme, "utf8")
  const officialReferences = [...officialReferenceMap.values()].sort((a, b) => a.url.localeCompare(b.url))
  const mediaReferences = [...mediaReferenceMap.values()].sort((a, b) => a.url.localeCompare(b.url))
  const manifest = {
    schemaVersion: "1.0",
    sourceType: "official-url-snapshot",
    rootUrl: initialUrl,
    capture: { capturedAt: completedAt, status: failures.length ? "partial" : "recorded" },
    crawlPolicy: {
      includeLinkedPages,
      maxPages,
      allowedDomain: "developer.huawei.com",
      allowedScope: rootRoute ? `/${rootRoute.language}/${rootRoute.catalog}/${rootRoute.documentId}*` : "entry-page-only",
      recursiveExternalLinks: false,
    },
    collectionIndex: {
      localPath: "README.md",
      bytes: readmeBytes.length,
      sha256: digest(readmeBytes),
      derived: true,
      officialRootUrl: initialUrl,
    },
    summary: {
      snapshotDocuments: snapshotItems.length,
      navigationOnlyDocuments: snapshotItems.filter((item) => item.contentStatus === "navigation-only").length,
      officialReferences: officialReferences.length,
      unsnapshottedOfficialReferences: officialReferences.filter((item) => item.snapshotStatus !== "snapshotted").length,
      unresolvedMediaReferences: mediaReferences.length,
      fetchFailures: failures.length,
    },
    snapshots: snapshotItems,
    officialReferences,
    mediaReferences,
    fetchFailures: failures,
    generatedBy: "harmonyos-feature-engineering/scripts/snapshot-url.mjs",
  }
  await writeFile(join(output.path, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  return { outputDirectory: output.path, temporary: output.temporary, manifest, documents: snapshotItems }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const result = await snapshotOfficialUrl(args.url, args)
  process.stdout.write(`${JSON.stringify({
    status: result.manifest.capture.status,
    outputDirectory: result.outputDirectory,
    temporary: result.temporary,
    documents: result.documents.length,
    failures: result.manifest.fetchFailures.length,
  })}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

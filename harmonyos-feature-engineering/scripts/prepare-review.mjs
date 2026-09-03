#!/usr/bin/env node

import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { access, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { parseHtml, parseMarkdown } from "./lib/document-parser.mjs"
import { validateOfficialPageUrl } from "./lib/official-url.mjs"

const execFileAsync = promisify(execFile)
const MAX_BYTES = 1024 * 1024
const SUPPORTED = new Set([".md", ".markdown", ".html", ".htm", ".txt"])
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function normalizePath(value) {
  return resolve(value)
}

function isWithin(root, target) {
  const rel = relative(root, target)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length
}

function locationFor(document, line, quote = null) {
  const section = [...document.sections].reverse().find((item) => item.lineStart <= line)
  return {
    source: document.sourcePath ?? document.canonicalUrl ?? document.sourceUrl,
    section: section?.heading ?? "文档开头",
    line,
    quote,
  }
}

function collectVersionStatements(content) {
  const statements = []
  const lines = String(content).split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!/(?:API|SDK|HarmonyOS|鸿蒙|版本)/i.test(line)) continue
    const versions = [...line.matchAll(/\b\d+(?:\.\d+){0,2}\b/g)].map((match) => match[0])
    if (versions.length) statements.push({ line: index + 1, text: line.trim(), versions: [...new Set(versions)] })
  }
  return statements
}

function collectSourceMetadata(content, fallbackUrl = null) {
  const declared = /(?:原文|来源)\s*[：:]\s*(https:\/\/[^\s)>]+)/i.exec(String(content))?.[1] ?? null
  return { declaredSourceUrl: declared, suppliedOfficialUrl: fallbackUrl }
}

function parseArgs(argv) {
  const args = [...argv]
  const input = args.shift()
  let output = null
  let maxEvidencePages = 12
  while (args.length) {
    const option = args.shift()
    if (option === "--output" && args.length) output = resolve(args.shift())
    else if (option === "--max-evidence-pages" && args.length) maxEvidencePages = Number(args.shift())
    else throw new Error("用法: node prepare-review.mjs <file|directory|URL> [--output <json>] [--max-evidence-pages 12]")
  }
  if (!input || !Number.isInteger(maxEvidencePages) || maxEvidencePages < 1 || maxEvidencePages > 100) {
    throw new Error("输入缺失，或 --max-evidence-pages 必须是 1–100 的整数")
  }
  return { input, output, maxEvidencePages }
}

async function parseLocalDocument(sourcePath, metadata = {}) {
  const fileStat = await stat(sourcePath)
  if (!fileStat.isFile()) throw new Error(`不是普通文件: ${sourcePath}`)
  if (fileStat.size > MAX_BYTES) throw new Error(`文件超过 ${MAX_BYTES} 字节上限: ${sourcePath}`)
  const bytes = await readFile(sourcePath)
  const raw = bytes.toString("utf8")
  const extension = extname(sourcePath).toLowerCase()
  if (!SUPPORTED.has(extension)) throw new Error(`不支持的文件类型: ${sourcePath}`)
  const sourceFormat = [".html", ".htm"].includes(extension) ? "html" : [".md", ".markdown"].includes(extension) ? "markdown" : "text"
  const parsed = sourceFormat === "html" ? parseHtml(raw, { baseUrl: metadata.officialUrl }) : parseMarkdown(raw)
  return {
    id: metadata.id ?? basename(sourcePath, extension),
    sourcePath,
    sourceUrl: metadata.officialUrl ?? null,
    canonicalUrl: metadata.canonicalUrl ?? metadata.officialUrl ?? null,
    retrievalMethod: metadata.retrievalMethod ?? "local_file",
    sourceFormat,
    bytes: bytes.length,
    sha256: sha256(bytes),
    expectedSha256: metadata.sha256 ?? null,
    observedFileModifiedAt: fileStat.mtime.toISOString(),
    capturedAt: metadata.capturedAt ?? null,
    declaredUpdatedAt: metadata.declaredUpdatedAt ?? null,
    contentStatus: metadata.contentStatus ?? null,
    sourceMetadata: collectSourceMetadata(raw, metadata.officialUrl ?? null),
    versionStatements: collectVersionStatements(parsed.contentMarkdown),
    ...parsed,
  }
}

async function fetchOfficialDocument(input) {
  const requestUrl = validateOfficialPageUrl(input)
  let stdout
  try {
    ;({ stdout } = await execFileAsync(process.execPath, [join(SCRIPT_DIR, "fetch-doc.mjs"), requestUrl], {
      encoding: "utf8",
      maxBuffer: 4 * MAX_BYTES,
      windowsHide: true,
    }))
  } catch (error) {
    if ([0, 1].includes(error?.code) && typeof error.stdout === "string") stdout = error.stdout
    else throw new Error(`官网抓取失败: ${String(error?.stderr || error?.message || error).trim()}`)
  }
  const fetched = JSON.parse(stdout)
  return {
    id: fetched.documentId ?? new URL(fetched.canonicalUrl).pathname.split("/").filter(Boolean).at(-1) ?? "official-document",
    sourcePath: null,
    sourceUrl: requestUrl,
    canonicalUrl: fetched.canonicalUrl,
    retrievalMethod: fetched.retrievalMethod,
    sourceFormat: "markdown",
    bytes: Buffer.byteLength(fetched.contentMarkdown, "utf8"),
    sha256: fetched.contentSha256,
    expectedSha256: null,
    observedFileModifiedAt: null,
    capturedAt: fetched.retrievedAt,
    declaredUpdatedAt: fetched.updatedDate ?? fetched.displayUpdateTime ?? null,
    contentStatus: fetched.warnings?.includes("possible_js_shell") ? "possible-js-shell" : "page-body-present",
    fetchWarnings: fetched.warnings ?? [],
    sourceMetadata: collectSourceMetadata(fetched.contentMarkdown, fetched.canonicalUrl),
    versionStatements: collectVersionStatements(fetched.contentMarkdown),
    title: fetched.title,
    contentMarkdown: fetched.contentMarkdown,
    contentText: fetched.contentText,
    sections: fetched.sections,
    codeBlocks: fetched.codeBlocks,
    links: fetched.links,
  }
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readManifest(manifestPath, integrity) {
  const manifestStat = await stat(manifestPath)
  if (manifestStat.size > MAX_BYTES) throw new Error(`内部快照索引超过 ${MAX_BYTES} 字节上限`)
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  } catch (error) {
    throw new Error(`无法解析内部快照索引 ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(manifest.snapshots)) throw new Error("内部快照索引缺少 snapshots 数组")
  const root = dirname(manifestPath)
  const rootRealPath = await realpath(root)
  const documents = []
  const defaultCapture = manifest.capture?.capturedAt ?? null
  for (const snapshot of manifest.snapshots) {
    if (!snapshot || typeof snapshot.localPath !== "string") {
      integrity.errors.push("清单快照缺少 localPath")
      continue
    }
    const sourcePath = resolve(root, snapshot.localPath)
    if (!isWithin(root, sourcePath)) {
      integrity.errors.push(`清单路径逃逸资料集目录: ${snapshot.localPath}`)
      continue
    }
    if (!(await exists(sourcePath))) {
      integrity.errors.push(`清单文件不存在: ${snapshot.localPath}`)
      continue
    }
    const sourceRealPath = await realpath(sourcePath)
    if (!isWithin(rootRealPath, sourceRealPath)) {
      integrity.errors.push(`清单路径通过链接逃逸资料集目录: ${snapshot.localPath}`)
      continue
    }
    const document = await parseLocalDocument(sourceRealPath, {
      ...snapshot,
      capturedAt: snapshot.capturedAt ?? defaultCapture,
      declaredUpdatedAt: snapshot.updatedAt ?? null,
      retrievalMethod: "manifest_snapshot",
    })
    documents.push(document)
    const hashMatches = typeof snapshot.sha256 === "string" && snapshot.sha256.toLowerCase() === document.sha256
    integrity.items.push({
      id: document.id,
      source: sourcePath,
      officialUrl: document.sourceUrl,
      expectedSha256: snapshot.sha256 ?? null,
      sha256: document.sha256,
      hashMatches,
      capturedAt: document.capturedAt,
      observedFileModifiedAt: document.observedFileModifiedAt,
    })
    if (!hashMatches) integrity.errors.push(`SHA-256 不匹配: ${snapshot.localPath}`)
  }
  if (!defaultCapture) integrity.warnings.push("官网抓取时间未记录；未使用本地修改时间替代")
  return { manifest, documents, root }
}

async function readDirectory(inputPath, integrity) {
  const manifestPath = join(inputPath, "source-manifest.json")
  if (await exists(manifestPath)) {
    integrity.manifestUsed = true
    return { ...(await readManifest(manifestPath, integrity)), manifestPath }
  }
  const entries = (await readdir(inputPath, { withFileTypes: true }))
    .filter((item) => item.isFile() && SUPPORTED.has(extname(item.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
  const documents = []
  for (const entry of entries) {
    const document = await parseLocalDocument(join(inputPath, entry.name))
    documents.push(document)
    integrity.items.push({
      id: document.id,
      source: document.sourcePath,
      officialUrl: null,
      expectedSha256: null,
      sha256: document.sha256,
      hashMatches: null,
      capturedAt: null,
      observedFileModifiedAt: document.observedFileModifiedAt,
    })
  }
  return { manifest: null, documents, root: inputPath, manifestPath: null }
}

function collectMarkdownTargets(markdown) {
  const targets = []
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    targets.push({ target: match[1].trim().replace(/^<|>$/g, ""), index: match.index, image: match[0].startsWith("!") })
  }
  return targets
}

function addCandidate(candidates, type, message, locations = [], details = {}) {
  candidates.push({ id: `PRE-${String(candidates.length + 1).padStart(3, "0")}`, type, message, locations, details })
}

async function buildPreflight(documents, root, manifest) {
  const candidates = []
  const scopeGlobal = []
  const scopeLimited = []
  const transparencyRules = []
  const opaqueExamples = []

  for (const document of documents) {
    const content = document.contentMarkdown
    if (!/^#\s+\S+/m.test(content)) addCandidate(candidates, "missing-h1", "文档缺少一级标题。", [locationFor(document, 1)])
    if (document.contentStatus === "navigation-only" || (document.contentText.length < 200 && document.links.length > 0)) {
      addCandidate(candidates, "navigation-only", "页面正文很短且主要承担导航职责。", [locationFor(document, 1)])
    }
    for (const block of document.codeBlocks) {
      if (!block.language) addCandidate(candidates, "unlabeled-code-fence", "代码围栏未声明语言。", [locationFor(document, block.startLine)])
      if (/\buiMaterial\s*\./.test(block.content) && !/import\s*\{[^}]*\buiMaterial\b[^}]*\}\s*from\s*['"]@kit\.ArkUI['"]/.test(block.content)) {
        addCandidate(candidates, "missing-import-context", "代码块使用 uiMaterial，但同一可复制代码块中没有对应 import。", [locationFor(document, block.startLine)])
      }
      const missingSymbols = []
      if (/\blistItems\b/.test(block.content) && !/(?:let|const|private|public|protected|@State|@Local|@Prop|@Param)\s+(?:\w+\s+)*listItems\b/.test(block.content)) missingSymbols.push("listItems")
      if (/\bListItemData\b/.test(block.content) && !/(?:interface|type|class)\s+ListItemData\b/.test(block.content)) missingSymbols.push("ListItemData")
      if (missingSymbols.length) {
        addCandidate(candidates, "missing-variable-context", `代码块使用但未实际声明上下文符号：${missingSymbols.join("、")}。`, [locationFor(document, block.startLine)], { symbols: missingSymbols })
      }
      for (const match of block.content.matchAll(/materialColor\s*:\s*['"](#[0-9a-fA-F]{6})['"]/g)) {
        opaqueExamples.push(locationFor(document, block.startLine + lineOf(block.content, match.index) - 1, match[0]))
      }
      for (const match of block.content.matchAll(/开发者需要(?:自定义|替换|补充)[^\n]*/g)) {
        addCandidate(candidates, "external-example-context", "示例依赖开发者自行补充的上下文，可能无法直接复制运行。", [locationFor(document, block.startLine + lineOf(block.content, match.index) - 1, match[0])])
      }
    }

    for (const link of collectMarkdownTargets(content)) {
      const line = lineOf(content, link.index)
      if (/^https:\/\/media:/i.test(link.target)) {
        addCandidate(candidates, "unresolved-media-reference", "站内媒体引用无法作为当前资料集中的可访问资源。", [locationFor(document, line, link.target)])
        continue
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(link.target) || link.target.startsWith("#")) continue
      if (!document.sourcePath) continue
      const cleanTarget = decodeURIComponent(link.target.split(/[?#]/)[0])
      if (!cleanTarget) continue
      const targetPath = resolve(dirname(document.sourcePath), cleanTarget)
      if (!isWithin(root, targetPath) || !(await exists(targetPath))) {
        addCandidate(candidates, "broken-relative-link", "相对链接在资料集内无法解析。", [locationFor(document, line, link.target)], { targetPath })
      }
    }

    for (const match of content.matchAll(/[^\n]*(?:disable|关闭)[^\n]*(?:全局禁用|全局失效|应用级或组件级[^\n]*不生效)[^\n]*/gi)) {
      scopeGlobal.push(locationFor(document, lineOf(content, match.index), match[0].trim()))
    }
    for (const match of content.matchAll(/[^\n]*disable[^\n]*(?:只针对|仅针对)[^\n]*应用级[^\n]*/gi)) {
      scopeLimited.push(locationFor(document, lineOf(content, match.index), match[0].trim()))
    }
    for (const match of content.matchAll(/[^\n]*materialColor[^\n]*(?:需要[^\n]*透明度|不透明[^\n]*(?:遮挡|覆盖))[^\n]*/gi)) {
      transparencyRules.push(locationFor(document, lineOf(content, match.index), match[0].trim()))
    }
  }

  if (scopeGlobal.length && scopeLimited.length) {
    addCandidate(candidates, "potential-scope-conflict", "disable 的全局作用域与“只针对应用级”的描述可能冲突。", [scopeGlobal[0], scopeLimited[0]], {
      globalMatches: scopeGlobal.length,
      limitedMatches: scopeLimited.length,
    })
  }
  if (transparencyRules.length && opaqueExamples.length) {
    addCandidate(candidates, "potential-material-color-conflict", "文档要求 materialColor 带透明度，但示例包含 6 位不透明色值。", [transparencyRules[0], ...opaqueExamples.slice(0, 5)], {
      ruleMatches: transparencyRules.length,
      opaqueExampleMatches: opaqueExamples.length,
    })
  }
  if (manifest) {
    const unsnapshotted = Array.isArray(manifest.officialReferences)
      ? manifest.officialReferences.filter((item) => item?.snapshotStatus !== "snapshotted")
      : []
    if (unsnapshotted.length) {
      addCandidate(candidates, "unsnapshotted-official-references", `${unsnapshotted.length} 个官方关联引用未包含在当前快照中。`, [], {
        count: unsnapshotted.length,
        sampleUrls: unsnapshotted.slice(0, 12).map((item) => item.url),
      })
    }
    const unresolvedMedia = Array.isArray(manifest.mediaReferences)
      ? manifest.mediaReferences.filter((item) => item?.status !== "resolved")
      : []
    if (unresolvedMedia.length) {
      addCandidate(candidates, "manifest-unresolved-media", `清单记录 ${unresolvedMedia.length} 个未解析媒体引用。`, [], { count: unresolvedMedia.length })
    }
  }
  return candidates
}

export async function prepareReview(rawInput, options = {}) {
  const maxEvidencePages = options.maxEvidencePages ?? 12
  const integrity = { status: "verified", manifestUsed: false, items: [], warnings: [], errors: [] }
  let kind
  let inputValue
  let documents
  let root
  let manifest = null
  let manifestPath = null

  if (/^https?:\/\//i.test(rawInput)) {
    kind = "url"
    inputValue = validateOfficialPageUrl(rawInput)
    const document = await fetchOfficialDocument(inputValue)
    documents = [document]
    root = null
    integrity.items.push({
      id: document.id,
      source: document.canonicalUrl,
      officialUrl: document.canonicalUrl,
      expectedSha256: null,
      sha256: document.sha256,
      hashMatches: null,
      capturedAt: document.capturedAt,
      observedFileModifiedAt: null,
    })
    integrity.warnings.push(...(document.fetchWarnings ?? []))
  } else {
    inputValue = normalizePath(rawInput)
    const inputStat = await stat(inputValue)
    if (inputStat.isDirectory()) {
      kind = "directory"
      ;({ documents, root, manifest, manifestPath } = await readDirectory(inputValue, integrity))
    } else if (inputStat.isFile() && basename(inputValue).toLowerCase() === "source-manifest.json") {
      throw new Error("不接受 source-manifest.json 作为输入；请提供其所在文档目录")
    } else if (inputStat.isFile()) {
      kind = "file"
      root = dirname(inputValue)
      const document = await parseLocalDocument(inputValue)
      documents = [document]
      integrity.items.push({
        id: document.id,
        source: document.sourcePath,
        officialUrl: null,
        expectedSha256: null,
        sha256: document.sha256,
        hashMatches: null,
        capturedAt: null,
        observedFileModifiedAt: document.observedFileModifiedAt,
      })
    } else throw new Error(`不支持的输入: ${inputValue}`)
  }

  if (!documents.length) integrity.errors.push("没有可审查文档")
  integrity.status = integrity.errors.length ? "failed" : integrity.warnings.length ? "partial" : "verified"
  const preflightCandidates = await buildPreflight(documents, root, manifest)
  return {
    reviewPreparationVersion: "1.0",
    mode: "document-review",
    input: { kind, value: inputValue, manifestPath, reviewedSources: documents.length },
    sourceIntegrity: integrity,
    documents,
    preflightCandidates,
    evidenceBudget: { maxPages: maxEvidencePages, usedPages: 0 },
  }
}

async function main() {
  const { input, output, maxEvidencePages } = parseArgs(process.argv.slice(2))
  const result = await prepareReview(input, { maxEvidencePages })
  const json = `${JSON.stringify(result, null, 2)}\n`
  if (output) {
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, json, "utf8")
    process.stdout.write(`${JSON.stringify({ status: result.sourceIntegrity.status, output, documents: result.documents.length, candidates: result.preflightCandidates.length })}\n`)
  } else process.stdout.write(json)
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

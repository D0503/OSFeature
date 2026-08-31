#!/usr/bin/env node
// Fetch and structure Huawei Developer documentation. Zero dependencies, Node.js 18+.

import { writeFile } from "node:fs/promises"
import { parseHtml } from "./lib/document-parser.mjs"

const PAGE_HOST = "developer.huawei.com"
const SERVICE_HOSTS = {
  cn: "svc-drcn.developer.huawei.com",
  en: "svc-dre.developer.huawei.com",
  de: "svc-dre.developer.huawei.com",
  es: "svc-dre.developer.huawei.com",
  fr: "svc-dre.developer.huawei.com",
  pt: "svc-dre.developer.huawei.com",
  ru: "svc-drru.developer.huawei.com",
  jp: "svc-dra.developer.huawei.com",
  kr: "svc-dra.developer.huawei.com",
}
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/
const MAX_CHARACTERS = 1024 * 1024
const TIMEOUT_MS = 30_000

function fail(code, error, extra = {}) {
  process.stderr.write(`${JSON.stringify({ status: "error", code, error, ...extra }, null, 2)}\n`)
  process.exit(2)
}

function parseArgs(argv) {
  const args = [...argv]
  const url = args.shift()
  let output = null
  while (args.length) {
    const option = args.shift()
    if (option === "--output" && args.length) output = args.shift()
    else fail("usage", "用法: node fetch-doc.mjs <https://developer.huawei.com/...> [--output <result.json>]")
  }
  if (!url) fail("usage", "用法: node fetch-doc.mjs <https://developer.huawei.com/...> [--output <result.json>]")
  return { url, output }
}

function validatePageUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    fail("official_url_rejected", "URL 无效")
  }
  if (parsed.protocol.toLowerCase() !== "https:" || parsed.hostname.toLowerCase() !== PAGE_HOST) {
    fail("official_url_rejected", "只允许 https://developer.huawei.com 官方 URL")
  }
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    fail("official_url_rejected", "URL 不得包含凭据或非标准端口")
  }
  parsed.hash = ""
  return parsed.toString()
}

function parseDocumentRoute(value) {
  const pageUrl = validatePageUrl(value)
  const segments = new URL(pageUrl).pathname.split("/")
  if (segments[1] !== "consumer" || segments[3] !== "doc") return null
  if (segments.length < 6 || segments.slice(2).some((segment) => !segment)) {
    fail("official_url_rejected", "标准文档 URL 必须匹配 /consumer/<language>/doc/<catalog>/<document-id>")
  }
  const language = segments[2].toLowerCase()
  const catalogName = segments[4]
  const documentSegments = segments.slice(5)
  if (!SERVICE_HOSTS[language]) fail("official_url_rejected", `不支持的华为文档语言区域: ${language}`)
  if (!SAFE_SEGMENT.test(catalogName) || documentSegments.some((item) => item === "." || item === ".." || !SAFE_SEGMENT.test(item))) {
    fail("official_url_rejected", "文档 catalog 或 documentId 含不安全字符")
  }
  const documentId = documentSegments.join("/")
  const apiUrl = `https://${SERVICE_HOSTS[language]}/community/servlet/consumer/${language}/documentPortal/getDocumentById`
  return { pageUrl, language, catalogName, documentId, apiUrl }
}

async function responseText(response, code) {
  let raw
  try {
    raw = await response.text()
  } catch (error) {
    fail(code, `读取响应失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (raw.length > MAX_CHARACTERS) fail(code, `响应超过 ${MAX_CHARACTERS} 字符上限`)
  return raw
}

async function fetchLiveDoc(route) {
  let response
  try {
    response = await fetch(route.apiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": route.language,
        "Content-Type": "application/json;charset=UTF-8",
        Origin: `https://${PAGE_HOST}`,
        Referer: route.pageUrl,
        "User-Agent": "HarmonyOS-Doc-Review/1.0",
      },
      body: JSON.stringify({ objectId: route.documentId, version: "", catalogName: route.catalogName, language: route.language }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    fail("live_doc_fetch_failed", `无法连接华为正文接口: ${error instanceof Error ? error.message : String(error)}`, {
      next: "尝试网页读取、使用本机 devecocli 实际支持的 docs/doc read，或请用户提供正文",
    })
  }
  if (!response.ok) fail("live_doc_fetch_failed", `正文接口 HTTP ${response.status}: ${(await responseText(response, "live_doc_fetch_failed")).slice(0, 300)}`)
  const finalUrl = new URL(response.url)
  const expected = new URL(route.apiUrl)
  if (finalUrl.hostname.toLowerCase() !== expected.hostname || finalUrl.pathname !== expected.pathname) {
    fail("official_url_rejected", "正文接口重定向到了未授权地址")
  }
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (!["application/json", "text/json", "text/plain"].includes(contentType)) fail("live_doc_fetch_failed", `正文接口返回了不支持的类型: ${contentType}`)
  let payload
  try {
    payload = JSON.parse(await responseText(response, "live_doc_fetch_failed"))
  } catch {
    fail("live_doc_fetch_failed", "正文接口未返回有效 JSON")
  }
  if (typeof payload !== "object" || payload === null || String(payload.code) !== "0") {
    fail("live_doc_fetch_failed", `正文接口拒绝请求: code=${payload?.code}, message=${String(payload?.message ?? payload?.msg ?? "").slice(0, 300)}`)
  }
  const value = payload.value
  const documentHtml = value?.content?.content
  if (typeof documentHtml !== "string" || !documentHtml.trim()) fail("live_doc_fetch_failed", "正文接口响应缺少文档正文")
  return { value, documentHtml }
}

async function fetchStatic(pageUrl) {
  let response
  try {
    response = await fetch(pageUrl, {
      headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5", "User-Agent": "HarmonyOS-Doc-Review/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    fail("static_fetch_failed", `无法抓取页面: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!response.ok) fail("static_fetch_failed", `HTTP ${response.status}`)
  const finalHost = new URL(response.url).hostname.toLowerCase()
  if (finalHost !== PAGE_HOST && !finalHost.endsWith(`.${PAGE_HOST}`)) fail("official_url_rejected", "页面重定向离开了官方域名")
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
  if (!["text/html", "application/xhtml+xml", "text/plain"].includes(contentType)) fail("static_fetch_failed", `页面返回了不支持的类型: ${contentType}`)
  return responseText(response, "static_fetch_failed")
}

async function emit(result, output, exitCode) {
  const json = `${JSON.stringify(result, null, 2)}\n`
  if (output) {
    try {
      await writeFile(output, json, "utf8")
    } catch (error) {
      fail("output_write_failed", `无法写入输出文件: ${error instanceof Error ? error.message : String(error)}`)
    }
    process.stdout.write(`${JSON.stringify({ status: result.status, output })}\n`)
  } else {
    process.stdout.write(json)
  }
  process.exit(exitCode)
}

async function main() {
  const { url, output } = parseArgs(process.argv.slice(2))
  const warnings = []
  const route = parseDocumentRoute(url)
  let result
  if (route) {
    const { value, documentHtml } = await fetchLiveDoc(route)
    const parsed = parseHtml(documentHtml, { baseUrl: route.pageUrl, title: typeof value.title === "string" ? value.title : null })
    if (String(value.status) !== "4") warnings.push("document_not_published")
    if (parsed.contentText.length < 500) warnings.push("content_too_short")
    result = {
      status: warnings.length ? "review_required" : "fetched",
      retrievalMethod: "huawei_getDocumentById",
      pageUrl: route.pageUrl,
      documentId: route.documentId,
      language: route.language,
      catalogName: route.catalogName,
      title: parsed.title,
      documentStatus: value.status ?? null,
      updatedDate: value.updatedDate ?? null,
      displayUpdateTime: value.displayUpdateTime ?? null,
      textCharacters: parsed.contentText.length,
      warnings,
      ...parsed,
    }
  } else {
    const pageUrl = validatePageUrl(url)
    const html = await fetchStatic(pageUrl)
    const parsed = parseHtml(html, { baseUrl: pageUrl })
    if (parsed.contentText.length < 500) warnings.push("content_too_short")
    if (html.length > 20_000 && parsed.contentText.length < 500) warnings.push("possible_js_shell")
    result = {
      status: warnings.length ? "review_required" : "fetched",
      retrievalMethod: "static_html",
      pageUrl,
      textCharacters: parsed.contentText.length,
      warnings,
      ...parsed,
    }
  }
  await emit(result, output, warnings.length ? 1 : 0)
}

main().catch((error) => fail("unexpected_error", error instanceof Error ? error.stack ?? error.message : String(error)))

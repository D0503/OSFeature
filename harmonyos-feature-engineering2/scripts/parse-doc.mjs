#!/usr/bin/env node
// Parse a local HTML, Markdown, or text document into a review-friendly JSON structure.

import { createHash } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, extname, resolve } from "node:path"
import { parseHtml, parseMarkdown } from "./lib/document-parser.mjs"

const MAX_CHARACTERS = 1024 * 1024

function fail(code, error) {
  process.stderr.write(`${JSON.stringify({ status: "error", code, error }, null, 2)}\n`)
  process.exit(2)
}

function parseArgs(argv) {
  const args = [...argv]
  const input = args.shift()
  let output = null
  while (args.length) {
    const option = args.shift()
    if (option === "--output" && args.length) output = args.shift()
    else fail("usage", "用法: node parse-doc.mjs <document.html|md|txt> [--output <result.json>]")
  }
  if (!input) fail("usage", "用法: node parse-doc.mjs <document.html|md|txt> [--output <result.json>]")
  return { input: resolve(input), output: output ? resolve(output) : null }
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2))
  let bytes
  try {
    bytes = await readFile(input)
  } catch (error) {
    fail("input_read_failed", `无法读取输入文件: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (bytes.length > MAX_CHARACTERS) fail("input_too_large", `输入超过 ${MAX_CHARACTERS} 字节上限`)
  const raw = bytes.toString("utf8")
  const fileStat = await stat(input)
  const extension = extname(input).toLowerCase()
  const format = [".html", ".htm"].includes(extension) ? "html" : [".md", ".markdown"].includes(extension) ? "markdown" : "text"
  const parsed = format === "html" ? parseHtml(raw) : parseMarkdown(raw)
  const warnings = []
  if (parsed.contentText.length < 200) warnings.push("content_too_short")
  const result = {
    status: warnings.length ? "review_required" : "parsed",
    retrievalMethod: "local_file",
    sourcePath: input,
    sourceFormat: format,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    observedFileModifiedAt: fileStat.mtime.toISOString(),
    capturedAt: null,
    textCharacters: parsed.contentText.length,
    warnings,
    ...parsed,
  }
  const json = `${JSON.stringify(result, null, 2)}\n`
  if (output) {
    try {
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, json, "utf8")
    } catch (error) {
      fail("output_write_failed", `无法写入输出文件: ${error instanceof Error ? error.message : String(error)}`)
    }
    process.stdout.write(`${JSON.stringify({ status: result.status, output })}\n`)
  } else {
    process.stdout.write(json)
  }
  process.exit(warnings.length ? 1 : 0)
}

main().catch((error) => fail("unexpected_error", error instanceof Error ? error.stack ?? error.message : String(error)))


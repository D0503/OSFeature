#!/usr/bin/env node

import { createHash } from "node:crypto"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function safeProjectFile(projectRoot, input) {
  const absolute = isAbsolute(input) ? resolve(input) : resolve(projectRoot, input)
  const rel = relative(projectRoot, absolute)
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`文件越出目标工程: ${input}`)
  return { absolute, relativePath: rel.replaceAll("\\", "/") }
}

export async function captureFileBaseline(projectPath, inputs) {
  if (!isAbsolute(projectPath)) throw new Error("project 必须是绝对路径")
  const projectRoot = resolve(projectPath)
  if (!Array.isArray(inputs) || !inputs.length) throw new Error("至少指定一个将触及的文件")
  const files = []
  for (const input of [...new Set(inputs)]) {
    const target = safeProjectFile(projectRoot, input)
    const present = await exists(target.absolute)
    const content = present ? await readFile(target.absolute, "utf8") : null
    files.push({
      path: target.relativePath,
      absolutePath: target.absolute.replaceAll("\\", "/"),
      existed: present,
      sha256: content === null ? null : sha256(content),
      content,
    })
  }
  return { baselineVersion: "1.0", projectRoot: projectRoot.replaceAll("\\", "/"), capturedAt: new Date().toISOString(), files }
}

function unifiedDiff(before, after, path) {
  if (before === after) return ""
  const oldLines = (before ?? "").split(/\r?\n/)
  const newLines = (after ?? "").split(/\r?\n/)
  let prefix = 0
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1
  let suffix = 0
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix += 1
  const contextStart = Math.max(0, prefix - 3)
  const oldEnd = Math.min(oldLines.length, oldLines.length - suffix + 3)
  const newEnd = Math.min(newLines.length, newLines.length - suffix + 3)
  const oldCount = oldEnd - contextStart
  const newCount = newEnd - contextStart
  const rows = [`--- a/${path}`, `+++ b/${path}`, `@@ -${contextStart + 1},${oldCount} +${contextStart + 1},${newCount} @@`]
  for (let index = contextStart; index < prefix; index += 1) rows.push(` ${oldLines[index]}`)
  for (let index = prefix; index < oldLines.length - suffix; index += 1) rows.push(`-${oldLines[index]}`)
  for (let index = prefix; index < newLines.length - suffix; index += 1) rows.push(`+${newLines[index]}`)
  const commonSuffixStart = Math.max(prefix, Math.min(oldLines.length - suffix, newLines.length - suffix))
  for (let offset = 0; offset < Math.min(3, suffix); offset += 1) rows.push(` ${newLines[commonSuffixStart + offset]}`)
  return `${rows.join("\n")}\n`
}

export async function compareFileBaseline(baseline) {
  if (baseline?.baselineVersion !== "1.0" || !isAbsolute(baseline?.projectRoot ?? "") || !Array.isArray(baseline?.files)) throw new Error("baseline 契约无效")
  const projectRoot = resolve(baseline.projectRoot)
  const changes = []
  for (const item of baseline.files) {
    const target = safeProjectFile(projectRoot, item.path)
    const present = await exists(target.absolute)
    const content = present ? await readFile(target.absolute, "utf8") : null
    const afterHash = content === null ? null : sha256(content)
    const status = !item.existed && present ? "added" : item.existed && !present ? "deleted" : item.sha256 === afterHash ? "unchanged" : "modified"
    changes.push({
      path: item.path,
      absolutePath: target.absolute.replaceAll("\\", "/"),
      status,
      beforeSha256: item.sha256,
      afterSha256: afterHash,
      diff: status === "unchanged" ? "" : unifiedDiff(item.content, content, item.path),
    })
  }
  return { projectRoot: projectRoot.replaceAll("\\", "/"), comparedAt: new Date().toISOString(), changes }
}

function parseArgs(argv) {
  const mode = argv[0]
  if (!["capture", "compare"].includes(mode)) throw new Error("首个参数必须是 capture 或 compare")
  const values = { mode }
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]
    if (!["--project", "--files", "--baseline", "--output"].includes(token)) throw new Error(`未知参数: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    values[token.slice(2)] = value
    index += 1
  }
  return values
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  let result
  if (options.mode === "capture") {
    if (!options.project || !options.files) throw new Error("capture 需要 --project 和 --files")
    result = await captureFileBaseline(options.project, options.files.split(";").filter(Boolean))
  } else {
    if (!options.baseline) throw new Error("compare 需要 --baseline")
    result = await compareFileBaseline(JSON.parse(await readFile(options.baseline, "utf8")))
  }
  const text = `${JSON.stringify(result, null, 2)}\n`
  if (options.output) {
    if (!isAbsolute(options.output)) throw new Error("output 必须是绝对路径")
    await mkdir(dirname(options.output), { recursive: true })
    await writeFile(options.output, text, "utf8")
  } else process.stdout.write(text)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

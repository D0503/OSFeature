#!/usr/bin/env node
// Demo 纯净源目录门禁：test-demo 只允许工程源码与场景实现资源。
// 禁止签名材料、构建与 IDE 缓存、依赖目录、历史报告与本机绝对路径。

import { access, readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve, relative, sep, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const exists = async (path) => { try { await access(path); return true } catch { return false } }

const FORBIDDEN_DIRS = new Set([
  '.hvigor', '.idea', '.cxx', '.deveco', '.preview', '.git',
  'build', 'oh_modules', 'node_modules', 'ohos-feature-engineering', 'evidence', 'coverage', 'dist',
])
const FORBIDDEN_FILES = new Set([
  'local.properties', '.DS_Store',
])
const FORBIDDEN_REPORT_PATTERN = /^(?:.*-report|feature-report-data)\.(?:json|md)$/i
const FORBIDDEN_FILE_PATTERN = /\.(p12|cer|p7b|jks|keystore|iml)$/i
const SIGNING_PATTERN = /keyPassword|storePassword|"signingConfigs"\s*:\s*\[\s*\{/
const LOCAL_PATH_PATTERN = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s"'`]*/
const MAX_TEXT_BYTES = 512 * 1024

function parseArgs(argv) {
  const allowed = new Set(['project'])
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index], value = argv[index + 1]
    if (!token?.startsWith('--') || !allowed.has(token.slice(2)) || !value || value.startsWith('--')) throw new Error('用法: node validate-demo-source.mjs --project <Demo工程绝对路径>')
    result[token.slice(2)] = value
  }
  return result
}

export async function validateDemoSource(projectPath) {
  const project = resolve(projectPath)
  if (!isAbsolute(projectPath) || !await exists(project)) throw new Error(`Demo 工程不存在: ${projectPath}`)
  const violations = []
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name)
      const rel = relative(project, full).split(sep).join('/')
      if (/\p{Script=Han}/u.test(rel)) {
        violations.push({ path: rel, reason: '源码路径不得包含中文字符' })
        if (entry.isDirectory()) continue
      }
      if (entry.isDirectory()) {
        if (FORBIDDEN_DIRS.has(entry.name)) { violations.push({ path: rel, reason: '禁止的缓存/依赖/历史目录' }); continue }
        await walk(full)
        continue
      }
      if (FORBIDDEN_FILES.has(entry.name) || FORBIDDEN_REPORT_PATTERN.test(entry.name)) { violations.push({ path: rel, reason: '禁止的本机配置或报告文件' }); continue }
      if (FORBIDDEN_FILE_PATTERN.test(entry.name)) { violations.push({ path: rel, reason: '禁止的签名材料或 IDE 工程文件' }); continue }
      const info = await stat(full)
      if (info.size > MAX_TEXT_BYTES || /\.(png|jpg|jpeg|gif|webp|so|hap|app|har|hsp|zip|jar|bin)$/i.test(entry.name)) continue
      const content = await readFile(full, 'utf8').catch(() => null)
      if (content === null || content.includes('\0')) continue
      if (entry.name === 'build-profile.json5' && SIGNING_PATTERN.test(content)) violations.push({ path: rel, reason: '工程配置携带签名材料' })
      const localPath = LOCAL_PATH_PATTERN.exec(content)
      if (localPath) violations.push({ path: rel, reason: `携带本机绝对路径: ${localPath[0].slice(0, 60)}` })
    }
  }
  await walk(project)
  return { status: violations.length ? 'failed' : 'passed', project, violations }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.project) throw new Error('用法: node validate-demo-source.mjs --project <Demo工程绝对路径>')
  const result = await validateDemoSource(args.project)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status !== 'passed') process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

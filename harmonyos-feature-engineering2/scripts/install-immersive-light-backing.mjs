#!/usr/bin/env node

import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const exists = async (path) => { try { await access(path); return true } catch { return false } }

function parseArgs(argv) {
  const allowed = new Set(['project', 'module', 'skill-root'])
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index], value = argv[index + 1]
    if (!token?.startsWith('--') || !allowed.has(token.slice(2)) || !value || value.startsWith('--')) throw new Error('用法: node install-immersive-light-backing.mjs --project <Demo工程绝对路径> [--module entry] [--skill-root <能力包>]')
    result[token.slice(2)] = value
  }
  return result
}

function validateModuleName(value) {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) throw new Error(`module 无效: ${value}`)
  return value
}

export async function installImmersiveLightBacking({ skillRoot, project, module = 'entry' }) {
  if (!isAbsolute(project)) throw new Error('project 必须是绝对路径')
  const projectRoot = resolve(project)
  if (!await exists(projectRoot)) throw new Error(`Demo 工程不存在: ${projectRoot}`)
  const source = resolve(skillRoot, 'assets', 'backing.png')
  if (!await exists(source)) throw new Error(`缺少沉浸光感背景素材: ${source}`)
  const bytes = await readFile(source)
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw new Error(`沉浸光感背景素材不是有效 PNG: ${source}`)
  const destination = join(projectRoot, validateModuleName(module), 'src', 'main', 'resources', 'base', 'media', 'backing.png')
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
  return { status: 'installed', source, destination, resource: 'app.media.backing' }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.project) throw new Error('project 必填')
  const skillRoot = args['skill-root'] ? resolve(args['skill-root']) : dirname(dirname(fileURLToPath(import.meta.url)))
  process.stdout.write(`${JSON.stringify(await installImmersiveLightBacking({ skillRoot, project: args.project, module: args.module ?? 'entry' }), null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

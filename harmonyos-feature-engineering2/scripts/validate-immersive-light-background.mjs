#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const exists = async (path) => { try { await access(path); return true } catch { return false } }

async function walk(root) {
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else files.push(path)
  }
  return files
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--project' || !argv[1]) throw new Error('用法: node validate-immersive-light-background.mjs --project <Demo工程绝对路径>')
  return { project: argv[1] }
}

function inside(root, path) {
  const rel = relative(root, path)
  return rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)
}

export async function validateImmersiveLightBackground(projectPath) {
  if (!isAbsolute(projectPath)) throw new Error('project 必须是绝对路径')
  const project = resolve(projectPath)
  if (!await exists(project)) throw new Error(`Demo 工程不存在: ${project}`)
  const files = await walk(project)
  const profiles = files.filter((path) => path.endsWith(`${sep}src${sep}main${sep}resources${sep}base${sep}profile${sep}main_pages.json`))
  if (!profiles.length) throw new Error('Demo 未找到 main_pages.json')

  const pageFiles = new Set()
  const errors = []
  for (const profile of profiles) {
    const moduleRoot = profile.slice(0, profile.lastIndexOf(`${sep}src${sep}main${sep}resources`))
    const media = resolve(moduleRoot, 'src/main/resources/base/media/backing.png')
    if (!await exists(media)) errors.push(`${relative(project, moduleRoot)} 缺少 base/media/backing.png`)
    else {
      const bytes = await readFile(media)
      if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) errors.push(`${relative(project, media)} 不是有效 PNG`)
    }
    let pages
    try { pages = JSON.parse(await readFile(profile, 'utf8')).src } catch { errors.push(`${relative(project, profile)} 不是有效 JSON`); continue }
    if (!Array.isArray(pages) || !pages.length) { errors.push(`${relative(project, profile)}.src 必须是非空数组`); continue }
    for (const page of pages) {
      if (typeof page !== 'string' || !page.trim()) { errors.push(`${relative(project, profile)} 包含无效页面路径`); continue }
      const path = resolve(moduleRoot, 'src/main/ets', `${page}.ets`)
      if (!inside(moduleRoot, path)) errors.push(`${relative(project, profile)} 页面路径越界: ${page}`)
      else pageFiles.add(path)
    }
    for (const file of files) if (file.startsWith(resolve(moduleRoot, 'src/main/ets/pages') + sep) && file.endsWith('.ets')) pageFiles.add(file)
  }

  if (!pageFiles.size) errors.push('Demo 未发现页面源文件')
  const checked = []
  for (const page of [...pageFiles].sort()) {
    const rel = relative(project, page)
    if (!await exists(page)) { errors.push(`页面不存在: ${rel}`); continue }
    const source = await readFile(page, 'utf8')
    const requirements = [
      [/\.backgroundImage\s*\(\s*\$r\(\s*['"]app\.media\.backing['"]\s*\)\s*\)/m, '必须直接使用 .backgroundImage($r(\'app.media.backing\'))'],
      [/\.backgroundImageSize\s*\(\s*ImageSize\.Cover\s*\)/m, '必须使用 .backgroundImageSize(ImageSize.Cover)'],
      [/\.width\s*\(\s*['"]100%['"]\s*\)/m, '必须设置全屏宽度 100%'],
      [/\.height\s*\(\s*['"]100%['"]\s*\)/m, '必须设置全屏高度 100%'],
    ]
    const missing = requirements.filter(([pattern]) => !pattern.test(source)).map(([, message]) => message)
    if (missing.length) errors.push(`${rel}: ${missing.join('；')}`)
    checked.push({ path: rel, status: missing.length ? 'failed' : 'passed' })
  }
  if (errors.length) throw new Error(`沉浸光感 Demo 页面背景门禁失败：${errors.join('; ')}`)
  return { status: 'passed', backgroundAsset: 'assets/backing.png', backgroundResource: 'app.media.backing', pages: checked }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(await validateImmersiveLightBackground(args.project), null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

#!/usr/bin/env node
import { mkdir, mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadCapability, resolveScenarios } from './lib/capability-tools.mjs'

function parseArgs(argv) {
  const allowed = new Set(['root', 'feature', 'demo-id', 'skill-root', 'work-dir', 'scenarios'])
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index], value = argv[index + 1]
    if (!token?.startsWith('--') || !allowed.has(token.slice(2)) || !value || value.startsWith('--')) throw new Error('用法: node prepare-demo-output.mjs --root <结果根目录绝对路径> --feature <特性> --demo-id <D01> [--scenarios <ID1,ID2>] [--work-dir <本批临时目录>] [--skill-root <能力包>]')
    result[token.slice(2)] = value
  }
  return result
}

function assertNoChinesePath(path, label) {
  if (/\p{Script=Han}/u.test(path)) throw new Error(`${label} 不能包含中文字符: ${path}`)
}

function featureFolderName(value) {
  const name = String(value ?? '').trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`featureId 必须是小写英文、数字和连字符组成的路径标识: ${name}`)
  return name
}

export async function prepareDemoOutput({ skillRoot, root, feature, demoId, workDir, scenarios = [] }) {
  if (!isAbsolute(root)) throw new Error('root 必须是绝对路径')
  assertNoChinesePath(root, 'root')
  if (!/^D\d{2}$/.test(demoId ?? '')) throw new Error('demo-id 必须是 D01、D02 等格式')
  const capability = await loadCapability(resolve(skillRoot), feature)
  const selected = scenarios.length ? resolveScenarios(capability, [], scenarios).selected : []
  const featureDirectory = resolve(root, featureFolderName(capability.feature.id))
  const demoDirectory = resolve(featureDirectory, demoId)
  const evidenceDirectory = resolve(demoDirectory, 'evidence')
  if (workDir && !isAbsolute(workDir)) throw new Error('work-dir 必须是绝对路径')
  const workDirectory = workDir ? resolve(workDir) : await mkdtemp(join(tmpdir(), 'feature-validation-'))
  const workRelativeToResult = relative(resolve(root), workDirectory)
  if (workRelativeToResult === '' || (!workRelativeToResult.startsWith(`..${sep}`) && workRelativeToResult !== '..' && !isAbsolute(workRelativeToResult))) throw new Error('work-dir 不能位于结果目录内')
  if (workDir && !(await stat(workDirectory)).isDirectory()) throw new Error('work-dir 必须是已存在的目录')
  const featureWorkDirectory = resolve(workDirectory, capability.feature.id)
  const demoWorkDirectory = resolve(featureWorkDirectory, demoId)
  await mkdir(demoWorkDirectory, { recursive: true })
  const scenarioOutputs = {}
  for (const scenario of selected) {
    const directory = resolve(demoWorkDirectory, scenario.id)
    await mkdir(directory, { recursive: true })
    scenarioOutputs[scenario.id] = {
      workDirectory: directory,
      validationPlan: resolve(directory, 'validation-plan.json'),
      selection: resolve(directory, 'selection.json'),
      results: resolve(directory, 'results.json'),
      implementation: resolve(directory, 'implementation.json'),
      baseline: resolve(directory, 'baseline.json'),
    }
  }
  await mkdir(resolve(evidenceDirectory, 'real-device'), { recursive: true })
  await mkdir(resolve(evidenceDirectory, 'emulator'), { recursive: true })
  return {
    schemaVersion: '1.0', featureId: capability.feature.id, featureName: capability.feature.displayName, demoId,
    featureDirectory, demoDirectory,
    workDirectory,
    scenarioOutputs,
    projectDirectory: resolve(demoDirectory, 'test-demo'),
    validationPlan: resolve(demoWorkDirectory, 'validation-plan.json'),
    evidenceDirectory,
    collection: resolve(featureWorkDirectory, 'feature-report-data.json'),
    developmentReport: resolve(featureDirectory, 'development-verification-report.md'),
    developmentReportJson: resolve(featureDirectory, 'development-verification-report.json'),
    featureReport: resolve(featureDirectory, 'demo-real-device-validation-report.md'),
    featureReportJson: resolve(featureDirectory, 'demo-real-device-validation-report.json'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const skillRoot = args['skill-root'] ? resolve(args['skill-root']) : dirname(dirname(fileURLToPath(import.meta.url)))
  process.stdout.write(`${JSON.stringify(await prepareDemoOutput({ skillRoot, root: args.root, feature: args.feature, demoId: args['demo-id'], workDir: args['work-dir'], scenarios: args.scenarios ? args.scenarios.split(',').map((id) => id.trim()) : [] }), null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

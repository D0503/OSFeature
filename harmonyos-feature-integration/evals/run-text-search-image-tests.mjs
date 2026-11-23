#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { auditProject } from '../scripts/lib/compatibility-audit.mjs'
import { evaluateCompatibility, inspectProject, loadFeature, verifyInspection } from '../scripts/lib/project-tools.mjs'
import { applyJudgment, validateTextSearchImageJudgment } from '../scripts/verify-development.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const feature = 'text-search-image'
const route = 'core-vision-text-search-image'
const { profile } = await loadFeature(root, feature)
const work = await mkdtemp(join(tmpdir(), 'text-search-image-tests-'))

async function write(path, content) {
  const target = join(work, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

try {
  const project = join(work, 'app')
  const sdk = join(work, 'sdk')
  const asset = await readFile(join(root, 'references', 'features', feature, 'assets', 'TextSearchImageSession.ets'), 'utf8')
  await write('app/build-profile.json5', '{ app: { products: [{ name: "default", targetSdkVersion: "26.0.0", compatibleSdkVersion: "6.1.0(23)" }] } }')
  await write('app/AppScope/app.json5', '{ app: { bundleType: "app" } }')
  await write('app/entry/src/main/module.json5', '{ module: { name: "entry", type: "entry", deviceTypes: ["phone"] } }')
  await write('sdk/sdk-pkg.json', '{ "data": { "apiVersion": "26", "version": "26.0.0" } }')
  await write('sdk/vision.d.ts', '/** @since 26.0.0 */\ndeclare namespace textSearchImage {\n/** @since 26.0.0 */\nfunction search(query: string, scope: string): Promise<ImageObject[]>;\n}\n')
  await write('app/entry/src/main/Session.ets', asset)
  await write('app/entry/src/main/Named.ets', "import { textSearchImage as finder } from '@kit.CoreVisionKit';\nfinder.search('海边', 'Album1');")
  await write('app/entry/src/main/Namespace.ets', "import * as vision from '@kit.CoreVisionKit';\nvision . textSearchImage . deleteImage(path, 'Album1');")
  await write('app/entry/src/main/Other.ets', "import { textRecognition, imageSuperResolution } from '@kit.CoreVisionKit';\nimport { textSearchImage } from 'another-kit';\ntextSearchImage.search('海边', 'Album1');\nimageSuperResolution.ImageSRAnalyzer.create();\n// import { textSearchImage as finder } from '@kit.CoreVisionKit'; finder.init();\nconst sample = \"import { textSearchImage as finder } from '@kit.CoreVisionKit'; finder.init();\";")
  await write('app/entry/src/test/Session.ets', asset)

  const inspection = await inspectProject(project, { sdkPath: sdk })
  const compatibility = input => evaluateCompatibility(input, profile)
  const normal = compatibility(inspection)
  assert.equal(normal.status, 'conditional')
  assert.deepEqual(normal.selectedRoutes, [route])
  assert.equal(normal.fallbackPolicy.baseline, 'pre-integration-source-state')
  assert.equal(inspection.api.compatible, 23)
  assert.deepEqual(
    [...new Set(inspection.textSearchImage.usages.map(usage => usage.operation))].sort(),
    ['clearData', 'deleteImage', 'init', 'insertImage', 'release', 'search']
  )
  assert.equal(verifyInspection(inspection, normal).status, 'warnings')
  assert.equal(verifyInspection(inspection, normal, 'unknown').status, 'failed')
  const incomplete = { usages: inspection.textSearchImage.usages.filter(usage => usage.operation !== 'release') }
  assert.equal(verifyInspection({ ...inspection, textSearchImage: incomplete }, normal).status, 'failed')
  const oldSdk = compatibility({ ...inspection, localSdk: { ...inspection.localSdk, apiVersion: 23 } })
  assert.equal(oldSdk.status, 'upgrade_available')
  assert.equal(oldSdk.sdk.routes[route].status, 'sdk_too_old')
  assert.equal(oldSdk.upgradeOptions[0].upgradeLocalSdkApi, 26)
  for (const key of ['compile', 'target']) {
    const oldProject = compatibility({ ...inspection, api: { ...inspection.api, [key]: 23 } })
    assert.equal(oldProject.status, 'upgrade_available')
    assert.equal(oldProject.decisionRequired, true)
    assert.equal(oldProject.upgradeOptions[0].keepCompatibleApi, 23)
  }
  assert.equal(compatibility({ ...inspection, model: 'fa' }).status, 'unsupported')
  assert.equal(compatibility({ ...inspection, localSdk: { status: 'missing' } }).status, 'insufficient_context')

  const audit = await auditProject(root, { project, sdk })
  const candidates = audit.features.find(item => item.id === feature).candidates
  assert.deepEqual([...new Set(candidates.map(item => item.path.split('/').at(-1)))], ['Named.ets', 'Namespace.ets', 'Session.ets'])
  assert.ok(candidates.every(item => item.status === 'needs-review'))
  assert.ok(audit.declarations.some(item => item.symbol === 'search' && item.api === 26))
  assert.ok(audit.features.some(item => item.id === 'image-super-resolution'))

  for (const deviceInfo of [{ deviceType: 'phone', isEmulator: true }, { deviceType: 'tv', isEmulator: false }, {}]) {
    await assert.rejects(applyJudgment({ feature, deviceInfo, runId: 'sample', goal: 'sample' },
      { schemaVersion: '1.0', runId: 'sample', goal: 'sample', runtime: { status: 'passed' } }), /真机/)
  }
  const evidence = [{ id: 'log', sha256: 'hash', type: 'runtime_log' }]
  const observations = ['index-and-search', 'source-state-fallback'].map(scenario => ({ scenario, note: '现场观察', evidence }))
  assert.throws(() => validateTextSearchImageJudgment({ feature }, 'runtime', { status: 'passed', observations: observations.slice(0, 1) }, evidence), /source-state-fallback/)
  assert.throws(() => validateTextSearchImageJudgment({ feature }, 'runtime', { status: 'passed', observations }, [{ ...evidence[0], type: 'screenshot' }]), /日志或组件树/)
  assert.doesNotThrow(() => validateTextSearchImageJudgment({ feature }, 'runtime', { status: 'passed', observations }, evidence))

  const source = asset.replace(/^import .*;\r?\n/gm, '')
  await write('session.mjs', "import { canIUse, deviceInfo, textSearchImage } from './mock.mjs';\n" + stripTypeScriptTypes(source))
  await write('mock.mjs', `
export const state = { api: false, syscap: true, initialize: false, released: true, calls: [] };
export const deviceInfo = { apiAvailable: version => version === '26.0.0' && state.api };
export const canIUse = name => name === 'SystemCapability.AI.Vision.VisionBase' && state.syscap;
export const textSearchImage = {
  async init() { state.calls.push('init'); return state.initialize; },
  async insertImage(path, scope) {
    state.calls.push(['insertImage', path, scope]);
    await state.insertGate;
    if (state.failure) throw state.failure;
    return true;
  },
  async search(...args) { state.calls.push(['search', ...args]); return []; },
  async deleteImage(path, scope) { state.calls.push(['deleteImage', path, scope]); return false; },
  async clearData() { state.calls.push('clearData'); return true; },
  async release() { state.calls.push('release'); return state.released; }
};
`)
  const { TextSearchImageSession } = await import(pathToFileURL(join(work, 'session.mjs')))
  const { state } = await import(pathToFileURL(join(work, 'mock.mjs')))
  const session = new TextSearchImageSession()
  assert.equal(await session.open(), false)
  state.api = true
  state.syscap = false
  assert.equal(await session.open(), false)
  assert.equal(await session.close(), true)
  assert.deepEqual(state.calls, [])
  state.syscap = true
  assert.equal(await session.open(), false)
  await assert.rejects(session.search('海边', 'Album1'), /unavailable/)
  state.initialize = true
  assert.deepEqual(await Promise.all([session.open(), session.open()]), [true, true])
  assert.deepEqual(state.calls, ['init', 'init'])
  state.failure = Object.assign(new Error('model updated'), { code: 1013100003 })
  const insertGate = Promise.withResolvers()
  state.insertGate = insertGate.promise
  const insert = assert.rejects(session.insert('/sandbox/image.jpg', 'Album1'), error => error === state.failure)
  const search = session.search('海边', 'Album1', 0)
  const remove = session.remove('/sandbox/image.jpg', 'Album1')
  state.released = false
  const close = session.close()
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(state.calls.slice(2), [['insertImage', '/sandbox/image.jpg', 'Album1']])
  insertGate.resolve()
  await insert
  assert.deepEqual(await search, [])
  assert.equal(await remove, false)
  assert.equal(await close, false)
  assert.deepEqual(state.calls.slice(2), [
    ['insertImage', '/sandbox/image.jpg', 'Album1'],
    ['search', '海边', 'Album1', 0],
    ['deleteImage', '/sandbox/image.jpg', 'Album1'],
    'release'
  ])
  assert.equal(await session.clearAllIndexes(), true)
  state.failure = undefined
  assert.equal(await session.insert('/sandbox/image.jpg', 'Album1'), true)
  assert.deepEqual(await session.search('海边', 'Album1'), [])
  state.released = true
  assert.equal(await session.close(), true)
  await assert.rejects(session.search('海边', 'Album1'), /unavailable/)
  assert.deepEqual(state.calls.slice(-4), ['clearData', ['insertImage', '/sandbox/image.jpg', 'Album1'], ['search', '海边', 'Album1'], 'release'])
  console.log('Text search image tests passed')
} finally {
  await rm(work, { recursive: true, force: true })
}

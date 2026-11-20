import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectProject, evaluateCompatibility, verifyInspection, loadFeature } from '../scripts/lib/project-tools.mjs'
import { auditProject } from '../scripts/lib/compatibility-audit.mjs'
import { applyJudgment, validateImageSuperResolutionJudgment } from '../scripts/verify-development.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const feature = 'image-super-resolution'
const route = 'core-vision-image-sr'
const { profile } = await loadFeature(root, feature)
const tempRoot = resolve(tmpdir())
const work = await mkdtemp(join(tempRoot, 'image-sr-tests-'))
const write = async (path, content) => {
  const target = join(work, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

try {
  const project = join(work, 'app'), sdkPath = join(work, 'sdk')
  const asset = await readFile(join(root, `references/features/${feature}/assets/ImageSuperResolutionProcessor.ets`), 'utf8')
  await write('app/build-profile.json5', '{ app: { products: [{ name: "default", targetSdkVersion: "26.0.0", compatibleSdkVersion: "6.1.0(23)" }] } }')
  await write('app/AppScope/app.json5', '{ app: { bundleType: "app" } }')
  await write('app/entry/src/main/module.json5', '{ module: { name: "entry", type: "entry", deviceTypes: ["phone"] } }')
  await write('sdk/sdk-pkg.json', '{ "data": { "apiVersion": "26", "version": "26.0.0" } }')
  await write('sdk/vision.d.ts', '/** @since 26.0.0 */\nclass ImageSRAnalyzer {\n/** @since 26.0.0 */\nstatic create(): Promise<ImageSRAnalyzer>;\n}\n')
  await write('app/entry/src/main/Processor.ets', asset)
  await write('app/entry/src/main/Alias.ets', "import { imageSuperResolution as sr } from '@kit.CoreVisionKit';\nsr.ImageSRAnalyzer.create();\n")
  await write('app/entry/src/main/Namespace.ets', "import * as vision from '@kit.CoreVisionKit';\nvision . imageSuperResolution . ImageSRAnalyzer.create();\n")
  await write('app/entry/src/main/Other.ets', "import { textRecognition } from '@kit.CoreVisionKit';\nimport { imageSuperResolution } from 'another-kit';\nimageSuperResolution.ImageSRAnalyzer.create();\n// import { imageSuperResolution as ignored } from '@kit.CoreVisionKit'; ignored.ImageSRAnalyzer.create();\nconst text = `import { imageSuperResolution as ignored } from '@kit.CoreVisionKit'; ignored.ImageSRAnalyzer.create()`;\n")
  await write('app/entry/src/test/Test.ets', asset)

  const inspection = await inspectProject(project, { sdkPath })
  const compat = value => evaluateCompatibility(value, profile)
  const normal = compat(inspection)
  assert.equal(normal.status, 'conditional')
  assert.deepEqual(normal.selectedRoutes, [route])
  assert.equal(normal.fallbackPolicy.baseline, 'pre-integration-source-state')
  assert.equal(inspection.api.compatible, 23)
  assert.equal(inspection.imageSuperResolution.usages.filter(value => value.operation === 'create').length, 3)
  assert.equal(verifyInspection(inspection, normal).status, 'warnings')
  assert.equal(verifyInspection(inspection, normal, 'other-route').status, 'failed')
  assert.equal(verifyInspection({ ...inspection, imageSuperResolution: { usages: [] } }, normal).status, 'failed')
  const oldSdk = compat({ ...inspection, localSdk: { ...inspection.localSdk, apiVersion: 23 } })
  assert.equal(oldSdk.sdk.routes[route].status, 'sdk_too_old')
  assert.equal(oldSdk.status, 'upgrade_available')
  assert.equal(oldSdk.upgradeOptions[0].upgradeLocalSdkApi, 26)
  for (const field of ['target', 'compile']) {
    const result = compat({ ...inspection, api: { ...inspection.api, [field]: 23 } })
    assert.equal(result.status, 'upgrade_available')
    assert.equal(result.decisionRequired, true)
    assert.equal(result.upgradeOptions[0].keepCompatibleApi, 23)
  }
  assert.equal(compat({ ...inspection, model: 'fa' }).status, 'unsupported')
  assert.equal(compat({ ...inspection, localSdk: { status: 'missing' } }).status, 'insufficient_context')
  assert.equal(compat({ ...inspection, agentFramework: { application: { type: 'atomicService' } } }).status, 'unsupported')

  const audit = await auditProject(root, { project, feature, sdk: sdkPath })
  assert.equal(audit.features.length, 1)
  assert.deepEqual([...new Set(audit.features[0].candidates.map(value => value.path.split('/').at(-1)))], ['Alias.ets', 'Namespace.ets', 'Processor.ets'])
  assert.ok(audit.features[0].candidates.every(value => value.status === 'needs-review'))
  assert.ok(audit.declarations.some(value => value.symbol === 'ImageSRAnalyzer' && value.api === 26))

  for (const deviceInfo of [{ deviceType: 'phone', isEmulator: true }, { deviceType: 'tv', isEmulator: false }, {}]) {
    await assert.rejects(applyJudgment({ feature, deviceInfo, runId: 'image-sr', goal: 'image-sr' },
      { schemaVersion: '1.0', runId: 'image-sr', goal: 'image-sr', runtime: { status: 'passed' } }), /真机/)
  }
  const evidence = [{ id: 'log', sha256: 'hash', type: 'runtime_log' }]
  const observations = ['single-image-result', 'source-state-fallback'].map(scenario => ({ scenario, note: '现场观察', evidence }))
  assert.throws(() => validateImageSuperResolutionJudgment({ feature }, 'runtime', { status: 'passed', observations: observations.slice(0, 1) }, evidence), /source-state-fallback/)
  assert.throws(() => validateImageSuperResolutionJudgment({ feature }, 'runtime', { status: 'passed', observations }, [{ ...evidence[0], type: 'screenshot' }]), /日志或组件树/)
  assert.doesNotThrow(() => validateImageSuperResolutionJudgment({ feature }, 'runtime', { status: 'passed', observations }, evidence))

  await write('processor.mjs', "import { deviceInfo, imageSuperResolution, canIUse, hilog } from './mock.mjs';\n" + stripTypeScriptTypes(asset.replace(/^import .*;\r?\n/gm, '')))
  await write('mock.mjs', `
export const state = { available: true, supported: true, calls: [], output: {}, process: async () => ({ pixelMap: state.output }) };
export const deviceInfo = { apiAvailable(version) { state.calls.push(version); return state.available; } };
export const canIUse = capability => { state.calls.push(capability); return state.supported; };
export const hilog = { warn() { state.calls.push('cleanup warning'); } };
export const imageSuperResolution = { ImageSRAnalyzer: {
  async create() { state.calls.push('create'); return {
    async process(request) { state.calls.push('process'); state.input = request.inputData.pixelMap; return state.process(); },
    async destroy() { state.calls.push('destroy'); if (state.destroyError) throw state.destroyError; }
  }; }
} };
`)
  const { state } = await import(pathToFileURL(join(work, 'mock.mjs')))
  const { processImageSuperResolution: processImage } = await import(pathToFileURL(join(work, 'processor.mjs')))
  const inputFor = (width, height) => ({ async getImageInfo() { return { size: { width, height } } } })
  const source = inputFor(17, 2047)
  state.available = false
  assert.equal(await processImage(source), undefined)
  assert.deepEqual(state.calls, ['26.0.0'])
  state.available = true
  state.supported = false
  assert.equal(await processImage(source), undefined)
  state.supported = true
  for (const input of [inputFor(16, 128), inputFor(128, 16), inputFor(2048, 128), inputFor(128, 2048)]) assert.equal(await processImage(input), undefined)
  assert.equal(state.calls.includes('create'), false)
  const pending = processImage(source)
  assert.equal(await processImage(source), undefined)
  assert.equal(await pending, state.output)
  assert.equal(state.input, source)
  assert.deepEqual(state.calls.filter(value => ['create', 'process', 'destroy'].includes(value)), ['create', 'process', 'destroy'])
  const serviceError = new Error('service error')
  state.process = async () => { throw serviceError }
  state.destroyError = new Error('cleanup error')
  await assert.rejects(processImage(source), error => error === serviceError)
  assert.equal(state.calls.at(-1), 'cleanup warning')
  state.process = async () => ({ pixelMap: state.output })
  state.destroyError = undefined
  assert.equal(await processImage(source), state.output)
  console.log('Image super resolution tests passed')
} finally {
  assert.equal(dirname(resolve(work)), tempRoot)
  await rm(work, { recursive: true, force: true })
}

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { inspectProject, evaluateCompatibility, verifyInspection, loadFeature } from '../scripts/lib/project-tools.mjs'
import { auditProject } from '../scripts/lib/compatibility-audit.mjs'
import { desktopShortcutManagementOperations } from '../scripts/lib/desktop-shortcuts-tools.mjs'
import { validateDesktopShortcutJudgment } from '../scripts/verify-development.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const work = await mkdtemp(join(tmpdir(), 'desktop-shortcuts-')), project = join(work, 'project')
const put = async (path, content) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content)) }
const { profile } = await loadFeature(root, 'desktop-shortcuts')
const modulePath = 'entry/src/main/module.json5'
const shortcutPath = 'entry/src/main/resources/base/profile/shortcuts_config.json'
const sourcePath = 'entry/src/main/ets/pages/Index.ets'
const want = { bundleName: 'com.example.shortcuts', moduleName: 'entry', abilityName: 'EntryAbility', parameters: { shortcutTarget: 'home' } }
const config = { shortcuts: [{ shortcutId: 'home', label: '$string:home', icon: '$media:home', wants: [want] }] }
await put(join(project, 'AppScope/app.json5'), { app: { bundleName: want.bundleName } })
await put(join(project, modulePath), { module: { name: 'entry', type: 'entry', deviceTypes: ['phone'], abilities: [{ name: 'EntryAbility', metadata: [{ name: 'ohos.ability.shortcuts', resource: '$profile:shortcuts_config' }] }] } })
await put(join(project, shortcutPath), config)
await put(join(project, 'entry/src/main/resources/base/element/string.json'), { string: [{ name: 'home', value: 'Home' }] })
await put(join(project, 'entry/src/main/resources/base/media/home.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
const source = `import { productViewManager as pv } from '@kit.AppGalleryKit';
const want: Want = ${JSON.stringify(want)};
const id = 'home';
pv.checkPinShortcutPermitted(context, id, want, 'home', 'home');
pv.requestNewPinShortcut(context, tid);`
await put(join(project, sourcePath), source)
const sdk = async api => { const path = join(work, `sdk${api}`); await put(join(path, 'sdk-pkg.json'), { apiVersion: api }); return path }
const inspect = async api => {
  await put(join(project, 'build-profile.json5'), { app: { products: [{ name: 'default', compatibleSdkVersion: 9, compileSdkVersion: api, targetSdkVersion: api }] } })
  return inspectProject(project, { sdkPath: await sdk(api) })
}
let i = await inspect(14), c = evaluateCompatibility(i, profile)
assert.equal(i.desktopShortcuts.configurations[0].requiredApi, 9)
assert.equal(i.desktopShortcuts.usages.length, 2)
assert.equal(i.desktopShortcuts.issues.length, 0)
assert.deepEqual(JSON.parse(JSON.stringify(i.desktopShortcuts.usages[0].values[2])), want)
assert.deepEqual(c.availableRoutes, ['static-shortcut', 'dynamic-shortcut'])
assert.equal(c.decisionRequired, true)
for (const route of ['static-shortcut', 'dynamic-shortcut', 'auto']) assert.equal(verifyInspection(i, c, route).counts.fail, 0)
assert.deepEqual(verifyInspection(i, c).routes, ['static-shortcut', 'dynamic-shortcut'])
assert.equal(verifyInspection(i, c, 'unknown').status, 'failed')
await put(join(project, sourcePath), '')
const parameterizedStatic = await inspect(9)
const parameterizedCompatibility = evaluateCompatibility(parameterizedStatic, profile)
assert.equal(parameterizedCompatibility.sdk.routes['static-shortcut'].requiredApi, 9)
assert.equal(parameterizedCompatibility.upgradeOptions.some(o => o.route === 'static-shortcut'), false)
assert.equal(verifyInspection(parameterizedStatic, parameterizedCompatibility, 'static-shortcut').counts.fail, 0)
await put(join(project, sourcePath), source)
for (const api of [9, 11, 13, 14, 19, 20, 23, 24, 25, 26]) {
  i = await inspect(api); c = evaluateCompatibility(i, profile)
  assert.equal(c.availableRoutes.includes('static-shortcut'), api >= 9)
  assert.equal(c.availableRoutes.includes('dynamic-shortcut'), api >= 14)
  assert.ok(c.upgradeOptions.every(o => o.keepCompatibleApi === 9 && o.upgradeTargetApi >= api))
}
for (const [operation, api, owner, kit] of [['setShortcutVisibleForSelf', 20, 'shortcutManager', 'AbilityKit'], ['getAllShortcutInfoForSelf', 20, 'shortcutManager', 'AbilityKit'], ['isShortcutSupported', 26, 'shortcutManager', 'AbilityKit'], ['getPinShortcutInfos', 24, 'productViewManager', 'AppGalleryKit'], ['removePinShortcut', 24, 'productViewManager', 'AppGalleryKit']]) {
  await put(join(project, sourcePath), `import { ${owner} as x } from '@kit.${kit}'; x.${operation}();`)
  i = await inspect(api - 1); c = evaluateCompatibility(i, profile)
  const route = owner === 'shortcutManager' ? 'static-shortcut' : 'dynamic-shortcut'
  assert.equal(c.availableRoutes.includes(route), false)
  assert.equal(c.sdk.routes[route].requiredApi, api)
  i = await inspect(api); assert.ok(evaluateCompatibility(i, profile).availableRoutes.includes(route))
}
await put(join(project, sourcePath), source)
for (const mutated of [
  { shortcuts: [...config.shortcuts, ...config.shortcuts] },
  { shortcuts: [{ ...config.shortcuts[0], icon: '$media:missing' }] },
  { shortcuts: [{ ...config.shortcuts[0], label: '$string:missing' }] },
  { shortcuts: [{ ...config.shortcuts[0], shortcutId: '中'.repeat(22) }] },
  { shortcuts: [{ ...config.shortcuts[0], wants: [{ ...want, abilityName: 'Missing' }] }] },
  { shortcuts: [{ ...config.shortcuts[0], wants: [{ ...want, parameters: { invalid: 1 } }] }] },
  { shortcuts: [{ ...config.shortcuts[0], visible: 'false' }] }
]) {
  await put(join(project, shortcutPath), mutated)
  i = await inspect(26)
  assert.ok(i.desktopShortcuts.issues.length)
  assert.equal(verifyInspection(i, evaluateCompatibility(i, profile), 'static-shortcut').status, 'failed')
}
await put(join(project, shortcutPath), config)
for (const [text, count] of [
  [source.replaceAll('pv.', 'Kit.productViewManager.').replace("{ productViewManager as pv }", '* as Kit'), 2],
  [source.replaceAll('pv.', 'unrelated.'), 0],
  ['// ' + source.replaceAll('\n', '\n// '), 0],
  ['const text = `' + source + '`;', 0],
  ["import { productViewManager } from '@kit.AppGalleryKit'; productViewManager.loadProduct(context, want);", 0],
  ["import { productViewManager } from '@kit.AppGalleryKit'; productViewManager.loadService(context, want);", 0],
  ["import { productViewManager } from '@kit.AppGalleryKit';", 0],
  ["import sm from '@ohos.bundle.shortcutManager'; sm.isShortcutSupported();", 1]
]) {
  await put(join(project, sourcePath), text); i = await inspect(26)
  assert.equal(i.desktopShortcuts.usages.length, count)
}
await put(join(project, sourcePath), source.replace("'home', 'home'", "'wrong', 'home'"))
i = await inspect(14)
assert.ok(verifyInspection(i, evaluateCompatibility(i, profile), 'dynamic-shortcut').checks.some(c => c.id.includes('preset') && c.status === 'fail'))
await put(join(project, modulePath), { module: { name: 'entry', type: 'entry', abilities: [{ name: 'EntryAbility' }] } })
await put(join(project, sourcePath), "import { productViewManager as x } from '@kit.AppGalleryKit'; x.checkPinShortcutPermitted(context, 'custom', {bundleName:'com.example.shortcuts', moduleName:'entry', abilityName:'EntryAbility'}, 'label', context.filesDir + '/x.png', ''); x.requestNewPinShortcut(context, tid);")
i = await inspect(14); c = evaluateCompatibility(i, profile)
assert.equal(verifyInspection(i, c, 'dynamic-shortcut').counts.fail, 0)
assert.deepEqual(verifyInspection(i, c, 'auto').routes, ['dynamic-shortcut'])
assert.equal(verifyInspection(i, c, 'static-shortcut').status, 'failed')
for (const [text, failure] of [
  ["import { productViewManager as x } from '@kit.AppGalleryKit'; x.checkPinShortcutPermitted(context, 'id', {bundleName:'com.example.shortcuts',abilityName:'Missing'}, 'label', '/sandbox/x.png', ''); x.requestNewPinShortcut(context, tid);", true],
  ["import { productViewManager as x } from '@kit.AppGalleryKit'; x.checkPinShortcutPermitted(context, 'id', {bundleName:'com.example.shortcuts',abilityName:'EntryAbility'}, 'label', '/sandbox/x.svg', ''); x.requestNewPinShortcut(context, tid);", true],
  ["import { productViewManager as x } from '@kit.AppGalleryKit'; x.checkPinShortcutPermitted(context, 'id', {bundleName:'com.example.shortcuts',abilityName:'EntryAbility'}, 'label', '/sandbox/x.png', 'background'); x.requestNewPinShortcut(context, tid);", true],
  ["import { productViewManager as x } from '@kit.AppGalleryKit'; x.checkPinShortcutPermitted(context, 'id', {bundleName:'com.example.shortcuts',abilityName:'EntryAbility'}, 'label', '/sandbox/x.png', ''); x.requestNewPinShortcut(context, tid);", false]
]) {
  await put(join(project, sourcePath), text); i = await inspect(14); c = evaluateCompatibility(i, profile)
  assert.equal(verifyInspection(i, c, 'dynamic-shortcut').counts.fail > 0, failure)
}
await put(join(project, sourcePath), "import { productViewManager as x } from '@kit.AppGalleryKit'; x.getPinShortcutInfos(context);")
i = await inspect(24); assert.equal(verifyInspection(i, evaluateCompatibility(i, profile), 'dynamic-shortcut').counts.fail, 0)
assert.deepEqual(desktopShortcutManagementOperations(i, 'dynamic-shortcut'), ['getPinShortcutInfos'])
await put(join(project, sourcePath), "import { productViewManager as x } from '@kit.AppGalleryKit'; x.checkPinShortcutPermitted(context, 'custom', {bundleName:'com.example.shortcuts',abilityName:'EntryAbility'}, 'label', context.filesDir + '/x.png', ''); x.requestNewPinShortcut(context, tid);")

let audit = await auditProject(root, { project, sdk: await sdk(14), feature: 'desktop-shortcuts' })
assert.equal(audit.features[0].id, 'desktop-shortcuts')
await put(join(project, sourcePath), '// x.requestNewPinShortcut(context, tid)')
audit = await auditProject(root, { project, sdk: await sdk(14), feature: 'desktop-shortcuts' })
assert.equal(audit.features.length, 0)
const missing = structuredClone(i); missing.localSdk.status = 'missing'
assert.equal(evaluateCompatibility(missing, profile).status, 'insufficient_context')
assert.equal(evaluateCompatibility({ ...i, model: 'fa' }, profile).status, 'unsupported')
const basic = structuredClone(config); delete basic.shortcuts[0].wants[0].parameters
await put(join(project, modulePath), { module: { name: 'entry', type: 'entry', abilities: [{ name: 'EntryAbility', metadata: [{ name: 'ohos.ability.shortcuts', resource: '$profile:shortcuts_config' }] }] } })
await put(join(project, shortcutPath), basic)
i = await inspect(9); c = evaluateCompatibility(i, profile)
assert.equal(c.sdk.routes['static-shortcut'].requiredApi, 9)
assert.equal(verifyInspection(i, c, 'static-shortcut').counts.fail, 0)
for (const visible of [true, false]) {
  basic.shortcuts[0].visible = visible
  await put(join(project, shortcutPath), basic)
  for (const api of [9, 19, 20]) {
    i = await inspect(api); c = evaluateCompatibility(i, profile)
    assert.equal(c.sdk.routes['static-shortcut'].requiredApi, 9)
    assert.ok(c.availableRoutes.includes('static-shortcut'))
    assert.equal(c.upgradeOptions.some(o => o.route === 'static-shortcut'), false)
    assert.equal(verifyInspection(i, c, 'static-shortcut').counts.fail, 0)
  }
}
await put(join(project, shortcutPath), { shortcuts: config.shortcuts.map(s => ({ ...s, visible: false })) })
await put(join(project, sourcePath), source)
i = await inspect(14); c = evaluateCompatibility(i, profile)
assert.equal(c.sdk.routes['dynamic-shortcut'].requiredApi, 14)
assert.equal(verifyInspection(i, c, 'dynamic-shortcut').counts.fail, 0)

const log = { id: 'log', sha256: 'loghash', type: 'runtime_log' }
const screenshots = ['entry', 'desktop', 'target'].map(id => ({ id, sha256: id, type: 'screenshot' }))
const refs = e => ({ id: e.id, sha256: e.sha256 })
for (const route of ['static-shortcut', 'dynamic-shortcut']) {
  const run = { feature: 'desktop-shortcuts', route, deviceInfo: { deviceType: 'phone', isEmulator: false }, device: 'usb' }
  const entry = route === 'dynamic-shortcut' ? 'pin-confirmation' : 'static-menu'
  const runtime = { status: 'passed', observations: [entry, 'desktop-icon', 'cold-start', 'warm-start'].map(scenario => ({ scenario, note: 'verified', evidence: [refs(log)] })) }
  validateDesktopShortcutJudgment(run, 'runtime', runtime, [log])
  assert.throws(() => validateDesktopShortcutJudgment(run, 'runtime', { ...runtime, observations: runtime.observations.slice(1) }, [log]))
  const visual = { status: 'passed', observations: [entry, 'desktop-icon', 'target-page'].map((scenario, n) => ({ scenario, note: 'verified', evidence: [refs(screenshots[n])] })) }
  validateDesktopShortcutJudgment(run, 'visual', visual, screenshots)
  assert.throws(() => validateDesktopShortcutJudgment(run, 'visual', { ...visual, observations: visual.observations.map(o => ({ ...o, evidence: [refs(screenshots[0])] })) }, screenshots))
  validateDesktopShortcutJudgment({ ...run, shortcutManagementOperations: ['getPinShortcutInfos'] }, 'runtime', { status: 'passed', observations: [{ scenario: 'getPinShortcutInfos', note: 'queried actual pinned list', evidence: [refs(log)] }] }, [log])
  if (route === 'dynamic-shortcut') for (const deviceInfo of [{ deviceType: 'phone', isEmulator: true }, { deviceType: 'tv', isEmulator: false }, { deviceType: 'phone' }]) assert.throws(() => validateDesktopShortcutJudgment({ ...run, deviceInfo }, 'runtime', runtime, [log]))
}

// Exercise the documented API steps with mocked Kits.
const guide = await readFile(join(root, 'references/features/desktop-shortcuts/routes/dynamic-shortcut.md'), 'utf8')
const blocks = [...guide.matchAll(/```typescript\r?\n([\s\S]*?)```/g)].map(m => m[1])
const fields = blocks.find(code => code.includes('@State private tid:')).replace(/@State\s+/g, '')
const methods = ['checkStaticShortcut', 'checkCustomShortcut', 'requestShortcut'].map(name => {
  const code = blocks.find(code => code.startsWith(`async ${name}()`))
  assert.ok(code, `Documented method ${name} must be available`)
  return code
})
await put(join(work, 'shortcut-page.ts'), `import { productViewManager, deviceInfo, canIUse, hilog } from './mock.mjs';
type Want = { bundleName: string; moduleName: string; abilityName: string; parameters: Record<string, string> };
type BusinessError = { code: number };
namespace common { export type UIAbilityContext = { filesDir: string }; }
export class ShortcutPage {
${fields}
getUIContext() { return { getHostContext: () => ({ filesDir: '/sandbox' }) }; }
${methods.join('\n')}
}`)
await put(join(work, 'mock.mjs'), `export const state = { api: 14, supported: true, checks: [], requests: [], logs: [], check: null, request: null };
export const deviceInfo = { get sdkApiVersion() { return state.api; } };
export const canIUse = () => state.supported;
export const hilog = { info: (...args) => state.logs.push(args), error: (...args) => state.logs.push(args) };
export const productViewManager = {
  checkPinShortcutPermitted: (...args) => { state.checks.push(args); return state.check ? state.check() : Promise.resolve({code:0,tid:'tid',expired:10000}); },
  requestNewPinShortcut: (...args) => { state.requests.push(args); return state.request ? state.request() : Promise.resolve(); }
};`)
await put(join(work, 'example-tests.mjs'), `import assert from 'node:assert/strict';
import { ShortcutPage } from './shortcut-page.ts';
import { state } from './mock.mjs';
const page = new ShortcutPage();
await page.requestShortcut(); assert.equal(state.requests.length,0);
state.api=13; await page.checkStaticShortcut(); await page.checkCustomShortcut(); await page.requestShortcut(); assert.equal(state.checks.length,0);
state.api=14; state.supported=false; await page.checkStaticShortcut(); await page.checkCustomShortcut(); assert.equal(state.checks.length,0);
state.supported=true; await page.checkStaticShortcut(); assert.equal(page.tid,'tid'); assert.ok(page.expiresAt>Date.now());
assert.equal(state.checks[0].length,5); assert.equal(state.checks[0][1],'open_feature'); assert.equal(state.checks[0][3],'shortcut_label'); assert.equal(state.checks[0][4],'shortcut_icon'); assert.deepEqual(state.checks[0][2].parameters,{shortcutTarget:'open_feature'});
await page.requestShortcut(); assert.equal(state.requests.length,1); assert.equal(state.requests[0][1],'tid'); assert.equal(page.tid,''); assert.equal(page.requesting,false); await page.requestShortcut(); assert.equal(state.requests.length,1);
await page.checkCustomShortcut(); const custom=state.checks.at(-1); assert.equal(custom.length,6); assert.equal(custom[1],'custom_open_feature'); assert.equal(custom[3],'打开功能'); assert.equal(custom[4],'/sandbox/shortcut.png'); assert.equal(custom[5],'');
let finish; state.request=()=>new Promise(resolve=>finish=resolve); const pending=page.requestShortcut(); assert.equal(page.requesting,true); await page.requestShortcut(); const checks=state.checks.length; await page.checkStaticShortcut(); assert.equal(state.checks.length,checks); assert.equal(state.requests.length,2); finish(); await pending; assert.equal(page.requesting,false);
state.request=()=>Promise.reject({code:1006620007}); await page.checkStaticShortcut(); const requests=state.requests.length; await page.requestShortcut(); assert.equal(state.requests.length,requests+1); assert.equal(page.tid,''); assert.equal(page.requesting,false); await page.requestShortcut(); assert.equal(state.requests.length,requests+1); assert.ok(state.logs.some(entry=>entry.includes(1006620007)));
state.request=null; state.check=()=>Promise.reject({code:1006620002}); await page.checkCustomShortcut(); assert.equal(page.tid,''); assert.ok(state.logs.some(entry=>entry.includes(1006620002)));
for (const result of [{code:5,tid:'x',expired:1000},{code:0,expired:1000},{code:0,tid:'x',expired:0}]) { state.check=()=>Promise.resolve(result); await page.checkStaticShortcut(); assert.equal(page.tid,''); assert.equal(page.expiresAt,0); }
state.check=null; await page.checkStaticShortcut(); const now=Date.now; Date.now=()=>page.expiresAt+1; const before=state.requests.length; await page.requestShortcut(); Date.now=now; assert.equal(state.requests.length,before); assert.equal(page.tid,'');
console.log('Documented shortcut API steps passed');`)
const exampleRun = spawnSync(process.execPath, ['--experimental-transform-types', join(work, 'example-tests.mjs')], { encoding: 'utf8' })
assert.equal(exampleRun.status, 0, exampleRun.stdout + exampleRun.stderr)
console.log('Desktop shortcuts tests passed: discovery, gates, resources, routes, audit, evidence and documented API steps')

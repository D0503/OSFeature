import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { inspectProject, evaluateCompatibility, verifyInspection, loadFeature } from '../scripts/lib/project-tools.mjs'
import { auditProject } from '../scripts/lib/compatibility-audit.mjs'
import { detectGesturesDeviceKind, validateGesturesShareJudgment } from '../scripts/verify-development.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = name => join(root, 'evals/fixtures', name)
const { profile } = await loadFeature(root, 'gestures-share')
const sdkPath = fixture('sdk-api20')
const registry = JSON.parse(await readFile(join(root, 'references/feature-registry.json'), 'utf8'))
const match = input => registry.features.find(f => [f.id, f.displayName, ...f.aliases].some(k => input.toLowerCase().includes(k.toLowerCase())))?.id
for (const input of ['隔空传送', 'Gestures Share', 'gesturesShare', 'GESTURESSHARE']) assert.equal(match(input), 'gestures-share')
for (const input of ['普通手势识别', '隔空截屏', '碰一碰', 'App Linking', 'Share Kit', '系统分享面板']) assert.equal(match(input), undefined)
const inspection = await inspectProject(fixture('gestures-share-api20'), { sdkPath })
const compat = i => evaluateCompatibility(i, profile)
assert.equal(inspection.gesturesShare.usages.length, 2)
assert.deepEqual(compat(inspection).selectedRoutes, ['gestures-share'])
assert.equal(compat(inspection).status, 'conditional')
assert.equal(verifyInspection(inspection, compat(inspection), 'auto').counts.fail, 0)
for (const field of ['compile', 'target']) {
  const i = structuredClone(inspection); i.api[field] = 19
  const c = compat(i)
  assert.equal(c.status, 'upgrade_available')
  assert.equal(c.upgradeOptions[0].keepCompatibleApi, 19)
}
const low = structuredClone(inspection); low.localSdk.apiVersion = 19
assert.equal(compat(low).status, 'upgrade_available')
assert.equal(compat({ ...inspection, localSdk: { status: 'missing' } }).status, 'insufficient_context')
assert.equal(compat({ ...inspection, model: 'fa' }).status, 'unsupported')
const atomic = structuredClone(inspection); atomic.agentFramework.application.type = 'atomicService'
assert.equal(compat(atomic).status, 'insufficient_context')
assert.equal(verifyInspection(inspection, compat(inspection), 'file-share').status, 'failed')

const work = await mkdtemp(join(tmpdir(), 'gestures-share-tests-')), project = join(work, 'project')
await cp(fixture('gestures-share-api20'), project, { recursive: true })
const sourcePath = join(project, 'entry/src/main/ets/pages/Index.ets')
const original = await readFile(sourcePath, 'utf8')
for (const [source, count] of [
  [original.replaceAll('harmonyShare.', 'hs.').replace('{ harmonyShare }', '{ harmonyShare as hs }'), 2],
  [original.replaceAll('harmonyShare.', 'Kit.harmonyShare.').replace('{ harmonyShare }', '* as Kit'), 2],
  ['// ' + original.replaceAll('\n', '\n// '), 0],
  ['const text = `' + original + '`;', 0],
  [original.replaceAll('gesturesShare', 'knockShare'), 0],
  ["import { systemShare } from '@kit.ShareKit'; new systemShare.ShareController(data);", 0]
]) {
  await writeFile(sourcePath, source)
  const i = await inspectProject(project, { sdkPath })
  assert.equal(i.gesturesShare.usages.length, count)
  const audit = await auditProject(root, { project, sdk: sdkPath, feature: 'gestures-share' })
  assert.equal(audit.features.length, count ? 1 : 0)
  if (!count) assert.equal(verifyInspection(i, compat(i), 'auto').status, 'failed')
}
for (const type of ['phone', 'tablet', '2in1', 'pc']) assert.equal(detectGesturesDeviceKind({ deviceType: type, isEmulator: false }, 'usb-serial'), 'physical')
assert.equal(detectGesturesDeviceKind({ deviceType: 'phone', isEmulator: true }), 'emulator')
assert.equal(detectGesturesDeviceKind({ deviceType: 'tv', isEmulator: false }), 'unknown')
assert.equal(detectGesturesDeviceKind({ deviceType: 'phone' }), 'unknown')
const run = { feature: 'gestures-share', deviceInfo: { deviceType: 'phone', isEmulator: false }, device: 'usb' }
const evidence = [{ id: 'log', type: 'runtime_log', sha256: 'a' }]
assert.throws(() => validateGesturesShareJudgment(run, 'runtime', { status: 'passed' }, evidence))
validateGesturesShareJudgment(run, 'runtime', { status: 'passed', observations: ['sender-grab', 'receiver-content', 'background-cleanup'].map(scenario => ({ scenario, note: '双端真机内容一致，后台已清理', evidence: [{ id: 'log', sha256: 'a' }] })) }, evidence)
assert.throws(() => validateGesturesShareJudgment(run, 'visual', { status: 'passed' }, [{ type: 'screenshot', sha256: 'a' }]))
validateGesturesShareJudgment(run, 'visual', { status: 'passed' }, [{ type: 'screenshot', sha256: 'a' }, { type: 'screenshot', sha256: 'b' }])

// Exercise the documented subscription and payload methods using mocked Kits.
const implementation = await readFile(join(root, 'references/features/gestures-share/implementation.md'), 'utf8')
const snippets = [...implementation.matchAll(/```(?:typescript)?\r?\n([\s\S]*?)```/g)].map(match => match[1])
const pageMethods = snippets.find(code => code.includes('private gestureCallback'))
const fileData = snippets.find(code => code.includes('for (const file of this.selectedFiles)'))
const linkData = snippets.find(code => code.includes('const content = this.currentContent;'))
assert.ok(pageMethods && fileData && linkData, 'subscription and business payload snippets must be available')
await writeFile(join(work, 'page.ts'), "import { canIUse, window, harmonyShare, deviceInfo, hilog, state, systemShare, uniformTypeDescriptor, fileUri } from './mock.mjs';\nexport class TestPage {\n" + pageMethods + "\ngetGestureShareData() { return state.data; }\n}\nexport class FilePage {\n" + fileData + "\n}\nexport class LinkPage {\n" + linkData + "\n}\n")
await writeFile(join(work, 'mock.mjs'), `
export const state = { supported: true, runtimeAvailable: true, requestedVersions: [], windowId: 7, windowError: false, contexts: [], data: { id: 1 }, listener: null, calls: [], offError: false, onError: false, logs: [] };
export const deviceInfo = { apiAvailable: version => { state.requestedVersions.push(version); return state.runtimeAvailable; } };
export const window = { getLastWindow: context => { state.contexts.push(context); return state.windowError ? Promise.reject(Error('window')) : Promise.resolve({ getWindowProperties: () => ({ id: state.windowId }) }); } };
export const canIUse = () => state.supported;
export const harmonyShare = {
  SharableErrorCode: { NO_CONTENT_ERROR: 1 },
  on: (...args) => { if(state.onError) throw Error('on'); state.calls.push(['on', ...args]); state.listener = args[2]; },
  off: (...args) => { if(state.offError) throw Error('off'); state.calls.push(['off', ...args]); if(state.listener === args[2]) state.listener = null; }
};
export const hilog = { error: (...args) => state.logs.push(args) };
export const systemShare = { SharedData: class { constructor(record) { this.records = [record]; } addRecord(record) { this.records.push(record); } } };
export const uniformTypeDescriptor = { getUniformDataTypeByFilenameExtension: ext => ext, UniformDataType: { HYPERLINK: 'hyperlink' } };
export const fileUri = { getUriFromPath: path => 'file://' + path };
`)
await writeFile(join(work, 'page-test.mjs'), `
import assert from 'node:assert/strict';
import { TestPage, FilePage, LinkPage } from './page.ts';
import { state } from './mock.mjs';
const sent = [], rejected = [];
const target = { share: d => { sent.push(d); return Promise.resolve(); }, reject: e => { rejected.push(e); return Promise.resolve(); } };
const page = new TestPage(), context = {};
const settle = () => new Promise(resolve => setImmediate(resolve));
page.startGestureShare(context); await settle();
assert.equal(state.contexts[0], context);
assert.equal(state.requestedVersions[0], '6.0.0');
assert.equal(state.calls.length, 1);
const callback = state.listener;
state.listener(target); state.data = { id: 2 }; state.listener(target);
assert.deepEqual(sent.map(d => d.id), [1, 2]);
state.data = undefined; state.listener(target); assert.deepEqual(rejected, [1]);
page.stopGestureShare(context); await settle();
assert.equal(state.calls[1][3], callback); assert.deepEqual(state.calls[1][2], { windowId: 7 });
assert.equal(state.listener, null);
state.windowId = 9; page.startGestureShare(context); await settle(); assert.deepEqual(state.calls.at(-1)[2], { windowId: 9 }); page.stopGestureShare(context); await settle(); state.windowId = 7;
const count = state.calls.length;
state.runtimeAvailable = false; page.startGestureShare(context); await settle(); page.stopGestureShare(context); await settle(); assert.equal(state.calls.length, count);
state.runtimeAvailable = true; state.supported = false; page.startGestureShare(context); await settle(); page.stopGestureShare(context); await settle(); assert.equal(state.calls.length, count);
state.supported = true; state.onError = true; page.startGestureShare(context); await settle(); assert.equal(state.calls.length, count); assert.ok(state.logs.length);
state.onError = false; page.startGestureShare(context); await settle();
state.offError = true; page.stopGestureShare(context); await settle(); assert.equal(state.listener, callback);
state.offError = false; page.stopGestureShare(context); await settle(); assert.equal(state.listener, null);
const beforeWindowError = state.calls.length; state.windowError = true; page.startGestureShare(context); await settle(); page.stopGestureShare(context); await settle(); assert.equal(state.calls.length, beforeWindowError); state.windowError = false;
const files = new FilePage(); files.selectedFiles = []; assert.equal(files.getGestureShareData(), undefined);
files.selectedFiles = [{ name: 'one.mp4', path: '/one.mp4', thumbnailPath: '/one.jpg', description: 'one' }, { name: 'two.jpg', path: '/two.jpg', thumbnailPath: '/two.jpg', description: 'two' }];
assert.deepEqual(files.getGestureShareData().records.map(r => [r.utd, r.uri]), [['.mp4','file:///one.mp4'],['.jpg','file:///two.jpg']]);
const links = new LinkPage(); assert.equal(links.getGestureShareData(), undefined);
links.currentContent = { appLink: 'https://domain.test/a', coverUri: 'file:///a.jpg', title: 'A', description: 'A description' };
assert.equal(links.getGestureShareData().records[0].content, 'https://domain.test/a');
links.currentContent = { ...links.currentContent, appLink: 'https://domain.test/b', title: 'B' };
assert.equal(links.getGestureShareData().records[0].title, 'B');
console.log('page subscription and payload methods passed');
`)
const pageResult = spawnSync(process.execPath, ['--experimental-transform-types', join(work, 'page-test.mjs')], { encoding: 'utf8' })
assert.equal(pageResult.status, 0, pageResult.stdout + pageResult.stderr)
console.log(JSON.stringify({ status: 'passed', feature: 'gestures-share', checks: 'routing, SDK, project, audit, evidence, page subscription and payloads' }))

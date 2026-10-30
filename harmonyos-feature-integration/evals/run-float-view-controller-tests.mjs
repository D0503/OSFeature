import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = resolve(tmpdir());
const work = await mkdtemp(join(parent, 'float-view-controller-tests-'));
try {
  const source = await readFile(join(root, 'references/features/float-view-ball/assets/FloatViewController.ets'), 'utf8');
  await writeFile(join(work, 'controller.ts'),
    "import { floatView, deviceInfo, canIUse, hilog, abilityAccessCtrl } from './mock.mjs';\n" + source.replace(/^import .*;\r?\n/gm, ''));
  await writeFile(join(work, 'mock.mjs'), `
export const logs = [];
export const hilog = { debug(...args) { logs.push(["debug", ...args]); }, error(...args) { logs.push(["error", ...args]); } };
export const deviceInfo = { sdkApiVersion: 26, apiAvailable(version) { return this.sdkApiVersion >= (typeof version === 'number' ? version : Number(version.split('.')[0])); } };
export const env = { supported: true, enabledCalls: 0, controller: null };
export const abilityAccessCtrl = { createAtManager() {
  return { async requestPermissionsFromUser(context, permissions) {
    env.permissionContext = context; env.permissions = permissions;
    if (env.permissionError) throw env.permissionError;
    return { authResults: env.authResults };
  } };
} };
export const canIUse = () => env.supported;
export const floatView = {
  FloatViewState: { STARTED: 1, HIDDEN: 2, STOPPED: 3, ERROR: 6 },
  isFloatViewEnabled() { env.enabledCalls++; return true; },
  getFloatViewLimits(template) { if (env.failLimits) throw new Error("limits failed"); return { template }; },
  async create(config) { env.config = config; return env.controller; }
};
`);
  await writeFile(join(work, 'test.mjs'), `
import assert from 'node:assert/strict';
import { FloatViewController as C, requestFloatViewPermission } from './controller.ts';
import { env, deviceInfo, logs } from './mock.mjs';
const calls = [];
const callbacks = new Map();
const failure = new Error('platform failure');
const permissionContext = {};
env.authResults = [0];
assert.equal(await requestFloatViewPermission(permissionContext), true);
assert.equal(env.permissionContext, permissionContext);
assert.deepEqual(env.permissions, ['ohos.permission.FLOAT_VIEW']);
for (const results of [[], [-1], [0, -1]]) {
  env.authResults = results;
  assert.equal(await requestFloatViewPermission(permissionContext), false);
}
env.permissionError = failure;
assert.equal(await requestFloatViewPermission(permissionContext), false);
env.permissionError = null;
let failPage = false, failStop = false;
const controller = {
  onStateChange(cb) { callbacks.set('state', cb); },
  onLimitsChange(cb) { callbacks.set('limits', cb); },
  onRectChange(cb) { callbacks.set('rect', cb); },
  offStateChange() { callbacks.delete('state'); },
  offLimitsChange(cb) { if (!cb || callbacks.get('limits') === cb) callbacks.delete('limits'); },
  offRectChange(cb) { if (!cb || callbacks.get('rect') === cb) callbacks.delete('rect'); },
  async setUIContext(page, storage) { calls.push(['page', page, storage]); if (failPage) throw failure; },
  async setWindowSize(size) { calls.push(['size', size]); },
  async start() { calls.push(['start']); },
  async switchTemplate(property) { calls.push(['template', property]); },
  async restoreMainWindow(params) { calls.push(['restore', params]); },
  getWindowProperties() { return { windowId: 123 }; },
  async stop() { if (failStop) throw failure; calls.push(['stop']); }
};
env.controller = controller;
deviceInfo.sdkApiVersion = 25;
assert.equal(C.canUseFloatView(), false);
assert.equal(env.enabledCalls, 0);
deviceInfo.sdkApiVersion = 26;
env.supported = false;
assert.equal(C.canUseFloatView(), false);
assert.equal(env.enabledCalls, 0);
env.supported = true;
assert.equal(C.canUseFloatView(), true);
const config = { context: {}, templateType: 1 };
let stopped = false, limitsSeen, rectSeen;
await C.createFloatView(config, info => {
  if (info.state === 3) {
    assert.equal(C.floatViewController, undefined);
    assert.equal(callbacks.size, 0);
    stopped = true;
  }
}, limits => { limitsSeen = limits; }, rect => { rectSeen = rect; });
assert.equal(env.config, config);
await assert.rejects(C.createFloatView(config), /already exists/);
assert.throws(() => C.getWindowProperties(), /not available/);
await assert.rejects(C.restoreMainWindow(), /STARTED/);
const size = { width: 200, height: 100 }, storage = {};
failPage = true;
await assert.rejects(C.startFloatView('pages/Content', size, storage), { name: 'Error', message: 'Prepare and start float view failed' });
assert.deepEqual(calls.map(c => c[0]), ['page']);
assert.equal(C.floatViewController, controller);
failPage = false; calls.length = 0;
await C.startFloatView('pages/Content', size, storage);
assert.deepEqual(calls.map(c => c[0]), ['page', 'size', 'start']);
assert.equal(calls[0][2], storage);
assert.equal(calls[1][1], size);
assert.equal(C.state, undefined);
callbacks.get('state')({ state: 1, stopReason: '' });
assert.equal(C.getWindowProperties().windowId, 123);
callbacks.get('limits')(size); callbacks.get('rect')(size);
assert.equal(limitsSeen, size); assert.equal(rectSeen, size);
const property = { templateType: 2, size }, params = { route: 'details' };
await C.switchTemplate(property); assert.equal(calls.at(-1)[1], property);
await C.restoreMainWindow(params); assert.equal(calls.at(-1)[1], params);
failStop = true;
await assert.rejects(C.stopFloatView(), { name: 'Error', message: 'Stop float view failed' });
assert.equal(C.floatViewController, controller);
assert.equal(callbacks.size, 3);
failStop = false; await C.stopFloatView();
assert.equal(C.floatViewController, controller);
callbacks.get('state')({ state: 3, stopReason: 'APP_STOP' });
assert.equal(stopped, true);
assert.throws(() => C.getWindowProperties(), /not available/);
await C.createFloatView(config);
assert.equal(callbacks.size, 2);
callbacks.get('state')({ state: 3 });
assert.equal(callbacks.size, 0);
// Independent wrappers preserve internal lifecycle observation.
assert.equal(C.getFloatViewProperties(), undefined);
assert.deepEqual(C.getFloatViewLimits(1), { template: 1 });
env.failLimits = true; assert.equal(C.getFloatViewLimits(1), null); env.failLimits = false;
await C.createFloatView(config);
let startedCount = 0, stoppedCount = 0;
C.registerStateChangeCallback(1, () => startedCount++);
C.registerStateChangeCallback(3, () => stoppedCount++);
callbacks.get('state')({ state: 1 });
assert.equal(startedCount, 1);
assert.equal(C.getFloatViewProperties().windowId, 123);
C.unRegisterStateChangeCallback();
callbacks.get('state')({ state: 1 });
assert.equal(startedCount, 1);
assert.equal(C.state, 1);
const limitsCallback = value => { limitsSeen = value; };
const rectCallback = value => { rectSeen = value; };
C.registerLimitsChangeCallback(limitsCallback);
C.onRectChangeCallback(rectCallback);
callbacks.get('limits')(size); callbacks.get('rect')(size);
assert.equal(limitsSeen, size); assert.equal(rectSeen, size);
C.UnRegisterLimitsChangeCallback(() => {}); assert.ok(callbacks.has('limits'));
C.offRectChangeCallback(() => {}); assert.ok(callbacks.has('rect'));
C.UnRegisterLimitsChangeCallback(limitsCallback); C.offRectChangeCallback(rectCallback);
assert.ok(!callbacks.has('limits')); assert.ok(!callbacks.has('rect'));
C.registerLimitsChangeCallback(limitsCallback); C.onRectChangeCallback(rectCallback);
C.UnRegisterLimitsChangeCallback(); C.offRectChangeCallback();
assert.ok(!callbacks.has('limits')); assert.ok(!callbacks.has('rect'));
C.onRectChangeCallback(rectCallback);
calls.length = 0;
await C.setUIContent('pages/Content', storage); await C.setWindowSize(size); await C.startFloatView();
assert.deepEqual(calls.map(c => c[0]), ['page', 'size', 'start']);
assert.equal(calls[0][2], storage);
const callsBeforeInvalidStart = calls.length;
await assert.rejects(C.startFloatView('pages/Content'), { name: 'Error', message: 'Prepare and start float view failed' });
assert.equal(calls.length, callsBeforeInvalidStart);
assert.ok(logs.some(log => log[0] === 'error' && log.includes('Provide both page and size, or prepare them before starting')));
C.registerStateChangeCallback(3, () => { assert.equal(callbacks.size, 0); stoppedCount++; });
callbacks.get('state')({ state: 3 });
assert.equal(stoppedCount, 1); assert.equal(callbacks.size, 0);
await C.createFloatView(config); callbacks.get('state')({ state: 3 });
assert.equal(stoppedCount, 1);
assert.ok(logs.some(log => log[0] === 'debug'));
assert.ok(logs.some(log => log[0] === 'error' && log.includes('Prepare and start float view')));
assert.ok(logs.some(log => log[0] === 'error' && log.includes('Stop float view')));
console.log('FloatViewController mock tests passed');
`);
  const result = spawnSync(process.execPath, ['--experimental-transform-types', join(work, 'test.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);
} finally {
  if (dirname(resolve(work)) !== parent || !basename(work).startsWith('float-view-controller-tests-')) {
    throw new Error('Unexpected temporary test path');
  }
  await rm(work, { recursive: true, force: true });
}

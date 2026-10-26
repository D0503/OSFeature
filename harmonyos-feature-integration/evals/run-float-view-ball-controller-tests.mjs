import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = resolve(tmpdir());
const work = await mkdtemp(join(parent, 'float-view-ball-tests-'));
try {
  for (const name of ['FloatViewController', 'FloatingBallController', 'FloatViewBallController']) {
    const source = await readFile(join(root, 'references/features/float-view-ball/assets', name + '.ets'), 'utf8');
    const dependencies = name === 'FloatViewBallController'
      ? "import { FloatViewController } from './FloatViewController.ts';\nimport { FloatingBallController } from './FloatingBallController.ts';\n" : '';
    await writeFile(join(work, name + '.ts'), "import { floatView, floatingBall, deviceInfo, canIUse, hilog, abilityAccessCtrl } from './mock.mjs';\n" + dependencies + source.replace(/^import .*;\r?\n/gm, ''));
  }
  await writeFile(join(work, 'mock.mjs'), `
export const calls = [], logs = [];
export const env = { fail: '', view: null, ball: null };
export const deviceInfo = { sdkApiVersion: 26 };
export const canIUse = () => true;
export const hilog = { debug(...args) { logs.push(args); }, error(...args) { logs.push(args); } };
export const abilityAccessCtrl = {};
async function step(name, ...args) {
  calls.push([name, ...args]);
  if (env.fail === name) throw new Error(name + ' failed');
}
function makeView() {
  const listeners = new Map();
  return {
    listeners,
    onStateChange(cb) { listeners.set('state', cb); },
    onLimitsChange(cb) { listeners.set('limits', cb); },
    onRectChange(cb) { listeners.set('rect', cb); },
    offStateChange() { listeners.delete('state'); },
    offLimitsChange() { listeners.delete('limits'); },
    offRectChange() { listeners.delete('rect'); },
    emit(state) { listeners.get('state')?.({ state, stopReason: '' }); },
    async setUIContext(...args) { await step('page', ...args); },
    async setWindowSize(size) { await step('size', size); },
    async start() { await step('viewStart'); },
    async stop() { await step('viewStop'); }
  };
}
function makeBall() {
  const listeners = new Map();
  return {
    listeners,
    on(name, cb) { listeners.set(name, cb); }, off(name) { listeners.delete(name); },
    emit(state) { listeners.get('stateChange')?.(state); },
    async startFloatingBall(params) { await step('ballStart', params); },
    async stopFloatingBall() { await step('ballStop'); },
    async restoreMainWindow() { await step('restore'); }
  };
}
export const floatView = {
  FloatViewState: { STARTED: 1, HIDDEN: 2, STOPPED: 3, IN_SIDEBAR: 4, IN_FLOATING_BALL: 5, ERROR: 6 },
  isFloatViewEnabled: () => true,
  async create(config) { await step('viewCreate', config); return env.view = makeView(); },
  async bind(...args) { await step('bind', ...args); },
  async unbind(...args) { await step('unbind', ...args); }
};
export const floatingBall = {
  FloatingBallState: { STARTED: 1, STOPPED: 2 }, isFloatingBallEnabled: () => true,
  async create(config) { await step('ballCreate', config); return env.ball = makeBall(); }
};
`);
  await writeFile(join(work, 'test.mjs'), `
import assert from 'node:assert/strict';
import { FloatViewBallController as C } from './FloatViewBallController.ts';
import { FloatViewController as V } from './FloatViewController.ts';
import { FloatingBallController as B } from './FloatingBallController.ts';
import { calls, env } from './mock.mjs';
const context = {}, vc = { context, templateType: 1 }, bc = { context };
const size = { width: 200, height: 100 }, storage = {};
const params = Object.freeze({ template: 2, title: 'Business' });
const prepare = callbacks => C.prepare(vc, bc, 'pages/Content', size, storage, callbacks);
const names = () => calls.map(c => c[0]);
async function finish() {
  env.view.emit(3); env.ball.emit(2);
  await C.unbind();
}
await assert.rejects(C.start('view'));
await assert.rejects(C.bind(params));
await assert.rejects(C.stop());
await assert.rejects(C.unbind());
for (const initial of ['view', 'ball']) {
  for (const first of ['view', 'ball']) {
    calls.length = 0;
    const seen = [];
    await prepare({ onViewStateChange: info => seen.push(['v', info.state]),
      onBallStateChange: state => seen.push(['b', state]),
      onLimitsChange: limits => seen.push(['l', limits]), onRectChange: rect => seen.push(['r', rect]) });
    const view = env.view, ball = env.ball;
    assert.deepEqual(names(), ['viewCreate', 'ballCreate', 'page', 'size']);
    assert.equal(calls[0][1], vc); assert.equal(calls[1][1], bc);
    assert.equal(calls[2][2], storage); assert.equal(calls[3][1], size);
    await assert.rejects(prepare());
    await assert.rejects(C.start(initial));
    await C.bind(params);
    assert.equal(calls.at(-1)[3], params);
    await assert.rejects(C.release());
    await C.start(initial);
    assert.deepEqual(names().slice(4), ['bind', initial === 'view' ? 'viewStart' : 'ballStart']);
    if (initial === 'ball') assert.equal(calls.at(-1)[1], params);
    await assert.rejects(C.unbind());
    await assert.rejects(C.release());
    view.emit(1); view.emit(5); view.emit(2); view.emit(4); ball.emit(1);
    assert.equal(V.floatViewController, view);
    view.listeners.get('limits')(size); view.listeners.get('rect')(size);
    ball.listeners.get('click')(); assert.ok(!names().includes('restore'));
    await C.stop();
    assert.equal(names().filter(n => n === 'viewStop' || n === 'ballStop').length, 1);
    await assert.rejects(C.unbind());
    if (first === 'view') view.emit(3); else ball.emit(2);
    await assert.rejects(C.unbind());
    if (first === 'view') ball.emit(2); else view.emit(3);
    assert.equal(V.floatViewController, view); assert.equal(B.floatingBallController, ball);
    assert.equal(view.listeners.size, 0); assert.equal(ball.listeners.size, 0);
    await C.unbind();
    assert.equal(V.floatViewController, undefined); assert.equal(B.floatingBallController, undefined);
    assert.equal(calls.at(-1)[1], view); assert.equal(calls.at(-1)[2], ball);
    assert.ok(seen.some(x => x[0] === 'l')); assert.ok(seen.some(x => x[0] === 'r'));
    await C.release();
  }
}
// Never-started binding can be unbound, with listeners released.
await prepare(); await C.bind(params); await C.unbind();
assert.equal(env.view.listeners.size, 0); assert.equal(env.ball.listeners.size, 0);
// System stop does not require another stop request.
await prepare(); await C.bind(params); await C.start('view'); await finish();
// Failure of each preparation stage leaves only owned resources to release.
for (const stage of ['viewCreate', 'ballCreate', 'page', 'size']) {
  calls.length = 0; env.fail = stage;
  await assert.rejects(prepare(), /failed/);
  assert.ok(!names().includes('bind')); assert.ok(!names().includes('viewStart'));
  env.fail = ''; await C.release();
  assert.equal(V.floatViewController, undefined); assert.equal(B.floatingBallController, undefined);
}
// Independent controllers are never adopted or removed.
await V.createFloatView(vc); const independentView = V.floatViewController;
await assert.rejects(prepare()); await C.release(); assert.equal(V.floatViewController, independentView);
independentView.emit(3);
await B.createFloatingBall(bc); const independentBall = B.floatingBallController;
await assert.rejects(prepare()); await C.release(); assert.equal(B.floatingBallController, independentBall);
independentBall.emit(2);
// Bind failure can be retried or abandoned without starting either side.
await prepare(); env.fail = 'bind'; await assert.rejects(C.bind(params));
await assert.rejects(C.start('view')); env.fail = ''; await C.release();
await prepare(); env.fail = 'bind'; await assert.rejects(C.bind(params));
env.fail = ''; await C.bind(params); await C.unbind();
for (const initial of ['view', 'ball']) {
  await prepare(); await C.bind(params); env.fail = initial === 'view' ? 'viewStart' : 'ballStart';
  await assert.rejects(C.start(initial));
  await assert.rejects(C.release()); await assert.rejects(C.unbind());
  assert.equal(V.floatViewController, env.view); assert.equal(B.floatingBallController, env.ball);
  env.fail = ''; await C.stop(); await finish();
}
await prepare(); await C.bind(params); await C.start('view');
env.fail = 'viewStop'; await assert.rejects(C.stop());
assert.equal(V.floatViewController, env.view); assert.equal(B.floatingBallController, env.ball);
env.fail = ''; await C.stop(); env.view.emit(3); env.ball.emit(2);
env.fail = 'unbind'; await assert.rejects(C.unbind());
assert.equal(V.floatViewController, env.view); assert.equal(B.floatingBallController, env.ball);
env.fail = ''; await C.unbind();
// Normal close releases stopped controllers without calling unbind.
for (const first of ['view', 'ball']) {
  await prepare(); await C.bind(params); await C.start('ball'); await C.stop();
  if (first === 'view') env.view.emit(3); else env.ball.emit(2);
  await assert.rejects(C.release());
  if (first === 'view') env.ball.emit(2); else env.view.emit(3);
  calls.length = 0;
  await C.release();
  assert.ok(!names().includes('unbind'));
  assert.equal(V.floatViewController, undefined); assert.equal(B.floatingBallController, undefined);
  await prepare(); await C.release();
}
console.log('FloatViewBallController integrated mock tests passed');
`);
  const result = spawnSync(process.execPath, ['--experimental-transform-types', join(work, 'test.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);
} finally {
  if (dirname(resolve(work)) !== parent || !basename(work).startsWith('float-view-ball-tests-')) throw new Error('Unexpected temporary path');
  await rm(work, { recursive: true, force: true });
}

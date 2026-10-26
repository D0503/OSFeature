import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = resolve(tmpdir());
const work = await mkdtemp(join(temporaryRoot, "floating-ball-controller-tests-"));
try {
  const source = await readFile(join(root, "references/features/float-view-ball/assets/FloatingBallController.ets"), "utf8");
  await writeFile(join(work, "controller.ts"), "import { floatingBall, deviceInfo, canIUse, hilog } from './mock.mjs';\n" + source.replace(/^import .*;\r?\n/gm, ""));
  await writeFile(join(work, "mock.mjs"), `
export const logs = [];
export const hilog = { debug(...args) { logs.push(["debug", ...args]); }, error(...args) { logs.push(["error", ...args]); } };
export const deviceInfo = { sdkApiVersion: 20 };
export const env = { syscap: true, enabledCalls: 0, controller: null };
export const canIUse = () => env.syscap;
export const floatingBall = {
  FloatingBallState: { STARTED: 1, STOPPED: 2 },
  isFloatingBallEnabled() { env.enabledCalls++; if (env.checkError) throw env.checkError; return true; },
  async create(config) { env.config = config; return env.controller; }
};
`);
  await writeFile(join(work, "test.mjs"), `
import assert from 'node:assert/strict';
import { FloatingBallController as C } from './controller.ts';
import { env, deviceInfo, logs } from './mock.mjs';
const failure = new Error('platform failure');
const calls = [];
function makeController() {
  const listeners = new Map();
  return {
    listeners,
    on(type, callback) { if (this.failOn === type) throw failure; listeners.set(type, callback); },
    off(type) { listeners.delete(type); },
    emit(state) { listeners.get('stateChange')?.(state); },
    async startFloatingBall(params) { if (this.failStart) throw failure; calls.push(['start', params]); },
    async updateFloatingBall(params) { calls.push(['update', params]); },
    async stopFloatingBall() { if (this.failStop) throw failure; calls.push(['stop']); },
    async restoreMainWindow(want) { calls.push(['restore', want]); if (this.failRestore) throw failure; }
  };
}
deviceInfo.sdkApiVersion = 19;
assert.equal(C.canUseFloatingBall(), false);
assert.equal(env.enabledCalls, 0);
deviceInfo.sdkApiVersion = 20; env.syscap = false;
assert.equal(C.canUseFloatingBall(), false);
assert.equal(env.enabledCalls, 0);
env.syscap = true; env.checkError = failure;
assert.equal(C.canUseFloatingBall(), false);
env.checkError = null;
assert.equal(C.canUseFloatingBall(), true);
await assert.rejects(C.startFloatingBall({}), /not initialized/);
await assert.rejects(C.updateFloatingBall({}), /not initialized/);
await assert.rejects(C.stopFloatingBall(), /not initialized/);
assert.equal(calls.length, 0);
for (const withClick of [false, true]) {
  for (const withState of [false, true]) {
    for (const withWant of [false, true]) {
      calls.length = 0;
      const ball = makeController(); env.controller = ball;
      const config = { context: {} }, want = { bundleName: 'app', abilityName: 'EntryAbility' };
      let clicks = 0;
      const states = [];
      await C.createFloatingBall(config, withClick ? () => { clicks++; } : undefined,
        withState ? state => {
          states.push(state);
          if (state === 2) {
            assert.equal(C.floatingBallController, undefined);
            assert.equal(ball.listeners.size, 0);
          }
        } : undefined, withWant ? want : undefined);
      assert.equal(env.config, config);
      assert.equal(ball.listeners.size, 2);
      await assert.rejects(C.createFloatingBall(config), /already exists/);
      assert.equal(C.floatingBallController, ball);
      assert.equal(ball.listeners.size, 2);
      const startParams = Object.freeze({ template: 2, title: 'title' });
      const updateParams = Object.freeze({ template: 2, title: 'updated' });
      await C.startFloatingBall(startParams);
      assert.equal(calls.at(-1)[1], startParams);
      assert.equal(C.state, undefined);
      ball.emit(1);
      await C.updateFloatingBall(updateParams);
      assert.equal(calls.at(-1)[1], updateParams);
      ball.listeners.get('click')();
      assert.equal(clicks, withClick ? 1 : 0);
      assert.equal(calls.filter(c => c[0] === 'restore').length, withWant ? 1 : 0);
      if (withWant) assert.equal(calls.at(-1)[1], want);
      await C.stopFloatingBall();
      assert.equal(C.floatingBallController, ball);
      assert.equal(ball.listeners.size, 2);
      ball.emit(2);
      assert.equal(C.floatingBallController, undefined);
      assert.deepEqual(states, withState ? [1, 2] : []);
    }
  }
}
const ball = makeController(); env.controller = ball;
ball.failOn = 'stateChange';
await assert.rejects(C.createFloatingBall({ context: {} }), /platform failure/);
assert.equal(ball.listeners.size, 0);
assert.equal(C.floatingBallController, undefined);
ball.failOn = null;
let clicked = false;
await C.createFloatingBall({ context: {} }, () => { clicked = true; }, undefined, {});
ball.failStart = true;
await assert.rejects(C.startFloatingBall({}), /platform failure/);
assert.equal(C.floatingBallController, ball);
assert.equal(ball.listeners.size, 2);
ball.failStart = false; await C.startFloatingBall({});
ball.failRestore = true; ball.listeners.get('click')();
await new Promise(resolve => setImmediate(resolve));
assert.equal(clicked, true);
ball.failStop = true;
await assert.rejects(C.stopFloatingBall(), /platform failure/);
assert.equal(C.floatingBallController, ball);
ball.failStop = false; await C.stopFloatingBall(); ball.emit(2);
assert.equal(C.floatingBallController, undefined);
assert.ok(logs.some(log => log[0] === 'debug'));
assert.ok(logs.some(log => log[0] === 'error' && log.includes('Start FloatingBall')));
assert.ok(logs.some(log => log[0] === 'error' && log.includes('Stop FloatingBall')));
console.log('FloatingBallController mock tests passed');
`);
  const result = spawnSync(process.execPath, ["--experimental-transform-types", join(work, "test.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);
} finally {
  if (dirname(work) !== temporaryRoot || !basename(work).startsWith("floating-ball-controller-tests-")) throw new Error("Unexpected temporary path");
  await rm(work, { recursive: true, force: true });
}

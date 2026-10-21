import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = resolve(tmpdir())
const work = await mkdtemp(join(temporaryRoot, "anti-peep-utils-tests-"))
try {
  const source = await readFile(join(root, "references/features/dlp-anti-peep/assets/AntiPeepUtils.ets"), "utf8")
  await writeFile(join(work, "utils.ts"), "import { dlpAntiPeep, hilog } from './mock.mjs';\n" + source.replace(/^import .*;\r?\n/gm, ""))
  await writeFile(join(work, "mock.mjs"), `
export const state = { result: 0, error: null, synchronous: false, context: null, logs: [] };
export const dlpAntiPeep = {
  AntiPeepOptionsResult: { SUCCESS: 0, FAIL: 1, ALREADY_ON: 2 },
  requestAntiPeepOptions(context) {
    state.context = context;
    if (state.error) {
      if (state.synchronous) throw state.error;
      return Promise.reject(state.error);
    }
    return Promise.resolve(state.result);
  }
};
export const hilog = Object.fromEntries(['info', 'warn', 'error'].map(level =>
  [level, (...args) => state.logs.push({ level, args })]));
`)
  await writeFile(join(work, "test.mjs"), `
import assert from 'node:assert/strict';
import { requestAntiPeepOptions } from './utils.ts';
import { dlpAntiPeep, state } from './mock.mjs';

const context = { owner: 'settings-entry' };
let cases = 0;
for (const result of Object.values(dlpAntiPeep.AntiPeepOptionsResult)) {
  Object.assign(state, { result, error: null, synchronous: false, logs: [] });
  assert.equal(await requestAntiPeepOptions(context), result);
  assert.equal(state.context, context);
  assert.equal(state.logs.length, 1);
  assert.equal(state.logs[0].level, 'info');
  assert.deepEqual(state.logs[0].args.slice(0, 2), [0x0000, 'AntiPeepUtils']);
  cases++;
}
for (const code of [201, 801, 1020600001, 1020600004]) {
  for (const synchronous of [false, true]) {
    Object.assign(state, { error: { code, message: 'mock failure' }, synchronous, logs: [] });
    assert.equal(await requestAntiPeepOptions(context), dlpAntiPeep.AntiPeepOptionsResult.FAIL);
    assert.equal(state.context, context);
    assert.equal(state.logs.length, 1);
    assert.equal(state.logs[0].level, 'error');
    assert.deepEqual(state.logs[0].args.slice(0, 2), [0x0000, 'AntiPeepUtils']);
    assert.ok(state.logs[0].args[2].includes(String(code)));
    cases++;
  }
}
console.log(JSON.stringify({ status: 'passed', asset: 'AntiPeepUtils.ets', cases }));
`)
  const result = spawnSync(process.execPath, ["--experimental-transform-types", join(work, "test.mjs")], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  process.stdout.write(result.stdout)
} finally {
  if (dirname(work) !== temporaryRoot || !basename(work).startsWith("anti-peep-utils-tests-")) throw new Error("测试临时目录不在预期范围")
  await rm(work, { recursive: true, force: true })
}

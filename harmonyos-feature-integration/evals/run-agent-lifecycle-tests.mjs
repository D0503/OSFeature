import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const work = await mkdtemp(join(tmpdir(), "agent-lifecycle-"))
try {
  const source = await readFile(join(root, "references/features/agent-framework-kit/assets/Agent.ets"), "utf8")
  // Execute the asset's lifecycle and query methods with controlled platform promises.
  const lifecycle = source.slice(0, source.indexOf("  build() {")) + "}\n"
  await writeFile(join(work, "agent.ts"), "import { deviceInfo, canIUse, hilog, FunctionController } from './mock.mjs';\n" + lifecycle
    .replace(/^import .*;\r?\n/gm, "").replace(/^@(?:Entry|ComponentV2)\r?\n/gm, "").replace("export struct Agent", "export class Agent").replace("@Local ", ""))
  await writeFile(join(work, "mock.mjs"), `
export const requests = [];
export const deviceInfo = { apiAvailable: () => true };
export const canIUse = () => true;
export const hilog = { error() {}, info() {} };
export class FunctionController {
  on() {}
  off() {}
  isAgentSupport(context, agentId) {
    return new Promise((resolve, reject) => requests.push({ resolve, reject, agentId }));
  }
}
`)
  await writeFile(join(work, "test.mjs"), `
import assert from 'node:assert/strict';
import { Agent } from './agent.ts';
import { FunctionController, requests } from './mock.mjs';
const ui = { getHostContext: () => ({}) };
const create = () => { const page = new Agent(); page.agentId = 'agent-one'; page.getUIContext = () => ui; return page; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const page = create();
page.aboutToAppear();
page.aboutToDisappear();
requests.at(-1).resolve(true);
await tick();
assert.equal(page.isAgentSupport, false, '离开后返回的成功结果不能恢复入口');

for (const oldFails of [false, true]) {
  const reentered = create();
  reentered.aboutToAppear();
  const old = requests.at(-1);
  reentered.aboutToDisappear();
  reentered.aboutToAppear();
  requests.at(-1).resolve(oldFails);
  await tick();
  if (oldFails) old.reject(new Error('late failure')); else old.resolve(true);
  await tick();
  assert.equal(reentered.isAgentSupport, oldFails, '旧页面查询的成功和失败均不能覆盖重入后的结果');
  reentered.aboutToDisappear();
}

const current = create();
current.aboutToAppear();
requests.at(-1).resolve(true);
await tick();
assert.equal(current.isAgentSupport, true, '当前查询成功应显示入口');
const earlier = current.checkAgentSupport(ui), old = requests.at(-1);
const latest = current.checkAgentSupport(ui);
requests.at(-1).resolve(true);
await latest;
old.reject(new Error('obsolete failure'));
await earlier;
assert.equal(current.isAgentSupport, true, '同一页面较早请求的失败不能覆盖最新成功');
const failing = current.checkAgentSupport(ui);
requests.at(-1).reject(new Error('current failure'));
await failing;
assert.equal(current.isAgentSupport, false, '当前查询失败应隐藏入口');

for (const replacement of ['agent', 'controller']) {
  const pending = current.checkAgentSupport(ui);
  if (replacement === 'agent') current.agentId = 'agent-two'; else current.controller = new FunctionController();
  requests.at(-1).resolve(true);
  await pending;
  assert.equal(current.isAgentSupport, false, '旧配置或控制器的结果不能写入新实例');
}
current.aboutToDisappear();
const count = requests.length;
await current.checkAgentSupport(ui);
assert.equal(requests.length, count, '页面隐藏后不发起查询');
console.log('Agent lifecycle tests passed: leave, reentry, overlapping queries and configuration changes');
`)
  const result = spawnSync(process.execPath, ["--experimental-transform-types", join(work, "test.mjs")], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  process.stdout.write(result.stdout)
} finally {
  if (dirname(work) !== resolve(tmpdir())) throw new Error("Unexpected test temporary path")
  await rm(work, { recursive: true, force: true })
}

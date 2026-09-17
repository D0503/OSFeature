import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { verifyDevelopment, parseDevelopmentArgs, inspectVerification } from "../scripts/verify-development.mjs"
import { buildStages, runHvigorBuild } from "../scripts/lib/hvigor-build.mjs"
import { navigate, validateNavigation } from "../scripts/lib/development-device.mjs"

const root = await mkdtemp(join(tmpdir(), "os-feature-tests-"))
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
const changes = {
  schemaVersion: "1.0", page: "首页", component: "Tabs", category: "悬浮 Tab", effect: "底部悬浮材质", files: ["entry/src/main/ets/pages/Home.ets"],
  before: { sdk: 26, compile: 26, target: 26, compatible: 23 },
  fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原布局与交互", status: "passed", evidence: "测试夹具中的独立回退观察" }))
}
const nav = { schemaVersion: "1.0", steps: [{ stepId: "home", action: "wait", timeoutMs: 1, expectPage: { by: "id", value: "home-page" } }] }
const inspection = { localSdk: { status: "valid", apiVersion: 26, path: root }, api: { compile: 26, target: 26, compatible: 23 }, modules: [{ name: "entry", type: "entry" }] }
let calls = [], builds = 0
const options = {
  inspector: async () => ({ inspection, compatibility: { availableRoutes: ["arkui"] }, staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }),
  buildRunner: async () => { builds++; return { exitCode: 0, stdout: "build passed" } },
  commandRunner: async (args) => {
    calls.push(args)
    if (args[1] === "screenshot") await writeFile(args[args.indexOf("--path") + 1], png)
    return { exitCode: 0, stdout: args[1] === "layout" ? JSON.stringify({ attributes: { id: "home-page", bounds: "[0,0][100,100]" } }) : "HarmonyOS API 26", stderr: "" }
  }, pause: async () => {}
}
const request = (name) => ({ project: root, feature: "immersive-light", route: "arkui", goal: "首页悬浮栏", changes: structuredClone(changes), output: join(root, name), executeBuild: true, executeRun: true, device: "test-device", navigate: nav, captureScreenshot: true, captureLayout: true })
const success = await verifyDevelopment(request("success"), options)
assert.equal(success.status, "inconclusive", "截图不自动通过")
assert.equal(builds, 1)
assert.ok(calls.find((a) => a[0] === "run").includes("--skip-build"))
const screenshot = success.evidence.find((e) => e.type === "screenshot")
const log = success.evidence.find((e) => e.type === "runtime_log")
const refs = (e) => [{ id: e.id, sha256: e.sha256 }]
const judgment = { schemaVersion: "1.0", runId: success.runId, goal: "首页悬浮栏", visual: { status: "passed", summary: "测试观察通过", evidence: refs(screenshot) }, runtime: { status: "passed", summary: "测试交互通过", evidence: refs(log) } }
const oldCalls = calls.length
const resume = { project: root, output: request("success").output, resume: success.runId, judgment }
const completed = await verifyDevelopment(resume, options)
assert.equal(completed.status, "passed")
assert.equal(calls.length, oldCalls, "补录不调用设备")
assert.equal(builds, 1, "补录不构建")
assert.deepEqual((await readdir(request("success").output)).sort(), ["evidence", "integration-report.md"])
const markdown = await readFile(completed.report, "utf8")
for (const title of ["沉浸光感改造汇总", "沉浸光感类别", "视觉验证结果", "升级与兼容", "SDK/API 未升级", "![目标页面截图]"]) assert.ok(markdown.includes(title))
await assert.rejects(verifyDevelopment({ ...resume, judgment: { ...judgment, runId: "old" } }, options), /runId/)
await assert.rejects(verifyDevelopment({ ...resume, executeRun: true }, options), /resume/)
const wrong = structuredClone(judgment)
wrong.visual.evidence[0].sha256 = "wrong"
await assert.rejects(verifyDevelopment({ ...resume, judgment: wrong }, options), /哈希/)

for (const scenario of ["sdk", "static", "build", "install", "navigate", "screenshot", "device"]) {
  calls = []
  const opts = { ...options }
  if (["sdk", "static"].includes(scenario)) opts.inspector = async () => {
    const result = await options.inspector()
    if (scenario === "sdk") result.compatibility.availableRoutes = []
    else result.staticResult.counts.fail = 1
    return result
  }
  if (scenario === "build") opts.buildRunner = async () => ({ exitCode: 1, stderr: "compile error" })
  if (["install", "navigate", "screenshot"].includes(scenario)) opts.commandRunner = async (args) => {
    if ((scenario === "install" && args[0] === "run") || (scenario === "screenshot" && args[1] === "screenshot")) { calls.push(args); return { exitCode: 1, stderr: "test failure" } }
    if (scenario === "navigate" && args[1] === "layout") { calls.push(args); return { exitCode: 0, stdout: '{"id":"wrong-page"}' } }
    return options.commandRunner(args)
  }
  const req = request(scenario)
  if (scenario === "device") delete req.device
  const result = await verifyDevelopment(req, opts)
  assert.notEqual(result.status, "passed")
  assert.equal(result.evidence.some((e) => e.type === "screenshot"), false)
  if (["sdk", "static", "build", "device"].includes(scenario)) assert.equal(calls.length, 0)
  if (["install", "navigate"].includes(scenario)) assert.equal(calls.some((a) => a[1] === "screenshot"), false)
  await assert.rejects(verifyDevelopment({ project: root, output: req.output, resume: result.runId, judgment: { ...judgment, runId: result.runId } }, opts))
}

const second = await verifyDevelopment({ ...request("success"), goal: "弹窗材质" }, options)
let content = await readFile(second.report, "utf8")
assert.ok(content.includes("首页悬浮栏") && content.includes("弹窗材质"))
const again = await verifyDevelopment({ ...request("success"), captureScreenshot: false }, options)
await assert.rejects(verifyDevelopment(resume, options), /不存在/)
content = await readFile(again.report, "utf8")
assert.equal((content.match(/### 首页悬浮栏/g) ?? []).length, 2)
assert.equal((await readdir(join(request("success").output, "evidence"))).length, 1, "另一目标仍引用同图")
await verifyDevelopment({ ...request("success"), goal: "弹窗材质", captureScreenshot: false }, options)
assert.equal((await readdir(join(request("success").output, "evidence"))).length, 0, "清理失去引用的截图")
await assert.rejects(verifyDevelopment({ ...request("success"), project: join(root, "other") }, options), /其他工程/)
assert.throws(() => validateNavigation({ ...nav, steps: [{ stepId: "bad", action: "wait", timeoutMs: 1 }] }), /expectPage/)
assert.throws(() => parseDevelopmentArgs(["--unknown"]), /未知/)
assert.equal(parseDevelopmentArgs(["--execute-build"]).executeBuild, true)

const tools = { node: "node", ohpm: "ohpm.js", hvigor: "hvigor.js", env: {} }
const selection = { product: "default", buildMode: "debug", module: "entry", modules: inspection.modules }
const stages = buildStages(tools, selection)
assert.ok(stages.slice(1).every((s) => s.args.includes("--no-daemon")))
assert.ok(stages[2].args.includes("assembleHap"))
let stageCalls = 0
const failedBuild = await runHvigorBuild(root, selection, { tools, runner: async () => { stageCalls++; return { exitCode: 1, stderr: "failure" } } })
assert.equal(stageCalls, 1)
assert.equal(failedBuild.failedStage, "ohpm install")
const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures")
for (const route of ["arkui", "hds"]) {
  const result = await inspectVerification({ project: join(fixtures, route === "arkui" ? "api26-arkui" : "api23-hds"), feature: "immersive-light", route, sdk: join(fixtures, route === "arkui" ? "sdk-api26" : "sdk-api23") })
  assert.ok(result.compatibility.availableRoutes.includes(route))
  assert.equal(result.staticResult.route, route)
}
const actionCalls = []
const actionNavigation = { schemaVersion: "1.0", steps: [
  { stepId: "launch", action: "launch" },
  { stepId: "tap", action: "tap", locator: { by: "id", value: "home-page" } },
  { stepId: "input", action: "input", value: "hello", locator: { by: "id", value: "home-page" } },
  { stepId: "scroll", action: "swipe", direction: "up" },
  { stepId: "swipe", action: "swipe", from: [0, 100], to: [0, 0], expectPage: { by: "id", value: "home-page" } }
] }
await navigate(actionNavigation, async (args) => { actionCalls.push(args); return options.commandRunner(args) }, ["run", "--skip-build", "--device", "test-device"], "test-device")
assert.ok(actionCalls.some((a) => a[1] === "click" && a.slice(-2).join(",") === "50,50"))
assert.ok(actionCalls.some((a) => a[1] === "text" && a.includes("hello")))
assert.ok(actionCalls.some((a) => a[1] === "dircfling"))
assert.ok(actionCalls.some((a) => a[1] === "swipe"))
await assert.rejects(navigate(actionNavigation, async () => ({ exitCode: 0, stdout: '{"children":[{"id":"home-page","bounds":[0,0,10,10]},{"id":"home-page","bounds":[0,0,10,10]}]}' }), ["run"], "test-device"), /非唯一/)

const tamper = await verifyDevelopment(request("tamper"), options)
const tamperShot = tamper.evidence.find((e) => e.type === "screenshot")
await writeFile(tamperShot.path, "modified")
await assert.rejects(verifyDevelopment({ project: root, output: request("tamper").output, resume: tamper.runId, judgment: { ...judgment, runId: tamper.runId, visual: { ...judgment.visual, evidence: refs(tamperShot) } } }, options), /哈希/)
console.log(JSON.stringify({ status: "passed" }))

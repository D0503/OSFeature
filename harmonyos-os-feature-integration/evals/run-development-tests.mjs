import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { verifyDevelopment, parseDevelopmentArgs, inspectVerification } from "../scripts/verify-development.mjs"
import { buildStages, runHvigorBuild } from "../scripts/lib/hvigor-build.mjs"
import { navigate, validateNavigation } from "../scripts/lib/development-device.mjs"
import { cacheDirectory, loadCollection, validateChanges } from "../scripts/lib/development-report.mjs"

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
for (const title of ["沉浸光感改造汇总", "沉浸光感类别", "视觉验证结果", "升级与兼容", "SDK/API 未升级", '<img src="evidence/', 'alt="目标页面截图" width="270"']) assert.ok(markdown.includes(title))
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

const popupChanges = { ...structuredClone(changes), component: "Popup", category: "弹窗", effect: "配置弹窗材质" }
const second = await verifyDevelopment({ ...request("success"), goal: "弹窗材质", changes: popupChanges }, options)
let content = await readFile(second.report, "utf8")
assert.ok(content.includes("首页悬浮栏") && content.includes("弹窗材质"))
assert.equal((content.match(/\| 回退条件 \|/g) ?? []).length, 1, "回退表按工程只保留一份")
assert.equal((content.match(/\| 项目 \| 改造前 \| 改造后 \|/g) ?? []).length, 1, "版本对照只保留一份")
assert.ok(content.includes("首页悬浮栏：保留原布局与交互") && content.includes("弹窗材质：保留原布局与交互"), "保留行为合并所有改造项")
const again = await verifyDevelopment({ ...request("success"), captureScreenshot: false }, options)
await assert.rejects(verifyDevelopment(resume, options), /不存在/)
content = await readFile(again.report, "utf8")
assert.equal((content.match(/### 首页悬浮栏/g) ?? []).length, 1, "视觉结果只保留当前项，升级与兼容不再按目标分节")
assert.equal((await readdir(join(request("success").output, "evidence"))).length, 1, "另一目标仍引用同图")
await verifyDevelopment({ ...request("success"), goal: "弹窗材质", changes: popupChanges, captureScreenshot: false }, options)
assert.equal((await readdir(join(request("success").output, "evidence"))).length, 0, "清理失去引用的截图")

// A display-name change updates the same item, including a previous failure.
const renamed = await verifyDevelopment({ ...request("success"), goal: "主页悬浮导航重验", captureScreenshot: false }, options)
content = await readFile(renamed.report, "utf8")
assert.ok(!content.includes("首页悬浮栏"))
assert.ok(content.includes("弹窗材质") && content.includes("主页悬浮导航重验"))
const stableRequest = { ...request("stable"), changes: { ...structuredClone(changes), id: "main-tabs", before: { ...changes.before, target: 22 } } }
const failedStable = await verifyDevelopment(stableRequest, { ...options, buildRunner: async () => ({ exitCode: 1, failedStage: "hvigor build", stderr: "RAW_BUILD_ERROR" }) })
const failedReport = await readFile(failedStable.report, "utf8")
assert.ok(failedReport.includes("停止于HAP 打包"))
assert.ok(!failedReport.includes("RAW_BUILD_ERROR"))
const stable = await verifyDevelopment({ ...stableRequest, goal: "更新后的标题", changes: { ...structuredClone(changes), id: "main-tabs", page: "主入口" } }, options)
content = await readFile(stable.report, "utf8")
assert.ok(!content.includes("RAW_BUILD_ERROR") && !content.includes("首页悬浮栏"))
assert.ok(content.includes("| target API | 22 | 26 |"), "重验保留改造前基线")
assert.ok(content.includes("已实施配置") && content.includes("| 未确认 | 未确认 |"))
await assert.rejects(verifyDevelopment({ project: root, output: stableRequest.output, resume: failedStable.runId, judgment: { ...judgment, runId: failedStable.runId } }, options), /不存在/)
const sibling = await verifyDevelopment({ ...stableRequest, goal: "另一实例", changes: { ...stableRequest.changes, id: "other-tabs" } }, options)
content = await readFile(sibling.report, "utf8")
assert.ok(content.includes("更新后的标题") && content.includes("另一实例"), "同页同类的不同实例不能合并")
assert.throws(() => validateChanges({ ...changes, id: " " }), /稳定标识/)

// Legacy duplicate records collapse without fuzzy matching unrelated components.
const cachedPath = join(cacheDirectory(request("success").output), "collection.json")
const cached = JSON.parse(await readFile(cachedPath, "utf8"))
cached.runs.unshift({ ...cached.runs.at(-1), runId: "stale-run", goal: "过期标题" })
await writeFile(cachedPath, JSON.stringify(cached))
const loaded = await loadCollection(request("success").output, root)
assert.equal(loaded.collection.runs.length, 2)
assert.ok(!loaded.collection.runs.some((r) => r.runId === "stale-run"))

const readableOptions = { ...options,
  inspector: async () => ({ ...(await options.inspector()), staticResult: { counts: { fail: 0, warn: 1 }, checks: [{ id: "scrollable-tab-tail-clearance", status: "warn", message: "RAW_ENGLISH_STATIC_DETAIL", evidence: [{ path: "Home.ets", line: 12 }] }] } }),
  commandRunner: async (args) => args[0] === "device" ? { exitCode: 0, stdout: JSON.stringify({ name: "测试手机", serial: "RAW_SERIAL", osVersion: "API 26" }) } : options.commandRunner(args)
}
const readable = await verifyDevelopment(request("readable"), readableOptions)
content = await readFile(readable.report, "utf8")
assert.ok(content.includes("设备：测试手机；系统：API 26"))
assert.ok(content.includes("逐页验证真实滚动容器") && content.includes("Home.ets:12"))
assert.ok(!content.includes("RAW_ENGLISH_STATIC_DETAIL") && !content.includes("RAW_SERIAL"))
assert.ok(content.includes("等待 AI 实际阅读"), "未判读的截图不能通过")
assert.equal((content.match(/等待 AI 实际阅读/g) ?? []).length, 1, "不重复输出视觉结论")

// Static review judgments resolve warn findings project-wide and persist across runs.
const reviewJudgment = { schemaVersion: "1.0", runId: readable.runId, goal: "首页悬浮栏", staticReview: { results: [{ id: "scrollable-tab-tail-clearance", status: "passed", note: "已逐页确认补偿归属唯一滚动容器" }] } }
const reviewed = await verifyDevelopment({ project: root, output: request("readable").output, resume: readable.runId, judgment: reviewJudgment }, readableOptions)
content = await readFile(reviewed.report, "utf8")
assert.ok(content.includes("已复核通过") && content.includes("已逐页确认补偿归属唯一滚动容器"))
assert.ok(content.includes("静态检查通过，warn 项已全部复核"))
assert.ok(!content.includes("待核对"))
const inherited = await verifyDevelopment({ ...request("readable"), goal: "弹窗材质", changes: popupChanges }, readableOptions)
content = await readFile(inherited.report, "utf8")
assert.ok(content.includes("已复核通过"), "静态复核按检查项在工程内继承")
assert.ok(!content.includes("待核对"))
await assert.rejects(verifyDevelopment({ project: root, output: request("readable").output, resume: inherited.runId, judgment: { ...reviewJudgment, runId: inherited.runId, goal: "弹窗材质", staticReview: { results: [{ id: "version-guard", status: "passed", note: "不存在" }] } } }, readableOptions), /不存在或不是 warn/)
const failedRun = await verifyDevelopment(request("review-failed"), readableOptions)
await assert.rejects(verifyDevelopment({ project: root, output: request("review-failed").output, resume: failedRun.runId, judgment: { schemaVersion: "1.0", runId: failedRun.runId, goal: "首页悬浮栏", staticReview: { results: [{ id: "scrollable-tab-tail-clearance", status: "passed" }] } } }, readableOptions), /note/)
const failedReview = await verifyDevelopment({ project: root, output: request("review-failed").output, resume: failedRun.runId, judgment: { schemaVersion: "1.0", runId: failedRun.runId, goal: "首页悬浮栏", staticReview: { results: [{ id: "scrollable-tab-tail-clearance", status: "failed", note: "发现列表外固定占位" }] } } }, readableOptions)
assert.equal(failedReview.status, "failed")
content = await readFile(failedReview.report, "utf8")
assert.ok(content.includes("复核确认问题") && content.includes("发现列表外固定占位"))

const incomplete = await verifyDevelopment(request("incomplete"), { ...options, inspector: async () => ({ ...(await options.inspector()), inspection: { ...inspection, api: { ...inspection.api, target: null } } }) })
content = await readFile(incomplete.report, "utf8")
assert.ok(content.includes("版本信息不完整，无法确认是否升级"))
assert.ok(!content.includes("SDK/API 变更如上表"))
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

// Smart-reach visual verification is real-device only; developer real-device screenshots import as visual evidence.
const devShot = join(root, "dev-shot.png")
await writeFile(devShot, png)
assert.deepEqual(parseDevelopmentArgs(["--import-screenshot", "a.png", "--import-screenshot", "b.png"]).importScreenshot, ["a.png", "b.png"])
assert.throws(() => parseDevelopmentArgs(["--device", "a", "--device", "b"]), /重复参数/)
const smartBase = { project: root, feature: "smart-reach", route: "holding-hand", goal: "侧边悬浮按钮握持手", changes: structuredClone(changes) }
const smartInspection = { ...inspection, api: { compile: 23, target: 23, compatible: 20 } }
const emulatorOptions = {
  ...options,
  inspector: async () => ({ inspection: smartInspection, compatibility: { availableRoutes: ["holding-hand"] }, staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }),
  commandRunner: async (args) => args[0] === "device" ? { exitCode: 0, stdout: JSON.stringify({ device: { name: "emulator", osVersion: "API 23" } }), stderr: "" } : options.commandRunner(args)
}
const emulatorRun = await verifyDevelopment({ ...smartBase, output: join(root, "sr-emulator"), executeBuild: true, executeRun: true, device: "emulator-1", navigate: nav, captureScreenshot: true }, emulatorOptions)
assert.equal(emulatorRun.status, "inconclusive")
assert.ok(emulatorRun.evidence.every((e) => e.type !== "screenshot"), "模拟器不采集智感握姿截图")
let smartReport = await readFile(emulatorRun.report, "utf8")
assert.ok(smartReport.includes("只能使用真机"))
assert.ok(smartReport.includes("（模拟器）"))
await assert.rejects(verifyDevelopment({ project: root, output: join(root, "sr-emulator"), resume: emulatorRun.runId, importScreenshot: [devShot] }, emulatorOptions), /真机/)
const physicalOptions = { ...emulatorOptions, commandRunner: async (args) => args[0] === "device" ? { exitCode: 0, stdout: JSON.stringify({ device: { name: "Mate 真机", osVersion: "API 23" } }), stderr: "" } : options.commandRunner(args) }
const manualRun = await verifyDevelopment({ ...smartBase, output: join(root, "sr-manual"), executeBuild: true, importScreenshot: [devShot, devShot] }, physicalOptions)
const manualShots = manualRun.evidence.filter((e) => e.type === "screenshot")
assert.equal(manualShots.length, 2, "可重复导入开发者真机截图")
assert.ok(manualShots.every((e) => e.origin === "developer"))
const manualRefs = manualShots.map((e) => ({ id: e.id, sha256: e.sha256 }))
const manualJudgment = { schemaVersion: "1.0", runId: manualRun.runId, goal: smartBase.goal, visual: { status: "passed", summary: "真机左右握姿均观察到按钮换边", evidence: manualRefs } }
await assert.rejects(verifyDevelopment({ project: root, output: join(root, "sr-manual"), resume: manualRun.runId, judgment: { ...manualJudgment, runtime: { status: "passed", summary: "测试交互通过", evidence: manualRefs } } }, physicalOptions), /安装或目标页导航/)
const manualDone = await verifyDevelopment({ project: root, output: join(root, "sr-manual"), resume: manualRun.runId, judgment: manualJudgment }, physicalOptions)
assert.equal(manualDone.status, "inconclusive", "安装导航未执行时整体保持未确认")
smartReport = await readFile(manualDone.report, "utf8")
assert.ok(smartReport.includes("截图来源：开发者按引导在真机采集并导入"))
assert.ok(smartReport.includes("真机左右握姿均观察到按钮换边"))
await assert.rejects(verifyDevelopment({ project: root, output: join(root, "sr-manual"), resume: manualRun.runId, importScreenshot: [join(root, "missing.png")] }, physicalOptions), /不存在/)
await writeFile(join(root, "not-png.txt"), "text")
await assert.rejects(verifyDevelopment({ project: root, output: join(root, "sr-manual"), resume: manualRun.runId, importScreenshot: [join(root, "not-png.txt")] }, physicalOptions), /PNG/)
console.log(JSON.stringify({ status: "passed" }))

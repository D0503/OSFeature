import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { inspectProject, evaluateCompatibility, verifyInspection, loadFeature } from "../scripts/lib/project-tools.mjs"
import { detectPrivacyDeviceKind, applyJudgment, verifyDevelopment } from "../scripts/verify-development.mjs"
import { windowPrivacyScenarios, validateWindowPrivacyJudgment } from "../scripts/lib/window-privacy-runtime.mjs"
import { hash, loadCollection } from "../scripts/lib/development-report.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = (n) => join(root, "evals/fixtures", n)
const profiles = {}
for (const id of ["float-view-ball", "dlp-anti-peep"]) profiles[id] = (await loadFeature(root, id)).profile
const inspect = (name, api) => inspectProject(fixture(name), { sdkPath: fixture(`sdk-api${api}`) })
const compat = (i, feature = "float-view-ball") => evaluateCompatibility(i, profiles[feature])
const verify = (i, feature = "float-view-ball", route = "auto") => verifyInspection(i, compat(i, feature), route)
const has = (r, suffix, status) => r.checks.some((c) => c.id.includes(suffix) && (!status || c.status === status))
const registry = JSON.parse(await readFile(join(root, "references/feature-registry.json"), "utf8"))
const match = (text) => registry.features.find((f) => [f.id, f.displayName, ...f.aliases].some((k) => text.toLowerCase().includes(k.toLowerCase())))?.id
for (const input of ["闪控窗", "闪控球", "闪控窗/球", "floatView", "FLOATINGBALL"]) assert.equal(match(input), "float-view-ball")
for (const input of ["防窥保护", "DlpAntiPeep", "dlpAntiPeep", "屏幕防窥", "系统防窥蒙层", "setAntiPeepMaskLayer", "requestAntiPeepOptions", "AntiPeepOptionsResult", "publishAntiPeepInformation"]) assert.equal(match(input), "dlp-anti-peep")
for (const input of ["全局悬浮窗", "悬浮按钮", "画中画", "防截屏", "隐私遮罩"]) assert.equal(match(input), undefined)

const ball = await inspect("floating-ball-api20", 20), view = await inspect("float-view-api26", 26)
const pair = await inspect("float-bound-api26", 26), privacy = await inspect("anti-peep-api21", 21), linked = await inspect("float-privacy-api26", 26)
assert.deepEqual(compat(ball).selectedRoutes, ["floating-ball"])
assert.deepEqual(compat(view).selectedRoutes, ["float-view"])
assert.deepEqual(compat(pair).selectedRoutes, ["binding"])
assert.equal(compat(pair).bindingDetected, true)
assert.equal(compat(pair).recommendedRoute, "binding")
assert.equal(verify(pair, "float-view-ball", "binding").route, "binding")
assert.equal(verify(pair, "float-view-ball", "binding").counts.fail, 0)
assert.ok(has(verify(pair, "float-view-ball", "float-view"), "binding-route", "fail"))
assert.ok(has(verify(view, "float-view-ball", "binding"), "binding-implementation", "fail"))
assert.ok(has(verify(ball, "float-view-ball", "binding"), "eligibility-binding", "fail"))
assert.ok(!compat(ball).availableRoutes.includes("binding"))
assert.ok(windowPrivacyScenarios("float-view-ball", "binding", ball).includes("pair-stopped"))
assert.equal(compat(ball).requiredApi, 20)
assert.equal(compat(pair).routeRequirements["binding"], 26)
assert.deepEqual(compat(privacy, "dlp-anti-peep").selectedRoutes, ["status-observation", "system-mask"])
assert.equal(compat(privacy, "dlp-anti-peep").requiredApi, 21)
for (const i of [ball, view, pair, linked]) assert.equal(verify(i).counts.fail, 0)
for (const i of [privacy, linked]) assert.equal(verify(i, "dlp-anti-peep").counts.fail, 0)
assert.ok(has(verify(ball, "float-view-ball", "invalid"), "eligibility", "fail"))
assert.ok(has(verify(pair), "binding", "warn"))
assert.ok(has(verify(privacy, "dlp-anti-peep"), "window-id", "warn"))
for (const [input, feature, required] of [[pair, "float-view-ball", 26], [privacy, "dlp-anti-peep", 21]]) {
  const low = structuredClone(input); low.localSdk.apiVersion = 20; low.api.compile = 20
  const r = compat(low, feature)
  assert.equal(r.status, "upgrade_available")
  assert.equal(r.upgradeOptions.at(-1).upgradeCompileApi, required)
  assert.equal(r.upgradeOptions.at(-1).upgradeTargetApi, Math.max(input.api.target, required))
  assert.equal(r.upgradeOptions.at(-1).keepCompatibleApi, 20)
  assert.equal(compat({ ...input, localSdk: { status: "missing" } }, feature).status, "insufficient_context")
  assert.equal(compat({ ...input, model: "fa" }, feature).status, "unsupported")
  assert.equal(compat({ ...input, api: { compile: "unknown" } }, feature).status, "insufficient_context")
}

const work = await mkdtemp(join(tmpdir(), "window-privacy-tests-")), project = join(work, "project")
await cp(fixture("float-privacy-api26"), project, { recursive: true })
const sourcePath = join(project, "entry/src/main/ets/pages/Index.ets"), manifestPath = join(project, "entry/src/main/module.json5")
const original = await readFile(sourcePath, "utf8"), originalManifest = await readFile(manifestPath, "utf8")
const source = async (text, api = 26) => { await writeFile(sourcePath, text); return inspectProject(project, { sdkPath: fixture(`sdk-api${api}`) }) }
const ballSource = await readFile(join(fixture("floating-ball-api20"), "entry/src/main/ets/pages/Index.ets"), "utf8")
const viewSource = await readFile(join(fixture("float-view-api26"), "entry/src/main/ets/pages/Index.ets"), "utf8")
assert.equal(compat(await source(ballSource + "\n" + viewSource)).bindingDetected, false)
assert.deepEqual(compat(await source(ballSource + "\n" + viewSource)).selectedRoutes, ["float-view", "floating-ball"])
assert.ok(has(verify(await source(ballSource + "\n" + viewSource), "float-view-ball", "binding"), "binding-implementation", "fail"))
for (const text of ["// " + original.replaceAll("\n", "\n// "), "const text = `" + original + "`;", "const text = 'floatView.bind(view, ball, {})';"]) {
  const i = await source(text)
  assert.equal(i.floatViewBall.usages.length, 0)
  assert.equal(i.dlpAntiPeep.usages.length, 0)
  assert.ok(has(verify(i), "implementation", "warn"))
}
const aliased = await source(ballSource.replace("{ floatingBall }", "{ floatingBall as fb }").replaceAll("floatingBall.", "fb."))
assert.ok(aliased.floatViewBall.usages.some((u) => u.operation === "startFloatingBall"))
const namespace = await source(ballSource.replace("{ floatingBall }", "* as UI").replaceAll("floatingBall.", "UI.floatingBall."))
assert.ok(namespace.floatViewBall.usages.some((u) => u.operation === "stopFloatingBall"))
const typed = await source("import { floatView } from '@kit.ArkUI'; function load(v: floatView.FloatViewController) { v.setUIContext('missing'); }")
assert.ok(has(verify(typed), "page", "fail"))
assert.ok(has(verify(await source(original.replace("'pages/FloatContent'", "'pages/Missing'"))), "page", "fail"))
assert.ok(has(verify(await source(original.replace("'pages/FloatContent'", "computedPage"))), "page", "warn"))
for (const title of ["''", `'${"汉".repeat(22)}'`]) assert.ok(has(verify(await source(original.replace("title: '进度'", `title: ${title}`))), "params", "fail"))
assert.ok(has(verify(await source(original.replace("template: floatingBall.FloatingBallTemplate.NORMAL, ", ""))), "params", "fail"))
assert.ok(has(verify(await source(original.replace("FloatingBallTemplate.NORMAL", "FloatingBallTemplate.STATIC"))), "params", "fail"))
assert.ok(has(verify(await source(original.replace("title: '进度'", "title: '进度', titleColor: '#FFFFFF'"))), "params", "fail"))
assert.ok(has(verify(await source(original.replace("setAntiPeepMaskLayer(windowId)", "setAntiPeepMaskLayer(0)")), "dlp-anti-peep"), "window-id", "fail"))
assert.ok(has(verify(await source(original.replace("setAntiPeepMaskLayer(windowId)", "setAntiPeepMaskLayer(-1)")), "dlp-anti-peep"), "window-id", "fail"))
assert.ok(has(verify(await source(original.replace("dlpAntiPeep.off('dlpAntiPeep', changed);", "dlpAntiPeep.passDlpAntiPeepInfo();")), "dlp-anti-peep"), "explicit-pass", "warn"))
for (const permission of ["FLOAT_VIEW", "USE_FLOAT_BALL", "DLP_GET_HIDE_STATUS"]) {
  const m = JSON.parse(originalManifest); m.module.requestPermissions = m.module.requestPermissions.filter((p) => p.name !== `ohos.permission.${permission}`)
  await writeFile(manifestPath, JSON.stringify(m))
  assert.ok(has(verify(await source(original), permission === "DLP_GET_HIDE_STATUS" ? "dlp-anti-peep" : "float-view-ball"), "permission", "fail"))
}
await writeFile(manifestPath, originalManifest)
for (const [operation, expected] of [["setFloatingBallVisibilityInApp(true)", 24], ["onDestroy(callback)", 26]]) {
  const i = await source(ballSource.replace("await ball.stopFloatingBall();", `ball.${operation};`))
  assert.equal(compat(i).requiredApi, expected)
}
assert.equal(compat(await source(ballSource.replace("title: '进度'", "title: '进度', textUpdateAnimationType: 0"))).requiredApi, 26)
const api23 = await source(original + "\ndlpAntiPeep.requestAntiPeepOptions(context);")
assert.equal(compat(api23, "dlp-anti-peep").requiredApi, 23)
assert.ok(windowPrivacyScenarios("dlp-anti-peep", "status-observation", api23).includes("options-result-checked"))
for (const [expression, operation, expectedScenarios] of [
  ["dlpAntiPeep.publishAntiPeepInformation();", "publishAntiPeepInformation", ["information-published", "information-failure-handled"]],
  ["dlpAntiPeep.passDlpAntiPeepInfo();", "passDlpAntiPeepInfo", ["explicit-pass-confirmed", "pass-duration-checked"]],
  ["const result = dlpAntiPeep.AntiPeepOptionsResult.SUCCESS;", "AntiPeepOptionsResult", []],
]) {
  const input = await source("import { dlpAntiPeep } from '@kit.DeviceSecurityKit';\n" + expression)
  assert.equal(compat(input, "dlp-anti-peep").requiredApi, operation === "passDlpAntiPeepInfo" ? 20 : 23)
  assert.equal(compat(input, "dlp-anti-peep").upgradeOptions.length, 0)
  assert.ok(expectedScenarios.every((scenario) => windowPrivacyScenarios("dlp-anti-peep", "status-observation", input).includes(scenario)))
  if (operation === "AntiPeepOptionsResult") {
    const low = structuredClone(input); low.localSdk.apiVersion = 21; low.api.compile = 21
    assert.equal(compat(low, "dlp-anti-peep").status, "upgrade_available")
    assert.equal(compat(low, "dlp-anti-peep").upgradeOptions[0].upgradeTargetApi, Math.max(low.api.target, 23))
  }
}
const aliasedEnum = await source("import { dlpAntiPeep as privacy } from '@kit.DeviceSecurityKit'; const result = privacy.AntiPeepOptionsResult.FAIL;")
assert.equal(compat(aliasedEnum, "dlp-anti-peep").requiredApi, 23)
const commentedEnum = await source("import { dlpAntiPeep } from '@kit.DeviceSecurityKit'; // dlpAntiPeep.AntiPeepOptionsResult.FAIL\nconst message = 'dlpAntiPeep.AntiPeepOptionsResult.SUCCESS';")
assert.equal(commentedEnum.dlpAntiPeep.usages.length, 0)
const statusOnly = await source("import { dlpAntiPeep } from '@kit.DeviceSecurityKit'; dlpAntiPeep.getDlpAntiPeepInfo();")
assert.equal(compat(statusOnly, "dlp-anti-peep").requiredApi, 20)
assert.equal(verify(statusOnly, "dlp-anti-peep", "status-observation").counts.fail, 0)
assert.ok(!windowPrivacyScenarios("dlp-anti-peep", "status-observation", statusOnly).includes("options-result-checked"))

assert.equal(detectPrivacyDeviceKind({ deviceType: "phone", connectType: "USB" }, "device-1"), "physical")
assert.equal(detectPrivacyDeviceKind({ deviceType: "tablet", isEmulator: false }, "device-1"), "unknown")
assert.equal(detectPrivacyDeviceKind({ deviceType: "phone", isEmulator: true }, "device-1"), "emulator")
assert.equal(detectPrivacyDeviceKind({}, "device-1"), "unknown")
const scenarios = windowPrivacyScenarios("dlp-anti-peep", "system-mask", linked)
assert.ok(scenarios.includes("float-view-protected"))
assert.ok(windowPrivacyScenarios("float-view-ball", "float-view", pair).includes("pair-stopped"))
assert.ok(!windowPrivacyScenarios("float-view-ball", "floating-ball", ball).includes("pair-stopped"))
const logPath = join(work, "runtime.log"), content = "observed runtime evidence"
await writeFile(logPath, content)
const evidence = [{ id: "E1", type: "runtime_log", path: logPath, sha256: hash(content) }]
const run = { runId: "run", goal: "privacy", feature: "dlp-anti-peep", route: "system-mask", requiredRuntimeScenarios: scenarios, device: "device-1", deviceInfo: { deviceType: "phone", isEmulator: false }, evidence, checks: Object.fromEntries(["build", "install", "navigation", "runtime", "visual"].map((key) => [key, { status: "passed" }])) }
const judgment = { schemaVersion: "1.0", runId: "run", goal: "privacy", runtime: { status: "passed", summary: "已核对实际观察", evidence: [{ id: "E1", sha256: evidence[0].sha256 }] } }
await assert.rejects(applyJudgment(run, judgment), /缺少/)
judgment.runtime.observations = scenarios.map((scenario) => ({ scenario, note: "对应场景的操作及结果", evidence: judgment.runtime.evidence }))
await applyJudgment(run, judgment)
assert.equal(run.checks.runtime.observations.length, scenarios.length)
await assert.rejects(applyJudgment({ ...run, deviceInfo: { deviceType: "phone", isEmulator: true } }, judgment), /真机/)
assert.throws(() => validateWindowPrivacyJudgment(run, "visual", { status: "passed" }, [{ type: "screenshot", sha256: "one" }]), /两张/)
judgment.runtime.observations[0].evidence = [{ id: "foreign", sha256: "other" }]
await assert.rejects(applyJudgment(run, judgment), /本轮/)

await source(original)
const changes = {
  schemaVersion: "1.0", page: "窗口", component: "floatView", category: "系统窗口与防窥", effect: "展示并保护目标窗口", files: ["entry/src/main/ets/pages/Index.ets"],
  before: { sdk: 26, compile: 26, target: 20, compatible: 20 },
  fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原业务", status: "not_run", evidence: "测试夹具" }))
}
const request = (feature, route, name) => ({ project, output: join(work, name), feature, route, goal: name, changes, executeBuild: true, executeRun: true, device: "phone-1", navigate: { schemaVersion: "1.0", steps: [{ stepId: "page", action: "wait", timeoutMs: 1, expectPage: { by: "id", value: "window-page" } }] } })
const options = {
  inspector: async (r) => ({ inspection: linked, compatibility: compat(linked, r.feature), staticResult: { checks: [], counts: { fail: 0, warn: 0 } } }),
  buildRunner: async () => ({ exitCode: 0, stdout: "mock build passed" }),
  commandRunner: async (args) => ({ exitCode: 0, stderr: "", stdout: args[0] === "device" ? JSON.stringify({ deviceType: "phone", isEmulator: false }) : args[1] === "layout" ? JSON.stringify({ attributes: { id: "window-page", bounds: "[0,0][100,100]" } }) : "mock execution" }),
  pause: async () => {}
}
for (const [feature, route] of [["float-view-ball", "binding"], ["dlp-anti-peep", "system-mask"]]) {
  const r = request(feature, route, feature)
  const output = await verifyDevelopment(r, options)
  assert.equal(output.status, "inconclusive")
  const saved = (await loadCollection(r.output, project)).collection.runs[0]
  assert.ok(saved.requiredRuntimeScenarios.includes(feature === "float-view-ball" ? "pair-stopped" : "float-view-protected"))
  assert.equal(saved.checks.install.status, "passed")
  const report = await readFile(output.report, "utf8")
  assert.match(report, feature === "float-view-ball" ? /闪控窗／球/ : /防窥保护/)
}
const unsupported = request("dlp-anti-peep", "system-mask", "emulator-rejected")
const unsupportedResult = await verifyDevelopment(unsupported, { ...options, commandRunner: async () => ({ exitCode: 0, stdout: JSON.stringify({ deviceType: "phone", isEmulator: true }) }) })
assert.equal((await loadCollection(unsupported.output, project)).collection.runs[0].checks.install.status, "not_run")
assert.notEqual(unsupportedResult.status, "passed")
for (const feature of Object.keys(profiles)) {
  const result = spawnSync(process.execPath, [join(root, "scripts/validate-feature-package.mjs"), "--feature", feature], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
}
for (const script of ["check-compatibility.mjs", "verify-integration.mjs"]) {
  const result = spawnSync(process.execPath, [join(root, "scripts", script), "--project", project, "--sdk", fixture("sdk-api26"), "--feature", "float-view-ball"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(JSON.parse(result.stdout).featureId, "float-view-ball")
}
const bindingCli = spawnSync(process.execPath, [join(root, "scripts/verify-integration.mjs"),
  "--project", fixture("float-bound-api26"), "--sdk", fixture("sdk-api26"),
  "--feature", "float-view-ball", "--route", "binding"], { encoding: "utf8" })
assert.equal(bindingCli.status, 0, bindingCli.stdout + bindingCli.stderr)
assert.equal(JSON.parse(bindingCli.stdout).route, "binding")
console.log(JSON.stringify({ status: "passed", features: Object.keys(profiles) }))

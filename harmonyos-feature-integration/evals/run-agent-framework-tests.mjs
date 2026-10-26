import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { inspectProject, evaluateCompatibility, verifyInspection, loadFeature } from "../scripts/lib/project-tools.mjs"
import { detectAgentDeviceKind, verifyDevelopment, applyJudgment } from "../scripts/verify-development.mjs"
import { loadCollection } from "../scripts/lib/development-report.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = (name) => join(root, "evals/fixtures", name)
const { profile } = await loadFeature(root, "agent-framework-kit")
const registry = JSON.parse(await readFile(join(root, "references/feature-registry.json"), "utf8"))
const matchFeature = (prompt) => registry.features.find((f) => [f.id, f.displayName, ...f.aliases].some((key) => prompt.toLowerCase().includes(key.toLowerCase())))
for (const prompt of ["智能体框架服务", "Agent Framework Kit", "AgentFrameworkKit", "FunctionComponent", "FunctionController", "通过 Function 组件拉起智能体"]) assert.equal(matchFeature(prompt)?.id, "agent-framework-kit")
for (const prompt of ["Agent", "Function", "开发聊天页面", "A2A", "AgentExtensionAbility"]) assert.equal(matchFeature(prompt), undefined)
const inspect = (name, api = 20) => inspectProject(fixture(name), { sdkPath: fixture(`sdk-api${api}`) })
const compat = (i) => evaluateCompatibility(i, profile)
const verify = (i, route = "auto") => verifyInspection(i, compat(i), route)
const has = (v, id, status) => v.checks.some((c) => c.id === `agent-framework-${id}` && (!status || c.status === status))
const app = await inspect("agent-function-api20")
const atomic = await inspect("agent-atomic-api21", 21)
assert.equal(app.agentFramework.application.type, "app")
assert.equal(app.agentFramework.usages.filter((u) => u.operation === "component").length, 1)
assert.equal(app.agentFramework.usages.filter((u) => u.operation === "controller").length, 1)
assert.equal(app.agentFramework.usages.filter((u) => u.operation === "on").length, 2)
assert.equal(app.agentFramework.usages.filter((u) => u.operation === "off").length, 2)
assert.equal(compat(app).requiredApi, 20)
assert.deepEqual(compat(app).availableRoutes, ["function-component"])
assert.equal(compat(app).decisionRequired, false)
assert.equal(compat(atomic).requiredApi, 21)
assert.equal(compat(atomic).status, "conditional")
assert.equal(verify(app).counts.fail, 0)
assert.ok(has(verify(app), "version-guard", "warn"))
assert.ok(has(verify(app), "source-state", "warn"))
assert.ok(has(verify(app), "external-prerequisites", "warn"))
assert.ok(has(verify(app), "subscription-0", "warn"))
assert.ok(verify(app).checks.every((c) => c.id.startsWith("agent-framework-")))
assert.ok(has(verify(app, "arkui"), "eligibility", "fail"))

for (const field of ["sdk", "compile", "atomic"] ) {
  const input = structuredClone(field === "atomic" ? atomic : app)
  if (field === "sdk") input.localSdk.apiVersion = 19
  if (field === "compile") input.api.compile = 19
  if (field === "atomic") input.api.compile = 20
  const result = compat(input)
  assert.equal(result.status, "upgrade_available")
  assert.equal(result.upgradeOptions[0].upgradeTargetApi, Math.max(input.api.target, result.requiredApi))
  assert.equal(result.upgradeOptions[0].keepCompatibleApi, input.api.compatible)
  assert.equal(result.upgradeOptions[0].upgradeCompileApi, field === "atomic" ? 21 : 20)
}
assert.equal(compat(await inspect("agent-atomic-api21", 20)).status, "upgrade_available")
for (const patch of [{ localSdk: { status: "missing" } }, { model: "unknown" }, { api: { compile: "unknown", compatible: 19 } }]) assert.equal(compat({ ...app, ...patch }).status, "insufficient_context")
assert.equal(compat({ ...app, model: "fa" }).status, "unsupported")
const unknownApp = structuredClone(app)
unknownApp.agentFramework.application.type = "unknown"
assert.equal(compat(unknownApp).status, "insufficient_context")
const sdkMissing = await inspectProject(fixture("agent-function-api20"), { sdkPath: fixture("sdk-missing") })
assert.equal(compat(sdkMissing).status, "insufficient_context")

const work = await mkdtemp(join(tmpdir(), "agent-framework-tests-"))
const project = join(work, "project")
await cp(fixture("agent-function-api20"), project, { recursive: true })
const sourcePath = join(project, "entry/src/main/ets/pages/Index.ets")
const original = await readFile(sourcePath, "utf8")
async function source(code) {
  await writeFile(sourcePath, code)
  return inspectProject(project, { sdkPath: fixture("sdk-api20") })
}
for (const [name, code] of [
  ["missing-id", original.replace("agentId: this.agentId,", "")],
  ["missing-error", original.replace("onError: (error: BusinessError): void => {},", "")],
  ["invalid-error", original.replace("onError: (error: BusinessError): void => {}", "onError: undefined")]
]) assert.ok(has(verify(await source(code)), "component-0-parameters", "fail"), name)
for (const id of ["", "a".repeat(65), "agentproxy65481da1fa2293a8482d45", "YOUR_AGENT_ID"]) assert.ok(has(verify(await source(original.replace("fixture-agent-id", id))), "component-0-id", "fail"), id)
assert.ok(has(verify(await source(original.replace("agentId: this.agentId", "agentId: fetchAgentId()"))), "component-0-id", "warn"))
assert.ok(has(verify(await source(original.replace("agentId: this.agentId,", "...this.config,"))), "component-0-parameters", "warn"))
assert.ok(has(verify(await source(original.replace("options: { title: '查询进度', queryText: '查询当前进度' }", "options: this.options"))), "component-0-options", "warn"))
const api21 = await source(original.replace("FunctionController as Controller", "FunctionController as Controller, ButtonType as Shape").replace("title: '查询进度'", "buttonType: Shape.ICON_ABOVE_TITLE, title: '查询进度'"))
assert.equal(compat(api21).requiredApi, 21)
assert.equal(compat(api21).status, "upgrade_available")
assert.equal(compat(await source(original.replace("title: '查询进度'", "buttonType: 2, title: '查询进度'"))).requiredApi, 21)
assert.equal((await source("// " + original.replaceAll("\n", "\n// "))).agentFramework.usages.length, 0)
assert.equal((await source("const text = `" + original + "`;\n// FunctionComponent({ agentId: 'bad' })")).agentFramework.usages.length, 0)
assert.ok(has(verify(await source("import { FunctionComponent } from '@kit.AgentFrameworkKit';\nconst log = 'FunctionComponent({})';")), "implementation", "warn"))
const namespace = await source("import * as AgentKit from '@kit.AgentFrameworkKit';\nfunction build() { AgentKit.FunctionComponent({ agentId: 'test-id', onError: handleError }); }")
assert.equal(namespace.agentFramework.usages.filter((u) => u.operation === "component").length, 1)
assert.ok(has(verify(await source(original.replace("this.controller.off('agentDialogOpened', this.opened);", ""))), "subscription-0", "warn"))
assert.ok(has(verify(await source(original.replace("this.controller.off('agentDialogOpened', this.opened);", "this.controller.off('agentDialogOpened');"))), "off-all", "warn"))
assert.ok(has(verify(await source(original.replace("this.controller.on('agentDialogOpened', this.opened);", "this.controller.isAgentSupport(context, this.agentId);"))), "availability-query", "warn"))
assert.ok(has(verify(await source(original.replace("aboutToAppear(): void {", "aboutToAppear(): void { this.agentId = lookup();"))), "component-0-id", "warn"))
const reusable = await source(`import { FunctionComponent } from '@kit.AgentFrameworkKit';
@Component
export struct ReusableEntry {
  agentId: string = '';
  build() {
    FunctionComponent({ agentId: this.agentId, onError: handleError })
  }
}`)
assert.ok(has(verify(reusable), "component-0-id", "warn"), "可重用子组件的默认空参数不能当作最终调用值")
assert.equal(verify(reusable).counts.fail, 0)
await source(original)
await writeFile(join(project, "AppScope/app.json5"), "{ app: { bundleType: 'invalid' } }")
assert.equal(compat(await inspectProject(project, { sdkPath: fixture("sdk-api20") })).status, "insufficient_context")
await writeFile(join(project, "AppScope/app.json5"), "{ app: { bundleName: 'com.example.fixture' } }")
assert.equal(compat(await inspectProject(project, { sdkPath: fixture("sdk-api20") })).requiredApi, 20)
const originalBuild = await readFile(join(project, "build-profile.json5"), "utf8")
await writeFile(join(project, "build-profile.json5"), originalBuild.replace("name: 'default'", "name: 'default', bundleType: 'atomicService'"))
assert.equal(compat(await inspectProject(project, { sdkPath: fixture("sdk-api20") })).requiredApi, 21)
await writeFile(join(project, "build-profile.json5"), originalBuild.replace("products: [", "products: [{ name: 'atomic', bundleType: 'atomicService' }, "))
assert.equal(compat(await inspectProject(project, { sdkPath: fixture("sdk-api20") })).status, "insufficient_context")
await writeFile(join(project, "build-profile.json5"), originalBuild)

const physical = { deviceType: "phone", isEmulator: false, name: "test phone", connectType: "USB" }
assert.equal(detectAgentDeviceKind(physical, "device-1"), "physical")
for (const info of [null, "not-json", {}, { deviceType: "phone" }, { deviceType: "wearable", isEmulator: false }]) assert.equal(detectAgentDeviceKind(info, "device-1"), "unknown")
assert.equal(detectAgentDeviceKind({ ...physical, name: "Phone Emulator" }, "device-1"), "emulator")
assert.equal(detectAgentDeviceKind({ ...physical, isEmulator: true }, "device-1"), "emulator")

// Mocked executor tests validate evidence gates, not the actual Huawei service.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
const secondPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
let shots = 0, calls = []
const options = {
  inspector: async () => ({ inspection: app, compatibility: compat(app), staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }),
  buildRunner: async () => ({ exitCode: 0, stdout: "fixture build" }),
  commandRunner: async (args) => {
    calls.push(args)
    if (args[0] === "device") return { exitCode: 0, stdout: JSON.stringify(physical) }
    if (args[1] === "screenshot") await writeFile(args[args.indexOf("--path") + 1], shots++ === 0 ? png : secondPng)
    return { exitCode: 0, stdout: args[1] === "layout" ? '{"attributes":{"id":"agent-page","bounds":"[0,0][100,100]"}}' : "fixture interaction log" }
  }, pause: async () => {}
}
const changes = {
  schemaVersion: "1.0", page: "首页", component: "FunctionComponent", category: "智能体入口", effect: "点击拉起智能体", files: ["Index.ets"],
  before: { sdk: 20, compile: 20, target: 19, compatible: 19 },
  fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原路径", status: "passed", evidence: "模拟执行器夹具" }))
}
const request = (name) => ({ project, feature: "agent-framework-kit", route: "function-component", goal: "首页智能体", output: join(work, name), changes, executeBuild: true, executeRun: true, device: "device-1", captureScreenshot: true, screenshotScenario: "入口", navigate: { schemaVersion: "1.0", steps: [{ stepId: "page", action: "wait", timeoutMs: 1, expectPage: { by: "id", value: "agent-page" } }] } })
for (const info of [{ ...physical, isEmulator: true }, {}, "not-json"]) {
  calls = []
  const req = request(`blocked-${Math.random()}`)
  const result = await verifyDevelopment(req, { ...options, commandRunner: async (args) => args[0] === "device" ? { exitCode: 0, stdout: JSON.stringify(info) } : options.commandRunner(args) })
  assert.equal(result.status, "inconclusive")
  assert.ok(!calls.some((a) => a[0] === "run" || a[1] === "screenshot"))
  const { collection } = await loadCollection(req.output, project)
  await assert.rejects(applyJudgment(collection.runs[0], { schemaVersion: "1.0", runId: result.runId, goal: req.goal, runtime: { status: "passed" } }), /真机/)
  const imagePath = join(work, "developer.png")
  await writeFile(imagePath, png)
  await assert.rejects(verifyDevelopment({ project, output: req.output, resume: result.runId, importScreenshot: [imagePath] }, options), /真机/)
}
const req = request("physical")
const first = await verifyDevelopment(req, options)
assert.equal(first.status, "inconclusive")
const ref = (e) => ({ id: e.id, sha256: e.sha256 })
const log = first.evidence.find((e) => e.type === "runtime_log")
const shot = first.evidence.find((e) => e.type === "screenshot")
const baseJudgment = { schemaVersion: "1.0", runId: first.runId, goal: req.goal }
const resume = { project, output: req.output, resume: first.runId }
await assert.rejects(verifyDevelopment({ ...resume, judgment: { ...baseJudgment, visual: { status: "passed", summary: "仅按钮", evidence: [ref(shot)] } } }, options), /两张/)
await assert.rejects(verifyDevelopment({ ...resume, judgment: { ...baseJudgment, runtime: { status: "passed", summary: "只有日志", evidence: [ref(log)] } } }, options), /entry-clicked/)
const captured = await verifyDevelopment({ ...resume, device: "device-1", captureScreenshot: true, screenshotScenario: "对话框打开" }, options)
assert.equal(captured.evidence.filter((e) => e.type === "screenshot").length, 2)
const judgment = {
  ...baseJudgment,
  visual: { status: "passed", summary: "模拟夹具的两种状态", evidence: captured.evidence.filter((e) => e.type === "screenshot").map(ref) },
  runtime: { status: "passed", summary: "模拟点击、打开和关闭", evidence: [ref(log)], observations: ["entry-clicked", "dialog-opened", "dialog-closed"].map((scenario) => ({ scenario, note: "模拟交互证据", evidence: [ref(log)] })) }
}
const wrong = structuredClone(judgment)
wrong.runtime.observations[2].evidence[0].sha256 = "wrong"
await assert.rejects(verifyDevelopment({ ...resume, judgment: wrong }, options), /dialog-closed/)
const success = await verifyDevelopment({ ...resume, judgment }, options)
assert.equal(success.status, "passed")
assert.match(await readFile(success.report, "utf8"), /智能体框架服务/)

for (const [script, args] of [
  ["validate-feature-package.mjs", ["--feature", "agent-framework-kit"]],
  ["check-compatibility.mjs", ["--project", fixture("agent-function-api20"), "--sdk", fixture("sdk-api20"), "--feature", "agent-framework-kit"]],
  ["verify-integration.mjs", ["--project", fixture("agent-function-api20"), "--sdk", fixture("sdk-api20"), "--feature", "agent-framework-kit", "--route", "function-component"]]
]) {
  const run = spawnSync(process.execPath, [join(root, "scripts", script), ...args], { encoding: "utf8" })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.ok(["valid", "conditional", "warnings"].includes(JSON.parse(run.stdout).status))
}
console.log(JSON.stringify({ status: "passed", feature: "agent-framework-kit" }))

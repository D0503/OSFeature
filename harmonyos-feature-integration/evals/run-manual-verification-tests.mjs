import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { detectAgentDeviceKind, verifyDevelopment } from "../scripts/verify-development.mjs"
import { fileHash, loadCollection } from "../scripts/lib/development-report.mjs"

const work = await mkdtemp(join(tmpdir(), "manual-verification-test-"))
const project = join(work, "project")
await mkdir(project)
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
const secondPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
const calls = []
const options = {
  inspector: async () => ({ inspection: { localSdk: { status: "valid", apiVersion: 26 }, api: { compile: 26, target: 26, compatible: 20 }, modules: [] }, compatibility: { availableRoutes: ["function-component"] }, staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }),
  buildRunner: async () => ({ exitCode: 0, stdout: "fixture build" }),
  commandRunner: async (args) => { calls.push(args); throw new Error("unexpected device call") }
}
const request = (name) => ({ project, output: join(work, name), feature: "agent-framework-kit", route: "function-component", goal: "首页智能体", device: "device-1", executeBuild: true,
  changes: { schemaVersion: "1.0", page: "首页", component: "FunctionComponent", category: "智能体入口", effect: "夹具入口", files: ["Home.ets"], before: { sdk: 26, compile: 26, target: 26, compatible: 20 }, fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "夹具保留原状态", status: "passed", evidence: "夹具回退观察" })) } })
const ref = (e) => ({ id: e.id, sha256: e.sha256 })
assert.equal(detectAgentDeviceKind({ kind: "device", deviceType: "phone" }, "device-1"), "physical")
assert.equal(detectAgentDeviceKind({ data: { kind: "device", deviceType: "tablet" } }, "device-1"), "physical")
assert.equal(detectAgentDeviceKind({ kind: "emulator", deviceType: "phone", isEmulator: false, connectType: "USB" }, "device-1"), "emulator")
assert.equal(detectAgentDeviceKind({ kind: "device", deviceType: "watch" }, "device-1"), "unknown")
assert.equal(detectAgentDeviceKind({ deviceType: "phone" }, "device-1"), "unknown")

// 手动取证必须关联已有构建；导入与最终验收是两个独立步骤。
const manualReq = { ...request("manual"), executeRun: false }
const manualRun = await verifyDevelopment(manualReq, options)
const manualResume = { project, output: manualReq.output, resume: manualRun.runId }
const manualFiles = []
for (const [key, type, content] of [
  ["device", "device_info", JSON.stringify({ kind: "device", deviceType: "phone", serial: "device-1" })],
  ["install", "install_log", "fixture: installed current HAP and started ability"],
  ["home", "component_tree", JSON.stringify({ id: "agent-page" })],
  ["runtime", "runtime_log", "fixture: clicked, dialog opened and closed"],
  ["entry", "screenshot", png], ["dialog", "screenshot", secondPng]
]) {
  const path = join(work, `manual-${key}`)
  await writeFile(path, content)
  manualFiles.push({ key, type, path, sha256: await fileHash(path) })
}
const manual = {
  schemaVersion: "1.0", runId: manualRun.runId, goal: manualReq.goal, device: manualReq.device,
  buildEvidence: ref(manualRun.evidence.find((e) => e.type === "build_log")), provenance: "本测试夹具的同一设备和构建", deviceInfo: "device", files: manualFiles,
  stages: { install: { status: "passed", summary: "夹具安装与启动", evidence: ["install"] }, navigation: { status: "passed", summary: "夹具目标页断言", evidence: ["home"] } }
}
for (const mutate of [
  (m) => { m.device = "other-device" },
  (m) => { m.goal = "other-goal" },
  (m) => { m.runId = "old-run" },
  (m) => { m.buildEvidence.sha256 = "wrong" },
  (m) => { m.files[1].sha256 = "wrong" },
  (m) => { m.stages.install.evidence = ["entry"] },
  (m) => { delete m.stages.install }
]) {
  const invalid = structuredClone(manual); mutate(invalid)
  await assert.rejects(verifyDevelopment({ ...manualResume, manualEvidence: invalid }, options))
}
const emulatorInfo = join(work, "manual-emulator-device")
await writeFile(emulatorInfo, JSON.stringify({ kind: "emulator", deviceType: "phone", serial: "device-1" }))
const emulatorManifest = structuredClone(manual)
Object.assign(emulatorManifest.files[0], { path: emulatorInfo, sha256: await fileHash(emulatorInfo) })
await assert.rejects(verifyDevelopment({ ...manualResume, manualEvidence: emulatorManifest }, options), /真机/)
const priorCalls = calls.length
const imported = await verifyDevelopment({ ...manualResume, manualEvidence: manual }, options)
assert.equal(calls.length, priorCalls, "手动补录不执行设备命令")
assert.equal(imported.status, "inconclusive", "导入不自动验收")
const importedLog = imported.evidence.find((e) => e.origin === "manual" && e.type === "runtime_log")
const manualJudgment = {
  schemaVersion: "1.0", runId: manualRun.runId, goal: manualReq.goal,
  visual: { status: "passed", summary: "已读取夹具入口和对话框", evidence: imported.evidence.filter((e) => e.type === "screenshot").map(ref) },
  runtime: { status: "passed", summary: "夹具交互逐项确认", evidence: [ref(importedLog)], observations: ["entry-clicked", "dialog-opened", "dialog-closed"].map((scenario) => ({ scenario, note: "夹具观察", evidence: [ref(importedLog)] })) }
}
const manualDone = await verifyDevelopment({ ...manualResume, judgment: manualJudgment }, options)
assert.equal(manualDone.status, "passed")
const manualReport = await readFile(manualDone.report, "utf8")
assert.match(manualReport, /手动验证：夹具安装与启动/)
assert.match(manualReport, /本轮手动验证采集并导入/)

const pendingReq = request("manual-pending-checks")
pendingReq.changes.fallback[0] = { condition: "low-api", behavior: "保留原状态", status: "not_run" }
const pendingOptions = { ...options, inspector: async () => ({ ...await options.inspector(), staticResult: { counts: { fail: 0, warn: 1 }, checks: [{ id: "agent-framework-pending", status: "warn", message: "待核对平台状态" }] } }) }
const pending = await verifyDevelopment(pendingReq, pendingOptions)
const pendingResume = { project, output: pendingReq.output, resume: pending.runId }
const pendingImport = await verifyDevelopment({ ...pendingResume, manualEvidence: { ...manual, runId: pending.runId, buildEvidence: ref(pending.evidence.find((e) => e.type === "build_log")) } }, options)
const pendingLog = pendingImport.evidence.find((e) => e.origin === "manual" && e.type === "runtime_log")
const pendingJudgment = { ...manualJudgment, runId: pending.runId, visual: { ...manualJudgment.visual, evidence: pendingImport.evidence.filter((e) => e.type === "screenshot").map(ref) }, runtime: { ...manualJudgment.runtime, evidence: [ref(pendingLog)], observations: manualJudgment.runtime.observations.map((o) => ({ ...o, evidence: [ref(pendingLog)] })) } }
assert.equal((await verifyDevelopment({ ...pendingResume, judgment: pendingJudgment }, options)).status, "inconclusive", "运行与视觉通过不覆盖静态待复核和回退未验证")

const partialReq = { ...request("manual-partial"), executeRun: false }
const partialRun = await verifyDevelopment(partialReq, options)
const partialResume = { project, output: partialReq.output, resume: partialRun.runId }
const partialManifest = { ...manual, runId: partialRun.runId, buildEvidence: ref(partialRun.evidence.find((e) => e.type === "build_log")), stages: {} }
const partialImport = await verifyDevelopment({ ...partialResume, manualEvidence: partialManifest }, options)
const partialLog = partialImport.evidence.find((e) => e.origin === "manual" && e.type === "runtime_log")
const partialJudgment = { schemaVersion: "1.0", runId: partialRun.runId, goal: partialReq.goal, runtime: { status: "inconclusive", summary: "有交互证据，安装关联未确认", evidence: [ref(partialLog)] } }
assert.equal((await verifyDevelopment({ ...partialResume, judgment: partialJudgment }, options)).status, "inconclusive")
await assert.rejects(verifyDevelopment({ ...partialResume, judgment: { ...partialJudgment, runtime: { ...partialJudgment.runtime, status: "passed" } } }, options), /安装/)

const failedReq = { ...request("manual-build-failed"), executeRun: false }
const failedRun = await verifyDevelopment(failedReq, { ...options, buildRunner: async () => ({ exitCode: 1, stdout: "fixture failure" }) })
await assert.rejects(verifyDevelopment({ project, output: failedReq.output, resume: failedRun.runId, manualEvidence: { ...manual, runId: failedRun.runId } }, options), /构建未通过/)

console.log(JSON.stringify({ status: "passed", suite: "manual-verification" }))

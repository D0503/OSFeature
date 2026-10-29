import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { applyJudgment, detectAgentDeviceKind, verifyDevelopment } from "../scripts/verify-development.mjs"
import { fileHash, loadCollection } from "../scripts/lib/development-report.mjs"

const work = await mkdtemp(join(tmpdir(), "manual-verification-test-"))
const project = join(work, "project")
await mkdir(project)
const put = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(data)) }
await put(join(project, "build-profile.json5"), { app: { products: [{ name: "default" }] }, modules: [{ name: "entry", srcPath: "./entry", targets: [{ name: "default" }] }] })
await put(join(project, "AppScope/app.json5"), { app: { bundleName: "com.example.manual", versionCode: 1 } })
await put(join(project, "entry/src/main/module.json5"), { module: { name: "entry", type: "entry", mainElement: "MainAbility", abilities: [{ name: "MainAbility" }] } })
await put(join(project, "entry/build/default/intermediates/hap_metadata/default/output_metadata.json"), [{ hapName: "entry-signed.hap", isSigned: true }])
await put(join(project, "entry/build/default/outputs/default/entry-signed.hap"), "fixture HAP")
const installed = { name: "com.example.manual", versionCode: 1, hapModuleInfos: [{ name: "entry", versionCode: 1 }] }
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
const secondPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
const calls = []
const options = {
  inspector: async () => ({ inspection: { localSdk: { status: "valid", apiVersion: 26 }, api: { compile: 26, target: 26, compatible: 20 }, modules: [] }, compatibility: { availableRoutes: ["function-component"], routes: { "function-component": { minApi: 20 } } }, staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }),
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
manualReq.changes.before.compatible = 15
manualReq.changes.fallback[0] = { condition: "low-api", behavior: "保留原布局与交互", status: "not_run" }
const manualRun = await verifyDevelopment(manualReq, { ...options, inspector: async () => {
  const result = await options.inspector()
  result.inspection.api.compatible = 15
  return result
} })
const manualResume = { project, output: manualReq.output, resume: manualRun.runId }
const manualFiles = []
for (const [key, type, content] of [
  ["device", "device_info", JSON.stringify({ kind: "device", deviceType: "phone", serial: "device-1" })],
  ["install", "install_log", "fixture: installed current HAP and started ability"],
  ["modules", "installed_modules", JSON.stringify(installed)],
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
  buildEvidence: ref(manualRun.evidence.find((e) => e.type === "build_log")), deploymentEvidence: ref(manualRun.evidence.find((e) => e.type === "deployment_manifest")), installedModules: "modules", provenance: "本测试夹具的同一设备和构建", deviceInfo: "device", files: manualFiles,
  stages: { install: { status: "passed", summary: "夹具安装与启动", evidence: ["install", "modules"] }, navigation: { status: "passed", summary: "夹具目标页断言", evidence: ["home"] } }
}
for (const mutate of [
  (m) => { m.device = "other-device" },
  (m) => { m.goal = "other-goal" },
  (m) => { m.runId = "old-run" },
  (m) => { m.buildEvidence.sha256 = "wrong" },
  (m) => { delete m.deploymentEvidence },
  (m) => { m.deploymentEvidence.sha256 = "wrong" },
  (m) => { delete m.installedModules },
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
assert.ok(imported.evidence.filter((e) => e.type === "screenshot").every((e) => e.purpose === "target"))
const manualJudgment = {
  schemaVersion: "1.0", runId: manualRun.runId, goal: manualReq.goal,
  visual: { status: "passed", summary: "已读取夹具入口和对话框", evidence: imported.evidence.filter((e) => e.type === "screenshot").map(ref) },
  runtime: { status: "passed", summary: "夹具交互逐项确认", evidence: [ref(importedLog)], observations: ["entry-clicked", "dialog-opened", "dialog-closed"].map((scenario) => ({ scenario, note: "夹具观察", evidence: [ref(importedLog)] })) }
}
const manualDone = await verifyDevelopment({ ...manualResume, judgment: manualJudgment }, options)
assert.equal(manualDone.status, "inconclusive", "目标效果通过不能代替尚未完成的低版本回退实测")
const manualReport = await readFile(manualDone.report, "utf8")
assert.match(manualReport, /手动验证：夹具安装与启动/)
assert.match(manualReport, /本轮手动验证采集并导入/)
assert.match(manualReport, /运行观察明细/)

// A subsequent fallback import/judgment must preserve the phone's acceptance.
const targetBeforeFallback = structuredClone((await loadCollection(manualReq.output, project)).collection.runs[0])
const fallbackImage = join(work, "fallback.png")
await writeFile(fallbackImage, png)
const fallbackImported = await verifyDevelopment({ ...manualResume, importScreenshot: [fallbackImage], screenshotPurpose: "fallback" }, options)
const fallbackEvidence = fallbackImported.evidence.find((e) => e.purpose === "fallback")
const afterFallbackImport = (await loadCollection(manualReq.output, project)).collection.runs[0]
for (const key of ["install", "navigation", "runtime", "visual"]) assert.deepEqual(afterFallbackImport.checks[key], targetBeforeFallback.checks[key])
const fallbackJudgment = { schemaVersion: "1.0", runId: manualRun.runId, goal: manualReq.goal, fallback: { condition: "low-api", status: "passed", summary: "API 15 模拟器实测保留原布局与交互", evidence: [ref(fallbackEvidence)] } }
const targetScreenshot = targetBeforeFallback.evidence.find((e) => e.type === "screenshot")
for (const evidence of [[ref(targetScreenshot)], [ref(fallbackEvidence), ref(targetScreenshot)]]) {
  await assert.rejects(verifyDevelopment({ ...manualResume, judgment: { ...fallbackJudgment, fallback: { ...fallbackJudgment.fallback, evidence } } }, options), /目标效果截图不能/)
}
assert.equal((await loadCollection(manualReq.output, project)).collection.runs[0].changes.fallback[0].status, "not_run", "用途不符的判定不能改变已保存的回退结论")
const legacyRun = structuredClone(targetBeforeFallback)
delete legacyRun.evidence.find((e) => e.id === targetScreenshot.id).purpose
const legacyJudgment = { ...fallbackJudgment, fallback: { ...fallbackJudgment.fallback, evidence: [ref(targetScreenshot)] } }
await assert.rejects(applyJudgment(legacyRun, legacyJudgment), /未标记用途的旧截图/)
await applyJudgment(legacyRun, { ...legacyJudgment, fallback: { ...legacyJudgment.fallback, status: "inconclusive" } })
assert.equal(legacyRun.checks.fallback.status, "inconclusive", "旧截图仍可记录未确认观察")
assert.equal(legacyRun.changes.fallback[0].status, "not_run")
const fallbackDone = await verifyDevelopment({ ...manualResume, judgment: fallbackJudgment }, options)
assert.equal(fallbackDone.status, "passed")
const regenerated = await readFile(fallbackDone.report, "utf8")
for (const result of ["夹具安装与启动", "夹具目标页断言", "夹具交互逐项确认", "已读取夹具入口和对话框", "运行观察明细", "API 15 模拟器实测保留原布局与交互", "截图用途：兼容方案回退"]) assert.ok(regenerated.includes(result), result)
assert.equal((regenerated.match(/### 首页智能体/g) ?? []).length, 1)
await assert.rejects(verifyDevelopment({ ...manualResume, judgment: { schemaVersion: "1.0", runId: manualRun.runId, goal: manualReq.goal, visual: { status: "passed", summary: "误用回退截图", evidence: [ref(fallbackEvidence)] } } }, options), /回退环境截图/)
await assert.rejects(verifyDevelopment({ ...manualResume, screenshotPurpose: "fallback" }, options), /import-screenshot/)
await assert.rejects(verifyDevelopment({ ...manualResume, importScreenshot: [fallbackImage], screenshotPurpose: "invalid" }, options), /target\/fallback/)

// Default target imports still require a fresh visual judgment.
await verifyDevelopment({ ...manualResume, importScreenshot: [fallbackImage] }, options)
assert.equal((await loadCollection(manualReq.output, project)).collection.runs[0].checks.visual.status, "inconclusive")

// Device snapshot JPEG data can be imported even when its source suffix is PNG.
const jpegPath = join(work, "snapshot.png")
await writeFile(jpegPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]))
const jpegManifest = { ...manual, files: [{ key: "jpeg", type: "screenshot", path: jpegPath, sha256: await fileHash(jpegPath) }], deviceInfo: undefined, stages: {} }
const jpegImport = await verifyDevelopment({ ...manualResume, manualEvidence: jpegManifest }, options)
assert.ok(jpegImport.evidence.some((e) => e.origin === "manual" && e.sha256 === jpegManifest.files[0].sha256))

const pendingReq = request("manual-pending-checks")
pendingReq.changes.fallback[0] = { condition: "low-api", behavior: "保留原状态", status: "not_run" }
const pendingOptions = { ...options, inspector: async () => ({ ...await options.inspector(), staticResult: { counts: { fail: 0, warn: 1 }, checks: [{ id: "agent-framework-pending", status: "warn", message: "待核对平台状态" }] } }) }
const pending = await verifyDevelopment(pendingReq, pendingOptions)
const pendingResume = { project, output: pendingReq.output, resume: pending.runId }
const pendingImport = await verifyDevelopment({ ...pendingResume, manualEvidence: { ...manual, runId: pending.runId, buildEvidence: ref(pending.evidence.find((e) => e.type === "build_log")), deploymentEvidence: ref(pending.evidence.find((e) => e.type === "deployment_manifest")) } }, options)
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

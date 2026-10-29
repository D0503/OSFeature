import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, writeFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { discoverDeployment, planDeployment, deployProduct, verifyInstalledModules } from "../scripts/lib/development-deployment.mjs"
import { fileHash, loadCollection } from "../scripts/lib/development-report.mjs"
import { verifyDevelopment } from "../scripts/verify-development.mjs"
import { navigate, validateNavigation } from "../scripts/lib/development-device.mjs"
import { buildStages } from "../scripts/lib/hvigor-build.mjs"

const root = await mkdtemp(join(tmpdir(), "部署验证-"))
const put = async (path, content) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, typeof content === "string" ? content : JSON.stringify(content)) }
const profile = { app: { products: [{ name: "default" }, { name: "other" }] }, modules: [] }
for (const [name, type, product] of [["entry", "entry", "default"], ["product", "shared", "default"], ["position", "shared", "default"], ["library", "har", "default"], ["foreign", "shared", "other"]]) {
  profile.modules.push({ name, srcPath: `./${name}`, targets: [{ name: "phone", applyToProducts: [product] }] })
  await put(join(root, name, "src/main/module.json5"), { module: { name, type, ...(type === "entry" ? { mainElement: "MainAbility", abilities: [{ name: "MainAbility" }] } : {}) } })
  if (type === "har") continue
  const shared = type === "shared"
  await put(join(root, name, "build", product, "intermediates", shared ? "hsp_metadata" : "hap_metadata", "phone/output_metadata.json"), [{ [shared ? "hspName" : "hapName"]: `${name}-signed.${shared ? "hsp" : "hap"}`, isSigned: true }])
  await put(join(root, name, "build", product, "outputs/phone", `${name}-signed.${shared ? "hsp" : "hap"}`), `${name} package`)
}
await put(join(root, "build-profile.json5"), profile)
await put(join(root, "AppScope/app.json5"), { app: { bundleName: "com.example.test", versionCode: 10 } })
const run = { product: "default", buildMode: "debug", module: "entry", device: "phone-1" }
const plan = await planDeployment(root, run)
assert.deepEqual(plan.modules.map((m) => m.name), ["entry", "product", "position"])
assert.ok(plan.modules.every((m) => m.path.includes("default") && m.target === "phone" && m.sha256.length === 64))
const installed = { name: plan.bundle, versionCode: 10, hapModuleInfos: plan.modules.map((m) => ({ name: m.name, versionCode: 10 })) }
const calls = [], records = []
const runner = async (args) => {
  calls.push(args)
  return { exitCode: 0, stdout: args[2] === "info" ? JSON.stringify(installed) : "ok", stderr: "" }
}
const deployed = await deployProduct(root, run, runner, async (...args) => records.push(args))
assert.deepEqual(calls.map((a) => a[2]), ["install", "info", "start"])
assert.deepEqual(calls[0].slice(6), plan.modules.map((m) => m.path))
assert.equal(deployed.plan.ability, "MainAbility")
assert.equal(records[0][0], "deployment_manifest")
for (const [info, pattern] of [
  [{ ...installed, hapModuleInfos: [{ name: "entry" }] }, /缺少模块 product、position/],
  [{ ...installed, versionCode: 9 }, /版本/],
  [{ ...installed, hapModuleInfos: [...installed.hapModuleInfos, { name: "old-product" }] }, /残留/],
  [{ ...installed, hapModuleInfos: installed.hapModuleInfos.map((m) => ({ ...m, versionCode: 9 })) }, /旧版本/]
]) {
  assert.throws(() => verifyInstalledModules(plan, info), pattern)
  calls.length = 0
  await assert.rejects(deployProduct(root, run, async (args) => { calls.push(args); return { exitCode: 0, stdout: JSON.stringify(info) } }, async () => {}), pattern)
  assert.ok(!calls.some((a) => a[2] === "start"))
}
const position = plan.modules.find((m) => m.name === "position")
await unlink(position.path)
await put(join(root, "position/build/other/outputs/phone/position-signed.hsp"), "stale other product")
calls.length = 0
await assert.rejects(deployProduct(root, run, runner, async () => {}), /ENOENT/)
assert.equal(calls.length, 0, "缺包时不能拿其他产品旧包或继续安装")
await put(position.path, "position package")
await assert.rejects(deployProduct(root, { ...run, deploymentEvidence: undefined }, runner, async () => { await put(position.path, "changed after manifest") }), /产物已变化/)
await put(position.path, "position package")
const nav = { schemaVersion: "1.0", steps: [{ stepId: "page", action: "wait", timeoutMs: 1, expectPage: { by: "id", value: "product-content" } }] }
await assert.rejects(navigate(nav, async () => ({ exitCode: 0, stdout: '[{"attributes":{"id":"product-content","type":"NavDestination"}}]' }), [], run.device, async () => {}), /空壳/)
assert.throws(() => validateNavigation({ schemaVersion: "1.0", steps: [{ ...nav.steps[0], expectPage: { by: "type", value: "NavDestination" } }] }), /业务内容/)
const changes = { schemaVersion: "1.0", id: "deployment", page: "product", component: "Button", category: "按钮", effect: "test", files: ["entry/src/main/Test.ets"], before: { sdk: 26, compile: 26, target: 26, compatible: 23 }, fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原行为", status: "passed", evidence: "fixture" })) }
let buildSelection
const options = {
  inspector: async () => ({ inspection: { localSdk: { status: "valid", apiVersion: 26, path: root }, api: { compile: 26, target: 26, compatible: 23 }, modules: [] }, compatibility: { availableRoutes: ["arkui"] }, staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }),
  buildRunner: async (_project, selection) => { buildSelection = selection; return { exitCode: 0, stdout: "build passed" } },
  commandRunner: async (args) => args[1] === "view" ? { exitCode: 0, stdout: '{"name":"phone"}' } : args[1] === "layout" ? { exitCode: 0, stdout: '[{"id":"product-content","type":"Text"}]' } : runner(args),
  pause: async () => {}
}
const request = { project: root, ...run, feature: "immersive-light", route: "arkui", goal: "product page", changes, executeBuild: true, executeRun: true, navigate: nav, output: join(root, "report") }
const result = await verifyDevelopment(request, options)
assert.equal(result.status, "inconclusive")
assert.equal(buildSelection.module, undefined, "启动 entry 不限制产品构建")
assert.ok(buildStages({ node: "node", ohpm: "ohpm", hvigor: "hvigor" }, buildSelection)[2].args.includes("assembleApp"))
assert.ok(result.evidence.some((e) => e.type === "deployment_manifest"))
calls.length = 0
const missing = await verifyDevelopment({ ...request, output: join(root, "missing-report") }, { ...options, commandRunner: async (args) => args[2] === "info" ? { exitCode: 0, stdout: JSON.stringify({ ...installed, hapModuleInfos: [{ name: "entry" }] }) } : options.commandRunner(args) })
assert.equal(missing.status, "failed")
assert.ok((await readFile(missing.report, "utf8")).includes("缺少模块 product、position"))
assert.ok(!calls.some((a) => a[2] === "start"))

// Manual installation must satisfy the same product/HSP completeness checks.
const manualRequest = { ...request, module: undefined, executeRun: false, output: join(root, "manual-report") }
const manualRun = await verifyDevelopment(manualRequest, options)
const ref = (e) => ({ id: e.id, sha256: e.sha256 })
const manualFile = async (key, type, data) => {
  const path = join(root, `manual-${key}.json`)
  await put(path, data)
  return { key, type, path, sha256: await fileHash(path) }
}
const installFile = await manualFile("install", "install_log", "fixture installed all packages and launched MainAbility")
const modulesFile = await manualFile("modules", "installed_modules", installed)
const navigationFile = await manualFile("navigation", "navigation_log", "fixture product-content found")
const manual = {
  schemaVersion: "1.0", runId: manualRun.runId, goal: manualRequest.goal, device: run.device,
  buildEvidence: ref(manualRun.evidence.find((e) => e.type === "build_log")),
  deploymentEvidence: ref(manualRun.evidence.find((e) => e.type === "deployment_manifest")),
  provenance: "fixture current build installed and queried on phone-1", installedModules: "modules",
  files: [installFile, modulesFile, navigationFile],
  stages: { install: { status: "passed", summary: "完整模块已安装启动", evidence: ["install", "modules"] }, navigation: { status: "passed", summary: "详情页业务内容已确认", evidence: ["navigation"] } }
}
const resume = { project: root, output: manualRequest.output, resume: manualRun.runId }
for (const [info, pattern] of [
  [{ ...installed, hapModuleInfos: [{ name: "entry" }] }, /缺少模块 product、position/],
  [{ ...installed, versionCode: 9 }, /版本/],
  [{ ...installed, hapModuleInfos: [...installed.hapModuleInfos, { name: "foreign" }] }, /残留/],
  [{ ...installed, hapModuleInfos: installed.hapModuleInfos.map((m) => ({ ...m, versionCode: 9 })) }, /旧版本/],
  [{ ...installed, hapModuleInfos: undefined }, /hapModuleInfos/]
]) {
  const incomplete = await manualFile("incomplete", "installed_modules", info)
  await assert.rejects(verifyDevelopment({ ...resume, manualEvidence: { ...manual, installedModules: "incomplete", files: [installFile, incomplete], stages: { install: { ...manual.stages.install, evidence: ["install", "incomplete"] } } } }, options), pattern)
  const unchanged = (await loadCollection(manualRequest.output, root)).collection.runs[0]
  assert.equal(unchanged.checks.install.status, "not_run", "不完整部署不能落盘为通过")
  assert.equal(unchanged.checks.navigation.status, "not_run")
}
await assert.rejects(verifyDevelopment({ ...resume, manualEvidence: { ...manual, files: [installFile], stages: { install: { ...manual.stages.install, evidence: ["install"] } } } }, options), /installed_modules/)
const initialCalls = calls.length
await verifyDevelopment({ ...resume, manualEvidence: manual }, options)
const manualSaved = (await loadCollection(manualRequest.output, root)).collection.runs[0]
assert.equal(manualSaved.deploymentVerified, true)
assert.equal(manualSaved.checks.install.status, "passed")
assert.equal(manualSaved.checks.navigation.status, "passed")
assert.equal(calls.length, initialCalls, "手动补录只校验导入证据，不重新部署设备")
await put(position.path, "different build HSP")
await assert.rejects(verifyDevelopment({ ...resume, manualEvidence: manual }, options), /产物已变化/)
await put(position.path, "position package")
await unlink(position.path)
assert.deepEqual((await discoverDeployment(root, run)).modules.map((m) => m.name), ["entry", "product", "position"], "构建前发现不依赖已有 HSP 产物或 entry 显式依赖")
const incompleteBuild = await verifyDevelopment({ ...manualRequest, output: join(root, "incomplete-build") }, options)
assert.equal(incompleteBuild.status, "failed")
await assert.rejects(verifyDevelopment({ project: root, output: join(root, "incomplete-build"), resume: incompleteBuild.runId, manualEvidence: { ...manual, runId: incompleteBuild.runId, buildEvidence: ref(incompleteBuild.evidence.find((e) => e.type === "build_log")) } }, options), /完整产品构建及部署产物清单/)
await put(position.path, "position package")
const moduleBuild = await verifyDevelopment({ ...manualRequest, module: "entry", output: join(root, "module-build") }, options)
await assert.rejects(verifyDevelopment({ project: root, output: join(root, "module-build"), resume: moduleBuild.runId, manualEvidence: { ...manual, runId: moduleBuild.runId, buildEvidence: ref(moduleBuild.evidence.find((e) => e.type === "build_log")) } }, options), /模块级构建/)
const changedDuringBuild = await verifyDevelopment({ ...manualRequest, output: join(root, "changed-during-build") }, { ...options, buildRunner: async () => {
  await put(join(root, "build-profile.json5"), { ...profile, modules: profile.modules.filter((m) => m.name !== "position") })
  return { exitCode: 0, stdout: "fixture build changed configuration" }
} })
assert.equal(changedDuringBuild.status, "failed")
assert.match(await readFile(changedDuringBuild.report, "utf8"), /构建前的产品模块清单不一致/)
await put(join(root, "build-profile.json5"), profile)

// Binding a build snapshot must preserve emulator unsigned support and physical signing requirements.
const entry = plan.modules.find((m) => m.name === "entry")
const unsignedPath = entry.path.replace("-signed.", "-unsigned.")
await put(entry.metadataPath, [{ hapName: "entry-unsigned.hap", isSigned: false }])
await unlink(entry.path)
await put(unsignedPath, "fixture unsigned HAP")
const unsignedSnapshot = await planDeployment(root, { ...run, deviceKind: undefined }, { allowUnsigned: true })
assert.equal(unsignedSnapshot.modules[0].path, unsignedPath)
await assert.rejects(planDeployment(root, { ...run, deviceKind: "physical" }), /签名/)
assert.equal((await planDeployment(root, { ...run, deviceKind: "emulator" })).modules[0].path, unsignedPath)
await put(entry.path, "entry package")
await put(entry.metadataPath, [{ hapName: "entry-signed.hap", isSigned: true }])
calls.length = 0
await assert.rejects(deployProduct(root, run, async (args) => { calls.push(args); return { exitCode: 1, stderr: "signature mismatch" } }, async () => {}), /签名/)
assert.deepEqual(calls.map((a) => a[2]), ["install"])
const metadata = position.metadataPath
await put(metadata, [{ hspName: "position-signed.hsp", isSigned: true, dependRemoteHsps: [{ hspName: "remote.hsp", hspPath: "remote.hsp" }] }])
await assert.rejects(planDeployment(root, run), /外部 HSP/)
await put(metadata, [{ hspName: "position-signed.hsp", isSigned: true }])
profile.modules[0].targets.push({ name: "tablet", applyToProducts: ["default"] })
await put(join(root, "build-profile.json5"), profile)
await assert.rejects(planDeployment(root, run), /target 不唯一/)
let preflightBuilds = 0
const blocked = await verifyDevelopment({ ...request, output: join(root, "ambiguous-target") }, { ...options, buildRunner: async () => { preflightBuilds++; return { exitCode: 0 } } })
assert.equal(preflightBuilds, 0, "部署范围不明确时在构建前拦截")
assert.ok(!blocked.evidence.some((e) => e.type === "build_log"), "未执行构建时不能生成构建成功或失败日志")
assert.match(await readFile(blocked.report, "utf8"), /部署范围核验失败.*target 不唯一/)
console.log(JSON.stringify({ status: "passed", suite: "deployment" }))

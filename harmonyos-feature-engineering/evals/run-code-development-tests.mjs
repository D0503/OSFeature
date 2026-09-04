#!/usr/bin/env node

import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadCapability, resolveScenario } from "../scripts/lib/capability-tools.mjs"
import { inspectDevelopmentProject, runStaticScenarioChecks } from "../scripts/lib/development-project.mjs"
import { captureFileBaseline, compareFileBaseline } from "../scripts/snapshot-project-files.mjs"
import { deriveDevelopmentVerdict, validateDevelopmentReport } from "../scripts/validate-development-report.mjs"
import { renderDevelopmentReport } from "../scripts/render-development-report.mjs"
import { runDevelopmentVerification } from "../scripts/verify-development.mjs"

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const tempRoot = await mkdtemp(join(tmpdir(), "feature-code-validation-"))
let assertions = 0
function check(condition, message) {
  assert.ok(condition, message)
  assertions += 1
}

async function put(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, "utf8")
}

async function makeSdk(root, api = 26, complete = true) {
  await put(join(root, "sdk-pkg.json"), `${JSON.stringify({ data: { apiVersion: api, version: `${api}.0.0.test`, platformVersion: `${api}.0.0`, releaseType: "Release" } }, null, 2)}\n`)
  if (complete) {
    await put(join(root, "openharmony", "ets", "api", "@ohos.arkui.uiMaterial.d.ts"), "class Material { static empty: Material } class ImmersiveMaterial extends Material {} interface ImmersiveOptions {} enum ImmersiveStyle {} function isImmersiveMaterialSupported(): boolean; function getGlobalMaterialLevel(): number;")
    await put(join(root, "openharmony", "ets", "component", "common.d.ts"), "interface CommonAttribute { systemMaterial(value: object): CommonAttribute }")
    await put(join(root, "hms", "ets", "kits", "@kit.UIDesignKit.d.ts"), "export { hdsMaterial, HdsNavigation, HdsTabs, TitleBarStyleOptions, HdsTabsFloatingStyle, SystemMaterialParams };")
    await put(join(root, "hms", "ets", "api", "@hms.hds.hdsMaterial.d.ets"), "namespace hdsMaterial { enum MaterialType { NONE, ADAPTIVE, IMMERSIVE } enum MaterialLevel { EXQUISITE, GENTLE, SMOOTH, ADAPTIVE } function getSystemMaterialTypes(): Array<MaterialType>; }")
    await put(join(root, "hms", "ets", "api", "@hms.hds.hdsBaseComponent.d.ets"), "interface SystemMaterialParams {} interface TitleBarStyleOptions { systemMaterialEffect?: SystemMaterialParams } interface HdsTabsFloatingStyle { systemMaterialEffect?: SystemMaterialParams } declare function HdsNavigation(): void; declare function HdsTabs(): void;")
  }
}

async function makeProject(root, { compatible = 25, target = 26, compile = 26, type = "entry", metadata = false, includeTarget = true, sdkPath = null } = {}) {
  const targetRow = includeTarget ? `targetSdkVersion: ${target},` : ""
  const compileRow = compile === null ? "" : `compileSdkVersion: ${compile},`
  await put(join(root, "build-profile.json5"), `{ app: { products: [{ name: "default", compatibleSdkVersion: ${compatible}, ${targetRow} ${compileRow} }], buildModeSet: [{ name: "debug" }, { name: "release" }] }, modules: [{ name: "entry", srcPath: "./entry" }] }`)
  const metadataRow = metadata ? `metadata: [{ name: "ohos.arkui.UIMaterial.state", value: "disable" }],` : ""
  await put(join(root, "entry", "src", "main", "module.json5"), `{ module: { name: "entry", type: "${type}", ${metadataRow} deviceTypes: ["phone"] } }`)
  await put(join(root, "entry", "src", "main", "ets", "pages", "Index.ets"), `import { uiMaterial } from '@kit.ArkUI'\n@Entry @Component struct Index { build() { Column() { Text('x') }.bindPopup(true, { builder: () => {}, systemMaterial: new uiMaterial.ImmersiveMaterial() }) } }`)
  if (sdkPath) await put(join(root, "local.properties"), `sdk.dir=${sdkPath.replaceAll("\\", "\\\\")}\n`)
}

function evidence(id, type, extra = {}) {
  return { id, type, path: null, sha256: "a".repeat(64), capturedAt: "2026-09-03T00:00:00.000Z", summary: `${type} evidence`, ...extra }
}

function reportTemplate(project, scenario, { conflict = false } = {}) {
  const evidenceItems = [
    evidence("EVID-001", "static"),
    evidence("EVID-002", "sdk_declaration"),
    evidence("EVID-003", "build_log", { exitCode: 0, command: "devecocli build" }),
    evidence("EVID-004", "device_log", { exitCode: 0, command: "devecocli run --skip-build" }),
    evidence("EVID-005", "user_observation"),
  ]
  const requiredChecks = scenario.requiredChecks
  return {
    verificationVersion: "1.0",
    mode: "code-development-validation",
    input: { feature: "immersive-light", project, goal: "验证场景", module: "entry", targetFiles: [], product: "default", buildMode: "debug", device: "test-device" },
    capabilityPackage: { featureId: "immersive-light", version: "1.1.0", digest: "b".repeat(64), scenarioId: scenario.id, route: scenario.route, requiredChecks, factRefs: scenario.factRefs, conflictingFactRefs: conflict ? ["IL-F006", "IL-F007"] : [] },
    projectBaseline: { inspectionVersion: "1.0" },
    changes: [],
    compatibility: { status: "supported", reasons: [], authorizationRequired: [], canModify: true, canBuild: true },
    checks: {
      static: { required: requiredChecks.includes("static"), status: "passed", summary: "static passed", evidenceRefs: ["EVID-001"] },
      sdk: { required: requiredChecks.includes("sdk"), status: "passed", summary: "sdk passed", evidenceRefs: ["EVID-002"] },
      build: { required: requiredChecks.includes("build"), status: "passed", summary: "build passed", evidenceRefs: ["EVID-003"], exitCode: 0, repairAttempts: 0 },
      install: { required: requiredChecks.includes("install"), status: "passed", summary: "install passed", evidenceRefs: ["EVID-004"] },
      runtime: { required: requiredChecks.includes("runtime"), status: "passed", summary: "runtime passed", evidenceRefs: ["EVID-004", "EVID-005"] },
      visual: { required: requiredChecks.includes("visual"), status: "passed", summary: "visual passed", evidenceRefs: ["EVID-005"] },
    },
    evidence: evidenceItems,
    pendingVerifications: [],
    verdict: { status: conflict ? "passed_with_spec_conflict" : "passed", summary: "verification complete", matchedFactRefs: conflict ? ["IL-F006"] : [] },
  }
}

try {
  const capability = await loadCapability(skillRoot, "沉浸光感")
  check(capability.profile.defaultRoute === "arkui-api26", "ArkUI API 26 保持默认路线")
  check(capability.profile.routes.some((item) => item.id === "hds-api23"), "注册 HDS 6.1.0(23) 路线")
  check(capability.factsData.facts.length === 36, "能力包登记 36 条规范与示例事实")
  check(capability.scenariosData.scenarios.length === 12, "能力包覆盖 12 类开发场景")
  check(capability.lock.deviceValidationStatus === "not-complete", "ready 不冒充真机已验证")
  check(capability.feature.readinessMeaning.includes("不表示"), "注册表披露 ready 语义")

  const disableFacts = capability.factsData.facts.filter((item) => item.conflictGroup === "disable-scope")
  check(disableFacts.length === 2 && disableFacts.every((item) => item.normativeStatus === "conflicting"), "disable 两条冲突事实同时保留")
  const applicationScenario = capability.scenariosData.scenarios.find((item) => item.id === "IL-S001")
  check(applicationScenario.expectationMode === "alternatives", "disable 场景使用多预期")
  check(new Set(applicationScenario.expectedOutcomes.flatMap((item) => item.factRefs)).size === 2, "两个冲突事实各有独立预期")
  const targets = capability.profile.routes.flatMap((route) => Object.values(route.supportedTargets).flat())
  for (const target of ["Navigation", "Tabs", "AlphabetIndexer", "Toast", "Popup", "Tips", "Menu", "Dialog", "Sheet", "Button", "Select", "Toggle", "Slider", "ChipGroup", "SegmentButton", "HdsNavigation", "HdsTabs"]) check(targets.includes(target), `覆盖组件 ${target}`)

  check(resolveScenario(capability, "给 Popup 接入沉浸光感").selected?.id === "IL-S004", "Popup 路由到弹窗场景")
  check(resolveScenario(capability, "应用级开启后关闭沉浸光感").selected?.id === "IL-S001", "应用级开关路由到冲突场景")
  check(resolveScenario(capability, "验证 materialColor 和反色").selected?.id === "IL-S006", "材质参数路由")
  check(resolveScenario(capability, "给 HdsNavigation 标题栏按钮接入沉浸光感").selected?.id === "IL-S009", "HdsNavigation 路由到 HDS 标题栏场景")
  check(resolveScenario(capability, "给 HdsTabs 底部悬浮页签接入沉浸光感").selected?.id === "IL-S010", "HdsTabs 路由到 HDS 页签场景")
  check(resolveScenario(capability, "为 HDS 组件接入系统自适应沉浸光感").selected?.id === "IL-S011", "通用 HDS 目标路由到组合场景")
  check(resolveScenario(capability, "调用 getSystemMaterialTypes 按设备能力选择档位").selected?.id === "IL-S012", "HDS 自定义等级路由")
  check(resolveScenario(capability, "给 Navigation 接入沉浸光感").selected?.id === "IL-S003", "ArkUI Navigation 不误路由到 HDS")
  check(resolveScenario(capability, "请完成这个能力").status === "unmatched", "无法唯一识别时不猜测")

  const hdsSources = capability.lock.sourceDocuments.filter((item) => item.snapshotId.startsWith("hds-"))
  check(hdsSources.length === 4 && hdsSources.every((item) => item.officialUrl?.startsWith("https://developer.huawei.com/")), "HDS 事实只绑定华为官网快照")

  const sdk = join(tempRoot, "sdk26")
  await makeSdk(sdk)
  const goodProject = join(tempRoot, "good")
  await makeProject(goodProject, { sdkPath: sdk })
  const popupScenario = capability.scenariosData.scenarios.find((item) => item.id === "IL-S004")
  const good = await inspectDevelopmentProject(goodProject, capability, { scenario: popupScenario })
  check(good.compatibility.status === "supported", "API 26 Stage entry 工程通过门禁")
  check(good.sdk.apiVersion === 26 && good.sdk.missingSymbols.length === 0, "SDK API 与符号核验通过")
  check(good.model === "stage" && good.modules[0].type === "entry", "识别 Stage entry module")
  check(good.buildMode.selected === "debug", "默认选择 debug build mode")
  const staticResult = await runStaticScenarioChecks(goodProject, popupScenario, good)
  check(staticResult.status === "passed", "Popup 最小接入通过静态规则")

  const hdsProject = join(tempRoot, "hds-good")
  await makeProject(hdsProject, { compatible: 23, target: 23, compile: 23, sdkPath: sdk })
  await put(join(hdsProject, "entry", "src", "main", "ets", "pages", "Index.ets"), `import { hdsMaterial, HdsNavigation } from '@kit.UIDesignKit'
@Entry @Component struct Index { build() { HdsNavigation() { Text('x') }.titleBar({ content: { title: { mainTitle: 'x' } }, style: { systemMaterialEffect: { materialType: hdsMaterial.MaterialType.ADAPTIVE, materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE } } }) } }`)
  const hdsNavigationScenario = capability.scenariosData.scenarios.find((item) => item.id === "IL-S009")
  const hdsInspection = await inspectDevelopmentProject(hdsProject, capability, { scenario: hdsNavigationScenario })
  check(hdsInspection.compatibility.status === "supported" && hdsInspection.route.id === "hds-api23", "HDS API 23 工程按独立路线通过门禁")
  check(hdsInspection.sdk.missingSymbols.length === 0, "HDS SDK 符号核验通过")
  check((await runStaticScenarioChecks(hdsProject, hdsNavigationScenario, hdsInspection)).status === "passed", "HdsNavigation 最小接入通过静态规则")

  const hdsApi22 = join(tempRoot, "hds-api22")
  await makeProject(hdsApi22, { compatible: 22, target: 22, compile: 22, sdkPath: sdk })
  check((await inspectDevelopmentProject(hdsApi22, capability, { scenario: hdsNavigationScenario })).compatibility.status === "upgrade_required", "HDS API 22 工程要求升级且不自动修改")

  const fallbackScenario = capability.scenariosData.scenarios.find((item) => item.id === "IL-S007")
  const argumentOnlyProject = join(tempRoot, "argument-only-guard")
  await makeProject(argumentOnlyProject, { sdkPath: sdk })
  await put(join(argumentOnlyProject, "entry", "src", "main", "ets", "pages", "Index.ets"), `import { uiMaterial } from '@kit.ArkUI'
import { deviceInfo } from '@kit.BasicServicesKit'
@Entry @Component struct Index { build() { Column() { Text('x') }.systemMaterial(deviceInfo.sdkApiVersion >= 26 ? new uiMaterial.ImmersiveMaterial() : undefined); uiMaterial.isImmersiveMaterialSupported() } }`)
  const argumentOnlyInspection = await inspectDevelopmentProject(argumentOnlyProject, capability, { scenario: fallbackScenario })
  const argumentOnlyResult = await runStaticScenarioChecks(argumentOnlyProject, fallbackScenario, argumentOnlyInspection)
  check(argumentOnlyResult.rules.find((item) => item.id === "argument-only-api-guard")?.status === "failed", "参数内版本判断不能通过低版本 API 调用保护")
  check(argumentOnlyResult.status === "failed", "伪版本保护使低版本回退静态层失败")

  const wholeBranchProject = join(tempRoot, "whole-branch-guard")
  await makeProject(wholeBranchProject, { sdkPath: sdk })
  await put(join(wholeBranchProject, "entry", "src", "main", "ets", "pages", "Index.ets"), `import { uiMaterial } from '@kit.ArkUI'
import { deviceInfo } from '@kit.BasicServicesKit'
@Entry @Component struct Index { build() { if (deviceInfo.sdkApiVersion >= 26 && uiMaterial.isImmersiveMaterialSupported()) { Column() { Text('x') }.systemMaterial(new uiMaterial.ImmersiveMaterial()) } else { Column() { Text('x') }.backgroundColor('#FFFFFF') } } }`)
  const wholeBranchInspection = await inspectDevelopmentProject(wholeBranchProject, capability, { scenario: fallbackScenario })
  const wholeBranchResult = await runStaticScenarioChecks(wholeBranchProject, fallbackScenario, wholeBranchInspection)
  check(wholeBranchResult.rules.find((item) => item.id === "argument-only-api-guard")?.status === "passed", "整段控制流避开高版本调用时不触发伪保护规则")

  const api25 = join(tempRoot, "api25")
  await makeProject(api25, { target: 25, compile: 25, sdkPath: sdk })
  check((await inspectDevelopmentProject(api25, capability, { scenario: popupScenario })).compatibility.status === "upgrade_required", "API 25 要求升级且不自动修改")

  const nonStage = join(tempRoot, "non-stage")
  await makeProject(nonStage, { type: "", sdkPath: sdk })
  check((await inspectDevelopmentProject(nonStage, capability, { scenario: popupScenario })).compatibility.status === "blocked", "非 Stage 工程阻塞")

  const badMetadata = join(tempRoot, "har-metadata")
  await makeProject(badMetadata, { type: "har", metadata: true, sdkPath: sdk })
  const badMetadataInspection = await inspectDevelopmentProject(badMetadata, capability, { scenario: applicationScenario })
  check(badMetadataInspection.compatibility.status === "blocked" && badMetadataInspection.compatibility.reasons.some((item) => item.includes("非 entry")), "非 entry 应用级配置阻塞")

  const missingSdk = join(tempRoot, "missing-sdk")
  await makeProject(missingSdk)
  const sdkEnvironment = Object.fromEntries(["DEVECO_SDK_HOME", "HARMONYOS_SDK_HOME", "OHOS_SDK_HOME"].map((key) => [key, process.env[key]]))
  for (const key of Object.keys(sdkEnvironment)) delete process.env[key]
  const missingSdkInspection = await inspectDevelopmentProject(missingSdk, capability, { scenario: popupScenario })
  for (const [key, value] of Object.entries(sdkEnvironment)) if (value !== undefined) process.env[key] = value
  check(missingSdkInspection.compatibility.status === "blocked", "缺失 SDK 阻塞")

  const unknownTarget = join(tempRoot, "unknown-target")
  await makeProject(unknownTarget, { includeTarget: false, sdkPath: sdk })
  check((await inspectDevelopmentProject(unknownTarget, capability, { scenario: popupScenario })).compatibility.status === "insufficient_context", "未知 target 不误判支持")

  const incompleteSdk = join(tempRoot, "incomplete-sdk")
  await makeSdk(incompleteSdk, 26, false)
  const incompleteProject = join(tempRoot, "incomplete-project")
  await makeProject(incompleteProject, { sdkPath: incompleteSdk })
  check((await inspectDevelopmentProject(incompleteProject, capability, { scenario: popupScenario })).compatibility.status === "blocked", "缺少 SDK 符号阻塞")
  check((await inspectDevelopmentProject(goodProject, capability, { scenario: popupScenario, module: "missing" })).compatibility.status === "blocked", "指定 module 不存在时阻塞")
  check((await inspectDevelopmentProject(goodProject, capability, { scenario: popupScenario, buildMode: "profile" })).compatibility.status === "blocked", "指定 build mode 不存在时阻塞")
  check((await inspectDevelopmentProject(goodProject, capability, { scenario: popupScenario, targetFiles: ["missing.ets"] })).compatibility.status === "blocked", "指定目标文件不存在时阻塞")

  const touched = join(goodProject, "entry", "src", "main", "ets", "pages", "Index.ets")
  const baseline = await captureFileBaseline(goodProject, [touched, "entry/src/main/ets/pages/NewFile.ets"])
  const beforeHash = baseline.files[0].sha256
  await writeFile(touched, `${await readFile(touched, "utf8")}\n// local minimal patch\n`, "utf8")
  await put(join(goodProject, "entry", "src", "main", "ets", "pages", "NewFile.ets"), "export const added: boolean = true\n")
  const compared = await compareFileBaseline(baseline)
  check(compared.changes[0].status === "modified" && compared.changes[0].beforeSha256 === beforeHash && compared.changes[0].diff.includes("local minimal patch"), "失败后可保留 before/after 哈希与精确 diff")
  check(compared.changes[1].status === "added" && compared.changes[1].diff.includes("added"), "新增文件被基线比较捕获")

  const passing = reportTemplate(goodProject, popupScenario)
  check(deriveDevelopmentVerdict(passing) === "passed" && validateDevelopmentReport(passing).valid, "完整证据报告为 passed")

  const noDevice = structuredClone(passing)
  for (const level of ["install", "runtime", "visual"]) noDevice.checks[level] = { required: true, status: "not_run", summary: "当前无设备或视觉证据。", evidenceRefs: [] }
  noDevice.evidence = noDevice.evidence.slice(0, 3)
  noDevice.pendingVerifications = [
    { id: "PENDING-001", level: "install", reason: "当前无设备。", required: true },
    { id: "PENDING-002", level: "runtime", reason: "当前无设备。", required: true },
    { id: "PENDING-003", level: "visual", reason: "当前无设备。", required: true },
  ]
  noDevice.verdict = { status: "build_passed_runtime_pending", summary: "build passed; runtime pending", matchedFactRefs: [] }
  check(deriveDevelopmentVerdict(noDevice) === "build_passed_runtime_pending" && validateDevelopmentReport(noDevice).valid, "无设备不得误报 passed")

  const conflictReport = reportTemplate(goodProject, applicationScenario, { conflict: true })
  check(deriveDevelopmentVerdict(conflictReport) === "passed_with_spec_conflict" && validateDevelopmentReport(conflictReport).valid, "只匹配一个冲突事实时披露规范冲突")
  const noConflictMatch = structuredClone(conflictReport)
  noConflictMatch.verdict = { status: "failed", summary: "no expected outcome matched", matchedFactRefs: [] }
  check(deriveDevelopmentVerdict(noConflictMatch) === "failed" && validateDevelopmentReport(noConflictMatch).valid, "不匹配任何冲突预期时失败")
  const ambiguousConflict = structuredClone(conflictReport)
  ambiguousConflict.verdict = { status: "inconclusive", summary: "both outcomes remain possible", matchedFactRefs: ["IL-F006", "IL-F007"] }
  check(deriveDevelopmentVerdict(ambiguousConflict) === "inconclusive" && validateDevelopmentReport(ambiguousConflict).valid, "无法区分冲突预期时 inconclusive")

  const fakeVisual = structuredClone(passing)
  fakeVisual.checks.visual.evidenceRefs = ["EVID-001"]
  check(!validateDevelopmentReport(fakeVisual).valid, "视觉成功不能由静态证据冒充")
  const badBuild = structuredClone(passing)
  badBuild.evidence.find((item) => item.id === "EVID-003").exitCode = 1
  check(!validateDevelopmentReport(badBuild).valid, "构建通过必须有 exitCode=0 证据")
  const tooManyRepairs = structuredClone(passing)
  tooManyRepairs.checks.build.repairAttempts = 3
  check(!validateDevelopmentReport(tooManyRepairs).valid, "定向修复最多两轮")
  const documentInjected = structuredClone(passing)
  documentInjected.input.document = join(tempRoot, "docs.md")
  check(!validateDevelopmentReport(documentInjected).valid, "代码验证输入拒绝临时文档依据")

  const output = join(tempRoot, "report-output")
  const rendered = await renderDevelopmentReport(noDevice, output)
  check(rendered.jsonPath.endsWith("development-verification-report.json"), "生成固定 JSON 报告名")
  check(rendered.markdownPath.endsWith("development-verification-report.md") && (await readFile(rendered.markdownPath, "utf8")).includes("build_passed_runtime_pending"), "生成固定 Markdown 报告名")

  const defaultOutput = join(tempRoot, "default-report-output")
  await mkdir(defaultOutput, { recursive: true })
  const previousCwd = process.cwd()
  let defaultRendered
  try {
    process.chdir(defaultOutput)
    defaultRendered = await renderDevelopmentReport(noDevice)
  } finally {
    process.chdir(previousCwd)
  }
  check(defaultRendered.jsonPath === join(defaultOutput, "development-verification-report.json"), "开发报告默认写入当前工作区")

  const verificationOutput = join(tempRoot, "verification-default-output")
  await mkdir(verificationOutput, { recursive: true })
  let verification
  try {
    process.chdir(verificationOutput)
    verification = await runDevelopmentVerification(skillRoot, {
      feature: "immersive-light",
      project: goodProject,
      goal: "给 Popup 接入沉浸光感",
      sdk,
    })
  } finally {
    process.chdir(previousCwd)
  }
  check(verification.rendered.jsonPath === join(verificationOutput, "development-verification-report.json"), "开发验证未指定输出时仍生成报告")

  const independent = join(tempRoot, "independent-skill")
  await cp(join(skillRoot, "references", "capabilities"), join(independent, "references", "capabilities"), { recursive: true })
  const independentCapability = await loadCapability(independent, "immersive-light")
  check(resolveScenario(independentCapability, "给 Dialog 接入沉浸光感").selected?.id === "IL-S004", "移除原始资料后仍仅凭能力包路由")
  await writeFile(join(independent, "references", "capabilities", "immersive-light", "facts.json"), "{}\n", "utf8")
  let tamperRejected = false
  try { await loadCapability(independent, "immersive-light") } catch { tamperRejected = true }
  check(tamperRejected, "能力包文件被篡改时锁校验拒绝执行")
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

process.stdout.write(`ok - ${assertions} code-development assertions\n`)

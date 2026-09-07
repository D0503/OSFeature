#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadCapability, resolveScenario } from "../scripts/lib/capability-tools.mjs"
import { inspectDevelopmentProject, runStaticScenarioChecks } from "../scripts/lib/development-project.mjs"
import { captureFileBaseline, compareFileBaseline } from "../scripts/snapshot-project-files.mjs"
import { deriveDevelopmentVerdict, validateDevelopmentReport } from "../scripts/validate-development-report.mjs"
import { renderDevelopmentReport, developmentReportMarkdown } from "../scripts/render-development-report.mjs"
import { buildImplementationTrace } from "../scripts/lib/implementation-trace.mjs"
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
  check(verification.report.verificationVersion === "1.1" && verification.report.implementation.recordStatus === "missing", "无实施记录且基线未知时新报告如实披露缺失")

  const traceProject = join(tempRoot, "trace-project")
  await makeProject(traceProject, { sdkPath: sdk })
  await put(join(traceProject, "Legacy.ets"), "export const obsolete = true\n")
  const traceBaseline = await captureFileBaseline(traceProject, ["entry/src/main/module.json5", "Support.ets", "Legacy.ets"])
  await put(join(traceProject, "entry/src/main/module.json5"), '{ module: { name: "entry", type: "entry", metadata: [{ name: "ohos.arkui.UIMaterial.state", value: "enable" }] } }\n')
  await put(join(traceProject, "Support.ets"), "export const label = 'demo'\n")
  await rm(join(traceProject, "Legacy.ets"))
  const traceChanges = (await compareFileBaseline(traceBaseline)).changes
  const record = { steps: [
    { id: "STEP-001", description: "配置应用级沉浸光感开启。", status: "applied", locations: [{ path: "entry/src/main/module.json5", version: "after", lineStart: 1, lineEnd: 1 }], basis: [
      { type: "capability_fact", factRefs: ["IL-F002"], reason: "采用能力包的应用级 metadata 配置。" },
      { type: "engineering_choice", reason: "保留原模块名称和类型。" },
    ] },
    { id: "STEP-002", description: "移除未使用的测试常量。", status: "applied", locations: [{ path: "Legacy.ets", version: "before", lineStart: 1, lineEnd: 1 }], basis: [{ type: "engineering_choice", reason: "删除冗余演示变量。" }] },
  ] }
  const trace = buildImplementationTrace(capability, record, traceChanges, true, "arkui-api26")
  const traceReport = { ...structuredClone(noDevice), verificationVersion: "1.1", input: { ...noDevice.input, project: traceProject }, capabilityPackage: { ...noDevice.capabilityPackage, version: capability.feature.packageVersion, digest: capability.lock.packageDigest }, changes: traceChanges, ...trace }
  check(validateDevelopmentReport(traceReport).valid, `实施依据报告有效：${validateDevelopmentReport(traceReport).errors.join("; ")}`)
  check(trace.implementation.uncoveredChanges.join() === "Support.ets", "未覆盖改动如实列出，删除步骤使用修改前位置")
  check(trace.normativeBasis.length === 1 && trace.normativeBasis[0].id === "IL-F002" && trace.normativeBasis[0].sources[0].officialUrl.endsWith("arkts-immersive-light-sense-enable"), "ArkUI 应用级事实展开官网来源且只展示引用事实")
  check(trace.normativeBasis[0].sources[0].retrievedAt === null && trace.normativeBasis[0].sources[0].title, "未知抓取时间为 null，来源标题来自已有清单")
  const tracePaths = await renderDevelopmentReport(traceReport, join(tempRoot, "trace-report"))
  const traceMarkdown = await readFile(tracePaths.markdownPath, "utf8")
  check(traceMarkdown.includes("工程配套选择") && traceMarkdown.includes("修改前") && traceMarkdown.includes("arkts-immersive-light-sense-enable") && traceMarkdown.includes("Support.ets"), "Markdown 展示步骤、删除位置、官网链接及未覆盖文件")
  check(!developmentReportMarkdown(noDevice).includes("代码实现步骤与依据"), "旧版报告不自动补写实施步骤")

  const missingTrace = buildImplementationTrace(capability, null, traceChanges, true)
  check(missingTrace.implementation.recordStatus === "missing" && missingTrace.implementation.uncoveredChanges.length === 3 && missingTrace.normativeBasis.length === 0, "有改动无实施记录时保留缺失状态及全部未覆盖文件")
  const noChange = buildImplementationTrace(capability, { steps: [] }, [], true)
  check(noChange.implementation.recordStatus === "not_started", "无改动有基线时准确记录未实施")
  const fakeApplied = structuredClone(record)
  fakeApplied.steps[0].locations[0].lineStart = 999
  fakeApplied.steps[0].locations[0].lineEnd = 999
  const uncorrelated = buildImplementationTrace(capability, fakeApplied, traceChanges, true)
  check(uncorrelated.implementation.steps[0].status === "partial" && uncorrelated.implementation.steps[0].issues.length > 0, "不存在的改动行不能标为已实施")
  const forgedApplied = { ...traceReport, ...uncorrelated }
  forgedApplied.implementation.steps[0].status = "applied"
  check(!validateDevelopmentReport(forgedApplied).valid, "校验器拒绝没有 diff 关联的 applied")
  const noBaselineTrace = buildImplementationTrace(capability, record, [], false)
  check(noBaselineTrace.implementation.steps.every((step) => step.status === "partial"), "基线缺失不能确认步骤已实施")
  const notApplied = structuredClone(record)
  notApplied.steps[0].status = "not_applied"
  check(buildImplementationTrace(capability, notApplied, traceChanges, true).implementation.uncoveredChanges.includes("entry/src/main/module.json5"), "未实施步骤不计入变更覆盖")

  const badFact = structuredClone(record)
  badFact.steps[0].basis[0].factRefs = ["IL-F999"]
  assert.throws(() => buildImplementationTrace(capability, badFact, traceChanges, true), /不存在/)
  assertions += 1
  const conflictRecord = structuredClone(record)
  conflictRecord.steps[0].basis[0] = { type: "capability_fact", factRefs: ["IL-F006"], reason: "配置全局关闭，实际作用域待设备观察。" }
  const conflictTrace = buildImplementationTrace(capability, conflictRecord, traceChanges, true)
  check(conflictTrace.normativeBasis.some((fact) => fact.id === "IL-F007" && fact.usage === "conflict_context"), "引用冲突事实时自动保留另一条规范预期")
  const lostConflict = { ...traceReport, ...structuredClone(conflictTrace) }
  lostConflict.normativeBasis = lostConflict.normativeBasis.filter((fact) => fact.usage === "direct")
  check(!validateDevelopmentReport(lostConflict).valid, "报告缺少关联冲突预期时校验失败")
  const missingUrlCapability = structuredClone(capability)
  delete missingUrlCapability.lock.sourceDocuments.find((source) => source.snapshotId === "enable").officialUrl
  const missingUrlTrace = buildImplementationTrace(missingUrlCapability, record, traceChanges, true)
  check(missingUrlTrace.normativeBasis[0].sources[0].officialUrl === null && developmentReportMarkdown({ ...traceReport, ...missingUrlTrace }).includes("官网链接缺失"), "官网链接缺失如实展示，不推测 URL")
  const unresolved = structuredClone(record)
  unresolved.steps[0].basis = [{ type: "unresolved", reason: "尚未找到该参数的能力包规范依据。" }]
  const unresolvedReport = { ...traceReport, ...buildImplementationTrace(capability, unresolved, traceChanges, true) }
  check(unresolvedReport.normativeBasis.length === 0 && developmentReportMarkdown(unresolvedReport).includes("依据待确认"), "未知规范依据不会由模型陈述补成官网事实")

  const failedTraceReport = structuredClone(traceReport)
  failedTraceReport.checks.build = { required: true, status: "failed", summary: "fixture build failure", evidenceRefs: ["EVID-003"], repairAttempts: 1 }
  failedTraceReport.evidence.find((item) => item.id === "EVID-003").exitCode = 1
  failedTraceReport.verdict = { status: "failed", summary: "fixture build failed", matchedFactRefs: [] }
  const failedPaths = await renderDevelopmentReport(failedTraceReport, join(tempRoot, "failed-trace"))
  check((await readFile(failedPaths.markdownPath, "utf8")).includes("代码实现步骤与依据") && failedTraceReport.changes.every((change) => change.diff), "失败报告仍保留步骤、依据和完整差异")

  const hdsPath = "entry/src/main/ets/pages/Index.ets"
  const hdsBaseline = await captureFileBaseline(hdsProject, [hdsPath])
  await put(join(hdsProject, hdsPath), (await readFile(join(hdsProject, hdsPath), "utf8")).replace("MaterialType.ADAPTIVE", "MaterialType.IMMERSIVE"))
  const hdsRecord = { steps: [{ id: "STEP-001", description: "为 HdsNavigation 标题栏选择沉浸式材质。", status: "applied", locations: [{ path: hdsPath, version: "after", lineStart: 2, lineEnd: 2 }], basis: [{ type: "capability_fact", factRefs: ["IL-F028", "IL-F031"], reason: "使用标题栏材质字段并选择 IMMERSIVE 类型。" }] }] }
  const hdsVerification = await runDevelopmentVerification(skillRoot, { project: hdsProject, goal: "给 HdsNavigation 标题栏按钮接入沉浸光感", sdk }, { baseline: hdsBaseline, implementation: hdsRecord, outputDirectory: join(tempRoot, "hds-trace") })
  check(hdsVerification.report.implementation.steps[0].status === "applied" && hdsVerification.report.normativeBasis.some((fact) => fact.sources.some((source) => source.officialUrl.endsWith("ui-design-hdsnavigation"))), "HDS 实际验证报告可追溯位置、能力事实和官网 API")
  assert.throws(() => buildImplementationTrace(capability, hdsRecord, [], false, "arkui-api26"), /不属于/)
  assertions += 1

  const independent = join(tempRoot, "independent-skill")
  await cp(join(skillRoot, "references", "capabilities"), join(independent, "references", "capabilities"), { recursive: true })
  const independentCapability = await loadCapability(independent, "immersive-light")
  check(resolveScenario(independentCapability, "给 Dialog 接入沉浸光感").selected?.id === "IL-S004", "移除原始资料后仍仅凭能力包路由")
  const independentReport = await runDevelopmentVerification(independent, { project: traceProject, goal: "应用级开启后关闭沉浸光感", sdk }, { baseline: traceBaseline, implementation: record, outputDirectory: join(tempRoot, "independent-report") })
  check(independentReport.report.normativeBasis[0].sources[0].officialUrl.endsWith("arkts-immersive-light-sense-enable") && independentReport.report.implementation.steps[0].status === "applied", "仅复制能力包、没有原始文档时仍生成完整实施依据报告")
  await put(join(tempRoot, "implementation.json"), JSON.stringify(record))
  await put(join(tempRoot, "baseline.json"), JSON.stringify(traceBaseline))
  const cli = spawnSync(process.execPath, [join(skillRoot, "scripts", "verify-development.mjs"), "--project", traceProject, "--goal", "应用级开启后关闭沉浸光感", "--sdk", sdk, "--skill-root", independent, "--baseline", join(tempRoot, "baseline.json"), "--implementation", join(tempRoot, "implementation.json"), "--output", join(tempRoot, "cli-trace")], { encoding: "utf8", windowsHide: true })
  check(cli.status === 3 && JSON.parse(cli.stdout).rendered.jsonPath, `CLI 接受实施记录并生成未执行构建的报告：${cli.stderr}`)
  const cliReport = JSON.parse(await readFile(join(tempRoot, "cli-trace", "development-verification-report.json"), "utf8"))
  check(cliReport.implementation.steps[0].status === "applied" && cliReport.normativeBasis[0].id === "IL-F002", "CLI 报告的实施记录和规范来源对应")
  await writeFile(join(independent, "references", "capabilities", "immersive-light", "facts.json"), "{}\n", "utf8")
  let tamperRejected = false
  try { await loadCapability(independent, "immersive-light") } catch { tamperRejected = true }
  check(tamperRejected, "能力包文件被篡改时锁校验拒绝执行")
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

process.stdout.write(`ok - ${assertions} code-development assertions\n`)

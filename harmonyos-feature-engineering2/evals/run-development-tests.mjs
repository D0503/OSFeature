#!/usr/bin/env node
// 离线回归：能力包契约、冻结快照与现提判据、criteria 门禁、实施记录、判图与导航。

import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { loadCapability, resolveScenario } from "../scripts/lib/capability-tools.mjs"
import { deriveMaterials, validateDraft } from "../scripts/derive-criteria.mjs"
import { runDevelopmentVerification } from "../scripts/verify-development.mjs"
import { deriveDevelopmentVerdict, validateDevelopmentReport } from "../scripts/validate-development-report.mjs"
import { buildImplementationTrace } from "../scripts/lib/implementation-trace.mjs"
import { renderDevelopmentReport } from "../scripts/render-development-report.mjs"
import { captureFileBaseline } from "../scripts/snapshot-project-files.mjs"
import { recordBuildDiagnosis } from "../scripts/record-build-diagnosis.mjs"
import { inspectDevelopmentProject } from "../scripts/lib/development-project.mjs"

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const tempRoot = await mkdtemp(join(tmpdir(), "dev-skill-tests-"))
let assertions = 0
function check(condition, message) {
  assert.ok(condition, message)
  assertions += 1
}
const digest = (text) => createHash("sha256").update(text, "utf8").digest("hex")

async function put(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, "utf8")
}

async function makeProject(root, { sdk }) {
  await put(join(root, "build-profile.json5"), `${JSON.stringify({ app: { products: [{ name: "default", compatibleSdkVersion: 26, targetSdkVersion: 26, compileSdkVersion: 26 }], buildModeSet: [{ name: "debug" }, { name: "release" }] }, modules: [{ name: "entry", srcPath: "./entry" }] }, null, 2)}\n`)
  await put(join(root, "entry", "src", "main", "module.json5"), `${JSON.stringify({ module: { name: "entry", type: "entry", metadata: [{ name: "ohos.arkui.UIMaterial.state", value: "enable" }], deviceTypes: ["phone"] } }, null, 2)}\n`)
  await put(join(root, "entry", "src", "main", "ets", "pages", "Index.ets"), `import { uiMaterial } from '@kit.ArkUI'\n@Entry @Component struct Index { build() { Column() { Text('x') }.bindPopup(true, { builder: () => {}, systemMaterial: new uiMaterial.ImmersiveMaterial() }) } }\n`)
  await put(join(root, "entry", "src", "main", "resources", "base", "profile", "main_pages.json"), `${JSON.stringify({ src: ["pages/Index"] })}\n`)
  if (sdk) await put(join(root, "local.properties"), `sdk.dir=${sdk.replaceAll("\\", "\\\\")}\n`)
}

async function makeSdk(root) {
  await put(join(root, "sdk-pkg.json"), `${JSON.stringify({ data: { apiVersion: 26, version: "26.0.0.test", platformVersion: "26.0.0", releaseType: "Release" } })}\n`)
  await put(join(root, "openharmony", "ets", "api", "@ohos.arkui.uiMaterial.d.ts"), "class Material { static empty: Material } class ImmersiveMaterial extends Material {} interface ImmersiveOptions {} enum ImmersiveStyle {} function isImmersiveMaterialSupported(): boolean; function getGlobalMaterialLevel(): number;")
  await put(join(root, "openharmony", "ets", "component", "common.d.ts"), "interface CommonAttribute { systemMaterial(value: object): CommonAttribute }")
  await put(join(root, "hms", "ets", "kits", "@kit.UIDesignKit.d.ts"), "export { hdsMaterial, HdsNavigation, HdsTabs, TitleBarStyleOptions, HdsTabsFloatingStyle, SystemMaterialParams };")
  await put(join(root, "hms", "ets", "api", "@hms.hds.hdsMaterial.d.ets"), "namespace hdsMaterial { enum MaterialType { NONE, ADAPTIVE, IMMERSIVE } enum MaterialLevel { EXQUISITE, GENTLE, SMOOTH, ADAPTIVE } function getSystemMaterialTypes(): Array<MaterialType>; }")
  await put(join(root, "hms", "ets", "api", "@hms.hds.hdsBaseComponent.d.ets"), "interface SystemMaterialParams {} interface TitleBarStyleOptions { systemMaterialEffect?: SystemMaterialParams } interface HdsTabsFloatingStyle { systemMaterialEffect?: SystemMaterialParams } declare function HdsNavigation(): void; declare function HdsTabs(): void;")
}

async function makeFrozen(directory, pages) {
  await mkdir(join(directory, "snapshots"), { recursive: true })
  const snapshots = []
  for (const page of pages) {
    await writeFile(join(directory, "snapshots", `${page.snapshotId}.md`), page.content, "utf8")
    snapshots.push({ snapshotId: page.snapshotId, officialUrl: page.officialUrl, contentSha256: digest(page.content), title: page.title ?? page.snapshotId, updatedDate: null })
  }
  await writeFile(join(directory, "frozen.json"), `${JSON.stringify({ frozenAt: "2026-09-07T00:00:00.000Z", snapshots }, null, 2)}\n`, "utf8")
  return directory
}

try {
  // ---------- 能力包契约 ----------
  const capability = await loadCapability(skillRoot, "沉浸光感")
  check(capability.scenariosData.scenarios.length === 18, "能力包登记 18 个场景")
  check(capability.scenariosData.entryPoints.length === 16, "登记 16 个官网入口")
  check(!Object.hasOwn(capability, "session"), "能力包不加载历史基线")
  check(resolveScenario(capability, "应用级开启后关闭沉浸光感").selected?.id === "IL-S001", "应用级开关路由")
  check(resolveScenario(capability, "给 HdsTabs 底部悬浮页签接入沉浸光感").selected?.id === "IL-S010", "HdsTabs 路由")
  const s1 = capability.scenariosData.scenarios.find((item) => item.id === "IL-S001")
  check(s1.sources.includes("enable") && s1.sources.includes("overview"), "IL-S001 官网入口映射正确")
  check(s1.criteriaSpec.conflictProbes.some((probe) => probe.id === "disable-scope"), "IL-S001 声明冲突监测点")

  const tamperedRoot = join(tempRoot, "tampered-skill")
  await cp(skillRoot, tamperedRoot, { recursive: true })
  const tamperedScenariosPath = join(tamperedRoot, "capabilities", "immersive-light", "scenarios.json")
  const tamperedScenarios = JSON.parse(await readFile(tamperedScenariosPath, "utf8"))
  tamperedScenarios.entryPoints[0].officialUrl = ""
  await writeFile(tamperedScenariosPath, JSON.stringify(tamperedScenarios), "utf8")
  let urlEnforced = false
  try { await loadCapability(tamperedRoot, "immersive-light") } catch { urlEnforced = true }
  check(urlEnforced, "入口缺少官网 URL 时包校验失败")

  const entryUrl = (id) => (capability.scenariosData.entryPoints.find((item) => item.snapshotId === id) ?? {}).officialUrl
  const changedBodies = new Map()
  for (const source of s1.sources) {
    changedBodies.set(source, ["本次冻结页", ...s1.criteriaSpec.required.map((topic, i) => `判据锚点${i}: ${topic.topic}`), "冲突监测点两侧表述"].join("\\n"))
  }
  const changedFrozen = await makeFrozen(join(tempRoot, "frozen-current"), s1.sources.map((snapshotId) => ({
    snapshotId, officialUrl: entryUrl(snapshotId), content: changedBodies.get(snapshotId),
  })))
  const materials = await deriveMaterials(capability, "IL-S001", changedFrozen)
  check(materials.status === "materials_ready" && materials.materials.strategy === "fresh", "只从本次冻结页准备现提材料")
  check(materials.materials.snapshots.length === s1.sources.length, "材料只包含本次场景来源")
  const disableScopeVerdict = "persists"
  const draftGood = {
    schemaVersion: "1.0",
    scenarioId: "IL-S001",
    criteria: s1.criteriaSpec.required.map((topic, index) => ({
      id: `C-${index + 1}`, type: "behavior", topic: topic.topic,
      statement: `本次冻结页记录 ${topic.topic}`, snapshotId: s1.sources[0],
      anchor: `判据锚点${index}: ${topic.topic}`,
      ...(index < 2 ? { conflictGroup: "disable-scope" } : {}),
    })),
    conflictResolutions: [{ probeId: "disable-scope", verdict: disableScopeVerdict, basis: "本次冻结原文保留两侧表述。" }],
  }
  const validated = await validateDraft(capability, "IL-S001", changedFrozen, draftGood)
  check(validated.status === "validated", "本次草稿通过校验")
  check(validated.criteriaDocument.criteria.every((item) => item.status === "fresh" && item.lines), "判据全部来自本次冻结正文")
  const draftBadAnchor = structuredClone(draftGood)
  draftBadAnchor.criteria[0].anchor = "不存在的锚点yyy"
  const badAnchor = await validateDraft(capability, "IL-S001", changedFrozen, draftBadAnchor)
  check(badAnchor.status === "invalid" && badAnchor.invalid.some((item) => item.includes("anchor")), "锚点未命中本次冻结正文时拒绝")
  const draftNoProbe = structuredClone(draftGood)
  draftNoProbe.conflictResolutions = []
  const noProbe = await validateDraft(capability, "IL-S001", changedFrozen, draftNoProbe)
  check(noProbe.status === "invalid" && noProbe.invalid.some((item) => item.includes("disable-scope")), "缺少冲突监测结论时拒绝")
  const draftMissingTopic = structuredClone(draftGood)
  draftMissingTopic.criteria.pop()
  const missingTopic = await validateDraft(capability, "IL-S001", changedFrozen, draftMissingTopic)
  check(missingTopic.status === "invalid" && missingTopic.invalid.some((item) => item.includes("骨架主题")), "缺少主题时拒绝")
  // ---------- verify：criteria 门禁与开发报告 ----------
  const project = join(tempRoot, "project")
  const sdk = join(tempRoot, "sdk")
  await makeSdk(sdk)
  await makeProject(project, { sdk })
  const hdsProject = join(tempRoot, "hds-compatible20")
  await makeProject(hdsProject, { sdk })
  const hdsProfilePath = join(hdsProject, "build-profile.json5")
  const hdsProfile = JSON.parse(await readFile(hdsProfilePath, "utf8"))
  const hdsProduct = hdsProfile.app.products[0]
  hdsProduct.compatibleSdkVersion = 20
  hdsProduct.targetSdkVersion = 23
  const hdsScenario = capability.scenariosData.scenarios.find((item) => item.id === "IL-S010")
  await put(hdsProfilePath, JSON.stringify(hdsProfile))
  const inspectHds = () => inspectDevelopmentProject(hdsProject, capability, { scenario: hdsScenario, sdkPath: sdk })
  check((await inspectHds()).compatibility.status === "supported", "HDS compatible=20、target=23、SDK=26 不被固定最低兼容门禁阻塞")
  hdsProduct.targetSdkVersion = 20
  await put(hdsProfilePath, JSON.stringify(hdsProfile))
  check((await inspectHds()).compatibility.status === "upgrade_required", "HDS target 不足仍被版本门禁阻塞")
  hdsProduct.targetSdkVersion = 23
  hdsProduct.compileSdkVersion = 20
  await put(hdsProfilePath, JSON.stringify(hdsProfile))
  check((await inspectHds()).compatibility.status === "upgrade_required", "HDS 显式 compile 不足仍被版本门禁阻塞")

  let criteriaGateRejected = false
  try {
    await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, { executeBuild: true, outputDirectory: join(tempRoot, "out-gate") })
  } catch (error) { criteriaGateRejected = error instanceof Error && error.message.includes("缺少本次判据集") }
  check(criteriaGateRejected, "未注入判据集时构建被程序拒绝")

  let badCriteriaRejected = false
  try {
    await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, { executeBuild: true, criteria: { schemaVersion: "1.0", scenarioId: "IL-S001", strategy: "fresh", criteria: [] }, outputDirectory: join(tempRoot, "out-gate") })
  } catch (error) { badCriteriaRejected = error instanceof Error && error.message.includes("criteria 无效") }
  check(badCriteriaRejected, "判据集结构无效时被拒绝")

  const criteriaForVerify = validated.criteriaDocument
  let implementationGateRejected = false
  try {
    await runDevelopmentVerification(skillRoot, { project, goal: "应用级开启后关闭沉浸光感", sdk }, { executeBuild: true, criteria: criteriaForVerify })
  } catch (error) { implementationGateRejected = error.message.includes("实施依据门禁未通过（尚未构建或运行）") }
  check(implementationGateRejected, "完整判据不能绕过实施依据门禁，拒绝发生在设备命令之前")
  const run = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk, criteriaPath: "criteria.json" }, { criteria: criteriaForVerify, outputDirectory: join(tempRoot, "out-verify") })
  check(!Object.hasOwn(run.report.input, "criteria"), "交付报告不保存临时判据路径")
  check(run.report.verificationVersion === "1.0", "报告契约版本正确")
  check(run.report.capabilityPackage.criteriaRefs.length === run.report.capabilityPackage.criteriaRefs.filter((id, index, all) => all.indexOf(id) === index).length && run.report.capabilityPackage.criteriaRefs.length > 0, "报告登记本次判据引用")
  check(run.report.capabilityPackage.conflictingCriteriaRefs.length === (disableScopeVerdict === "persists" ? 2 : 0), "冲突判据按当前结论进入报告")
  check(validateDevelopmentReport(run.report).valid, "开发报告通过结构校验")
  const explicitRun = await runDevelopmentVerification(skillRoot, { project, scenarioId: 'IL-S001', goal: '同时验证搜索框标题栏与应用级开关', sdk }, { criteria: criteriaForVerify, outputDirectory: join(tempRoot, 'out-explicit') })
  check(explicitRun.report.capabilityPackage.scenarioId === 'IL-S001', 'explicitly selected scene is not replaced by another goal route')
  await assert.rejects(() => runDevelopmentVerification(skillRoot, { project, scenarioId: 'IL-S013', goal: '搜索框标题栏', sdk }, { criteria: criteriaForVerify }), /指定场景与本轮判据/)
  await assert.rejects(() => runDevelopmentVerification(skillRoot, { project, scenarioId: 'IL-S999', goal: 'fixture', sdk }), /未注册场景/)
  assertions += 2

  // A real verification path with an injected command runner must never operate a device after failure.
  const codePath = "entry/src/main/ets/pages/Index.ets"
  const buildBaseline = await captureFileBaseline(project, [codePath])
  const impl = { developmentMode: "demo", requirements: criteriaForVerify.criteria.map((c) => {
    const body = changedBodies.get(c.snapshotId)
    return { criteriaId: c.id, strength: "required", disposition: "implement", approach: "Fixture contract implementation", sources: [{ snapshotId: c.snapshotId, lineStart: 1, lineEnd: 1, sha256: digest(body.split(/\r?\n/)[0]) }], review: { status: "passed", basis: "Fixture code references the official contract" } }
  }), steps: [{ id: "BUILD-INPUT", description: "Existing fixture", status: "existing", locations: [{ path: codePath, version: "after", lineStart: 1, lineEnd: 1 }], basis: criteriaForVerify.criteria.map((c) => ({ type: "criteria", criteriaId: c.id, reason: "Fixture official contract" })) }] }
  const commands = []
  const failedOutput = join(tempRoot, "failed-build")
  const failed = await runDevelopmentVerification(skillRoot, { project, goal: "应用级开启后关闭沉浸光感", sdk, device: "mock-device" }, {
    criteria: criteriaForVerify, implementation: impl, baseline: buildBaseline, frozenDirectory: changedFrozen,
    executeBuild: true, executeRun: true, captureScreenshot: true, captureLayout: true,
    navigate: { schemaVersion: "1.0", steps: [{ stepId: "launch", action: "launch", target: "fixture" }] },
    observations: { runtime: { status: "passed", summary: "stale" }, visual: { status: "passed", summary: "stale" } },
    judgment: { visual: { status: "passed" }, matchedCriteriaRefs: ["C-1"] }, outputDirectory: failedOutput,
    commandRunner: async (args) => { commands.push(args); const now = new Date().toISOString(); return { exitCode: 1, stdout: "compile error: fixture", stderr: "", command: `mock ${args.join(" ")}`, startedAt: now, endedAt: now } },
  })
  check(commands.length === 1 && commands[0][0] === "build", "构建失败后无安装、启动、导航或采集命令")
  check(["install", "runtime", "visual"].every((level) => failed.report.checks[level].status === "not_run") && failed.report.verdict.status === "failed" && !failed.report.verdict.matchedCriteriaRefs.length, "旧观察和判图不能覆盖构建失败")
  check(failed.report.buildDiagnosis.category === "unknown", "首次失败不按关键词归因官网")
  const reportPath = join(failedOutput, "development-verification-report.json")
  const other = structuredClone(run.report); other.input.goal = "Other target"
  await renderDevelopmentReport(other, failedOutput)
  const diagnostic = { ...failed.report.buildDiagnosis, category: "official_documentation", summary: "Fixture official contract contradicts SDK", decision: "stop_repair", sdkComparisonRequired: true,
    premises: { codeMatchesOfficial: true, versionSatisfied: true, configurationSatisfied: true, basis: "Fixture versions/configuration checked against frozen official text" },
    evidence: [...failed.report.buildInputs.filter((e) => e.type === "code" || e.type === "official_source"), failed.report.evidence.find((e) => e.type === "sdk_declaration")].map((e) => ({ type: e.type, path: e.path, sha256: e.sha256, lineStart: 1, lineEnd: 1 })) }
  const unchangedReport = await readFile(reportPath, "utf8")
  for (const kind of ["code", "official_source", "sdk_declaration", "log", "hash", "premise"]) {
    const bad = structuredClone(diagnostic)
    if (["code", "official_source", "sdk_declaration"].includes(kind)) bad.evidence = bad.evidence.filter((e) => e.type !== kind)
    if (kind === "log") bad.buildLog.path = join(tempRoot, "unrelated.log")
    if (kind === "hash") bad.evidence[0].sha256 = "0".repeat(64)
    if (kind === "premise") bad.premises.versionSatisfied = false
    let rejected = false
    try { await recordBuildDiagnosis(reportPath, bad) } catch { rejected = true }
    check(rejected && await readFile(reportPath, "utf8") === unchangedReport, `归因 ${kind} 无效时拒绝且不写回`)
  }
  const originalCode = await readFile(join(project, codePath), "utf8")
  const buildLogBytes = await readFile(diagnostic.buildLog.path)
  await writeFile(diagnostic.buildLog.path, "changed log")
  let changedLogRejected = false
  try { await recordBuildDiagnosis(reportPath, diagnostic) } catch { changedLogRejected = true }
  check(changedLogRejected && await readFile(reportPath, "utf8") === unchangedReport, "证据路径匹配但日志文件内容已变化时拒绝写回")
  await writeFile(diagnostic.buildLog.path, buildLogBytes)
  await writeFile(join(project, codePath), "later edited code")
  await recordBuildDiagnosis(reportPath, diagnostic)
  let recorded = JSON.parse(await readFile(reportPath, "utf8"))
  check(recorded.reports.length === 2 && recorded.reports.find((r) => r.input.goal === other.input.goal).verdict.status === other.verdict.status, "归因写回保留其他目标")
  check(recorded.reports.find((r) => r.buildDiagnosis)?.buildDiagnosis.decision === "stop_repair" && commands.length === 1, "官网问题记录停止修复且不重新构建，证据取自失败前代码副本")
  const diagnosedMarkdown = await readFile(join(failedOutput, "development-verification-report.md"), "utf8")
  check(diagnosedMarkdown.includes("停止修改和重试"), "报告突出官网问题停止修复")
  check(!diagnosedMarkdown.includes("[查看日志]") && !diagnosedMarkdown.includes(diagnostic.buildLog.path), "交付 Markdown 不链接临时日志")
  await writeFile(join(project, codePath), originalCode)
  for (const [category, decision] of [["implementation_error", "repair_according_to_official"], ["environment_issue", "resolve_prerequisites"], ["unknown", "investigate_only"]]) {
    await recordBuildDiagnosis(reportPath, { ...failed.report.buildDiagnosis, category, decision, summary: category })
    check(JSON.parse(await readFile(reportPath, "utf8")).reports.some((r) => r.buildDiagnosis?.category === category && r.verdict.status === "failed"), `${category} 保持构建失败且分类独立`)
  }
  recorded = JSON.parse(await readFile(reportPath, "utf8"))
  const duplicate = structuredClone(recorded.reports.find((r) => r.buildDiagnosis)); duplicate.input.goal = "Duplicate build evidence"
  recorded.reports.push(duplicate)
  await writeFile(reportPath, JSON.stringify(recorded))
  let ambiguousRejected = false
  try { await recordBuildDiagnosis(reportPath, diagnostic) } catch { ambiguousRejected = true }
  check(ambiguousRejected, "相同日志匹配多个条目时拒绝")

  const conflictReport = structuredClone(run.report)
  for (const level of Object.keys(conflictReport.checks)) conflictReport.checks[level] = { ...conflictReport.checks[level], status: "passed" }
  // 冲突裁决算法使用最小合成判据对覆盖。
  conflictReport.capabilityPackage.conflictingCriteriaRefs = ["synthetic-conflict-left", "synthetic-conflict-right"]
  conflictReport.verdict.matchedCriteriaRefs = [conflictReport.capabilityPackage.conflictingCriteriaRefs[0]]
  check(deriveDevelopmentVerdict(conflictReport) === "passed_with_spec_conflict", "只匹配一个冲突判据时 passed_with_spec_conflict")
  conflictReport.verdict.matchedCriteriaRefs = []
  check(deriveDevelopmentVerdict(conflictReport) === "failed", "不匹配任何冲突判据时 failed")
  conflictReport.verdict.matchedCriteriaRefs = [...conflictReport.capabilityPackage.conflictingCriteriaRefs]
  check(deriveDevelopmentVerdict(conflictReport) === "inconclusive", "匹配多个冲突判据时 inconclusive")

  // ---------- 三层链实施记录 ----------
  const trace = buildImplementationTrace(criteriaForVerify, { steps: [
    { id: "STEP-001", description: "配置应用级开启。", status: "applied", locations: [{ path: "entry/src/main/module.json5", version: "after", lineStart: 1, lineEnd: 8 }], basis: [{ type: "criteria", criteriaId: "C-2", reason: "应用级配置键与取值来自判据。" }] },
  ] }, [
    { path: "entry/src/main/module.json5", status: "modified", beforeSha256: digest("a"), afterSha256: digest("b"), diff: "@@ -1,2 +1,3 @@\n context\n+metadata line" },
  ], true)
  check(trace.normativeBasis.some((item) => item.id === "C-2" && item.sources[0].officialUrl), "三层链展开：代码→判据→快照来源")
  let badCriteriaRefThrown = false
  try {
    buildImplementationTrace(criteriaForVerify, { steps: [
      { id: "STEP-X", description: "引用不存在判据。", status: "applied", locations: [{ path: "a.ets", version: "after", lineStart: 1, lineEnd: 1 }], basis: [{ type: "criteria", criteriaId: "C-999", reason: "x" }] },
    ] }, [], true)
  } catch { badCriteriaRefThrown = true }
  check(badCriteriaRefThrown, "实施记录引用不存在判据时被拒绝")

  // ---------- 判图与导航回归 ----------
  const judgmentShot = join(tempRoot, "shot.png")
  await writeFile(judgmentShot, "png", "utf8")
  const judgmentRun = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, {
    criteria: criteriaForVerify,
    judgment: { schemaVersion: "1.0", scenarioId: "IL-S001", runtime: { status: "passed", summary: "应用已拉起。" }, visual: { status: "passed", basis: "弹窗区域材质可见。", evidence: [{ path: judgmentShot, type: "screenshot" }] }, matchedCriteriaRefs: [criteriaForVerify.criteria[0].id] },
    outputDirectory: join(tempRoot, "out-judgment"),
  })
  check(judgmentRun.report.checks.visual.status === "passed" && judgmentRun.report.evidence.some((item) => item.type === "visual_judgment"), "判图注入路径保留")

  // 多目标汇总与可随 Markdown 搬运的截图。
  const combinedOutput = join(tempRoot, "combined report")
  const first = structuredClone(judgmentRun.report)
  const firstShot = first.evidence.find((item) => item.type === "screenshot")
  const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64")
  await writeFile(judgmentShot, imageBytes)
  firstShot.sha256 = createHash("sha256").update(imageBytes).digest("hex")
  const second = structuredClone(run.report)
  second.input.goal = "给搜索框标题栏接入沉浸光感"
  second.capabilityPackage.scenarioId = "IL-S013"
  await Promise.all([renderDevelopmentReport(first, combinedOutput), renderDevelopmentReport(second, combinedOutput)])
  const combinedPath = join(combinedOutput, "development-verification-report.json")
  let combined = JSON.parse(await readFile(combinedPath, "utf8"))
  check(combined.reports.length === 2 && validateDevelopmentReport(combined).valid, "同工程多场景并发渲染合并为同一份有效报告")
  let markdown = await readFile(join(combinedOutput, "development-verification-report.md"), "utf8")
  check(markdown.includes(first.input.goal) && markdown.includes(second.input.goal) && !/^## IL-S/m.test(markdown), "汇总按开发目标展示两个场景")
  const imageLink = markdown.match(/!\[[^\]]*\]\(<([^>]+)>\)/)?.[1]
  check(imageLink?.startsWith("evidence/images/") && (await readFile(resolve(combinedOutput, decodeURIComponent(imageLink)))).equals(imageBytes), "Markdown 内嵌真实截图并使用随报告目录可搬运的相对路径")
  const storedShot = combined.reports[0].evidence.find((item) => item.type === "screenshot")
  check(storedShot.path !== judgmentShot && firstShot.path === judgmentShot, "截图复制到报告证据目录且不修改调用方数据")
  first.verdict.summary = "重跑后的最新结论"
  await renderDevelopmentReport(first, combinedOutput)
  combined = JSON.parse(await readFile(combinedPath, "utf8"))
  check(combined.reports.length === 2 && combined.reports[0].verdict.summary === "重跑后的最新结论", "同目标重跑更新结论，保留其他目标")
  const third = structuredClone(second)
  third.input.goal = "同一场景的另一个开发目标"
  await renderDevelopmentReport(third, combinedOutput)
  check(JSON.parse(await readFile(combinedPath, "utf8")).reports.length === 3, "同场景不同目标分别保留")
  const missingImage = structuredClone(first)
  missingImage.input.goal = "截图丢失的目标"
  missingImage.evidence.find((item) => item.type === "screenshot").path = join(tempRoot, "missing.png")
  await renderDevelopmentReport(missingImage, combinedOutput)
  markdown = await readFile(join(combinedOutput, "development-verification-report.md"), "utf8")
  check(markdown.includes("截图文件缺失，无法预览。") && !/!\[[^\]]*\]\([^\n]*missing\.png/.test(markdown), "缺失截图明确提示，不输出损坏图片链接")
  const otherProject = structuredClone(second)
  otherProject.input.project = join(tempRoot, "another-project")
  let otherProjectRejected = false
  const beforeReject = await readFile(combinedPath, "utf8")
  try { await renderDevelopmentReport(otherProject, combinedOutput) } catch { otherProjectRejected = true }
  check(otherProjectRejected && await readFile(combinedPath, "utf8") === beforeReject, "拒绝把其他工程混入已有报告且保留文件")
  const rerendered = await renderDevelopmentReport(JSON.parse(beforeReject), join(tempRoot, "rerendered"))
  check(rerendered.reportCount === 4, "汇总 JSON 可独立重新渲染 Markdown")
  const defaultRun = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, { criteria: criteriaForVerify })
  check(defaultRun.rendered.markdownPath === join(project, "ohos-feature-engineering", "development-verification-report.md"), "默认报告直接写入工程统一目录")

  let badNavigationRejected = false
  try {
    await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, { criteria: criteriaForVerify, navigate: { schemaVersion: "1.0", steps: [{ stepId: "S01", action: "teleport" }] }, outputDirectory: join(tempRoot, "out-nav") })
  } catch { badNavigationRejected = true }
  check(badNavigationRejected, "非法导航动作被拒绝")

  const navSkipped = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk, navigationPath: "route-steps.json" }, { criteria: criteriaForVerify, navigate: { schemaVersion: "1.0", steps: [{ stepId: "S01", action: "launch", target: "entry/EntryAbility" }] }, outputDirectory: join(tempRoot, "out-nav") })
  check(navSkipped.report.input.navigation === "route-steps.json" && navSkipped.report.checks.visual.status === "not_run", "无设备时导航跳过且视觉保持 not_run")

  console.log(`ok - ${assertions} development assertions`)
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

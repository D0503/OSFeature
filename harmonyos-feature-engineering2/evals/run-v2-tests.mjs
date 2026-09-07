#!/usr/bin/env node
// v2 离线回归：能力包契约、freeze/diff/derive 链路、criteria 门禁、三层链实施记录、判图与导航回归。

import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { loadCapability2, resolveScenario2 } from "../scripts/lib/capability2-tools.mjs"
import { diffAgainstLatest } from "../scripts/diff-snapshots.mjs"
import { deriveMaterials, validateDraft } from "../scripts/derive-criteria.mjs"
import { runDevelopmentVerification } from "../scripts/verify-development.mjs"
import { deriveDevelopmentVerdict, validateDevelopmentReport } from "../scripts/validate-development-report.mjs"
import { buildImplementationTrace } from "../scripts/lib/implementation-trace.mjs"

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const tempRoot = await mkdtemp(join(tmpdir(), "v2-skill-tests-"))
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
  await put(join(root, "hms", "ets", "api", "@hds.hds.hdsMaterial.d.ets"), "namespace hdsMaterial { enum MaterialType { NONE, ADAPTIVE, IMMERSIVE } enum MaterialLevel { EXQUISITE, GENTLE, SMOOTH, ADAPTIVE } function getSystemMaterialTypes(): Array<MaterialType>; }")
  await put(join(root, "hms", "ets", "api", "@hds.hds.hdsBaseComponent.d.ets"), "interface SystemMaterialParams {} interface TitleBarStyleOptions { systemMaterialEffect?: SystemMaterialParams } interface HdsTabsFloatingStyle { systemMaterialEffect?: SystemMaterialParams } declare function HdsNavigation(): void; declare function HdsTabs(): void;")
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
  const capability = await loadCapability2(skillRoot, "沉浸光感")
  check(capability.scenariosData.scenarios.length === 11, "v2 能力包登记 11 个场景")
  check(capability.scenariosData.entryPoints.length === 11, "登记 11 个官网入口")
  check((capability.session?.criteria ?? []).length === 32, "初始上次审查判据 32 条")
  check(capability.session.conflictResolutions.some((item) => item.probeId === "disable-scope" && item.verdict === "persists"), "disable-scope 冲突监测点带初始结论")

  check(resolveScenario2(capability, "应用级开启后关闭沉浸光感").selected?.id === "IL-S001", "应用级开关路由")
  check(resolveScenario2(capability, "给 HdsTabs 底部悬浮页签接入沉浸光感").selected?.id === "IL-S010", "HdsTabs 路由")
  const s1 = capability.scenariosData.scenarios.find((item) => item.id === "IL-S001")
  check(s1.sources.includes("enable") && s1.sources.includes("overview"), "IL-S001 官网入口映射正确")
  check(s1.criteriaSpec.conflictProbes.some((probe) => probe.id === "disable-scope"), "IL-S001 声明 disable-scope 冲突监测点")

  const tamperedRoot = join(tempRoot, "tampered-skill")
  await cp(skillRoot, tamperedRoot, { recursive: true })
  const tamperedScenariosPath = join(tamperedRoot, "capabilities2", "immersive-light", "scenarios.json")
  const tamperedScenarios = JSON.parse(await readFile(tamperedScenariosPath, "utf8"))
  tamperedScenarios.entryPoints[0].officialUrl = ""
  await writeFile(tamperedScenariosPath, `${JSON.stringify(tamperedScenarios, null, 2)}\n`, "utf8")
  let urlEnforced = false
  try { await loadCapability2(tamperedRoot, "immersive-light") } catch { urlEnforced = true }
  check(urlEnforced, "入口缺少官网 URL 时包校验失败")

  const tamperedSessionPath = join(tamperedRoot, "capabilities2", "immersive-light", "sessions", "latest", "session.json")
  const tamperedScenarios2 = JSON.parse(await readFile(tamperedScenariosPath, "utf8"))
  tamperedScenarios2.entryPoints[0].officialUrl = "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-overview"
  await writeFile(tamperedScenariosPath, `${JSON.stringify(tamperedScenarios2, null, 2)}\n`, "utf8")
  const tamperedSession = JSON.parse(await readFile(tamperedSessionPath, "utf8"))
  tamperedSession.criteria[0].anchor = "不存在的锚点xxx"
  await writeFile(tamperedSessionPath, `${JSON.stringify(tamperedSession, null, 2)}\n`, "utf8")
  // 锚点不校验内容命中（校验的是快照哈希完整性），此处应仍可加载；锚点失效由 diff/derive 暴露
  await loadCapability2(tamperedRoot, "immersive-light")
  tamperedSession.snapshots[0].contentSha256 = "0".repeat(64)
  await writeFile(tamperedSessionPath, `${JSON.stringify(tamperedSession, null, 2)}\n`, "utf8")
  let hashEnforced = false
  try { await loadCapability2(tamperedRoot, "immersive-light") } catch { hashEnforced = true }
  check(hashEnforced, "上次审查快照正文哈希不一致时包校验失败")

  // ---------- freeze/diff fixture ----------
  const entryUrl = (id) => (capability.scenariosData.entryPoints.find((item) => item.snapshotId === id) ?? {}).officialUrl
  const enableBodyLatest = await readFile(join(capability.packageRoot, "sessions/latest/snapshots/enable.md"), "utf8")
  const overviewBodyLatest = await readFile(join(capability.packageRoot, "sessions/latest/snapshots/overview.md"), "utf8")

  const cleanFrozen = await makeFrozen(join(tempRoot, "frozen-clean"), [
    { snapshotId: "enable", officialUrl: entryUrl("enable"), content: enableBodyLatest },
    { snapshotId: "overview", officialUrl: entryUrl("overview"), content: overviewBodyLatest },
  ])
  const cleanDiff = await diffAgainstLatest(capability, cleanFrozen)
  check(cleanDiff.status === "clean" && cleanDiff.pages.every((page) => page.status === "unchanged"), "快照与上次一致时 diff=clean")

  const changedBody = `${enableBodyLatest}\n\n新增段落：materialType 参数默认值变更为 ADAPTIVE。\n`
  const changedFrozen = await makeFrozen(join(tempRoot, "frozen-changed"), [
    { snapshotId: "enable", officialUrl: entryUrl("enable"), content: changedBody },
    { snapshotId: "overview", officialUrl: entryUrl("overview"), content: overviewBodyLatest },
  ])
  const changedDiff = await diffAgainstLatest(capability, changedFrozen)
  const changedPage = changedDiff.pages.find((page) => page.snapshotId === "enable")
  check(changedDiff.status === "changed" && changedPage.status === "changed", "正文变化时 diff=changed")
  check(["api-signature", "version", "deletion", "content"].includes(changedPage.category), "变化被分类")
  check(changedDiff.highRisk.length === 1, "变化页计入高危清单")

  // ---------- derive：clean → reuse ----------
  const reuse = await deriveMaterials(capability, "IL-S001", cleanFrozen, cleanDiff)
  check(reuse.status === "reuse_ready", "无变化时直接复用上次判据")
  check(reuse.criteriaDocument.criteria.length === 6 && reuse.criteriaDocument.criteria.every((item) => item.status === "reused"), "IL-S001 复用 6 条判据且全部 reused")
  check(reuse.criteriaDocument.criteria.some((item) => item.conflictGroup === "disable-scope"), "复用判据保留冲突组")
  check(reuse.criteriaDocument.snapshots.length === 2, "判据文档内嵌本次快照来源表")

  const degradedFrozen = await makeFrozen(join(tempRoot, "frozen-degraded"), [
    { snapshotId: "enable", officialUrl: entryUrl("enable"), content: "正文被替换，所有锚点失效。" },
    { snapshotId: "overview", officialUrl: entryUrl("overview"), content: overviewBodyLatest },
  ])
  const degradedDiff = await diffAgainstLatest(capability, degradedFrozen)
  const degraded = await deriveMaterials(capability, "IL-S001", degradedFrozen, degradedDiff)
  check(degraded.status === "materials_ready", "正文变化必须走现提流程，不进入静默复用")
  const degradedValidate = await validateDraft(capability, "IL-S001", degradedFrozen, {
    schemaVersion: "1.0", scenarioId: "IL-S001", criteria: [],
    conflictResolutions: [{ probeId: "disable-scope", verdict: "persists", basis: "原文两段互斥表述仍在。" }],
    confirmations: degradedDiff.highRisk.map((risk) => ({ snapshotId: risk.snapshotId, category: risk.category, userDecision: "proceed", note: "确认变化。" })),
  }, degradedDiff)
  check(degradedValidate.status === "invalid" && degradedValidate.invalid.some((item) => item.includes("骨架主题")), "锚点失效的旧判据不能自动补齐，必须现提")

  // ---------- derive：changed → materials ----------
  const materials = await deriveMaterials(capability, "IL-S001", changedFrozen, changedDiff)
  check(materials.status === "materials_ready", "有变化时产出材料包")
  check(materials.materials.conflictProbes.some((probe) => probe.id === "disable-scope" && probe.lastResolution?.verdict === "persists"), "材料包含冲突监测点与上次结论对照")
  check(materials.materials.highRisk.length === 1 && materials.materials.highRisk[0].snapshotId === "enable", "材料包含高危变化清单")

  // ---------- derive validate ----------
  const changedBodies = new Map([["enable", changedBody], ["overview", overviewBodyLatest]])
  const anchorFrom = (id, body) => capability.session.criteria.find((item) => item.id === id).anchor && body.includes(capability.session.criteria.find((item) => item.id === id).anchor) ? capability.session.criteria.find((item) => item.id === id).anchor : null
  const draftGood = {
    schemaVersion: "1.0",
    scenarioId: "IL-S001",
    criteria: s1.criteriaSpec.required.map((topic, index) => {
      const reused = capability.session.criteria.find((item) => item.topic === topic.topic)
      const body = changedBodies.get(reused?.snapshotId) ?? ""
      const anchor = anchorFrom(reused.id, body) ?? (index === 0 ? "新增段落" : null)
      if (!anchor) return null
      return { id: `C-${index + 1}`, type: reused.type, topic: topic.topic, statement: reused.statement, snapshotId: reused.snapshotId, anchor, ...(reused.conflictGroup ? { conflictGroup: reused.conflictGroup } : {}) }
    }).filter(Boolean),
    conflictResolutions: [{ probeId: "disable-scope", verdict: "persists", basis: "新增段落未触及 disable 表述，两段互斥原文仍在。" }],
    confirmations: [{ snapshotId: "enable", category: changedDiff.highRisk[0].category, userDecision: "proceed", note: "确认参数默认值变化并按新文现提。" }],
  }
  const validated = await validateDraft(capability, "IL-S001", changedFrozen, draftGood, changedDiff)
  check(validated.status === "validated", "草稿通过校验产出最终判据集")
  check(validated.criteriaDocument.criteria.every((item) => item.status === "fresh") && validated.criteriaDocument.criteria.every((item) => item.lines), "现提判据全部 fresh 且带行号")

  const draftBadAnchor = structuredClone(draftGood)
  draftBadAnchor.criteria[0].anchor = "不存在的锚点yyy"
  const badAnchor = await validateDraft(capability, "IL-S001", changedFrozen, draftBadAnchor, changedDiff)
  check(badAnchor.status === "invalid" && badAnchor.invalid.some((item) => item.includes("anchor")), "锚点未命中本次冻结正文时拒绝")

  const draftNoProbe = structuredClone(draftGood)
  draftNoProbe.conflictResolutions = []
  const noProbe = await validateDraft(capability, "IL-S001", changedFrozen, draftNoProbe, changedDiff)
  check(noProbe.status === "invalid" && noProbe.invalid.some((item) => item.includes("disable-scope")), "缺少冲突监测结论时拒绝")

  const draftNoConfirm = structuredClone(draftGood)
  draftNoConfirm.confirmations = []
  const noConfirm = await validateDraft(capability, "IL-S001", changedFrozen, draftNoConfirm, changedDiff)
  check(noConfirm.status === "invalid" && noConfirm.invalid.some((item) => item.includes("高危")), "缺少高危确认记录时拒绝")

  // ---------- verify：criteria 门禁与报告 2.0 ----------
  const project = join(tempRoot, "project")
  const sdk = join(tempRoot, "sdk")
  await makeSdk(sdk)
  await makeProject(project, { sdk })

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
  const run = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk, criteriaPath: "criteria.json" }, { criteria: criteriaForVerify, outputDirectory: join(tempRoot, "out-verify") })
  check(run.report.verificationVersion === "2.0", "报告为 2.0 契约")
  check(run.report.capabilityPackage.criteriaRefs.length === run.report.capabilityPackage.criteriaRefs.filter((id, index, all) => all.indexOf(id) === index).length && run.report.capabilityPackage.criteriaRefs.length > 0, "报告登记本次判据引用")
  check(run.report.capabilityPackage.conflictingCriteriaRefs.length === 2, "冲突判据对进入报告")
  check(validateDevelopmentReport(run.report).valid, "2.0 报告通过结构校验")

  const conflictReport = structuredClone(run.report)
  for (const level of Object.keys(conflictReport.checks)) conflictReport.checks[level] = { ...conflictReport.checks[level], status: "passed" }
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
  check(trace.normativeBasis.length === 1 && trace.normativeBasis[0].id === "C-2" && trace.normativeBasis[0].sources[0].officialUrl, "三层链展开：代码→判据→快照来源")
  let badCriteriaRefThrown = false
  try {
    buildImplementationTrace(criteriaForVerify, { steps: [
      { id: "STEP-X", description: "引用不存在判据。", status: "applied", locations: [{ path: "a.ets", version: "after", lineStart: 1, lineEnd: 1 }], basis: [{ type: "criteria", criteriaId: "C-999", reason: "x" }] },
    ] }, [], true)
  } catch { badCriteriaRefThrown = true }
  check(badCriteriaRefThrown, "实施记录引用不存在判据时被拒绝")

  // ---------- 判图与导航回归（v1.5 能力保留） ----------
  const judgmentShot = join(tempRoot, "shot.png")
  await writeFile(judgmentShot, "png", "utf8")
  const judgmentRun = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, {
    criteria: criteriaForVerify,
    judgment: { schemaVersion: "1.0", scenarioId: "IL-S001", runtime: { status: "passed", summary: "应用已拉起。" }, visual: { status: "passed", basis: "弹窗区域材质可见。", evidence: [{ path: judgmentShot, type: "screenshot" }] }, matchedCriteriaRefs: [run.report.capabilityPackage.conflictingCriteriaRefs[0]] },
    outputDirectory: join(tempRoot, "out-judgment"),
  })
  check(judgmentRun.report.checks.visual.status === "passed" && judgmentRun.report.evidence.some((item) => item.type === "visual_judgment"), "判图注入路径保留")

  let badNavigationRejected = false
  try {
    await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk }, { criteria: criteriaForVerify, navigate: { schemaVersion: "1.0", steps: [{ stepId: "S01", action: "teleport" }] }, outputDirectory: join(tempRoot, "out-nav") })
  } catch { badNavigationRejected = true }
  check(badNavigationRejected, "非法导航动作被拒绝")

  const navSkipped = await runDevelopmentVerification(skillRoot, { feature: "immersive-light", project, goal: "应用级开启后关闭沉浸光感", sdk, navigationPath: "route-steps.json" }, { criteria: criteriaForVerify, navigate: { schemaVersion: "1.0", steps: [{ stepId: "S01", action: "launch", target: "entry/EntryAbility" }] }, outputDirectory: join(tempRoot, "out-nav") })
  check(navSkipped.report.input.navigation === "route-steps.json" && navSkipped.report.checks.visual.status === "not_run", "无设备时导航跳过且视觉保持 not_run")

  console.log(`ok - ${assertions} v2 assertions`)
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

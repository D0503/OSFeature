#!/usr/bin/env node

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { prepareReview } from "../scripts/prepare-review.mjs"
import { renderReport } from "../scripts/render-report.mjs"
import { renderValidationChecklist } from "../scripts/render-validation-checklist.mjs"
import { validateValidationChecklist } from "../scripts/validate-validation-checklist.mjs"
import { DIMENSIONS, validateReport } from "../scripts/validate-report.mjs"

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceDirectory = resolve(SKILL_DIR, "..", "沉浸光感")
const enablePath = join(sourceDirectory, "arkts-immersive-light-sense-enable.md")
const componentPath = join(sourceDirectory, "arkts-immersive-light-sense-component-adaptation.md")
const prepared = await prepareReview(sourceDirectory)
const enableRaw = await readFile(enablePath, "utf8")
const componentRaw = await readFile(componentPath, "utf8")
const enableLines = enableRaw.split(/\r?\n/)
const componentLines = componentRaw.split(/\r?\n/)
const enableHash = createHash("sha256").update(enableRaw).digest("hex")
const componentHash = createHash("sha256").update(componentRaw).digest("hex")

const sourceRef = (source, lines, line, section, sha256) => ({ source, section, line, quote: lines[line - 1].trim(), sha256 })
const globalDisable = sourceRef(enablePath, enableLines, 45, "应用级开启", enableHash)
const appOnlyDisable = sourceRef(enablePath, enableLines, 54, "关闭沉浸光感", enableHash)
const applicationConfig = sourceRef(enablePath, enableLines, 24, "应用级开启", enableHash)
const emptyVsUndefined = sourceRef(enablePath, enableLines, 58, "组件级关闭", enableHash)
const overlayScope = sourceRef(componentPath, componentLines, 57, "弹窗类组件", componentHash)
const toastOverride = sourceRef(componentPath, componentLines, 67, "即时反馈（Toast）", componentHash)

assert.match(globalDisable.quote, /全局禁用/)
assert.match(appOnlyDisable.quote, /只针对应用级/)
assert.match(overlayScope.quote, /Toast、Popup、Tips、Menu和Dialog/)

const report = {
  reviewVersion: "1.0",
  mode: "document-review",
  input: prepared.input,
  sourceIntegrity: prepared.sourceIntegrity,
  verdict: { label: "不合格", score: 80, summary: "disable 作用域存在影响接入的已确认文档内部冲突。" },
  integrationGate: "blocked",
  dimensions: DIMENSIONS.map(([id, name, weight]) => ({ id, name, weight, score: 80, notes: "已完成当前验收范围检查。" })),
  findings: [{
    id: "DOC-001", title: "disable 作用域存在直接冲突", dimension: "consistency", status: "confirmed", severity: "High", confidence: "certain", integrationAffecting: true, coreTechnicalClaim: true, claimScope: "internal_consistency",
    location: globalDisable, claim: "disable 是否同时使组件级开启失效。", analysis: "两处官网资料分别声明全局失效和只影响应用级；这里只确认冲突，不确认哪一方正确。", evidenceRefs: ["EVID-001", "EVID-002"], impact: "关闭策略和组件级覆盖逻辑无法确定。", recommendation: "通过同版本 SDK 和最小工程状态切换实验记录规范—实现关系。",
  }],
  evidence: [
    { id: "EVID-001", type: "target", source: globalDisable.source, locator: `${globalDisable.section}:${globalDisable.line}`, claim: globalDisable.quote, version: null, capturedAt: null, sha256: enableHash },
    { id: "EVID-002", type: "internal", source: appOnlyDisable.source, locator: `${appOnlyDisable.section}:${appOnlyDisable.line}`, claim: appOnlyDisable.quote, version: null, capturedAt: null, sha256: enableHash },
  ],
  pendingVerifications: [],
}
assert.ok(validateReport(report).valid, validateReport(report).errors.join("\n"))

const temp = await mkdtemp(join(tmpdir(), "immersive-validation-planning-e2e-"))
try {
  const reportOutput = join(temp, "review")
  const reportPaths = await renderReport(report, reportOutput)
  const reportRaw = await readFile(reportPaths.jsonPath, "utf8")
  const reportHash = createHash("sha256").update(reportRaw).digest("hex")
  const verify = (level, expectedResult) => ({
    level,
    objective: `${level} 层确认`,
    procedure: `在指定环境执行 ${level} 验证并保留原始输出。`,
    expectedResult,
    evidenceToCollect: `${level} 命令、版本、日志或画面证据。`,
  })
  const facts = [
    { id: "FACT-001", statement: "应用级 disable 会全局禁用，应用级或组件级开启均不生效。", role: "expected_behavior", consistencyStatus: "conflicting", reviewFindingRefs: ["DOC-001"], sourceRefs: [globalDisable], developmentValidationRequired: true, validationRationale: "与另一处关闭范围声明冲突，需裁决。" },
    { id: "FACT-002", statement: "应用级 disable 只针对应用级开启的组件。", role: "expected_behavior", consistencyStatus: "conflicting", reviewFindingRefs: ["DOC-001"], sourceRefs: [appOnlyDisable], developmentValidationRequired: true, validationRationale: "与全局禁用声明冲突，需裁决。" },
    { id: "FACT-003", statement: "entry module 的 metadata 可用 default、enable、disable 控制应用级状态。", role: "configuration", consistencyStatus: "consistent", reviewFindingRefs: [], sourceRefs: [applicationConfig], developmentValidationRequired: true, validationRationale: "需要 SDK、构建和状态读取验证。" },
    { id: "FACT-004", statement: "Material.empty 关闭组件效果，undefined 恢复组件默认效果。", role: "expected_behavior", consistencyStatus: "consistent", reviewFindingRefs: [], sourceRefs: [emptyVsUndefined], developmentValidationRequired: true, validationRationale: "需要运行时状态转换验证。" },
    { id: "FACT-005", statement: "Toast、Popup、Tips、Menu 和 Dialog 属于可接入沉浸光感的弹窗类组件。", role: "requirement", consistencyStatus: "consistent", reviewFindingRefs: [], sourceRefs: [overlayScope], developmentValidationRequired: true, validationRationale: "需要逐类确认接口、构建和视觉行为。" },
    { id: "FACT-006", statement: "Toast 主动设置 backgroundBlurStyle 或 backgroundColor 时不呈现沉浸光感。", role: "constraint", consistencyStatus: "consistent", reviewFindingRefs: [], sourceRefs: [toastOverride], developmentValidationRequired: true, validationRationale: "需要正反例视觉对照。" },
  ]
  const items = [
    {
      id: "DEVVAL-001", title: "核对 disable 冲突的 SDK 与配置前提", purpose: "normative_resolution", category: "document_conflict", factRefs: ["FACT-001", "FACT-002"], reviewFindingRefs: ["DOC-001"], environment: "minimal_project",
      preconditions: ["锁定与文档相同的 HarmonyOS SDK 版本。"], implementationSteps: ["创建仅含一个可观察材质组件的最小页面。", "分别准备应用级与组件级开启配置。"], negativeCases: ["保留未配置 metadata 的 DEFAULT 对照组。"],
      verifications: [verify("static", "配置键、值和组件调用均可定位。"), verify("sdk", "只记录 SDK 中实际存在的符号、字段和版本声明。"), verify("build", "各配置变体分别构建并保留独立日志；构建成功不裁决运行语义。")], dependencies: [], blocking: true, readiness: "ready", blockedBy: [], executionStatus: "not_run",
    },
    {
      id: "DEVVAL-002", title: "验证应用级 ENABLE 后切换 DISABLE 的真实作用域", purpose: "normative_resolution", category: "state_transition", factRefs: ["FACT-001", "FACT-002", "FACT-003"], reviewFindingRefs: ["DOC-001"], environment: "minimal_project",
      preconditions: ["DEVVAL-001 的所有配置变体均能构建。"], implementationSteps: ["先运行 ENABLE 变体并记录应用级默认开启与组件级显式开启的基线。", "切换为 DISABLE 后重新安装运行，分别观察两类组件。"], negativeCases: ["组件级显式开启是否仍被覆盖。", "DEFAULT 与未配置 metadata 是否一致。"],
      verifications: [verify("static", "ENABLE/DISABLE 变体除目标配置外保持一致。"), verify("sdk", "记录 getMaterialInfo 与 MaterialState 的 SDK 签名和版本。"), verify("build", "所有变体可独立构建。"), verify("device", "并列记录两条冲突文档预期与实际观察；实际不同应报告规范—实现偏差，不静默改写规范。")], dependencies: ["DEVVAL-001"], blocking: true, readiness: "ready", blockedBy: [], executionStatus: "not_run",
    },
    {
      id: "DEVVAL-003", title: "验证弹窗类组件沉浸光感接入矩阵", purpose: "integration_validation", category: "component_integration", factRefs: ["FACT-005", "FACT-006"], reviewFindingRefs: [], environment: "minimal_project",
      preconditions: ["disable 作用域冲突已经裁决。"], implementationSteps: ["为 Toast、Popup、Tips、Menu、Dialog 建立独立触发入口。", "按文档分别验证应用级默认行为与组件级 systemMaterial 配置。", "对 Toast 增加 backgroundColor/backgroundBlurStyle 互斥对照组。"], negativeCases: ["不透明背景覆盖材质。", "未设置组件级材质且应用级状态变化。"],
      verifications: [verify("static", "每类组件的 options、import 和触发上下文完整。"), verify("sdk", "逐项记录对应 options.systemMaterial 是否存在及版本。"), verify("build", "五类弹窗均进入同一可复现构建。"), verify("device", "逐类采集正例、互斥属性反例和材质视觉证据。")], dependencies: ["DEVVAL-002"], blocking: true, readiness: "blocked", blockedBy: ["review_gate"], executionStatus: "blocked",
    },
    {
      id: "DEVVAL-004", title: "验证组件级关闭与恢复默认", purpose: "integration_validation", category: "state_transition", factRefs: ["FACT-004"], reviewFindingRefs: [], environment: "minimal_project",
      preconditions: ["选择一个默认可呈现材质效果的组件。"], implementationSteps: ["记录默认状态。", "设置 Material.empty 后记录关闭状态。", "设置 undefined 后记录恢复状态。"], negativeCases: ["在应用级 DISABLE 下重复三态验证。"],
      verifications: [verify("static", "三态代码路径唯一且可追踪。"), verify("sdk", "记录 Material.empty 与 systemMaterial 类型。"), verify("build", "三态变体均可构建。"), verify("device", "比较默认、empty、undefined 的实际画面与状态日志。")], dependencies: ["DEVVAL-002"], blocking: true, readiness: "blocked", blockedBy: ["review_gate"], executionStatus: "blocked",
    },
  ]
  const checklist = {
    checklistVersion: "1.0", mode: "development-validation-planning",
    input: { kind: report.input.kind, value: report.input.value, feature: "沉浸光感", reviewReport: reportPaths.jsonPath, reviewReportSha256: reportHash },
    sourceIntegrity: report.sourceIntegrity, reviewGate: report.integrationGate,
    scope: { description: "验收 disable 冲突、应用级状态切换、弹窗类组件接入及组件级关闭/恢复。", targetProject: null, environments: ["minimal_project"], requestedFocus: ["弹窗类组件接入", "应用级开启后关闭"] },
    summary: { totalFacts: facts.length, developmentFacts: facts.length, checklistItems: items.length, readyItems: 2, blockedItems: 2 },
    coverage: { sourceUnits: facts.length, representedSourceUnits: facts.length, factsRequiringValidation: facts.length, factsCoveredByChecklist: facts.length, uncoveredFactRefs: [], exclusions: [] },
    engineeringFacts: facts, items, executionOrder: items.map((item) => item.id),
  }
  const validation = validateValidationChecklist(checklist)
  assert.ok(validation.valid, validation.errors.join("\n"))
  const checklistOutput = join(temp, "checklist")
  const paths = await renderValidationChecklist(checklist, checklistOutput)
  const markdown = await readFile(paths.markdownPath, "utf8")
  assert.match(markdown, /弹窗类组件沉浸光感接入矩阵/)
  assert.match(markdown, /ENABLE 后切换 DISABLE/)
  assert.match(markdown, /Toast、Popup、Tips、Menu、Dialog/)
  assert.match(markdown, /review_gate/)
  assert.equal(checklist.engineeringFacts.filter((fact) => fact.consistencyStatus === "conflicting").length, 2)
  assert.equal(checklist.items.filter((item) => item.purpose === "integration_validation").every((item) => item.executionStatus === "blocked"), true)
  process.stdout.write(`ok - immersive validation planning: ${facts.length} facts, ${items.length} items, gate=${checklist.reviewGate}\n`)
} finally {
  await rm(temp, { recursive: true, force: true })
}

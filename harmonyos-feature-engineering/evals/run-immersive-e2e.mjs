#!/usr/bin/env node

import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { prepareReview } from "../scripts/prepare-review.mjs"
import { renderReport } from "../scripts/render-report.mjs"
import { DIMENSIONS, validateReport } from "../scripts/validate-report.mjs"

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceDirectory = resolve(SKILL_DIR, "..", "沉浸光感")
const prepared = await prepareReview(sourceDirectory)
const byType = new Map(prepared.preflightCandidates.map((item) => [item.type, item]))
const required = [
  "potential-scope-conflict",
  "potential-material-color-conflict",
  "missing-import-context",
  "missing-variable-context",
  "unguarded-versioned-api-invocation",
  "navigation-only",
  "unresolved-media-reference",
  "unsnapshotted-official-references",
]
for (const type of required) assert.ok(byType.has(type), `缺少验收候选项 ${type}`)

const evidence = []
function addEvidence(location, claim, locatorOverride = null) {
  const id = `EVID-${String(evidence.length + 1).padStart(3, "0")}`
  const document = prepared.documents.find((item) => (item.sourcePath ?? item.canonicalUrl) === location.source)
  evidence.push({
    id,
    type: "target",
    source: location.source,
    locator: locatorOverride ?? `${location.section}${location.line ? `:${location.line}` : ""}`,
    claim,
    version: null,
    capturedAt: document?.capturedAt ?? null,
    sha256: document?.sha256 ?? null,
  })
  return id
}

function findingFromCandidate({ id, type, title, dimension, status, severity, confidence, integrationAffecting, coreTechnicalClaim, claimScope, claim, analysis, impact, recommendation, internalConflict = null }) {
  const candidate = byType.get(type)
  const locations = candidate.locations.length ? candidate.locations : [{
    source: prepared.input.manifestPath,
    section: "source-manifest.json",
    line: null,
    quote: candidate.message,
  }]
  const evidenceRefs = locations.map((location) => addEvidence(location, location.quote ?? candidate.message))
  const first = locations[0]
  return {
    id,
    title,
    dimension,
    status,
    severity,
    confidence,
    integrationAffecting,
    coreTechnicalClaim,
    claimScope,
    location: { ...first, quote: first.quote ?? candidate.message },
    claim,
    analysis,
    evidenceRefs,
    ...(internalConflict ? {
      internalConflict: {
        ...internalConflict,
        left: {
          ...internalConflict.left,
          evidenceRef: evidenceRefs[0],
          statement: locations[0].quote ?? candidate.message,
        },
        right: {
          ...internalConflict.right,
          evidenceRef: evidenceRefs[1],
          statement: locations[1].quote ?? candidate.message,
        },
      },
    } : {}),
    impact,
    recommendation,
  }
}

const findings = [
  findingFromCandidate({
    id: "DOC-001",
    type: "potential-scope-conflict",
    title: "disable 作用域存在直接冲突",
    dimension: "consistency",
    status: "confirmed",
    severity: "High",
    confidence: "certain",
    integrationAffecting: true,
    coreTechnicalClaim: true,
    claimScope: "internal_consistency",
    claim: "disable 是否同时使组件级开启失效。",
    analysis: "一处声明全局禁用并覆盖组件级开启，另一处声明只针对应用级开启；当前仅确认内部冲突，不判断技术真值。",
    internalConflict: {
      subject: "disable 对组件级开启的影响",
      left: {
        scope: { version: null, mode: "应用级开关为 disable", component: "组件级开启", condition: null, environment: null, lifecycle: null },
        outcome: "应用级和组件级开启均不生效",
      },
      right: {
        scope: { version: null, mode: "应用级开关为 disable", component: "组件级开启", condition: null, environment: null, lifecycle: null },
        outcome: "只影响应用级开启，组件级开启仍可生效",
      },
      incompatibility: "同一 disable 配置下，组件级开启不能同时生效和不生效。",
    },
    impact: "开发者可能选择相反的关闭或覆盖策略。",
    recommendation: "依据同版本 MaterialState/API 参考统一作用域和优先级。",
  }),
  findingFromCandidate({
    id: "DOC-002",
    type: "potential-material-color-conflict",
    title: "materialColor 透明度规则与示例冲突",
    dimension: "consistency",
    status: "confirmed",
    severity: "Medium",
    confidence: "certain",
    integrationAffecting: true,
    coreTechnicalClaim: true,
    claimScope: "internal_consistency",
    claim: "示例的 materialColor 是否遵守文中必须带透明度的约束。",
    analysis: "规则要求带透明度并说明不透明色会遮挡滤镜，但典型场景使用 6 位不透明十六进制颜色。这里只确认资料内部不一致。",
    internalConflict: {
      subject: "materialColor 透明度约束",
      left: {
        scope: { version: null, mode: "组件级材质配置", component: null, condition: "materialColor 用于沉浸光感材质颜色", environment: null, lifecycle: null },
        outcome: "materialColor 必须带透明度",
      },
      right: {
        scope: { version: null, mode: "组件级材质配置", component: null, condition: "materialColor 用于沉浸光感材质颜色", environment: null, lifecycle: null },
        outcome: "典型示例使用六位不透明颜色",
      },
      incompatibility: "同一 materialColor 约束下，示例不能既符合必须带透明度的要求又使用不透明色。",
    },
    impact: "复制示例可能得到与文档描述相反的视觉效果。",
    recommendation: "改用显式 alpha 色值，或说明该示例有意以纯色覆盖滤镜。",
  }),
  findingFromCandidate({
    id: "DOC-003",
    type: "missing-import-context",
    title: "示例缺少可复制的 import 上下文",
    dimension: "developer_usability",
    status: "editorial",
    severity: "Medium",
    confidence: "high",
    integrationAffecting: false,
    coreTechnicalClaim: false,
    claimScope: "editorial",
    claim: "典型场景代码可直接复制使用。",
    analysis: "代码块使用 uiMaterial，但没有在同一完整代码块中提供 import。",
    impact: "开发者复制后需要猜测依赖来源。",
    recommendation: "为每个独立完整示例补齐 import，或明确标记为片段并链接完整工程。",
  }),
  findingFromCandidate({
    id: "DOC-004",
    type: "missing-variable-context",
    title: "示例仅注释说明变量，未实际声明",
    dimension: "developer_usability",
    status: "editorial",
    severity: "Medium",
    confidence: "high",
    integrationAffecting: false,
    coreTechnicalClaim: false,
    claimScope: "editorial",
    claim: "listItems 和 ListItemData 的上下文足以复现实例。",
    analysis: "示例调用变量和类型，但只在注释中描述数据结构，没有可编译声明。",
    impact: "示例无法原样静态检查或构建。",
    recommendation: "补充 interface 与最小测试数据，或提供完整示例工程。",
  }),
  findingFromCandidate({
    id: "DOC-005",
    type: "navigation-only",
    title: "开发指导页没有可审查正文",
    dimension: "completeness",
    status: "editorial",
    severity: "Medium",
    confidence: "certain",
    integrationAffecting: false,
    coreTechnicalClaim: false,
    claimScope: "editorial",
    claim: "开发指导页本身提供开发说明。",
    analysis: "该快照主要是面包屑、来源和标题，无法承担开发指导职责。",
    impact: "读者必须自行寻找分散页面，入口页也无法独立验收。",
    recommendation: "提供章节索引、适用版本、前置条件和推荐阅读顺序。",
  }),
  findingFromCandidate({
    id: "DOC-006",
    type: "unresolved-media-reference",
    title: "站内媒体引用不可访问",
    dimension: "links_resources",
    status: "editorial",
    severity: "Medium",
    confidence: "certain",
    integrationAffecting: false,
    coreTechnicalClaim: false,
    claimScope: "editorial",
    claim: "资料集包含文中用于判断视觉结果的媒体。",
    analysis: "媒体使用不可解析的 https://media: 内部引用，当前快照不能展示。",
    impact: "视觉成功判据与错误示例无法复核。",
    recommendation: "快照化可访问媒体并记录来源、哈希和替代文本。",
  }),
  findingFromCandidate({
    id: "DOC-007",
    type: "unsnapshotted-official-references",
    title: "关键 API 参考未纳入证据快照",
    dimension: "technical_correctness",
    status: "pending",
    severity: "High",
    confidence: "certain",
    integrationAffecting: true,
    coreTechnicalClaim: true,
    claimScope: "external_technical",
    claim: "资料中的 API 行为和版本声明已得到独立官方证据支持。",
    analysis: "清单记录的官方关联页均未快照，无法独立确认 API 行为、版本和优先级。",
    impact: "现有资料不能作为唯一工程事实直接进入接入阶段。",
    recommendation: "按风险定向抓取同版本 API 参考，优先验证 MaterialState、ImmersiveOptions 和 systemMaterial。",
  }),
  findingFromCandidate({
    id: "DOC-008",
    type: "unguarded-versioned-api-invocation",
    title: "版本判断只保护参数，未保护 API 26 属性调用本身",
    dimension: "version_compatibility",
    status: "likely",
    severity: "High",
    confidence: "high",
    integrationAffecting: true,
    coreTechnicalClaim: true,
    claimScope: "external_technical",
    claim: "将 sdkApiVersion 三元判断放入 systemMaterial 参数即可保证低于 API 26 时不访问该高版本属性。",
    analysis: "低版本分支只把参数变为 undefined，systemMaterial 调用仍处于无条件组件属性链中。目标文档同时声明该属性在低版本不可用，因此该写法不能仅凭三元表达式视为兼容；具体失败阶段仍需 SDK、构建或低版本运行证据确认。",
    impact: "开发者可能在低版本设备上继续调用不存在的属性，造成构建、加载或运行失败，直接破坏兼容目标。",
    recommendation: "让版本控制流包围高版本 API 调用本身，并分别验证 compile/target/compatible 版本关系及低版本运行路径。",
  }),
]

const report = {
  reviewVersion: "1.1",
  mode: "document-review",
  input: prepared.input,
  sourceIntegrity: prepared.sourceIntegrity,
  verdict: { label: "不合格", score: null, summary: "资料内部存在影响接入的已确认高严重度冲突，且关键 API 独立证据尚未落地。" },
  integrationGate: "blocked",
  dimensions: DIMENSIONS.map(([id, name, weight]) => ({
    id,
    name,
    weight,
    score: ["technical_correctness", "version_compatibility"].includes(id) ? null : 70,
    notes: id === "technical_correctness" ? "缺少同版本独立 API 证据，暂不评分。" : "已执行内部质量检查。",
  })),
  findings,
  evidence,
  pendingVerifications: [{
    id: "PEND-001",
    claim: "disable 的真实作用域与组件级优先级",
    reason: "当前只能确认内部冲突，不能确认哪一处技术描述正确。",
    requiredEvidence: "HarmonyOS API 26 同版本 MaterialState/API 参考或 SDK 声明",
    priority: "high",
  }],
}

const validation = validateReport(report)
assert.ok(validation.valid, validation.errors.join("\n"))
assert.equal(report.findings.filter((item) => item.status === "confirmed").every((item) => item.claimScope === "internal_consistency"), true)
assert.equal(report.findings.some((item) => item.status === "confirmed" && item.claimScope === "external_technical"), false)

const output = await mkdtemp(join(tmpdir(), "immersive-review-e2e-"))
try {
  const paths = await renderReport(report, output)
  const markdown = await readFile(paths.markdownPath, "utf8")
  assert.match(markdown, /disable 作用域存在直接冲突/)
  assert.ok(markdown.indexOf("DOC-008") < markdown.indexOf("DOC-002"), "High 低版本 API 调用风险应排在 Medium 机制问题之前")
  assert.doesNotMatch(markdown, /关键工程问题（优先处理）|次要问题（不单独阻断接入）/)
  assert.match(await readFile(paths.jsonPath, "utf8"), /"integrationGate": "blocked"/)
} finally {
  await rm(output, { recursive: true, force: true })
}

process.stdout.write(`ok - immersive-light end-to-end: ${findings.length} findings, gate=${report.integrationGate}\n`)

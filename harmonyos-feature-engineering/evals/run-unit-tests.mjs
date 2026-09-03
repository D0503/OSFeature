#!/usr/bin/env node

import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseHtml, parseMarkdown } from "../scripts/lib/document-parser.mjs"
import { validateOfficialFinalUrl, validateOfficialPageUrl } from "../scripts/lib/official-url.mjs"
import { prepareReview } from "../scripts/prepare-review.mjs"
import { renderReport } from "../scripts/render-report.mjs"
import { snapshotOfficialUrl } from "../scripts/snapshot-url.mjs"
import { DIMENSIONS, deriveIntegrationGate, validateReport } from "../scripts/validate-report.mjs"

const EVAL_DIR = dirname(fileURLToPath(import.meta.url))
const SKILL_DIR = resolve(EVAL_DIR, "..")
const WORKSPACE = resolve(SKILL_DIR, "..")

function reportTemplate() {
  const evidence = [
    {
      id: "EVID-001",
      type: "target",
      source: "D:\\docs\\a.md",
      locator: "L10",
      claim: "第一处原文声明全局失效。",
      version: null,
      capturedAt: null,
      sha256: "a".repeat(64),
    },
    {
      id: "EVID-002",
      type: "internal",
      source: "D:\\docs\\a.md",
      locator: "L20",
      claim: "第二处原文声明仅影响应用级。",
      version: null,
      capturedAt: null,
      sha256: "a".repeat(64),
    },
  ]
  const findings = [
    {
      id: "DOC-001",
      title: "作用域描述冲突",
      dimension: "consistency",
      status: "confirmed",
      severity: "High",
      confidence: "certain",
      integrationAffecting: true,
      coreTechnicalClaim: true,
      claimScope: "internal_consistency",
      location: { source: "D:\\docs\\a.md", section: "关闭", line: 10, quote: "全局失效" },
      claim: "disable 的作用域在同一资料集中应保持一致。",
      analysis: "两处原文给出了互斥的作用域。",
      evidenceRefs: ["EVID-001", "EVID-002"],
      impact: "开发者无法判断组件级配置是否仍然生效。",
      recommendation: "依据同版本 API 参考统一作用域并补充优先级说明。",
    },
  ]
  return {
    reviewVersion: "1.0",
    mode: "document-review",
    input: { kind: "directory", value: "D:\\docs", reviewedSources: 2 },
    sourceIntegrity: { status: "verified", manifestUsed: true, items: [], warnings: [] },
    verdict: { label: "不合格", score: 90, summary: "存在影响接入的已确认高严重度内部冲突。" },
    integrationGate: "blocked",
    dimensions: DIMENSIONS.map(([id, name, weight]) => ({ id, name, weight, score: 90, notes: "已完成本维度检查。" })),
    findings,
    evidence,
    pendingVerifications: [],
  }
}

async function withTempDirectory(run) {
  const root = await mkdtemp(join(tmpdir(), "harmonyos-feature-review-"))
  try {
    return await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function run() {
  let assertions = 0
  const check = (condition, message) => {
    assert.ok(condition, message)
    assertions += 1
  }

  const parsedMd = parseMarkdown("# 标题\n\n```ts\nlet value = 1\n```\n\n[链接](https://developer.huawei.com/x)")
  check(parsedMd.title === "标题" && parsedMd.codeBlocks[0].language === "ts", "Markdown 标题和代码围栏解析")
  check(parsedMd.links[0].official === true, "Markdown 官方链接识别")
  const parsedHtml = parseHtml("<html><head><title>网页</title></head><body><h1>章节</h1><pre><code class='language-ts'>let a=1</code></pre></body></html>")
  check(parsedHtml.title === "网页" && parsedHtml.codeBlocks.length === 1, "HTML 标题和代码解析")

  check(validateOfficialPageUrl("https://developer.huawei.com/consumer/cn/doc/test#x").endsWith("/test"), "规范 URL 去除 fragment")
  assert.throws(() => validateOfficialPageUrl("http://developer.huawei.com/test"))
  assert.throws(() => validateOfficialPageUrl("https://developer.huawei.com.evil.example/test"))
  assert.throws(() => validateOfficialPageUrl("https://user@developer.huawei.com/test"))
  check(validateOfficialFinalUrl("https://sub.developer.huawei.com/path").includes("sub.developer.huawei.com"), "允许官方子域最终 URL")
  assert.throws(() => validateOfficialFinalUrl("https://example.com/redirect"))
  assertions += 4

  await withTempDirectory(async (root) => {
    const doc = join(root, "doc.md")
    await writeFile(doc, "# 页面\n\n> 原文：https://developer.huawei.com/consumer/cn/doc/example\n\n要求 API 26.0.0。\n\n```\nnew uiMaterial.ImmersiveMaterial({})\n```\n\n![](https://media:123)\n[坏链接](./none.md)\n", "utf8")
    const prepared = await prepareReview(doc)
    const types = new Set(prepared.preflightCandidates.map((item) => item.type))
    check(prepared.input.kind === "file" && prepared.documents.length === 1, "单文件输入")
    check(prepared.documents[0].versionStatements[0].versions.includes("26.0.0"), "抽取版本声明")
    check(prepared.documents[0].sourceMetadata.declaredSourceUrl?.includes("developer.huawei.com"), "抽取来源元数据")
    for (const type of ["unlabeled-code-fence", "missing-import-context", "unresolved-media-reference", "broken-relative-link"]) {
      check(types.has(type), `预检识别 ${type}`)
    }
  })

  await withTempDirectory(async (root) => {
    const rootUrl = "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/feature"
    const childUrl = `${rootUrl}-child`
    const apiUrl = "https://developer.huawei.com/consumer/cn/doc/harmonyos-references/feature-api"
    const fetched = {
      [rootUrl]: {
        status: "fetched",
        canonicalUrl: rootUrl,
        pageUrl: rootUrl,
        retrievedAt: "2026-09-03T00:00:00.000Z",
        updatedDate: "2026-09-01",
        retrievalMethod: "test-fixture",
        title: "特性入口",
        contentMarkdown: `# 特性入口\n\n[子页](${childUrl})\n[API](${apiUrl})\n![](https://media:123)`,
        contentText: "特性入口 子页 API",
        links: [
          { url: childUrl, text: "子页", official: true },
          { url: apiUrl, text: "API", official: true },
          { url: "https://example.com/third-party", text: "第三方", official: false },
        ],
        sections: [],
        codeBlocks: [],
        warnings: [],
      },
      [childUrl]: {
        status: "fetched",
        canonicalUrl: childUrl,
        pageUrl: childUrl,
        retrievedAt: "2026-09-03T00:00:01.000Z",
        updatedDate: null,
        retrievalMethod: "test-fixture",
        title: "特性子页",
        contentMarkdown: "# 特性子页\n\n要求 API 26.0.0。",
        contentText: "特性子页 要求 API 26.0.0。",
        links: [],
        sections: [],
        codeBlocks: [],
        warnings: [],
      },
    }
    const bundle = join(root, "source-snapshot")
    const snapshot = await snapshotOfficialUrl(rootUrl, {
      outputDirectory: bundle,
      maxPages: 3,
      fetcher: async (url) => fetched[url],
    })
    check(snapshot.documents.length === 2 && snapshot.temporary === false, "URL 入口和同前缀子页生成 Markdown 快照")
    check((await readFile(join(bundle, "feature.md"), "utf8")).includes("[子页](./feature-child.md)"), "已快照页面链接改写为本地相对链接")
    check(snapshot.manifest.summary.unsnapshottedOfficialReferences === 1, "API 参考保留为未快照证据引用")
    check(snapshot.manifest.summary.unresolvedMediaReferences === 1, "媒体引用写入快照清单")
    check((await readFile(join(bundle, "evidence", "fetch", "feature.json"), "utf8")).includes('"retrievalMethod": "test-fixture"'), "保存结构化抓取证据")
    const preparedSnapshot = await prepareReview(bundle)
    check(preparedSnapshot.sourceIntegrity.errors.length === 0 && preparedSnapshot.documents.length === 2, "生成的 URL 快照可直接进入目录审查")
    await assert.rejects(() => snapshotOfficialUrl(rootUrl, { outputDirectory: bundle, fetcher: async (url) => fetched[url] }))
    assertions += 1
  })

  await withTempDirectory(async (root) => {
    const first = join(root, "a.md")
    const second = join(root, "b.md")
    const a = "# A\n\ndisable 会全局禁用，应用级或组件级开启均不生效。\n"
    const b = "# B\n\ndisable 只针对应用级开启的组件。\n"
    await writeFile(first, a, "utf8")
    await writeFile(second, b, "utf8")
    const crypto = await import("node:crypto")
    const digest = (text) => crypto.createHash("sha256").update(text).digest("hex")
    await writeFile(join(root, "source-manifest.json"), JSON.stringify({
      capture: { capturedAt: null },
      snapshots: [
        { id: "a", localPath: "a.md", sha256: digest(a), officialUrl: "https://developer.huawei.com/a" },
        { id: "b", localPath: "b.md", sha256: digest(b), officialUrl: "https://developer.huawei.com/b" },
      ],
      officialReferences: [],
      mediaReferences: [],
    }), "utf8")
    const prepared = await prepareReview(root)
    check(prepared.sourceIntegrity.manifestUsed && prepared.sourceIntegrity.errors.length === 0, "快照目录自动读取内部索引并校验哈希")
    check(prepared.preflightCandidates.some((item) => item.type === "potential-scope-conflict"), "跨文档作用域冲突预检")
    await writeFile(second, `${b}变更`, "utf8")
    const changed = await prepareReview(root)
    check(changed.sourceIntegrity.status === "failed", "清单哈希变化导致源完整性失败")
  })

  const immersive = await prepareReview(join(WORKSPACE, "沉浸光感"))
  const immersiveTypes = new Set(immersive.preflightCandidates.map((item) => item.type))
  check(immersive.documents.length === 9, "沉浸光感按清单审查九个快照")
  check(immersive.sourceIntegrity.errors.length === 0, "沉浸光感快照哈希全部匹配")
  for (const type of [
    "potential-scope-conflict",
    "potential-material-color-conflict",
    "missing-import-context",
    "missing-variable-context",
    "navigation-only",
    "unresolved-media-reference",
    "unsnapshotted-official-references",
  ]) check(immersiveTypes.has(type), `沉浸光感验收识别 ${type}`)

  const valid = reportTemplate()
  check(validateReport(valid).valid, `有效报告通过校验: ${validateReport(valid).errors.join("; ")}`)
  check(deriveIntegrationGate(valid) === "blocked", "Blocker/接入 High 映射 blocked")

  const insufficient = structuredClone(valid)
  insufficient.findings[0] = {
    ...insufficient.findings[0],
    status: "pending",
    severity: "Medium",
    integrationAffecting: false,
    claimScope: "external_technical",
    evidenceRefs: ["EVID-001"],
  }
  insufficient.pendingVerifications = [{ id: "PEND-001", claim: "API 行为", reason: "缺少版本证据", requiredEvidence: "同版本 API 参考", priority: "high" }]
  insufficient.integrationGate = "insufficient_evidence"
  insufficient.verdict.label = "证据不足"
  check(validateReport(insufficient).valid, "证据不足报告及门禁通过校验")

  const warning = structuredClone(valid)
  warning.findings[0] = { ...warning.findings[0], status: "editorial", severity: "Medium", integrationAffecting: false, coreTechnicalClaim: false, claimScope: "editorial", evidenceRefs: ["EVID-001"] }
  warning.integrationGate = "pass_with_warnings"
  warning.verdict.label = "基本合格但需修改"
  check(validateReport(warning).valid, "非阻断 Medium 映射 pass_with_warnings")

  const pass = structuredClone(valid)
  pass.findings = []
  pass.integrationGate = "pass"
  pass.verdict.label = "合格"
  check(validateReport(pass).valid, "无警告且证据充分映射 pass")

  const invalidStatus = structuredClone(valid)
  invalidStatus.findings[0].status = "maybe"
  check(!validateReport(invalidStatus).valid, "拒绝未知 finding 状态")
  const wrongGate = structuredClone(valid)
  wrongGate.integrationGate = "pass"
  check(!validateReport(wrongGate).valid, "拒绝错误门禁映射")
  const externalWithoutEvidence = structuredClone(valid)
  externalWithoutEvidence.findings[0].claimScope = "external_technical"
  check(!validateReport(externalWithoutEvidence).valid, "confirmed 外部事实缺少独立证据时拒绝")
  const fakeCapture = structuredClone(valid)
  fakeCapture.evidence[0].capturedAt = "not-recorded"
  check(!validateReport(fakeCapture).valid, "未知抓取时间必须使用 null")

  for (const confidence of ["certain", "high", "medium", "low"]) {
    const variant = structuredClone(valid)
    variant.findings[0].confidence = confidence
    check(validateReport(variant).valid, `接受置信度枚举 ${confidence}`)
  }
  const labelForGate = (gate) => ({ blocked: "不合格", insufficient_evidence: "证据不足", pass_with_warnings: "基本合格但需修改", pass: "合格" })[gate]
  for (const status of ["confirmed", "likely", "ambiguous", "version_caveat", "editorial", "pending"]) {
    const variant = structuredClone(valid)
    variant.findings[0].status = status
    variant.integrationGate = deriveIntegrationGate(variant)
    variant.verdict.label = labelForGate(variant.integrationGate)
    check(validateReport(variant).valid, `接受 finding 状态枚举 ${status}`)
  }
  for (const severity of ["Blocker", "High", "Medium", "Low", "Suggestion"]) {
    const variant = structuredClone(valid)
    variant.findings[0].severity = severity
    variant.integrationGate = deriveIntegrationGate(variant)
    variant.verdict.label = labelForGate(variant.integrationGate)
    check(validateReport(variant).valid, `接受严重度枚举 ${severity}`)
  }
  for (const evidenceType of ["target", "internal", "official_api", "official_guide", "sdk", "build", "simulator", "device"]) {
    const variant = structuredClone(pass)
    variant.evidence[0].type = evidenceType
    check(validateReport(variant).valid, `接受证据类型枚举 ${evidenceType}`)
  }
  const likelyHigh = structuredClone(valid)
  likelyHigh.findings[0].status = "likely"
  check(validateReport(likelyHigh).valid && deriveIntegrationGate(likelyHigh) === "blocked", "接入相关 likely High 映射 blocked")
  const failedIntegrity = structuredClone(pass)
  failedIntegrity.sourceIntegrity.status = "failed"
  failedIntegrity.integrationGate = "insufficient_evidence"
  failedIntegrity.verdict.label = "证据不足"
  check(validateReport(failedIntegrity).valid, "源完整性失败映射 insufficient_evidence")
  const hintVerdict = structuredClone(warning)
  hintVerdict.verdict.label = "合格但有提示"
  check(validateReport(hintVerdict).valid, "pass_with_warnings 接受提示型 verdict")
  const confirmedExternal = structuredClone(valid)
  confirmedExternal.findings[0].claimScope = "external_technical"
  confirmedExternal.evidence.push({ id: "EVID-003", type: "official_api", source: "https://developer.huawei.com/api", locator: "MaterialState", claim: "同版本 API 行为", version: "API 26", capturedAt: null, sha256: null })
  confirmedExternal.findings[0].evidenceRefs.push("EVID-003")
  check(validateReport(confirmedExternal).valid, "同版本独立证据可支持 confirmed 外部技术结论")

  await withTempDirectory(async (root) => {
    const rendered = await renderReport(valid, root)
    check((await readFile(rendered.jsonPath, "utf8")).includes('"reviewVersion": "1.0"'), "生成 review-report.json")
    check((await readFile(rendered.markdownPath, "utf8")).includes("作用域描述冲突"), "从 JSON 渲染 review-report.md")
  })

  process.stdout.write(`ok - ${assertions} assertions\n`)
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})

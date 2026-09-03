#!/usr/bin/env node

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderValidationChecklist } from "../scripts/render-validation-checklist.mjs"
import { validateChecklistWithReview, validateValidationChecklist } from "../scripts/validate-validation-checklist.mjs"
import { DIMENSIONS } from "../scripts/validate-report.mjs"

function reviewTemplate(root) {
  const sourceIntegrity = { status: "verified", manifestUsed: true, items: [], warnings: [] }
  return {
    reviewVersion: "1.0",
    mode: "document-review",
    input: { kind: "directory", value: join(root, "docs"), reviewedSources: 1 },
    sourceIntegrity,
    verdict: { label: "不合格", score: 90, summary: "存在影响接入的已确认高严重度内部冲突。" },
    integrationGate: "blocked",
    dimensions: DIMENSIONS.map(([id, name, weight]) => ({ id, name, weight, score: 90, notes: "已检查。" })),
    findings: [{
      id: "DOC-001",
      title: "关闭作用域冲突",
      dimension: "consistency",
      status: "confirmed",
      severity: "High",
      confidence: "certain",
      integrationAffecting: true,
      coreTechnicalClaim: true,
      claimScope: "internal_consistency",
      location: { source: join(root, "docs", "a.md"), section: "关闭", line: 10, quote: "全局关闭" },
      claim: "关闭作用域应一致。",
      analysis: "两个原文位置互斥。",
      evidenceRefs: ["EVID-001", "EVID-002"],
      impact: "无法确定组件级行为。",
      recommendation: "通过同版本 SDK 与运行实验裁决。",
    }],
    evidence: [
      { id: "EVID-001", type: "target", source: join(root, "docs", "a.md"), locator: "L10", claim: "全局关闭", version: null, capturedAt: null, sha256: "a".repeat(64) },
      { id: "EVID-002", type: "internal", source: join(root, "docs", "a.md"), locator: "L20", claim: "只关闭应用级", version: null, capturedAt: null, sha256: "a".repeat(64) },
    ],
    pendingVerifications: [],
  }
}

function verification(level) {
  return {
    level,
    objective: `${level} 层验证`,
    procedure: `执行 ${level} 检查`,
    expectedResult: "按文档分别记录预期，不提前裁决。",
    evidenceToCollect: `${level} 证据`,
  }
}

function checklistTemplate(root, reportPath, reportHash, report) {
  const source = join(root, "docs", "a.md")
  return {
    checklistVersion: "1.0",
    mode: "development-validation-planning",
    input: {
      kind: report.input.kind,
      value: report.input.value,
      feature: "测试特性",
      reviewReport: reportPath,
      reviewReportSha256: reportHash,
    },
    sourceIntegrity: report.sourceIntegrity,
    reviewGate: report.integrationGate,
    scope: {
      description: "验证冲突裁决与弹窗组件接入。",
      targetProject: null,
      environments: ["minimal_project"],
      requestedFocus: ["关闭作用域", "弹窗组件"],
    },
    summary: { totalFacts: 3, developmentFacts: 3, checklistItems: 2, readyItems: 1, blockedItems: 1 },
    coverage: {
      sourceUnits: 4,
      representedSourceUnits: 3,
      factsRequiringValidation: 3,
      factsCoveredByChecklist: 3,
      uncoveredFactRefs: [],
      exclusions: [{ source, locator: "L1", unitCount: 1, reason: "面包屑导航不形成工程事实。" }],
    },
    engineeringFacts: [
      {
        id: "FACT-001", statement: "disable 会使应用级和组件级开启均失效。", role: "expected_behavior", consistencyStatus: "conflicting", reviewFindingRefs: ["DOC-001"],
        sourceRefs: [{ source, section: "关闭", line: 10, quote: "全局关闭", sha256: "a".repeat(64) }], developmentValidationRequired: true, validationRationale: "需要裁决关闭作用域。",
      },
      {
        id: "FACT-002", statement: "disable 只影响应用级开启。", role: "expected_behavior", consistencyStatus: "conflicting", reviewFindingRefs: ["DOC-001"],
        sourceRefs: [{ source, section: "关闭", line: 20, quote: "只关闭应用级", sha256: "a".repeat(64) }], developmentValidationRequired: true, validationRationale: "与另一处声明冲突。",
      },
      {
        id: "FACT-003", statement: "弹窗支持组件级沉浸光感。", role: "api_contract", consistencyStatus: "consistent", reviewFindingRefs: [],
        sourceRefs: [{ source, section: "弹窗", line: 30, quote: "弹窗支持组件级开启", sha256: "a".repeat(64) }], developmentValidationRequired: true, validationRationale: "需要确认 SDK 与运行视效。",
      },
    ],
    items: [
      {
        id: "DEVVAL-001", title: "裁决 disable 作用域", purpose: "normative_resolution", category: "document_conflict", factRefs: ["FACT-001", "FACT-002"], reviewFindingRefs: ["DOC-001"], environment: "minimal_project",
        preconditions: ["使用文档目标版本 SDK。"], implementationSteps: ["建立最小状态切换页面。"], negativeCases: ["组件级显式开启。"],
        verifications: [verification("static"), verification("sdk"), verification("build")], dependencies: [], blocking: true, readiness: "ready", blockedBy: [], executionStatus: "not_run",
      },
      {
        id: "DEVVAL-002", title: "验证弹窗组件接入", purpose: "integration_validation", category: "component_integration", factRefs: ["FACT-003"], reviewFindingRefs: [], environment: "minimal_project",
        preconditions: ["先完成关闭语义裁决。"], implementationSteps: ["为弹窗设置文档声明的材质字段。"], negativeCases: ["同时设置不透明背景。"],
        verifications: [verification("static"), verification("sdk"), verification("build"), verification("device")], dependencies: ["DEVVAL-001"], blocking: true, readiness: "blocked", blockedBy: ["review_gate"], executionStatus: "blocked",
      },
    ],
    executionOrder: ["DEVVAL-001", "DEVVAL-002"],
  }
}

const root = await mkdtemp(join(tmpdir(), "validation-planning-tests-"))
let assertions = 0
const check = (condition, message) => {
  assert.ok(condition, message)
  assertions += 1
}

try {
  const report = reviewTemplate(root)
  const reportPath = join(root, "review-report.json")
  const reportRaw = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(reportPath, reportRaw, "utf8")
  const reportHash = createHash("sha256").update(reportRaw).digest("hex")
  const valid = checklistTemplate(root, reportPath, reportHash, report)

  check(validateValidationChecklist(valid).valid, `有效清单通过结构校验: ${validateValidationChecklist(valid).errors.join("; ")}`)
  check((await validateChecklistWithReview(valid)).valid, "有效清单与审查报告一致")

  const uncovered = structuredClone(valid)
  uncovered.items[1].factRefs = ["FACT-001"]
  check(!validateValidationChecklist(uncovered).valid, "拒绝未覆盖的开发验证事实")

  const noRuntime = structuredClone(valid)
  noRuntime.items[1].verifications = noRuntime.items[1].verifications.filter((item) => item.level !== "device")
  check(!validateValidationChecklist(noRuntime).valid, "拒绝没有运行层的组件接入项")

  const bypassGate = structuredClone(valid)
  bypassGate.items[1].readiness = "ready"
  bypassGate.items[1].blockedBy = []
  bypassGate.items[1].executionStatus = "not_run"
  bypassGate.summary.readyItems = 2
  bypassGate.summary.blockedItems = 0
  check(!validateValidationChecklist(bypassGate).valid, "blocked 门禁不得放行普通接入项")

  const missingProject = structuredClone(valid)
  missingProject.scope.environments.push("target_project")
  missingProject.items[1].environment = "target_project"
  check(!validateValidationChecklist(missingProject).valid, "目标工程项缺路径时必须显式阻塞")

  const weakConflict = structuredClone(valid)
  weakConflict.items[0].factRefs = ["FACT-001"]
  check(!validateValidationChecklist(weakConflict).valid, "文档冲突项必须保留两个冲突事实位置")

  const wrongOrder = structuredClone(valid)
  wrongOrder.executionOrder.reverse()
  check(!validateValidationChecklist(wrongOrder).valid, "依赖项必须先于消费者")

  const falseResult = structuredClone(valid)
  falseResult.items[0].executionStatus = "passed"
  check(!validateValidationChecklist(falseResult).valid, "规划阶段不得伪造已通过结果")

  const wrongHash = structuredClone(valid)
  wrongHash.input.reviewReportSha256 = "b".repeat(64)
  check(!(await validateChecklistWithReview(wrongHash)).valid, "拒绝不匹配的审查报告哈希")

  const output = join(root, "output")
  const rendered = await renderValidationChecklist(valid, output)
  check((await readFile(rendered.jsonPath, "utf8")).includes('"checklistVersion": "1.0"'), "生成固定名称 JSON 清单")
  check((await readFile(rendered.markdownPath, "utf8")).includes("裁决 disable 作用域"), "从 JSON 渲染 Markdown 清单")
} finally {
  await rm(root, { recursive: true, force: true })
}

process.stdout.write(`ok - ${assertions} validation-planning assertions\n`)

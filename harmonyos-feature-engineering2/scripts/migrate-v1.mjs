#!/usr/bin/env node
// v1.5 能力包 → v2 一次性迁移：
// - scenarios.json：场景（含官网入口 sources + 判据骨架 + 冲突监测点）+ routes/safety/verification/projectSignals + entryPoints
// - sessions/latest：联网抓取全部入口页作初始上次审查快照；v1 事实转为初始判据集
// - registry.json

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fetchOfficialDocument, writeFrozenSnapshot } from "./lib/fetch-official.mjs"

const v1Root = resolve("D:\\HW\\OSFeatureSkill\\harmonyos-feature-engineering")
const v2Root = resolve("D:\\HW\\OSFeatureSkill\\harmonyos-feature-engineering2")
const v1Pkg = join(v1Root, "references\\capabilities\\immersive-light")
const v2Pkg = join(v2Root, "capabilities2\\immersive-light")
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"))

const factsData = await readJson(join(v1Pkg, "facts.json"))
const v1Scenarios = await readJson(join(v1Pkg, "scenarios.json"))
const profile = await readJson(join(v1Pkg, "profile.json"))
const lock = await readJson(join(v1Pkg, "capability-lock.json"))
const registryV1 = await readJson(join(v1Root, "references\\capabilities\\registry.json"))
const featureV1 = registryV1.features[0]

const TOPIC_LABELS = {
  version: "版本门槛", configuration: "配置契约", api: "API 契约", state: "状态语义", capability: "能力查询",
  navigation: "导航组件", overlay: "弹窗组件", control: "控件组件", "material-option": "材质参数",
  compatibility: "兼容适配", fallback: "回退", performance: "性能约束", diagnostic: "诊断排障", "code-example": "示例审计",
  "hds-version": "HDS 版本门槛", "hds-navigation": "HdsNavigation", "hds-tabs": "HdsTabs", "hds-material-params": "HDS 材质参数",
  "hds-material-type": "HDS MaterialType", "hds-material-level": "HDS MaterialLevel", "hds-adaptive-policy": "HDS 自适应策略",
  "hds-custom-policy": "HDS 自定义等级", "hds-device": "HDS 设备差异", "hds-code-example": "HDS 示例审计",
}
const topicFor = (fact) => `${TOPIC_LABELS[fact.category] ?? fact.category}（${fact.id}）`

// ---------- entryPoints / 初始判据 ----------
const entryPoints = lock.sourceDocuments.map((source) => ({ snapshotId: source.snapshotId, officialUrl: source.officialUrl, title: source.title }))
const entryIds = new Set(entryPoints.map((item) => item.snapshotId))
const initialCriteria = []
for (const fact of factsData.facts) {
  const primary = fact.sources[0]
  if (!entryIds.has(primary.snapshotId)) throw new Error(`事实 ${fact.id} 的来源 ${primary.snapshotId} 不在入口清单`)
  initialCriteria.push({
    id: fact.id,
    type: fact.category,
    topic: topicFor(fact),
    statement: fact.statement,
    snapshotId: primary.snapshotId,
    anchor: primary.anchor,
    status: "fresh",
    ...(fact.conflictGroup ? { conflictGroup: fact.conflictGroup } : {}),
  })
}

// ---------- scenarios v2 ----------
const factById = new Map(factsData.facts.map((fact) => [fact.id, fact]))
const scenariosV2 = v1Scenarios.scenarios.map((scenario) => {
  const sourceIds = [...new Set(scenario.factRefs.flatMap((id) => (factById.get(id)?.sources ?? []).map((source) => source.snapshotId)))]
  const conflictGroups = [...new Set(scenario.factRefs.map((id) => factById.get(id)?.conflictGroup).filter(Boolean))]
  const { id, displayName, route, intentPatterns, targets, implementation, staticRules, negativeCases, requiredChecks, expectedOutcomes } = scenario
  return {
    id, displayName, route,
    intentPatterns, targets,
    sources: sourceIds,
    criteriaSpec: {
      required: scenario.factRefs.map((factId) => ({ topic: topicFor(factById.get(factId)), hint: factById.get(factId).statement, mustResolve: true })),
      conflictProbes: conflictGroups.map((group) => ({ id: group, topic: group === "disable-scope" ? "应用级 disable 的作用范围（全局禁用 vs 只针对应用级开启）" : group, positions: sourceIds })),
    },
    expectedOutcomeTemplates: expectedOutcomes.map((outcome) => ({
      assertion: outcome.assertion,
      criteriaTopics: outcome.factRefs.map((factId) => topicFor(factById.get(factId))),
      ...(outcome.id.includes("-A") || outcome.id.includes("-B") ? { conflictAlternativeOf: "disable-scope" } : {}),
    })),
    implementation, staticRules, negativeCases, requiredChecks,
  }
})

const scenariosDocument = {
  schemaVersion: "2.0",
  featureId: "immersive-light",
  displayName: "沉浸光感",
  defaultRoute: profile.defaultRoute,
  routes: profile.routes,
  projectSignals: profile.projectSignals,
  safety: profile.safety,
  verification: profile.verification,
  entryPoints,
  scenarios: scenariosV2,
}
await mkdir(v2Pkg, { recursive: true })
await writeFile(join(v2Pkg, "scenarios.json"), `${JSON.stringify(scenariosDocument, null, 2)}\n`, "utf8")

const registry = {
  registryVersion: "2.0",
  features: [{
    id: featureV1.id,
    displayName: featureV1.displayName,
    aliases: featureV1.aliases,
    status: "ready",
    readinessMeaning: "v2 能力包：只登记场景、官网入口与判据骨架；判据每次开发时从冻结的现网快照现提，包内 sessions/latest 仅是上次审查的对照缓存。",
    scenarios: "capabilities2/immersive-light/scenarios.json",
  }],
}
await writeFile(join(v2Root, "capabilities2", "registry.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8")

// ---------- 初始 latest：联网抓取全部入口 ----------
const pages = []
const failures = []
for (const entry of entryPoints) {
  const fetched = await fetchOfficialDocument(entry.officialUrl)
  if (!fetched.ok || !fetched.contentSha256) { failures.push({ snapshotId: entry.snapshotId, detail: fetched.detail }); continue }
  pages.push({ snapshotId: entry.snapshotId, officialUrl: entry.officialUrl, contentSha256: fetched.contentSha256, contentMarkdown: fetched.contentMarkdown, title: fetched.title ?? entry.title, updatedDate: fetched.updatedDate })
}
if (failures.length) throw new Error(`入口抓取失败，迁移中止：${JSON.stringify(failures)}`)

const latestRoot = join(v2Pkg, "sessions\\latest")
await mkdir(join(latestRoot, "snapshots"), { recursive: true })
const frozen = await writeFrozenSnapshot(latestRoot, pages)
const session = {
  archivedAt: new Date().toISOString(),
  frozenAt: frozen.frozenAt,
  snapshots: frozen.snapshots,
  criteria: initialCriteria,
  conflictResolutions: [{ probeId: "disable-scope", verdict: "persists", basis: "v1.5 审查：enable 页同时存在『全局禁用，应用级或组件级开启均不生效』与『只针对应用级开启的组件』两种表述，尚未真机裁决。" }],
  confirmations: [],
}
await writeFile(join(latestRoot, "session.json"), `${JSON.stringify(session, null, 2)}\n`, "utf8")
console.log(JSON.stringify({ status: "migrated", scenarios: scenariosV2.length, entryPoints: entryPoints.length, initialCriteria: initialCriteria.length, frozenSnapshots: pages.length }, null, 2))

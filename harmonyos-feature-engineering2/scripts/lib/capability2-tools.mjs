import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve, relative } from "node:path"

export const CHECK_LEVELS = new Set(["static", "sdk", "build", "install", "runtime", "visual"])
export const LAYER_STATUSES = new Set(["passed", "failed", "blocked", "not_run", "inconclusive"])
export const VERDICTS = new Set(["passed", "passed_with_spec_conflict", "build_passed_runtime_pending", "inconclusive", "failed", "blocked"])
export const ASSET_ORIGINS = new Set(["official-exact", "mechanical-adaptation", "derived-implementation", "test-harness", "corrected-variant"])

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex")
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    throw new Error(`无法读取 ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function safeChild(root, value, label = "path") {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("..")) {
    throw new Error(`${label} 必须是能力包内的安全相对路径: ${value}`)
  }
  const absolute = resolve(root, value)
  const rel = relative(root, absolute)
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`${label} 越出能力包根目录: ${value}`)
  return absolute
}

function validateOfficialUrl(value, label, errors) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.hostname !== "developer.huawei.com") errors.push(`${label} 必须是华为开发者官网 HTTPS 页面`)
  } catch {
    errors.push(`${label} 无效`)
  }
}

function validateScenariosDocument(scenariosData, errors) {
  if (scenariosData?.schemaVersion !== "2.0") errors.push("scenarios.schemaVersion 必须为 2.0")
  if (!nonEmptyString(scenariosData?.featureId)) errors.push("scenarios.featureId 必填")
  const routeIds = new Set((scenariosData?.routes ?? []).map((route) => route?.id).filter(Boolean))
  if (!routeIds.has(scenariosData?.defaultRoute)) errors.push("scenarios.defaultRoute 必须引用已注册路线")

  const entryIds = new Set()
  for (const [index, entry] of (scenariosData?.entryPoints ?? []).entries()) {
    const label = `entryPoints[${index}]`
    if (!nonEmptyString(entry?.snapshotId)) { errors.push(`${label}.snapshotId 必填`); continue }
    if (entryIds.has(entry.snapshotId)) errors.push(`${label}.snapshotId 重复`)
    entryIds.add(entry.snapshotId)
    if (!nonEmptyString(entry?.officialUrl)) errors.push(`${label}.officialUrl 必填`)
    else validateOfficialUrl(entry.officialUrl, `${label}.officialUrl`, errors)
    if (!nonEmptyString(entry?.title)) errors.push(`${label}.title 必填`)
  }
  if (!entryIds.size) errors.push("entryPoints 必须是非空数组")

  const probeIds = new Set()
  const scenarioIds = new Set()
  for (const [index, scenario] of (scenariosData?.scenarios ?? []).entries()) {
    const label = `scenarios[${index}]`
    if (!/^IL-S\d{3,}$/.test(scenario?.id ?? "")) errors.push(`${label}.id 格式无效`)
    else if (scenarioIds.has(scenario.id)) errors.push(`${label}.id 重复`)
    else scenarioIds.add(scenario.id)
    if (!nonEmptyString(scenario?.displayName)) errors.push(`${label}.displayName 必填`)
    if (!routeIds.has(scenario?.route)) errors.push(`${label}.route 未注册`)
    if (!Array.isArray(scenario?.intentPatterns) || !scenario.intentPatterns.length) errors.push(`${label}.intentPatterns 必须是非空数组`)
    if (!Array.isArray(scenario?.sources) || !scenario.sources.length) errors.push(`${label}.sources（官网入口）必须是非空数组`)
    else for (const id of scenario.sources) if (!entryIds.has(id)) errors.push(`${label}.sources 引用未登记入口 ${id}`)
    const required = scenario?.criteriaSpec?.required
    if (!Array.isArray(required) || !required.length) errors.push(`${label}.criteriaSpec.required 必须是非空数组`)
    else for (const [topicIndex, topic] of required.entries()) {
      if (!nonEmptyString(topic?.topic)) errors.push(`${label}.criteriaSpec.required[${topicIndex}].topic 必填`)
    }
    for (const [probeIndex, probe] of (scenario?.criteriaSpec?.conflictProbes ?? []).entries()) {
      if (!nonEmptyString(probe?.id)) errors.push(`${label}.conflictProbes[${probeIndex}].id 必填`)
      else if (probeIds.has(probe.id)) errors.push(`${label}.conflictProbes[${probeIndex}].id 重复`)
      else probeIds.add(probe.id)
    }
    if (!Array.isArray(scenario?.staticRules) || !scenario.staticRules.length) errors.push(`${label}.staticRules 必须是非空数组`)
    if (!Array.isArray(scenario?.requiredChecks) || !scenario.requiredChecks.includes("static") || !scenario.requiredChecks.includes("build")) errors.push(`${label} 必须包含 static 与 build`)
    else for (const level of scenario.requiredChecks) if (!CHECK_LEVELS.has(level)) errors.push(`${label}.requiredChecks 包含无效层 ${level}`)
    if (!Array.isArray(scenario?.expectedOutcomeTemplates) || !scenario.expectedOutcomeTemplates.length) errors.push(`${label}.expectedOutcomeTemplates 必须是非空数组`)
    for (const [assetIndex, asset] of (scenario?.implementation?.assets ?? []).entries()) {
      const assetLabel = `${label}.implementation.assets[${assetIndex}]`
      if (typeof asset === "string") { errors.push(`${assetLabel} 必须是对象（path + origin 来源分类）`); continue }
      if (!nonEmptyString(asset?.path)) errors.push(`${assetLabel}.path 必填`)
      if (!ASSET_ORIGINS.has(asset?.origin)) errors.push(`${assetLabel}.origin 必须是 ${[...ASSET_ORIGINS].join("/")}`)
      if ((asset?.origin === "official-exact" || asset?.origin === "mechanical-adaptation") && (!nonEmptyString(asset?.sourceSnapshotId) || !entryIds.has(asset.sourceSnapshotId) || !nonEmptyString(asset?.anchor))) {
        errors.push(`${assetLabel} 来源分类 ${asset.origin} 必须提供入口 sourceSnapshotId 与官网代码锚点 anchor`)
      }
      if (asset?.origin === "corrected-variant" && !nonEmptyString(asset?.adaptationNotes)) errors.push(`${assetLabel} 来源分类 corrected-variant 必须提供 adaptationNotes`)
    }
  }
  return { routeIds, entryIds, probeIds }
}

async function validateSessionDocument(session, packageRoot, entryIds, errors) {
  const sessionPath = "sessions/latest/session.json"
  if (!Array.isArray(session?.snapshots) || !session.snapshots.length) { errors.push(`${sessionPath}.snapshots 必须是非空数组`); return }
  for (const [index, snapshot] of session.snapshots.entries()) {
    const label = `${sessionPath}.snapshots[${index}]`
    if (!nonEmptyString(snapshot?.snapshotId) || !entryIds.has(snapshot.snapshotId)) { errors.push(`${label}.snapshotId 无效`); continue }
    if (!nonEmptyString(snapshot?.officialUrl)) errors.push(`${label}.officialUrl 必填`)
    if (!/^[a-f0-9]{64}$/i.test(snapshot?.contentSha256 ?? "")) errors.push(`${label}.contentSha256 必须是 SHA-256`)
    const bodyPath = safeChild(packageRoot, `sessions/latest/snapshots/${snapshot.snapshotId}.md`, `${label} 正文`)
    if (!(await exists(bodyPath))) errors.push(`${label} 缺少快照正文文件`)
    else if ((await sha256File(bodyPath)).toLowerCase() !== String(snapshot.contentSha256).toLowerCase()) errors.push(`${label} 快照正文哈希与登记不一致`)
  }
  const knownSnapshots = new Set(session.snapshots.map((item) => item.snapshotId))
  const criteriaIds = new Set()
  for (const [index, criterion] of (session?.criteria ?? []).entries()) {
    const label = `${sessionPath}.criteria[${index}]`
    if (!nonEmptyString(criterion?.id)) { errors.push(`${label}.id 必填`); continue }
    if (criteriaIds.has(criterion.id)) errors.push(`${label}.id 重复`)
    criteriaIds.add(criterion.id)
    if (!nonEmptyString(criterion?.type)) errors.push(`${label}.type 必填`)
    if (!nonEmptyString(criterion?.statement)) errors.push(`${label}.statement 必填`)
    if (!knownSnapshots.has(criterion?.snapshotId)) errors.push(`${label}.snapshotId 不在上次快照集内`)
    if (!nonEmptyString(criterion?.anchor)) errors.push(`${label}.anchor 必填`)
    if (!["fresh", "reused"].includes(criterion?.status)) errors.push(`${label}.status 必须是 fresh 或 reused`)
  }
  for (const [index, resolution] of (session?.conflictResolutions ?? []).entries()) {
    const label = `${sessionPath}.conflictResolutions[${index}]`
    if (!nonEmptyString(resolution?.probeId)) errors.push(`${label}.probeId 必填`)
    if (!["persists", "resolved", "changed"].includes(resolution?.verdict)) errors.push(`${label}.verdict 必须是 persists/resolved/changed`)
    if (!nonEmptyString(resolution?.basis)) errors.push(`${label}.basis 必填`)
  }
}

export async function loadCapability2(skillRoot, featureQuery = "immersive-light") {
  const root = resolve(skillRoot)
  const registryPath = join(root, "capabilities2", "registry.json")
  const registry = await readJson(registryPath, "能力注册表")
  const query = String(featureQuery).trim().toLocaleLowerCase()
  const feature = registry.features.find((item) =>
    item.id.toLocaleLowerCase() === query ||
    item.displayName.toLocaleLowerCase() === query ||
    (item.aliases ?? []).some((alias) => alias.toLocaleLowerCase() === query),
  )
  if (!feature) throw new Error(`未注册能力: ${featureQuery}`)
  if (feature.status !== "ready") throw new Error(`能力包未就绪: ${feature.id}`)

  const packageRoot = dirname(resolve(root, feature.scenarios))
  const scenariosData = await readJson(resolve(root, feature.scenarios), "scenarios")
  const errors = []
  const { entryIds } = validateScenariosDocument(scenariosData, errors)
  if (await exists(join(packageRoot, "sessions", "latest", "session.json"))) {
    const session = await readJson(join(packageRoot, "sessions", "latest", "session.json"), "sessions/latest")
    await validateSessionDocument(session, packageRoot, entryIds, errors)
    if (errors.length) throw new Error(errors.join("; "))
    return { root, feature, packageRoot, scenariosData, session }
  }
  if (errors.length) throw new Error(errors.join("; "))
  return { root, feature, packageRoot, scenariosData, session: null }
}

export function resolveScenario2(capability, goal, target = "") {
  const text = `${goal ?? ""} ${target ?? ""}`.trim().toLocaleLowerCase()
  if (!text) return { status: "needs_input", selected: null, candidates: [], reason: "缺少自然语言开发目标" }
  const ranked = capability.scenariosData.scenarios.map((scenario) => {
    const matches = []
    let score = 0
    for (const pattern of scenario.intentPatterns) {
      if (text.includes(pattern.toLocaleLowerCase())) {
        matches.push(pattern)
        score += pattern.length >= 5 ? 3 : pattern.length >= 2 ? 2 : 1
      }
    }
    for (const component of scenario.targets ?? []) {
      if (text.includes(component.toLocaleLowerCase())) {
        matches.push(component)
        score += 4
      }
    }
    if (text.includes(scenario.displayName.toLocaleLowerCase())) score += 8
    return { id: scenario.id, displayName: scenario.displayName, route: scenario.route, score, matches: [...new Set(matches)], scenario }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  if (!ranked.length) {
    return {
      status: "unmatched", selected: null,
      candidates: capability.scenariosData.scenarios.map((item) => ({ id: item.id, displayName: item.displayName, score: 0, matches: [] })),
      reason: "开发目标未唯一命中已发布场景",
    }
  }
  const topScore = ranked[0].score
  const top = ranked.filter((item) => item.score === topScore)
  if (top.length !== 1) {
    return { status: "ambiguous", selected: null, candidates: top.map(({ scenario, ...item }) => item), reason: "多个场景得分相同，需要用户选择" }
  }
  const { scenario, ...selectedSummary } = top[0]
  return { status: "resolved", selected: scenario, selectedSummary, candidates: ranked.slice(1, 4).map(({ scenario: ignored, ...item }) => item), reason: "唯一最高分场景" }
}

export function capabilityRoute2(capability, routeId) {
  const id = routeId ?? capability.scenariosData.defaultRoute
  const route = capability.scenariosData.routes.find((item) => item.id === id)
  if (!route) throw new Error(`能力包未注册技术路线: ${id}`)
  return route
}

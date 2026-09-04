import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"

export const CHECK_LEVELS = new Set(["static", "sdk", "build", "install", "runtime", "visual"])
export const LAYER_STATUSES = new Set(["passed", "failed", "blocked", "not_run", "inconclusive"])
export const VERDICTS = new Set([
  "passed", "passed_with_spec_conflict", "build_passed_runtime_pending",
  "inconclusive", "failed", "blocked",
])

export async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex")
}

export function packageDigest(files) {
  const canonical = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => `${item.path}\0${item.sha256}\n`)
    .join("")
  return createHash("sha256").update(canonical).digest("hex")
}

export function safeChild(root, value, label = "path") {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("..")) {
    throw new Error(`${label} 必须是能力包内的安全相对路径: ${value}`)
  }
  const absolute = resolve(root, value)
  const rel = relative(root, absolute)
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`${label} 越出能力包根目录: ${value}`)
  return absolute
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

function validateRegistry(registry, errors) {
  if (registry?.registryVersion !== "1.0") errors.push("registryVersion 必须为 1.0")
  if (!Array.isArray(registry?.features) || registry.features.length === 0) {
    errors.push("registry.features 必须是非空数组")
    return
  }
  const ids = new Set()
  for (const [index, feature] of registry.features.entries()) {
    const path = `features[${index}]`
    if (!nonEmptyString(feature?.id)) errors.push(`${path}.id 必须是非空字符串`)
    else if (ids.has(feature.id)) errors.push(`${path}.id 重复`)
    else ids.add(feature.id)
    if (!nonEmptyString(feature?.displayName)) errors.push(`${path}.displayName 必须是非空字符串`)
    if (!Array.isArray(feature?.aliases) || feature.aliases.some((item) => !nonEmptyString(item))) errors.push(`${path}.aliases 必须是字符串数组`)
    if (feature?.status !== "ready") errors.push(`${path}.status 首版必须为 ready`)
    for (const field of ["entry", "profile", "facts", "scenarios", "lock"]) {
      if (!nonEmptyString(feature?.[field])) errors.push(`${path}.${field} 必须是非空字符串`)
    }
  }
}

function validateProfile(profile, feature, errors) {
  if (profile?.schemaVersion !== "1.1") errors.push("profile.schemaVersion 必须为 1.1")
  if (profile?.featureId !== feature.id) errors.push("profile.featureId 与注册表不一致")
  if (profile?.packageVersion !== feature.packageVersion) errors.push("profile.packageVersion 与注册表不一致")
  if (!Array.isArray(profile?.routes) || profile.routes.length === 0) errors.push("profile.routes 必须是非空数组")
  const routeIds = new Set()
  for (const [index, route] of (profile?.routes ?? []).entries()) {
    const path = `profile.routes[${index}]`
    if (!nonEmptyString(route?.id)) errors.push(`${path}.id 必须是非空字符串`)
    else if (routeIds.has(route.id)) errors.push(`${path}.id 重复`)
    else routeIds.add(route.id)
    if (route?.status !== "ready") errors.push(`${path}.status 必须为 ready`)
    if (!nonEmptyString(route?.displayName)) errors.push(`${path}.displayName 必须是非空字符串`)
    const requirements = route?.projectRequirements
    if (requirements?.model !== "stage") errors.push(`${path} 必须要求 Stage 模型`)
    if (!Number.isInteger(requirements?.minCompileApi) || requirements.minCompileApi < 1) errors.push(`${path}.projectRequirements.minCompileApi 无效`)
    if (!Number.isInteger(requirements?.minTargetApi) || requirements.minTargetApi < 1) errors.push(`${path}.projectRequirements.minTargetApi 无效`)
    if (requirements?.minCompatibleApi !== null && requirements?.minCompatibleApi !== undefined && (!Number.isInteger(requirements.minCompatibleApi) || requirements.minCompatibleApi < 1)) {
      errors.push(`${path}.projectRequirements.minCompatibleApi 无效`)
    }
    if (!Array.isArray(route?.sdk?.requiredDeclarationGlobs) || route.sdk.requiredDeclarationGlobs.length === 0) errors.push(`${path}.sdk.requiredDeclarationGlobs 必须是非空数组`)
    if (!Array.isArray(route?.sdk?.requiredSymbols) || route.sdk.requiredSymbols.length === 0) errors.push(`${path}.sdk.requiredSymbols 必须是非空数组`)
    if (!route?.supportedTargets || typeof route.supportedTargets !== "object") errors.push(`${path}.supportedTargets 必须是对象`)
  }
  if (!routeIds.has("arkui-api26")) errors.push("profile 必须包含 arkui-api26 路线")
  if (!routeIds.has("hds-api23")) errors.push("profile 必须包含 hds-api23 路线")
  if (!routeIds.has(profile?.defaultRoute)) errors.push("profile.defaultRoute 必须引用已注册路线")
  const arkui = (profile?.routes ?? []).find((item) => item.id === "arkui-api26")
  if (arkui?.projectRequirements?.minCompileApi !== 26 || arkui?.projectRequirements?.minTargetApi !== 26 || !arkui?.projectRequirements?.applicationMetadataModuleTypes?.includes("entry")) {
    errors.push("arkui-api26 必须要求 compile/target API 26，应用级配置限制为 entry module")
  }
  const hds = (profile?.routes ?? []).find((item) => item.id === "hds-api23")
  if (hds?.projectRequirements?.minCompileApi !== 23 || hds?.projectRequirements?.minTargetApi !== 23 || hds?.projectRequirements?.minCompatibleApi !== 23) {
    errors.push("hds-api23 首个发布版本必须限制 compile/target/compatible API 23 或以上")
  }
  if (profile?.safety?.maxDirectedRepairRounds !== 2) errors.push("定向修复轮数必须为 2")
  if (profile?.safety?.automaticRollback !== false || profile?.safety?.automaticUninstall !== false || profile?.safety?.automaticEmulatorDownload !== false) {
    errors.push("安全策略不得开启自动回滚、卸载或模拟器下载")
  }
  const statuses = new Set(profile?.verification?.layerStatuses ?? [])
  for (const value of LAYER_STATUSES) if (!statuses.has(value)) errors.push(`profile 缺少层状态 ${value}`)
  const verdicts = new Set(profile?.verification?.verdicts ?? [])
  for (const value of VERDICTS) if (!verdicts.has(value)) errors.push(`profile 缺少总结果 ${value}`)
  return { routeIds }
}

function validateFacts(factsData, feature, routeState, defaultRoute, errors) {
  if (factsData?.schemaVersion !== "1.0" || factsData?.featureId !== feature.id) errors.push("facts 根契约无效")
  const facts = Array.isArray(factsData?.facts) ? factsData.facts : []
  if (!facts.length) errors.push("facts 必须是非空数组")
  const ids = new Set()
  const routeByFact = new Map()
  const conflictGroups = new Map()
  for (const [index, fact] of facts.entries()) {
    const path = `facts[${index}]`
    if (!/^IL-F\d{3,}$/.test(fact?.id ?? "")) errors.push(`${path}.id 格式无效`)
    else if (ids.has(fact.id)) errors.push(`${path}.id 重复`)
    else ids.add(fact.id)
    const factRoute = fact?.route ?? defaultRoute
    if (!routeState.routeIds.has(factRoute)) errors.push(`${path}.route 未注册`)
    else if (nonEmptyString(fact?.id)) routeByFact.set(fact.id, factRoute)
    if (!nonEmptyString(fact?.statement)) errors.push(`${path}.statement 必须是非空字符串`)
    if (!["clear", "conflicting", "ambiguous"].includes(fact?.normativeStatus)) errors.push(`${path}.normativeStatus 无效`)
    if (!Array.isArray(fact?.sources) || fact.sources.length === 0) errors.push(`${path}.sources 必须是非空数组`)
    else for (const [sourceIndex, source] of fact.sources.entries()) {
      if (!nonEmptyString(source?.snapshotId) || !nonEmptyString(source?.locator) || !/^[a-f0-9]{64}$/i.test(source?.sha256 ?? "")) {
        errors.push(`${path}.sources[${sourceIndex}] 无效`)
      }
    }
    if (!Array.isArray(fact?.validationKinds) || fact.validationKinds.some((item) => !CHECK_LEVELS.has(item))) errors.push(`${path}.validationKinds 无效`)
    if (fact?.normativeStatus === "conflicting") {
      if (!nonEmptyString(fact.conflictGroup)) errors.push(`${path}.conflictGroup 必须存在`)
      else conflictGroups.set(fact.conflictGroup, [...(conflictGroups.get(fact.conflictGroup) ?? []), fact.id])
    }
  }
  for (const [group, members] of conflictGroups) if (members.length < 2) errors.push(`冲突组 ${group} 至少需要两个事实`)
  if (!conflictGroups.has("disable-scope") || conflictGroups.get("disable-scope").length !== 2) errors.push("必须原样保留 disable-scope 的两条冲突事实")
  return { ids, routeByFact, conflictGroups }
}

function validateScenarios(scenariosData, feature, factState, routeState, errors) {
  if (scenariosData?.schemaVersion !== "1.0" || scenariosData?.featureId !== feature.id) errors.push("scenarios 根契约无效")
  const scenarios = Array.isArray(scenariosData?.scenarios) ? scenariosData.scenarios : []
  if (!scenarios.length) errors.push("scenarios 必须是非空数组")
  const ids = new Set()
  const coveredFacts = new Set()
  for (const [index, scenario] of scenarios.entries()) {
    const path = `scenarios[${index}]`
    if (!/^IL-S\d{3,}$/.test(scenario?.id ?? "")) errors.push(`${path}.id 格式无效`)
    else if (ids.has(scenario.id)) errors.push(`${path}.id 重复`)
    else ids.add(scenario.id)
    if (!nonEmptyString(scenario?.displayName)) errors.push(`${path}.displayName 必须是非空字符串`)
    if (!routeState.routeIds.has(scenario?.route)) errors.push(`${path}.route 未注册`)
    if (!Array.isArray(scenario?.intentPatterns) || !scenario.intentPatterns.length) errors.push(`${path}.intentPatterns 必须是非空数组`)
    if (!Array.isArray(scenario?.factRefs) || !scenario.factRefs.length) errors.push(`${path}.factRefs 必须是非空数组`)
    else for (const id of scenario.factRefs) {
      if (!factState.ids.has(id)) errors.push(`${path}.factRefs 引用了不存在的 ${id}`)
      else if (factState.routeByFact.get(id) !== scenario.route) errors.push(`${path}.factRefs 引用了其他路线的 ${id}`)
      coveredFacts.add(id)
    }
    if (!Array.isArray(scenario?.requiredChecks) || !scenario.requiredChecks.includes("static") || !scenario.requiredChecks.includes("build")) errors.push(`${path} 必须包含 static 与 build`)
    else for (const level of scenario.requiredChecks) if (!CHECK_LEVELS.has(level)) errors.push(`${path}.requiredChecks 包含无效层 ${level}`)
    if (!["all", "alternatives"].includes(scenario?.expectationMode)) errors.push(`${path}.expectationMode 无效`)
    if (!Array.isArray(scenario?.expectedOutcomes) || !scenario.expectedOutcomes.length) errors.push(`${path}.expectedOutcomes 必须是非空数组`)
    if (!Array.isArray(scenario?.staticRules) || !scenario.staticRules.length) errors.push(`${path}.staticRules 必须是非空数组`)
    const conflictingRefs = (scenario?.factRefs ?? []).filter((id) => [...factState.conflictGroups.values()].flat().includes(id))
    if (conflictingRefs.length) {
      if (scenario.expectationMode !== "alternatives") errors.push(`${path} 引用冲突事实时必须使用 alternatives`)
      const outcomeRefs = new Set((scenario.expectedOutcomes ?? []).flatMap((item) => item.factRefs ?? []))
      for (const id of conflictingRefs) if (!outcomeRefs.has(id)) errors.push(`${path} 未为冲突事实 ${id} 提供独立预期`)
    }
  }
  for (const id of factState.ids) if (!coveredFacts.has(id)) errors.push(`事实 ${id} 未被任何场景覆盖`)
  return { ids }
}

function validateSourceTraceability(factsData, lock, errors) {
  const lockedSources = new Map()
  for (const [index, source] of (lock?.sourceDocuments ?? []).entries()) {
    const path = `sourceDocuments[${index}]`
    if (!nonEmptyString(source?.snapshotId) || !/^[a-f0-9]{64}$/i.test(source?.sha256 ?? "")) {
      errors.push(`${path} 无效`)
      continue
    }
    if (lockedSources.has(source.snapshotId)) errors.push(`${path}.snapshotId 重复`)
    lockedSources.set(source.snapshotId, source)
    if (source.officialUrl !== undefined) {
      try {
        const url = new URL(source.officialUrl)
        if (url.protocol !== "https:" || url.hostname !== "developer.huawei.com") errors.push(`${path}.officialUrl 必须是华为开发者官网 HTTPS 页面`)
      } catch {
        errors.push(`${path}.officialUrl 无效`)
      }
    }
  }
  for (const fact of factsData?.facts ?? []) for (const source of fact.sources ?? []) {
    const locked = lockedSources.get(source.snapshotId)
    if (!locked) errors.push(`事实 ${fact.id} 的来源 ${source.snapshotId} 未登记到锁文件`)
    else {
      if (locked.sha256.toLowerCase() !== source.sha256.toLowerCase()) errors.push(`事实 ${fact.id} 的来源 ${source.snapshotId} 哈希与锁文件不一致`)
      if (source.officialUrl !== undefined && source.officialUrl !== locked.officialUrl) errors.push(`事实 ${fact.id} 的来源 ${source.snapshotId} 官网 URL 与锁文件不一致`)
      if (fact.route === "hds-api23" && !locked.officialUrl) errors.push(`HDS 事实 ${fact.id} 的来源 ${source.snapshotId} 缺少华为官网 URL`)
    }
  }
}

export async function verifyCapabilityLock(packageRoot, lock) {
  const errors = []
  if (lock?.lockVersion !== "1.0") errors.push("lockVersion 必须为 1.0")
  if (!Array.isArray(lock?.packageFiles) || !lock.packageFiles.length) return { valid: false, errors: [...errors, "packageFiles 必须是非空数组"] }
  const observed = []
  for (const [index, item] of lock.packageFiles.entries()) {
    try {
      if (!nonEmptyString(item?.path) || !/^[a-f0-9]{64}$/i.test(item?.sha256 ?? "")) throw new Error("路径或哈希无效")
      const path = safeChild(packageRoot, item.path, `packageFiles[${index}].path`)
      if (!(await exists(path))) throw new Error("文件不存在")
      const sha256 = await sha256File(path)
      observed.push({ path: item.path.replaceAll("\\", "/"), sha256 })
      if (sha256.toLowerCase() !== item.sha256.toLowerCase()) errors.push(`${item.path} SHA-256 不匹配`)
    } catch (error) {
      errors.push(`packageFiles[${index}]: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (observed.length && packageDigest(observed) !== lock.packageDigest) errors.push("packageDigest 不匹配")
  return { valid: errors.length === 0, errors, observed }
}

export async function loadCapability(skillRoot, featureQuery = "immersive-light", options = {}) {
  const root = resolve(skillRoot)
  const registryPath = resolve(root, "references", "capabilities", "registry.json")
  const registry = await readJson(registryPath, "能力注册表")
  const registryErrors = []
  validateRegistry(registry, registryErrors)
  if (registryErrors.length) throw new Error(registryErrors.join("; "))

  const query = String(featureQuery).trim().toLocaleLowerCase()
  const feature = registry.features.find((item) =>
    item.id.toLocaleLowerCase() === query ||
    item.displayName.toLocaleLowerCase() === query ||
    item.aliases.some((alias) => alias.toLocaleLowerCase() === query)
  )
  if (!feature) throw new Error(`未注册能力: ${featureQuery}`)
  if (feature.status !== "ready") throw new Error(`能力包未就绪: ${feature.id}`)

  const paths = {}
  for (const field of ["entry", "profile", "facts", "scenarios", "lock"]) {
    const path = safeChild(root, feature[field], `feature.${field}`)
    if (!(await exists(path))) throw new Error(`能力包文件不存在: ${feature[field]}`)
    paths[field] = path
  }
  const packageRoot = dirname(paths.profile)
  const [profile, factsData, scenariosData, lock] = await Promise.all([
    readJson(paths.profile, "profile"), readJson(paths.facts, "facts"),
    readJson(paths.scenarios, "scenarios"), readJson(paths.lock, "capability-lock"),
  ])
  const errors = []
  const routeState = validateProfile(profile, feature, errors)
  const factState = validateFacts(factsData, feature, routeState, profile.defaultRoute, errors)
  validateScenarios(scenariosData, feature, factState, routeState, errors)
  if (lock.featureId !== feature.id || lock.packageVersion !== feature.packageVersion) errors.push("锁文件与注册表的能力或版本不一致")
  const lockedRoutes = new Set(lock?.routes ?? [])
  if (lockedRoutes.size !== routeState.routeIds.size || [...routeState.routeIds].some((id) => !lockedRoutes.has(id))) errors.push("锁文件与 profile 的技术路线不一致")
  validateSourceTraceability(factsData, lock, errors)
  const lockResult = options.verifyLock === false ? { valid: true, errors: [] } : await verifyCapabilityLock(packageRoot, lock)
  errors.push(...lockResult.errors)
  if (errors.length) throw new Error(errors.join("; "))
  return { root, registryPath, registry, feature, packageRoot, paths, profile, factsData, scenariosData, lock, lockResult }
}

export function resolveScenario(capability, goal, target = "") {
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
    for (const component of scenario.targets) {
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

export function capabilityRoute(capability, routeId) {
  const id = routeId ?? capability.profile.defaultRoute
  const route = capability.profile.routes.find((item) => item.id === id)
  if (!route) throw new Error(`能力包未注册技术路线: ${id}`)
  return route
}

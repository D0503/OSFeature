import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

export const CHECK_LEVELS = new Set(["static", "sdk", "build", "install", "runtime", "visual"])
export const LAYER_STATUSES = new Set(["passed", "failed", "blocked", "not_run", "inconclusive"])
export const VERDICTS = new Set(["passed", "passed_with_spec_conflict", "build_passed_runtime_pending", "inconclusive", "failed", "blocked"])

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

function validateOfficialUrl(value, label, errors) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.hostname !== "developer.huawei.com") errors.push(`${label} 必须是华为开发者官网 HTTPS 页面`)
  } catch {
    errors.push(`${label} 无效`)
  }
}

function validateScenariosDocument(scenariosData, errors) {
  if (scenariosData?.schemaVersion !== "1.0") errors.push("scenarios.schemaVersion 必须为 1.0")
  if (!nonEmptyString(scenariosData?.featureId)) errors.push("scenarios.featureId 必填")
  const routeIds = new Set((scenariosData?.routes ?? []).map((route) => route?.id).filter(Boolean))
  if (!routeIds.has(scenariosData?.defaultRoute)) errors.push("scenarios.defaultRoute 必须引用已注册路线")
  for (const route of scenariosData?.routes ?? []) {
    if (route.intentPatterns !== undefined && (!Array.isArray(route.intentPatterns) || route.intentPatterns.some((term) => !nonEmptyString(term)))) errors.push(`route ${route.id}.intentPatterns 必须为非空词数组`)
  }

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
    if (!/^[A-Z][A-Z0-9]*-S\d{3,}$/.test(scenario?.id ?? "")) errors.push(`${label}.id 格式无效`)
    else if (scenarioIds.has(scenario.id)) errors.push(`${label}.id 重复`)
    else scenarioIds.add(scenario.id)
    if (!nonEmptyString(scenario?.displayName)) errors.push(`${label}.displayName 必填`)
    if (!routeIds.has(scenario?.route)) errors.push(`${label}.route 未注册`)
    if (!Array.isArray(scenario?.intentPatterns) || !scenario.intentPatterns.length) errors.push(`${label}.intentPatterns 必须是非空数组`)
    if (scenario.intentGroups !== undefined && (!Array.isArray(scenario.intentGroups) || scenario.intentGroups.some((group) => !Array.isArray(group) || !group.length || group.some((term) => !nonEmptyString(term))))) errors.push(`${label}.intentGroups 必须是非空词组成的组合数组`)
    if (scenario.intentPriority !== undefined && (!Number.isInteger(scenario.intentPriority) || scenario.intentPriority < 1 || scenario.intentPriority > 3)) errors.push(`${label}.intentPriority 必须为 1 到 3`)
    if (scenario.crossRoute !== undefined && typeof scenario.crossRoute !== "boolean") errors.push(`${label}.crossRoute 必须是布尔值`)
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
    if (scenario.demoValidation !== undefined) {
      const plan = scenario.demoValidation
      if (!['single_page_preferred'].includes(plan?.layoutPolicy)) errors.push(`${label}.demoValidation.layoutPolicy 无效`)
      if (plan?.backgroundResource !== undefined && !nonEmptyString(plan.backgroundResource)) errors.push(`${label}.demoValidation.backgroundResource 必须是非空字符串`)
      if (plan?.scopePolicy !== undefined) {
        const policy = plan.scopePolicy
        if (policy?.selection !== 'prompt_strong_relevance_only') errors.push(`${label}.demoValidation.scopePolicy.selection 无效`)
        if (policy?.prerequisiteHandling !== 'setup_or_static_only') errors.push(`${label}.demoValidation.scopePolicy.prerequisiteHandling 无效`)
        if (!Array.isArray(policy?.excludedByDefault) || policy.excludedByDefault.some((item) => !nonEmptyString(item))) errors.push(`${label}.demoValidation.scopePolicy.excludedByDefault 必须是字符串数组`)
        if (!Array.isArray(policy?.excludedCriterionTypes) || policy.excludedCriterionTypes.some((item) => !nonEmptyString(item))) errors.push(`${label}.demoValidation.scopePolicy.excludedCriterionTypes 必须是字符串数组`)
        if (!policy?.includeExcludedTypeWhenPromptContains || typeof policy.includeExcludedTypeWhenPromptContains !== 'object' || Array.isArray(policy.includeExcludedTypeWhenPromptContains)) errors.push(`${label}.demoValidation.scopePolicy.includeExcludedTypeWhenPromptContains 必须是对象`)
        else for (const [type, keywords] of Object.entries(policy.includeExcludedTypeWhenPromptContains)) {
          if (!policy.excludedCriterionTypes.includes(type) || !Array.isArray(keywords) || !keywords.length || keywords.some((item) => !nonEmptyString(item))) errors.push(`${label}.demoValidation.scopePolicy.includeExcludedTypeWhenPromptContains.${type} 无效`)
        }
      }
      if (!Array.isArray(plan?.points) || !plan.points.length) errors.push(`${label}.demoValidation.points 必须是非空数组`)
      const pointIds = new Set()
      for (const [pointIndex, point] of (plan?.points ?? []).entries()) {
        const pointLabel = `${label}.demoValidation.points[${pointIndex}]`
        if (!/^D\d{2}-\d{2}$/.test(point?.id ?? '')) errors.push(`${pointLabel}.id 格式无效`)
        else if (pointIds.has(point.id)) errors.push(`${pointLabel}.id 重复`)
        else pointIds.add(point.id)
        if (!nonEmptyString(point?.title)) errors.push(`${pointLabel}.title 必填`)
        if (!['single_page', 'rebuild_per_variant'].includes(point?.execution)) errors.push(`${pointLabel}.execution 无效`)
        if (!Array.isArray(point?.criteriaTopics) || !point.criteriaTopics.length || point.criteriaTopics.some((topic) => !nonEmptyString(topic))) errors.push(`${pointLabel}.criteriaTopics 必须是非空数组`)
        if (!Array.isArray(point?.variants) || !point.variants.length) errors.push(`${pointLabel}.variants 必须是非空数组`)
        if (point?.demoSetupRequirements !== undefined) {
          if (!Array.isArray(point.demoSetupRequirements) || !point.demoSetupRequirements.length) errors.push(`${pointLabel}.demoSetupRequirements 必须是非空数组`)
          const setupIds = new Set()
          for (const [setupIndex, setup] of (point.demoSetupRequirements ?? []).entries()) {
            const setupLabel = `${pointLabel}.demoSetupRequirements[${setupIndex}]`
            if (!nonEmptyString(setup?.id)) errors.push(`${setupLabel}.id 必填`)
            else if (setupIds.has(setup.id)) errors.push(`${setupLabel}.id 重复`)
            else setupIds.add(setup.id)
            if (!nonEmptyString(setup?.description)) errors.push(`${setupLabel}.description 必填`)
            if (setup?.enforcement !== 'implementation_and_static_gate') errors.push(`${setupLabel}.enforcement 无效`)
            if (setup?.countsAsFeatureValidation !== false) errors.push(`${setupLabel}.countsAsFeatureValidation 必须为 false`)
          }
        }
        if (point?.interactionRequirements !== undefined) {
          if (!Array.isArray(point.interactionRequirements) || !point.interactionRequirements.length) errors.push(`${pointLabel}.interactionRequirements 必须是非空数组`)
          const interactionIds = new Set()
          for (const [interactionIndex, interaction] of (point.interactionRequirements ?? []).entries()) {
            const interactionLabel = `${pointLabel}.interactionRequirements[${interactionIndex}]`
            if (!nonEmptyString(interaction?.id)) errors.push(`${interactionLabel}.id 必填`)
            else if (interactionIds.has(interaction.id)) errors.push(`${interactionLabel}.id 重复`)
            else interactionIds.add(interaction.id)
            if (!nonEmptyString(interaction?.description)) errors.push(`${interactionLabel}.description 必填`)
            if (!nonEmptyString(interaction?.expected)) errors.push(`${interactionLabel}.expected 必填`)
          }
        }
        const variantIds = new Set()
        for (const [variantIndex, variant] of (point?.variants ?? []).entries()) {
          const variantLabel = `${pointLabel}.variants[${variantIndex}]`
          if (!nonEmptyString(variant?.id)) errors.push(`${variantLabel}.id 必填`)
          else if (variantIds.has(variant.id)) errors.push(`${variantLabel}.id 重复`)
          else variantIds.add(variant.id)
          if (!nonEmptyString(variant?.label)) errors.push(`${variantLabel}.label 必填`)
          if (!variant?.parameters || typeof variant.parameters !== 'object' || Array.isArray(variant.parameters)) errors.push(`${variantLabel}.parameters 必须是对象`)
        }
        if (point?.defaultEquivalence !== undefined) {
          const equivalence = point.defaultEquivalence
          if (!nonEmptyString(equivalence?.defaultVariantId) || !variantIds.has(equivalence.defaultVariantId)) errors.push(`${pointLabel}.defaultEquivalence.defaultVariantId 必须引用已有变体`)
          if (!nonEmptyString(equivalence?.explicitVariantId) || !variantIds.has(equivalence.explicitVariantId)) errors.push(`${pointLabel}.defaultEquivalence.explicitVariantId 必须引用已有变体`)
          if (equivalence?.defaultVariantId === equivalence?.explicitVariantId) errors.push(`${pointLabel}.defaultEquivalence 两个变体必须不同`)
          if (equivalence?.expected !== 'visual_equivalent') errors.push(`${pointLabel}.defaultEquivalence.expected 必须为 visual_equivalent`)
          if (!nonEmptyString(equivalence?.basis)) errors.push(`${pointLabel}.defaultEquivalence.basis 必填`)
        }
      }
    }
  }
  return { routeIds, entryIds, probeIds }
}

export async function loadCapability(skillRoot, featureQuery = "immersive-light") {
  const root = resolve(skillRoot)
  const registryPath = join(root, "capabilities", "registry.json")
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
  validateScenariosDocument(scenariosData, errors)
  if (errors.length) throw new Error(errors.join("; "))
  return { root, feature, packageRoot, scenariosData }
}

// 明确选择可包含多个场景；自动路由按独立目标逐项执行，歧义不丢弃已命中的其他目标。
export function resolveScenarios(capability, goals = [], selectedIds = []) {
  if (!Array.isArray(goals) || !Array.isArray(selectedIds)) throw new Error("goals 与 selectedIds 必须是数组")
  if (selectedIds.length) {
    const selected = [...new Set(selectedIds)].map((id) => {
      const scenario = capability.scenariosData.scenarios.find((item) => item.id === id)
      if (!scenario) throw new Error(`未注册场景: ${id}`)
      return scenario
    })
    return { status: "resolved", selected, resolutions: [], reason: "采用明确选择的全部场景" }
  }
  if (!goals.length) return { status: "needs_input", selected: [], resolutions: [], reason: "缺少开发目标或场景选择" }
  const resolutions = goals.map((goal) => ({ goal, ...resolveScenario(capability, goal) }))
  const selected = [...new Map(resolutions.filter((item) => item.status === "resolved").map((item) => [item.selected.id, item.selected])).values()]
  return { status: resolutions.every((item) => item.status === "resolved") ? "resolved" : "needs_selection", selected, resolutions, reason: "逐项目标解析；未确定的目标允许选择一个或多个候选" }
}

export function resolveScenario(capability, goal, target = "") {
  const text = `${goal ?? ""} ${target ?? ""}`.trim().toLocaleLowerCase()
  if (!text) return { status: "needs_input", selected: null, candidates: [], reason: "缺少自然语言开发目标" }
  const matchesTerm = (term) => {
    const normalized = term.toLocaleLowerCase()
    if (/^[a-z][a-z0-9_.]*$/i.test(term)) {
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`(?<![a-z0-9_])${escaped}(?![a-z0-9_])`).test(text)
    }
    return text.replace(/\s+/g, "").includes(normalized.replace(/\s+/g, ""))
  }
  const explicitRoutes = (capability.scenariosData.routes ?? []).filter((route) => (route.intentPatterns ?? []).some(matchesTerm)).map((route) => route.id)
  const ranked = capability.scenariosData.scenarios.filter((scenario) => !explicitRoutes.length || scenario.crossRoute || explicitRoutes.includes(scenario.route)).map((scenario) => {
    const matches = []
    let score = 0
    for (const pattern of scenario.intentPatterns) {
      if (matchesTerm(pattern)) {
        matches.push(pattern)
        score += pattern.length >= 5 ? 3 : pattern.length >= 2 ? 2 : 1
      }
    }
    for (const component of scenario.targets ?? []) {
      if (matchesTerm(component)) {
        matches.push(component)
        score += 4
      }
    }
    if (text.includes(scenario.displayName.toLocaleLowerCase())) score += 8
    const groups = (scenario.intentGroups ?? []).filter((group) => group.every(matchesTerm))
    const specificity = groups.length ? (scenario.intentPriority ?? 1) : 0
    matches.push(...groups.flat())
    return { id: scenario.id, displayName: scenario.displayName, route: scenario.route, score, specificity, matches: [...new Set(matches)], scenario }
  }).filter((item) => item.score > 0 || item.specificity > 0).sort((a, b) => b.specificity - a.specificity || b.score - a.score || a.id.localeCompare(b.id))

  if (!ranked.length) {
    return {
      status: "unmatched", selected: null,
      candidates: capability.scenariosData.scenarios.map((item) => ({ id: item.id, displayName: item.displayName, score: 0, matches: [] })),
      reason: "开发目标未唯一命中已发布场景",
    }
  }
  const topScore = ranked[0].score
  const top = ranked.filter((item) => item.specificity === ranked[0].specificity && item.score === topScore)
  if (top.length !== 1) {
    return { status: "ambiguous", selected: null, candidates: top.map(({ scenario, ...item }) => item), reason: "多个场景得分相同，需要用户选择" }
  }
  const { scenario, ...selectedSummary } = top[0]
  return { status: "resolved", selected: scenario, selectedSummary, candidates: ranked.slice(1, 4).map(({ scenario: ignored, ...item }) => item), reason: "唯一最高分场景" }
}

export function capabilityRoute(capability, routeId) {
  const id = routeId ?? capability.scenariosData.defaultRoute
  const route = capability.scenariosData.routes.find((item) => item.id === id)
  if (!route) throw new Error(`能力包未注册技术路线: ${id}`)
  return route
}

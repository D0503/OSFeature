#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadCapability } from './lib/capability-tools.mjs'

function parseArgs(argv) {
  const allowed = new Set(['goal', 'criteria', 'selection', 'output', 'feature', 'skill-root'])
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index], value = argv[index + 1]
    if (!token?.startsWith('--') || !allowed.has(token.slice(2)) || !value || value.startsWith('--')) throw new Error('用法: node generate-validation-plan.mjs --goal <提示词> --criteria <criteria.json> --selection <selection.json> --output <绝对路径> [--feature <特性ID>]')
    result[token.slice(2)] = value
  }
  return result
}

export function buildValidationPlan(scenario, criteriaDocument, goal, selection) {
  const skeleton = scenario.demoValidation
  if (!skeleton) throw new Error(`场景 ${scenario.id} 未登记 Demo 验证骨架`)
  if (criteriaDocument?.scenarioId !== scenario.id) throw new Error(`criteria.scenarioId 必须是 ${scenario.id}`)
  if (!criteriaDocument?.featureId) throw new Error('criteria.featureId 必填')
  if (typeof goal !== 'string' || !goal.trim()) throw new Error('goal 必须是非空用户目标')
  if (!Array.isArray(selection?.points) || !selection.points.length) throw new Error('必须显式选择本次目标涉及的验证点和变体，提供 selection.points；不得默认采用整个场景骨架')
  const selectedIds = new Set()
  const selectedPoints = selection.points.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('selection.points 每项必须是对象')
    const point = skeleton.points.find((point) => point.id === item.id)
    if (!point || selectedIds.has(item.id)) throw new Error(`验证点不存在或重复: ${item.id}`)
    selectedIds.add(item.id)
    if (typeof item.goalAnchor !== 'string' || !item.goalAnchor.trim() || !goal.includes(item.goalAnchor)) throw new Error(`${item.id}.goalAnchor 必须逐字引用用户目标`)
    if (!Array.isArray(item.variantIds) || !item.variantIds.length || new Set(item.variantIds).size !== item.variantIds.length) throw new Error(`${item.id}.variantIds 必须非空且不重复`)
    const variants = item.variantIds.map((id) => {
      const variant = point.variants.find((variant) => variant.id === id)
      if (!variant) throw new Error(`${item.id} 的变体不存在: ${id}`)
      return variant
    })
    const selected = { ...point, variants, goalAnchor: item.goalAnchor }
    if (point.defaultEquivalence && ![point.defaultEquivalence.defaultVariantId, point.defaultEquivalence.explicitVariantId].every((id) => item.variantIds.includes(id))) delete selected.defaultEquivalence
    return selected
  })
  const criteria = criteriaDocument.criteria ?? []
  const excludedCriterionTypes = new Set(skeleton.scopePolicy?.excludedCriterionTypes ?? [])
  const promptOverrides = skeleton.scopePolicy?.includeExcludedTypeWhenPromptContains ?? {}
  const explicitlyRequestedTypes = new Set(Object.entries(promptOverrides)
    .filter(([, keywords]) => keywords.some((keyword) => goal.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())))
    .map(([type]) => type))
  const points = selectedPoints.map((point) => {
    const topicMatched = criteria.filter((criterion) => point.criteriaTopics.includes(criterion.topic))
    const matched = topicMatched.filter((criterion) => !excludedCriterionTypes.has(criterion.type) || explicitlyRequestedTypes.has(criterion.type))
    const missingTopics = point.criteriaTopics.filter((topic) => !matched.some((criterion) => criterion.topic === topic))
    if (missingTopics.length) throw new Error(`${point.id} 缺少本次冻结判据主题: ${missingTopics.join('、')}`)
    return {
      ...point,
      buildPolicy: point.execution === 'single_page'
        ? { mode: 'reuse_build', rebuildWhen: ['source', 'resource', 'configuration', 'sdk', 'dependency', 'signing'], instruction: '本轮构建安装一次；仅运行时参数或页面状态变化时复用安装包，重置页面后逐变体采集证据。文件或构建输入变化则重新执行门禁并构建。' }
        : { mode: 'rebuild_per_variant', instruction: '默认逐变体构建；只有确认差异全部是运行时状态且构建输入哈希一致时才可复用。' },
      criteriaRefs: matched.map((criterion) => criterion.id),
      expectedFromCurrentSnapshot: matched.map((criterion) => ({ criteriaId: criterion.id, statement: criterion.statement, snapshotId: criterion.snapshotId, anchor: criterion.anchor })),
      capture: point.execution === 'single_page'
        ? { strategy: 'one_page_comparison', instruction: '优先在同一 Demo 使用参数控件或状态入口切换变体，也可同页并列；保持对照条件一致，重置状态后逐变体截图，不新建工程。' }
        : { strategy: 'rebuild_each_variant', instruction: '每次只修改该参数，重新执行实施门禁、构建、安装并在相同页面状态截图；保存源码与 HAP 哈希。' },
    }
  })
  return {
    schemaVersion: '1.0', mode: 'demo-development-validation', generatedAt: new Date().toISOString(),
    featureId: criteriaDocument.featureId, scenarioId: scenario.id, goal,
    frozenAt: criteriaDocument.frozenAt, criteriaStrategy: criteriaDocument.strategy,
    layoutPolicy: skeleton.layoutPolicy,
    ...(skeleton.backgroundResource ? { backgroundResource: skeleton.backgroundResource } : {}),
    demoReusePolicy: {
      mode: 'existing_project_first',
      variantStrategy: 'runtime_controls_or_state_switch',
      compileTimeChanges: 'edit_and_rebuild_same_project',
      deviceChanges: 'reuse_same_project',
      pointIdsDoNotAllocateProjects: true,
      splitRequiresReason: true,
    },
    scopePolicy: skeleton.scopePolicy ?? { selection: 'prompt_strong_relevance_only', prerequisiteHandling: 'setup_or_static_only', excludedByDefault: [], excludedCriterionTypes: [], includeExcludedTypeWhenPromptContains: {} },
    points,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!isAbsolute(args.output)) throw new Error('output 必须是绝对路径')
  const skillRoot = args['skill-root'] ? resolve(args['skill-root']) : dirname(dirname(fileURLToPath(import.meta.url)))
  const capability = await loadCapability(skillRoot, args.feature ?? 'immersive-light')
  const criteria = JSON.parse(await readFile(resolve(args.criteria), 'utf8'))
  if (criteria.featureId && criteria.featureId !== capability.feature.id) throw new Error('criteria.featureId 与所选特性不一致')
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === criteria.scenarioId)
  if (!scenario) throw new Error(`本轮判据引用未注册场景: ${criteria.scenarioId}`)
  if (!args.selection) throw new Error('缺少 --selection：先按用户目标选择验证点和变体')
  const selection = JSON.parse(await readFile(resolve(args.selection), 'utf8'))
  const plan = buildValidationPlan(scenario, { ...criteria, featureId: criteria.featureId ?? capability.feature.id }, args.goal, selection)
  await mkdir(dirname(args.output), { recursive: true })
  await writeFile(args.output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify({ output: resolve(args.output), scenarioId: plan.scenarioId, points: plan.points.map((point) => point.id) }, null, 2)}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

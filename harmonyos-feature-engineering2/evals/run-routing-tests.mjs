#!/usr/bin/env node
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { loadCapability, resolveScenario } from "../scripts/lib/capability-tools.mjs"
import { deriveMaterials, validateDraft } from "../scripts/derive-criteria.mjs"
import { diffAgainstLatest } from "../scripts/diff-snapshots.mjs"
import { runStaticScenarioChecks } from "../scripts/lib/development-project.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const capability = await loadCapability(root)
let assertions = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
const cases = {
  "IL-S001": ["应用级开启后关闭沉浸光感"],
  "IL-S002": ["组件级关闭沉浸光感", "通过 Material.empty 关闭材质"],
  "IL-S003": ["实现索引条沉浸光感", "给普通标题栏增加沉浸光感", "实现标题栏按钮沉浸光感", "实现沉浸光感底部悬浮页签", "给 Tabs 接入沉浸光感"],
  "IL-S004": ["给日期选择弹出框开启沉浸光感", "给 AlertDialog 开启沉浸光感", "给 CustomDialog 开启沉浸光感", "给 DatePickerDialog 开启沉浸光感", "给 CalendarPicker 开启沉浸光感", "给 ActionSheet 接入沉浸光感", "给文本长按菜单接入沉浸光感"],
  "IL-S005": ["给子页签开启沉浸光感", "给操作块开启沉浸光感", "给滑动条开启沉浸光感", "给按钮开启沉浸光感", "给 SegmentButtonV2 接入沉浸光感"],
  "IL-S006": ["实现交互形变", "实现点光源跟手效果", "实现材质赋色", "给按钮设置自定义阴影", "开启自动反色"],
  "IL-S008": ["材质渲染区域与组件可视区域不一致", "材质效果的显示层级问题", "组件边框呈现出周围背景的颜色", "保持材质参数与材质区域稳定", "搜索框标题栏沉浸光感不生效", "TextArea 设置材质后样式显示异常", "Material inactive: out of scope", "优化沉浸光感功耗"],
  "IL-S009": ["给 HDS 标题栏接入沉浸光感", "给 HdsNavigation 接入沉浸光感"],
  "IL-S010": ["给 HdsTabs 底部悬浮页签接入沉浸光感", "给 HDS 页签增加沉浸光感"],
  "IL-S011": ["给 HdsNavigation 和 HdsTabs 接入沉浸光感", "给 HDS 导航和底部页签接入沉浸光感"],
  "IL-S012": ["HDS自定义材质等级", "HdsNavigation 使用 EXQUISITE", "通过 getSystemMaterialTypes 查询设备能力", "给 HdsNavigation 和 HdsTabs 设置自定义等级"],
  "IL-S013": ["实现搜索框标题栏具有沉浸光感效果", "沉浸光感典型场景：搜索框标题栏具有沉浸光感效果", "给搜索栏和标题栏增加沉浸光感", "Navigation 页面上滑收起搜索框，保留 Tabs 页签和分类按钮", "给 Search 所在的标题栏接入沉浸光感"],
  "IL-S014": ["内容区标题栏开启沉浸光感", "让分类栏吸顶后融入 NavDestination 标题栏", "内容区的小标题滚动到顶部标题栏后显示沉浸光感"],
  "IL-S015": ["查询应用当前材质配置状态", "使用 getMaterialInfo 查询配置", "查询设备是否支持沉浸光感", "获取 getGlobalMaterialLevel", "调用 isImmersiveMaterialSupported 查询支持情况"],
  "IL-S016": ["选择 ULTRA_THIN 材质样式", "设置材质厚度", "适配系统强弱档位和深浅色模式", "给 ImmersiveMaterial 选择 ULTRA_THIN"],
  "IL-S017": ["实现菜单非线性形变", "实现边缘流光", "实现滑动条粒子动画"],
  "IL-S018": ["uiMaterial与hdsMaterial的材质等级和材质样式差异对比", "用 uiMaterial 选择 EXQUISITE 材质等级", "比较 ArkUI 与 HDS 沉浸光感"],
  "IL-S019": ["给 Search 开启沉浸光感", "给 TextArea 开启沉浸光感", "给布局容器开启沉浸光感", "给普通搜索框接入沉浸光感"]
}
const failures = []
for (const [id, goals] of Object.entries(cases)) for (const goal of goals) {
  const result = resolveScenario(capability, goal)
  if (result.selected?.id !== id) failures.push(`${goal}: expected ${id}, actual ${result.selected?.id ?? result.status}`)
  assertions++
}
assert.deepEqual(failures, [], failures.join("\n"))
const typical = resolveScenario(capability, "实现沉浸光感典型场景")
check(typical.status === "ambiguous" && typical.candidates.map((item) => item.id).sort().join() === "IL-S013,IL-S014", "典型场景未指定效果时提供两个候选")
check(resolveScenario(capability, "").status === "needs_input", "空目标需要输入")
check(resolveScenario(capability, "量子传送装置").status === "unmatched", "未知需求不猜测场景")

const entryById = new Map(capability.scenariosData.entryPoints.map((item) => [item.snapshotId, item]))
for (const [id, goals] of Object.entries(cases)) {
  const scenario = resolveScenario(capability, goals[0]).selected
  check(scenario.sources.every((source) => entryById.has(source)), `${id} 的冻结来源均已登记`)
}
for (const id of ["IL-S013", "IL-S014"]) {
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === id)
  check(scenario.sources.includes("typical-scenes") && entryById.get("typical-scenes").officialUrl.endsWith("/arkts-immersive-light-sample"), `${id} 关联典型场景正文`)
  check(scenario.criteriaSpec.conflictProbes.every((probe) => probe.positions.every((source) => scenario.sources.includes(source))), `${id} 冲突监测的两侧页面都会冻结`)
}

const temporary = await mkdtemp(join(tmpdir(), "immersive-routing-"))
try {
  const project = join(temporary, "entry-checks")
  await mkdir(project)
  for (const [id, content, rule] of [
    ["IL-S003", "NavDestination() {}.title('标题', { systemMaterial: material })", "navigation-entry"],
    ["IL-S004", "AlertDialog.show({ systemMaterial: material })", "overlay-target"],
    ["IL-S004", "new CustomDialogController({ systemMaterial: material })", "overlay-target"],
    ["IL-S005", "ChipGroup({ backgroundSystemMaterial: material })", "control-material"]
  ]) {
    await writeFile(join(project, "Index.ets"), content)
    const result = await runStaticScenarioChecks(project, capability.scenariosData.scenarios.find((item) => item.id === id), { modules: [] })
    check(result.rules.find((item) => item.id === rule)?.status === "passed", `${id} 已登记入口能通过静态识别: ${content}`)
  }
  const directory = join(temporary, "frozen")
  await mkdir(join(directory, "snapshots"), { recursive: true })
  const scenario = capability.scenariosData.scenarios.find((item) => item.id === "IL-S013")
  const snapshots = []
  for (const snapshotId of scenario.sources) {
    const content = `测试正文 ${snapshotId}：本次冻结页。`
    await writeFile(join(directory, "snapshots", `${snapshotId}.md`), content)
    snapshots.push({ ...entryById.get(snapshotId), contentSha256: createHash("sha256").update(content).digest("hex"), updatedDate: null })
  }
  await writeFile(join(directory, "frozen.json"), JSON.stringify({ frozenAt: "2026-09-08T00:00:00Z", snapshots }))
  const diff = await diffAgainstLatest(capability, directory)
  const materials = await deriveMaterials(capability, scenario.id, directory, diff)
  check(materials.status === "materials_ready", "新增场景必须现提判据，不能复用旧通用导航判据")
  check(materials.materials.requiredTopics.some((item) => item.topic === "搜索标题栏滚动联动"), "材料包包含典型场景专属主题")
  check(materials.materials.conflictProbes.some((item) => item.id === "search-title-nesting"), "材料包保留嵌套约束监测")
  const draft = { schemaVersion: "1.0", scenarioId: scenario.id,
    criteria: scenario.criteriaSpec.required.map((topic, index) => ({ id: `TEST-${index}`, type: "behavior", topic: topic.topic, statement: "测试正文的判据", snapshotId: "typical-scenes", anchor: "本次冻结页" })),
    conflictResolutions: [], confirmations: diff.highRisk.map((item) => ({ snapshotId: item.snapshotId, category: item.category, userDecision: "proceed", note: "离线测试夹具" })) }
  const missing = await validateDraft(capability, scenario.id, directory, draft, diff)
  check(missing.status === "invalid" && missing.invalid.some((item) => item.includes("search-title-nesting")), "未审查新增冲突监测点时拒绝草稿")
  draft.conflictResolutions = [{ probeId: "search-title-nesting", verdict: "resolved", basis: "测试夹具无嵌套冲突" }]
  check((await validateDraft(capability, scenario.id, directory, draft, diff)).status === "validated", "新增主题与监测结论完整时可生成判据")
} finally {
  await rm(temporary, { recursive: true, force: true })
}
process.stdout.write(`ok - ${assertions} routing and criteria assertions\n`)

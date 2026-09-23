import { createHash } from "node:crypto"
import { access, copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

export const hash = (value) => createHash("sha256").update(value).digest("hex")
export const exists = async (path) => { try { await access(path); return true } catch { return false } }
export const fileHash = async (path) => hash(await readFile(path))
export const statusLabel = (status) => ({ passed: "通过", failed: "失败", not_run: "未验证", inconclusive: "未确认", not_applicable: "不适用" })[status] ?? status
const escape = (value) => String(value ?? "未记录").replace(/[&<>|\[\]`*_]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\r?\n/g, "<br>")

export function sameTarget(a, b) {
  if (!["feature", "route", "product", "buildMode", "module"].every((key) => a[key] === b[key])) return false
  if (a.changes.id && b.changes.id) return a.changes.id === b.changes.id
  return ["page", "component"].every((key) => a.changes[key].trim() === b.changes[key].trim())
}

const findingLabels = {
  "stage-model": "核对 Stage 工程结构与入口模块",
  "hds-components": "核对目标 HDS 组件是否已接入",
  "hds-material-entry": "核对 systemMaterialEffect 材质入口",
  "hds-adaptive-material": "核对系统自适应材质配置",
  "floating-tabs": "核对 HDS 悬浮样式入口",
  "floating-tabs-bottom-position": "核对底部 Tab 位置配置",
  "floating-tabs-overlap": "核对 Tab 内容与悬浮栏的重叠布局",
  "mini-bar-contract": "核对 MiniBar 入口与内容 Builder",
  "mini-bar-layout-mode-version-guard": "核对 MiniBar 排列模式的版本保护",
  "arkui-import": "核对 ArkUI 材质接口导入",
  "arkui-material-entry": "核对目标组件的材质入口",
  "arkui-native-tabs-floating-style": "核对原生 Tabs 悬浮样式配置",
  "arkui-native-tabs-overlap": "核对原生 Tabs 的重叠布局",
  "arkui-native-tabs-horizontal": "核对原生 Tabs 的横向排列",
  "arkui-native-tabs-bottom": "核对原生 Tabs 的底部位置",
  "arkui-native-tabs-background-conflict": "核对 Tab 栏背景色或模糊是否遮挡材质",
  "arkui-alphabet-indexer-background-conflict": "核对索引提示弹窗背景属性是否阻止材质生效",
  "arkui-toggle-checkbox": "核对 Toggle 类型是否支持材质",
  "arkui-material-color-opacity": "核对材质颜色透明度",
  "arkui-color-invert-resource": "核对反色所用颜色资源",
  "arkui-background-blur-conflict": "核对背景模糊与材质是否冲突",
  "arkui-default-state-background-conflict": "核对默认材质状态与自定义背景配置",
  "arkui-light-effect-fallback": "核对点光源关闭后的交互反馈",
  "route-eligibility": "核对工程版本与技术路线门槛",
  "version-guard": "沿调用链核对新增 API 的低版本保护",
  "capability-guard": "核对设备能力判断及调用时机",
  "application-level-config": "核对应用级材质配置的位置、取值与版本",
  "arkui-navigation-stack": "核对标题栏下方的内容延伸布局",
  "arkui-select-dual-entry": "分别核对 Select 按钮与下拉菜单材质入口",
  "arkui-material-effect-scope": "核对组件层级是否属于材质合法生效区域",
  "arkui-shadow-conflict": "核对自定义阴影与材质阴影是否冲突",
  "floating-tabs-window-immersion": "核对窗口沉浸状态、栏底距与完整安全区扩展链",
  "floating-tabs-bottom-spacing": "核对外层底部 padding 的用途与分支归属",
  "floating-tabs-width-and-breakpoints": "核对悬浮栏宽度与各断点布局",
  "floating-tabs-height": "核对 HDS 栏高配置及显隐行为",
  "scrollable-tab-tail-clearance": "逐页验证真实滚动容器的尾部补偿和末项操作",
  "web-same-layer": "核对 Web 同层渲染的透明异常风险",
  "performance-risk": "核对材质面积、嵌套与滚动性能",
  "fallback-style": "核对普通样式回退",
  "source-tabs-fallback": "核对低版本 Tabs 分支",
  "source-experience-preservation": "对照源程序核对原有交互与状态"
}

function deviceLabel(run) {
  const kind = run.deviceKind === "emulator" ? "（模拟器）" : ""
  let info = run.deviceInfo
  if (typeof info === "string") {
    try { info = JSON.parse(info) } catch {
      return `设备：${escape(run.device || "未指定")}${kind}；系统：${escape(info && !/^[\s]*[\[{]/.test(info) ? info : "未采集")}。`
    }
  }
  const device = info?.device ?? info?.data ?? info
  return `设备：${escape(device?.name || run.device || "未指定")}${kind}；系统：${escape(device?.osVersion || "未采集")}。`
}

function stageSummary(key, value) {
  if (key === "static") return value.status === "passed" ? value.summary : "待处理项目见下方，扫描提示不等于已确认缺陷"
  if (value.status === "failed" && ["build", "install", "navigation"].includes(key)) {
    return value.reportSummary ?? { build: "构建失败，需解决构建错误后重验；未继续安装", install: "安装或启动失败，未完成目标页验证", navigation: "目标页导航或页面断言失败，不能据此验收目标效果" }[key]
  }
  return value.summary
}

export function cacheDirectory(output) {
  return join(tmpdir(), "harmonyos-os-feature-verification", hash(resolve(output)))
}

export function validateChanges(value) {
  if (value?.schemaVersion !== "1.0") throw new Error("changes.schemaVersion 必须为 1.0")
  if (value.id !== undefined && (typeof value.id !== "string" || !value.id.trim())) throw new Error("changes.id 必须是非空稳定标识")
  for (const key of ["page", "component", "category", "effect"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`changes.${key} 必填`)
  }
  if (!Array.isArray(value.files) || !value.files.length || value.files.some((v) => typeof v !== "string" || !v.trim())) throw new Error("changes.files 必须列出实际改动文件")
  if (!value.before || ["sdk", "compile", "target", "compatible"].some((key) => !(Number.isInteger(value.before[key]) || value.before[key] === "unknown"))) throw new Error("changes.before 必须提供 sdk/compile/target/compatible，无法确认填 unknown")
  for (const condition of ["low-api", "unsupported", "disabled"]) {
    const item = value.fallback?.find((entry) => entry.condition === condition)
    if (!item || !["passed", "failed", "not_run", "not_applicable"].includes(item.status) || !item.behavior?.trim()) throw new Error(`changes.fallback 缺少 ${condition} 的行为与验证状态`)
    if (item.status !== "not_run" && !item.evidence?.trim()) throw new Error(`${condition} 必须说明验证证据或不适用依据`)
  }
  return value
}

export function deriveVerdict(run) {
  const checks = Object.values(run.checks)
  if (checks.some((v) => v.status === "failed") || run.changes.fallback.some((v) => v.status === "failed")) return "failed"
  return checks.every((v) => ["passed", "not_applicable"].includes(v.status)) && run.changes.fallback.every((v) => ["passed", "not_applicable"].includes(v.status)) ? "passed" : "inconclusive"
}

export async function loadCollection(output, project) {
  const directory = cacheDirectory(output)
  const path = join(directory, "collection.json")
  if (!await exists(path)) {
    if (await exists(join(output, "integration-report.md"))) throw new Error("临时运行记录已丢失，无法安全合并已有报告；请指定新的 --output 目录")
    return { directory, collection: { project: resolve(project), runs: [] } }
  }
  const collection = JSON.parse(await readFile(path, "utf8"))
  if (collection.project !== resolve(project)) throw new Error("输出目录已属于其他工程")
  collection.runs = collection.runs.filter((run, i, runs) => !runs.slice(i + 1).some((later) => sameTarget(run, later)))
  return { directory, collection }
}

export async function saveReport(output, directory, collection) {
  await mkdir(output, { recursive: true })
  const reportPath = join(output, "integration-report.md")
  const previous = await exists(reportPath) ? await readFile(reportPath, "utf8") : ""
  const previousImages = [...previous.matchAll(/<img src="evidence\/([a-f0-9]{64}\.png)" alt="目标页面截图" width="270" \/>/g), ...previous.matchAll(/!\[目标页面截图\]\(<evidence\/([a-f0-9]{64}\.png)>\)/g)].map((m) => m[1])
  const featureNames = [...new Set(collection.runs.map((r) => r.featureName ?? ({ "immersive-light": "沉浸光感", "easygo-parallel": "平行视界", "smart-reach": "智感握姿" })[r.feature] ?? r.feature))]
  const featureTitle = featureNames.join(" / ") || "系统特性"
  const onlyMaterial = collection.runs.every((r) => r.feature === "immersive-light")
  const lines = [`# ${escape(featureTitle)}接入汇总报告`, "", `工程：${escape(collection.project)}`, "", `## ${escape(featureTitle)}改造汇总`, "", "以下为已实施的代码配置；实际效果以逐项验证结果为准。", "", "| 改造项 | 页面 / 组件 | 已实施配置 | 修改文件 | 运行验证 | 视觉验证 |", "|---|---|---|---|---|---|"]
  for (const r of collection.runs) lines.push(`| ${escape(r.goal)} | ${escape(r.changes.page)} / ${escape(r.changes.component)} | ${escape(r.changes.effect)} | ${r.changes.files.map(escape).join("<br>")} | ${statusLabel(r.checks.runtime.status)} | ${statusLabel(r.checks.visual.status)} |`)
  lines.push("", onlyMaterial ? "## 沉浸光感类别" : "## 路线与模式", "", "| 目标 | 技术路线 | 类别 |", "|---|---|---|")
  for (const r of collection.runs) lines.push(`| ${escape(r.goal)} | ${escape(({ arkui: "ArkUI", hds: "HDS", router: "Router", navigation: "Navigation" })[r.route] ?? r.route)} | ${escape(r.changes.category)} |`)
  lines.push("", "## 视觉验证结果", "")
  for (const r of collection.runs) {
    lines.push(`### ${escape(r.goal)}`, "", `页面 / 组件：${escape(r.changes.page)} / ${escape(r.changes.component)}。`, "", `视觉结果：**${statusLabel(r.checks.visual.status)}**。${escape(r.checks.visual.summary)}`, "", deviceLabel(r), "", `验证时间：${escape(r.createdAt)}；整体结果：${statusLabel(deriveVerdict(r))}。`, "", "| 验证阶段 | 结果 | 说明 |", "|---|---|---|")
    const names = { static: "静态检查", sdk: "SDK", build: "构建", install: "安装启动", navigation: "目标页导航", runtime: "运行观察", visual: "视觉验证" }
    for (const [key, value] of Object.entries(r.checks).filter(([key]) => key !== "visual")) lines.push(`| ${names[key]} | ${statusLabel(value.status)} | ${escape(stageSummary(key, value))} |`)
    const findings = r.staticFindings ?? []
    if (findings.length || !["passed", "not_applicable"].includes(r.checks.static.status)) {
      lines.push("", findings.some((f) => !f.review) ? "待处理事项：" : "静态复核结论：", "")
      if (!findings.length) lines.push("- 静态检查尚未完成复核，需重新检查并明确具体问题。")
      for (const finding of findings) {
        const locations = (finding.evidence ?? []).map((e) => typeof e === "string" ? e : e.path ? `${e.path}${e.line ? `:${e.line}` : ""}` : "").filter(Boolean)
        const label = escape(findingLabels[finding.id] ?? (/^(easygo|smart-reach)-/.test(finding.id) ? finding.message : `需人工复核检查项（${finding.id}）`))
        const location = locations.length ? `；位置：${[...new Set(locations)].slice(0, 3).map(escape).join("、")}` : ""
        if (finding.review) lines.push(`- ${finding.review.status === "passed" ? "已复核通过" : "复核确认问题"}：${label}${location}；${escape(finding.review.note)}。`)
        else lines.push(`- ${finding.status === "fail" ? "检查失败" : "待核对"}：${label}${location}。`)
      }
    }
    for (const e of r.evidence.filter((v) => v.type === "screenshot")) {
      const filename = `${e.sha256}.png`
      const dest = join(output, "evidence", filename)
      if (!await exists(e.path) || await fileHash(e.path) !== e.sha256) throw new Error(`截图丢失或已改变: ${e.path}`)
      await mkdir(join(output, "evidence"), { recursive: true })
      if (resolve(e.path) !== resolve(dest)) await copyFile(e.path, dest)
      e.path = dest
      lines.push("", `<img src="evidence/${filename}" alt="目标页面截图" width="270" />`, "")
      if (e.origin === "developer") lines.push("", `截图来源：开发者按引导在真机采集并导入。`)
    }
  }
  lines.push("", "## 升级与兼容", "", "SDK 版本与回退行为按整个工程记录一份；保留行为覆盖所有改造项。", "")
  const first = collection.runs[0]
  const after = first.after ?? {}
  lines.push("| 项目 | 改造前 | 改造后 |", "|---|---|---|")
  for (const key of ["sdk", "compile", "target", "compatible"]) lines.push(`| ${{ sdk: "本机 SDK API", compile: "compile API", target: "target API", compatible: "最低兼容 API" }[key]} | ${escape(first.changes.before[key])} | ${escape(after[key])} |`)
  const known = [first.changes.before, after].every((versions) => ["sdk", "compile", "target", "compatible"].every((key) => Number.isInteger(versions[key])))
  lines.push("", known && Object.keys(after).every((key) => after[key] === first.changes.before[key]) ? "SDK/API 未升级。" : known ? "SDK/API 变更如上表。" : "版本信息不完整，无法确认是否升级。", "", "| 回退条件 | 保留行为 | 验证结果 | 证据或限制 |", "|---|---|---|---|")
  for (const condition of ["low-api", "unsupported", "disabled"]) {
    const entries = collection.runs.map((r) => ({ goal: r.goal, feature: r.feature, fallback: r.changes.fallback.find((v) => v.condition === condition) })).filter((v) => v.fallback)
    if (!entries.length) continue
    const labels = [...new Set(entries.map((v) => v.feature === "immersive-light" ? "材质关闭" : "特性关闭"))]
    const behaviors = [...new Set(entries.map((v) => `${escape(v.goal)}：${escape(v.fallback.behavior)}`))]
    const status = entries.some((v) => v.fallback.status === "failed") ? "失败" : entries.some((v) => v.fallback.status === "not_run") ? "未验证" : "通过"
    const evidences = [...new Set(entries.filter((v) => v.fallback.evidence?.trim()).map((v) => `${escape(v.goal)}：${escape(v.fallback.evidence)}`))]
    lines.push(`| ${escape(condition === "low-api" ? "低版本" : condition === "unsupported" ? "设备不支持" : labels.join(" / "))} | ${behaviors.join("<br>")} | ${status} | ${evidences.length ? evidences.join("<br>") : "尚未实际验证"} |`)
  }
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "report.tmp"), `${lines.join("\n")}\n`, "utf8")
  await copyFile(join(directory, "report.tmp"), reportPath)
  await writeFile(join(directory, "collection.tmp"), JSON.stringify(collection, null, 2), "utf8")
  await rename(join(directory, "collection.tmp"), join(directory, "collection.json"))
  const currentImages = new Set(collection.runs.flatMap((r) => r.evidence.filter((e) => e.type === "screenshot").map((e) => `${e.sha256}.png`)))
  for (const name of previousImages) {
    const path = join(output, "evidence", name)
    if (!currentImages.has(name) && await exists(path) && await fileHash(path) === name.slice(0, -4)) await unlink(path)
  }
  return reportPath
}

import { createHash } from "node:crypto"
import { access, copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

export const hash = (value) => createHash("sha256").update(value).digest("hex")
export const exists = async (path) => { try { await access(path); return true } catch { return false } }
export const fileHash = async (path) => hash(await readFile(path))
export const statusLabel = (status) => ({ passed: "通过", failed: "失败", not_run: "未验证", inconclusive: "未确认", not_applicable: "不适用" })[status] ?? status
const escape = (value) => String(value ?? "未记录").replace(/[&<>|\[\]`*_]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\r?\n/g, "<br>")

export function cacheDirectory(output) {
  return join(tmpdir(), "harmonyos-os-feature-verification", hash(resolve(output)))
}

export function validateChanges(value) {
  if (value?.schemaVersion !== "1.0") throw new Error("changes.schemaVersion 必须为 1.0")
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
  return { directory, collection }
}

export async function saveReport(output, directory, collection) {
  await mkdir(output, { recursive: true })
  const reportPath = join(output, "integration-report.md")
  const previous = await exists(reportPath) ? await readFile(reportPath, "utf8") : ""
  const previousImages = [...previous.matchAll(/!\[目标页面截图\]\(<evidence\/([a-f0-9]{64}\.png)>\)/g)].map((m) => m[1])
  const lines = ["# 沉浸光感接入汇总报告", "", `工程：${escape(collection.project)}`, "", "## 沉浸光感改造汇总", "", "| 目标 | 页面 / 组件 | 实际改造效果 | 修改文件 |", "|---|---|---|---|"]
  for (const r of collection.runs) lines.push(`| ${escape(r.goal)} | ${escape(r.changes.page)} / ${escape(r.changes.component)} | ${escape(r.changes.effect)} | ${r.changes.files.map(escape).join("<br>")} |`)
  lines.push("", "## 沉浸光感类别", "", "| 目标 | 技术路线 | 类别 |", "|---|---|---|")
  for (const r of collection.runs) lines.push(`| ${escape(r.goal)} | ${r.route === "arkui" ? "ArkUI" : "HDS"} | ${escape(r.changes.category)} |`)
  lines.push("", "## 视觉验证结果", "")
  for (const r of collection.runs) {
    lines.push(`### ${escape(r.goal)}`, "", `视觉结果：**${statusLabel(r.checks.visual.status)}**。${escape(r.checks.visual.summary)}`, "", `设备：${escape(r.device || "未指定")}；系统信息：${escape(r.deviceInfo || "未采集")}。`, "", `验证时间：${escape(r.createdAt)}；整体结果：${statusLabel(deriveVerdict(r))}。`, "", "| 验证阶段 | 结果 | 说明 |", "|---|---|---|")
    const names = { static: "静态检查", sdk: "SDK", build: "构建", install: "安装启动", navigation: "目标页导航", runtime: "运行观察", visual: "视觉验证" }
    for (const [key, value] of Object.entries(r.checks)) lines.push(`| ${names[key]} | ${statusLabel(value.status)} | ${escape(value.summary)} |`)
    for (const e of r.evidence.filter((v) => v.type === "screenshot")) {
      const filename = `${e.sha256}.png`
      const dest = join(output, "evidence", filename)
      if (!await exists(e.path) || await fileHash(e.path) !== e.sha256) throw new Error(`截图丢失或已改变: ${e.path}`)
      await mkdir(join(output, "evidence"), { recursive: true })
      if (resolve(e.path) !== resolve(dest)) await copyFile(e.path, dest)
      e.path = dest
      lines.push("", `![目标页面截图](<evidence/${filename}>)`, "")
    }
  }
  lines.push("", "## 升级与兼容", "")
  for (const r of collection.runs) {
    lines.push(`### ${escape(r.goal)}`, "", "| 项目 | 改造前 | 改造后 |", "|---|---|---|")
    for (const key of ["sdk", "compile", "target", "compatible"]) lines.push(`| ${{ sdk: "本机 SDK API", compile: "compile API", target: "target API", compatible: "最低兼容 API" }[key]} | ${escape(r.changes.before[key])} | ${escape(r.after[key])} |`)
    const known = Object.values(r.changes.before).every((v) => v !== "unknown")
    lines.push("", known && Object.keys(r.after).every((key) => r.after[key] === r.changes.before[key]) ? "SDK/API 未升级。" : known ? "SDK/API 变更如上表。" : "改造前版本信息不完整，无法确认是否升级。", "", "| 回退条件 | 保留行为 | 验证结果 | 证据或限制 |", "|---|---|---|---|")
    for (const f of r.changes.fallback) lines.push(`| ${escape({ "low-api": "低版本", unsupported: "设备不支持", disabled: "材质关闭" }[f.condition] ?? f.condition)} | ${escape(f.behavior)} | ${statusLabel(f.status)} | ${escape(f.evidence || "尚未实际验证")} |`)
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

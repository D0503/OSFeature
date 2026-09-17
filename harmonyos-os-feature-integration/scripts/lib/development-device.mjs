import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { dirname, resolve } from "node:path"
import { executeBuildStage } from "./hvigor-build.mjs"
import { exists } from "./development-report.mjs"

export async function runDeveco(args, cwd) {
  if (args.some((v) => typeof v !== "string" || /[\0\r\n]/.test(v))) throw new Error("设备命令参数无效")
  let command = "devecocli", prefix = []
  if (process.platform === "win32") {
    const { stdout } = await promisify(execFile)("where.exe", ["devecocli.cmd"], { windowsHide: true })
    const wrapper = stdout.split(/\r?\n/).map((v) => v.trim()).find((v) => v.endsWith(".cmd"))
    if (!wrapper) throw new Error("未找到 devecocli.cmd")
    const entry = resolve(dirname(wrapper), "node_modules", "@deveco", "deveco-cli", "dist", "cli.js")
    if (!await exists(entry)) throw new Error("未找到 devecocli Node 入口")
    command = process.execPath
    prefix = [entry]
  }
  return executeBuildStage({ command, args: [...prefix, ...args] }, cwd, process.env)
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== "object") return []
  return [tree.attributes ?? tree, ...Object.entries(tree).filter(([key]) => key !== "attributes").flatMap(([, value]) => nodes(value))]
}

function matches(node, locator) {
  return typeof node[locator.by] === "string" && node[locator.by] === locator.value
}

export function validateNavigation(nav) {
  if (nav?.schemaVersion !== "1.0" || !Array.isArray(nav.steps) || !nav.steps.length) throw new Error("导航文件需要 schemaVersion=1.0 与非空 steps")
  const seen = new Set()
  const locator = (v) => v && ["id", "text", "type"].includes(v.by) && typeof v.value === "string" && v.value.trim()
  for (const s of nav.steps) {
    if (!/^[\w-]+$/.test(s.stepId ?? "") || seen.has(s.stepId)) throw new Error("导航 stepId 必须唯一且只含字母数字下划线连字符")
    seen.add(s.stepId)
    if (!["launch", "tap", "swipe", "input", "wait"].includes(s.action)) throw new Error("无效导航 action")
    if (s.action === "tap" && !locator(s.locator)) throw new Error("tap 需要 locator")
    if (s.action === "input" && (typeof s.value !== "string" || !s.value || (s.locator && !locator(s.locator)))) throw new Error("input 参数无效")
    if (s.action === "swipe" && !(["up", "down", "left", "right"].includes(s.direction) || (s.from?.length === 2 && s.to?.length === 2 && [...s.from, ...s.to].every(Number.isFinite)))) throw new Error("swipe 需要 direction 或 from/to 坐标")
    if (s.action === "wait" && (!Number.isInteger(s.timeoutMs) || s.timeoutMs < 1 || s.timeoutMs > 30000)) throw new Error("wait.timeoutMs 必须为 1..30000")
    if (s.expectPage !== undefined && !locator(s.expectPage)) throw new Error("expectPage 必须为精确匹配的 {by: id|text|type, value}")
  }
  if (!nav.steps.at(-1).expectPage) throw new Error("最后一步必须包含目标页面 expectPage 断言")
}

export async function navigate(nav, call, launchArgs, device, pause = (ms) => new Promise((done) => setTimeout(done, ms))) {
  validateNavigation(nav)
  const layout = async () => {
    const result = await call(["ui", "layout", "--device", device, "--format", "json", "--mode", "full", "--depth", "0"], "component_tree")
    if (result.exitCode !== 0) throw new Error("组件树采集失败")
    return JSON.parse(result.stdout)
  }
  const center = async (locator) => {
    const found = nodes(await layout()).filter((v) => matches(v, locator))
    if (found.length !== 1) throw new Error(`定位结果非唯一: ${locator.by}=${locator.value}`)
    const bounds = found[0].bounds
    const values = Array.isArray(bounds) ? bounds : String(bounds).match(/-?\d+(?:\.\d+)?/g)?.map(Number)
    if (values?.length !== 4 || !values.every(Number.isFinite)) throw new Error("目标组件缺少有效 bounds")
    return [String(Math.round((values[0] + values[2]) / 2)), String(Math.round((values[1] + values[3]) / 2))]
  }
  for (const s of nav.steps) {
    try {
      let args
      if (s.action === "launch") args = launchArgs
      if (s.action === "tap") args = ["ui", "click", "--device", device, ...await center(s.locator)]
      if (s.action === "swipe") args = s.direction ? ["ui", "dircfling", "--device", device, s.direction] : ["ui", "swipe", "--device", device, ...s.from.map(String), ...s.to.map(String)]
      if (s.action === "input") args = ["ui", "text", "--device", device, s.value, ...(s.locator ? await center(s.locator) : [])]
      if (s.action === "wait") await pause(s.timeoutMs)
      if (args && (await call(args)).exitCode !== 0) throw new Error("设备命令失败")
      if (s.expectPage && !nodes(await layout()).some((v) => matches(v, s.expectPage))) throw new Error("目标页面断言未命中")
    } catch (error) { throw new Error(`导航步骤 ${s.stepId}: ${error.message}`) }
  }
}

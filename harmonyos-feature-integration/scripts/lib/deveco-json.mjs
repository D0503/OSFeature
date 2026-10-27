import { stripVTControlCharacters } from "node:util"

function notice(line) {
  const text = stripVTControlCharacters(line).trim()
  return !text || /^New (?:cli|docs) version \d+\.\d+\.\d+(?:[-+][\w.-]+)? available(?:, run `devecocli (?:docs )?update` to upgrade)?$/.test(text) ||
    /^[-✔✓]?\s*Dumping layout(?:\.{3}|…)?$/.test(text)
}

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value)

export function parseDevecoJson(stdout, kind) {
  const label = kind === "layout" ? "组件树" : kind === "app" ? "应用模块信息" : "设备信息"
  if (typeof stdout !== "string") throw new Error(`${label}输出解析失败：stdout 不是文本`)
  let data
  try {
    data = JSON.parse(stdout)
  } catch {
    // Only discard recognized outer lines; never repair JSON or select one of multiple payloads.
    const lines = stdout.split(/\r?\n/)
    while (lines.length && notice(lines[0])) lines.shift()
    while (lines.length && notice(lines.at(-1))) lines.pop()
    try { data = JSON.parse(lines.join("\n")) }
    catch { throw new Error(`${label}输出解析失败：stdout 中没有唯一完整的 JSON，或包含未识别文本；请查看原始 stdout/stderr 证据`) }
  }
  if (kind === "layout") {
    const node = (value) => object(value) && (object(value.attributes) || Array.isArray(value.children) || ["id", "text", "type"].some((key) => typeof value[key] === "string"))
    if (!(Array.isArray(data) ? data.every(node) : node(data))) throw new Error(`${label}输出解析失败：JSON 结构不是组件树`)
  } else if (kind === "app") {
    if (!object(data) || !Array.isArray(data.hapModuleInfos)) throw new Error(`${label}输出解析失败：缺少 hapModuleInfos`)
  } else {
    const device = data?.device ?? data?.data ?? data
    if (!object(device) || !["name", "model", "serial", "serialNumber", "deviceType", "type", "connectType", "osVersion", "isEmulator"].some((key) => Object.hasOwn(device, key))) {
      throw new Error(`${label}输出解析失败：JSON 结构不是设备信息`)
    }
  }
  return data
}

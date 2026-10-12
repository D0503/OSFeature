#!/usr/bin/env node

import { execFile } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function parsePayload(stdout) {
  let payload
  try { payload = JSON.parse(stdout) } catch { throw new Error("devecocli emulator list 未返回有效 JSON") }
  if (!Array.isArray(payload)) throw new Error("devecocli emulator list 返回格式无效：预期为数组")
  return payload
}

export function normalizeInstalledEmulators(payload) {
  if (!Array.isArray(payload)) throw new Error("模拟器清单必须是数组")
  const seen = new Set()
  return payload.map((item, index) => {
    const name = text(item?.name)
    if (!name) throw new Error(`模拟器清单第 ${index + 1} 项缺少 name`)
    if (seen.has(name)) throw new Error(`模拟器名称重复，无法安全选择: ${name}`)
    seen.add(name)
    const status = text(item?.status) ?? "unknown"
    return {
      selectionId: name,
      name,
      status,
      running: ["running", "started", "online"].includes(status.toLowerCase()),
      serial: text(item?.serial),
      deviceType: text(item?.deviceType),
      osVersion: text(item?.osVersion),
    }
  }).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
}

export async function listInstalledEmulators(options = {}) {
  const run = options.commandRunner ?? (async () => {
    const { stdout } = await execFileAsync("devecocli", ["emulator", "list", "--format", "json"], {
      cwd: options.cwd,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    return stdout
  })
  const stdout = await run(["emulator", "list", "--format", "json"])
  const candidates = normalizeInstalledEmulators(parsePayload(typeof stdout === "string" ? stdout : stdout?.stdout ?? ""))
  return {
    status: candidates.length ? "selection_required" : "none_installed",
    requiresUserSelection: candidates.length > 0,
    candidates,
    nextAction: candidates.length
      ? "向用户展示全部候选并等待其明确选择；即使只有一个候选也不得自动选中。"
      : "未安装模拟器；停止模拟器验证并请用户安装模拟器或改选真机。",
  }
}

async function main() {
  const result = await listInstalledEmulators({ cwd: process.cwd() })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.candidates.length) process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error), script: fileURLToPath(import.meta.url), directory: dirname(fileURLToPath(import.meta.url)) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

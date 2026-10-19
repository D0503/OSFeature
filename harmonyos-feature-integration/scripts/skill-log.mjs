#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { openLog, executeLoggedCommand } from "./lib/skill-log.mjs"

let log
try {
  const [operation, ...argv] = process.argv.slice(2)
  const boundary = argv.indexOf("--")
  const flags = boundary < 0 ? argv : argv.slice(0, boundary)
  const args = {}
  // Bootstrap before strict parsing so malformed requests still have a log.
  const value = (key) => { const i = flags.indexOf(`--${key}`); return i >= 0 && flags[i + 1] && !flags[i + 1].startsWith("--") ? flags[i + 1] : undefined }
  log = openLog({ project: value("project"), session: value("log-session") })
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i].replace(/^--/, "")
    if (!flags[i].startsWith("--") || !["project", "log-session", "file", "status", "summary", "cwd", "timeout"].includes(key) || args[key] || !flags[i + 1] || flags[i + 1].startsWith("--")) throw new Error(`无效参数: ${flags[i]}`)
    args[key] = flags[i + 1]
  }
  if (!["start", "event", "exec", "finish"].includes(operation)) throw new Error("用法: skill-log.mjs start|event|exec|finish [--project 路径] [--log-session 会话目录]")
  if (operation !== "start" && !args["log-session"]) throw new Error("event/exec/finish 必须提供 --log-session")
  if (operation === "event") {
    const event = JSON.parse(await readFile(args.file, "utf8"))
    if (!event || typeof event !== "object" || Array.isArray(event) || !["stage", "status", "summary"].every((key) => typeof event[key] === "string" && event[key].trim())) throw new Error("事件必须包含非空 stage、status、summary")
    log.event({ ...event, source: "ai" })
  }
  if (operation === "finish") {
    if (!["passed", "inconclusive", "blocked"].includes(args.status) || !args.summary?.trim()) throw new Error("finish 需要 --status passed|inconclusive|blocked 和 --summary 实际结论")
    const manifest = JSON.parse(await readFile(join(log.metadata.directory, "session.json"), "utf8"))
    log.event({ stage: "session", source: "ai", status: args.status, summary: args.summary, durationMs: Date.now() - Date.parse(manifest.createdAt) })
  }
  if (operation === "exec") {
    const command = argv.slice(boundary + 1)
    if (boundary < 0 || !command.length) throw new Error("exec 需要 -- 可执行文件 参数...")
    const timeout = Number(args.timeout ?? 600000)
    if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("timeout 必须为正毫秒数")
    const result = await executeLoggedCommand({ command: command[0], args: command.slice(1) }, args.cwd ?? args.project ?? process.cwd(), process.env, timeout, { log, passthrough: true })
    process.exitCode = result.exitCode ?? (result.timedOut ? 124 : result.signal === "SIGINT" ? 130 : result.signal ? 143 : 2)
    process.stderr.write(`[skill-log] ${JSON.stringify(log.metadata)}\n`)
  } else process.stdout.write(`${JSON.stringify({ logging: log.metadata }, null, 2)}\n`)
} catch (error) {
  log ??= openLog()
  log.event({ stage: "skill-log", source: "script", status: "failed", error: error.message })
  process.stderr.write(`${JSON.stringify({ error: error.message, logging: log.metadata })}\n`)
  process.exitCode = 2
}

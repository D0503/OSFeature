import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID, createHash } from "node:crypto"
import { appendFileSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { StringDecoder } from "node:string_decoder"
import { spawn } from "node:child_process"

const context = new AsyncLocalStorage()
const secretKey = /password|passwd|passphrase|token|secret|private.?key|authorization|cookie|credential|storePassword|keyPassword/i
const digest = (data) => createHash("sha256").update(data).digest("hex")
const temporaryRoot = () => join(tmpdir(), "harmonyos-skill-logs")
const warning = (message) => process.stderr.write(`[skill-log] ${redactText(message)}\n`)

export function redactText(value) {
  return String(value)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, "[REDACTED PRIVATE KEY]")
    .replace(/\bBearer\s+[^\s"',;]+/gi, "Bearer [REDACTED]")
    .replace(/((?:[\w-]*(?:password|passwd|passphrase|token|secret|private[_-]?key|authorization|cookie|credential)[\w-]*)["']?\s*(?:[:=]\s*|\s+))(?:("[^"\r\n]*"|'[^'\r\n]*')|([^\s,;\r\n}]+))/gi, (_, prefix, quoted) => `${prefix}${quoted ? quoted[0] : ""}[REDACTED]${quoted ? quoted[0] : ""}`)
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
}

export function redact(value, key = "") {
  if (/^(env|environment|processEnv)$/i.test(key)) return "[ENV OMITTED]"
  if (secretKey.test(key)) return "[REDACTED]"
  if (typeof value === "string") return redactText(value)
  if (Array.isArray(value)) return value.map((v, i) => typeof value[i - 1] === "string" && /^--?[\w-]+$/.test(value[i - 1]) && secretKey.test(value[i - 1]) ? "[REDACTED]" : redact(v))
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]))
  return value
}

// Keep incomplete lines private until a credential's boundary is known. PEM blocks
// are suppressed across lines, and StringDecoder preserves split UTF-8 characters.
export function outputRedactor(write) {
  const decoder = new StringDecoder("utf8")
  let pending = "", privateKey = false
  const line = (text) => {
    if (privateKey) {
      const end = /-----END [^-]*PRIVATE KEY-----/.exec(text)
      if (!end) return
      privateKey = false
      text = text.slice(end.index + end[0].length)
    }
    const begin = /-----BEGIN [^-]*PRIVATE KEY-----/.exec(text)
    if (begin && !/-----END [^-]*PRIVATE KEY-----/.test(text.slice(begin.index))) privateKey = true
    write(redactText(text))
  }
  return {
    push(data) {
      pending += decoder.write(Buffer.isBuffer(data) ? data : Buffer.from(data))
      let end
      while ((end = pending.indexOf("\n")) >= 0) { line(pending.slice(0, end + 1)); pending = pending.slice(end + 1) }
    },
    end() { pending += decoder.end(); if (pending) line(pending); pending = "" }
  }
}

function resolveRedirect(directory) {
  let current = resolve(directory)
  const seen = new Set()
  while (existsSync(join(current, "redirect.json"))) {
    if (seen.has(current)) throw new Error("日志会话重定向循环")
    seen.add(current)
    current = JSON.parse(readFileSync(join(current, "redirect.json"), "utf8")).directory
  }
  return current
}

function locked(directory, action) {
  const path = join(directory, ".write-lock")
  const deadline = Date.now() + 5000
  while (true) {
    try { writeFileSync(path, String(process.pid), { flag: "wx" }); break }
    catch (error) {
      if (error.code !== "EEXIST") throw error
      try {
        const pid = Number(readFileSync(path, "utf8"))
        if (pid > 0) { try { process.kill(pid, 0) } catch (e) { if (e.code === "ESRCH") { unlinkSync(path); continue } } }
      } catch {}
      if (Date.now() >= deadline) throw new Error(`日志写入锁超时: ${directory}`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15)
    }
  }
  try { return action() } finally { unlinkSync(path) }
}

function initialize(directory, sessionId, project) {
  mkdirSync(directory, { recursive: true })
  for (const name of ["commands", "evidence"]) mkdirSync(join(directory, name), { recursive: true })
  if (!existsSync(join(directory, "session.json"))) writeFileSync(join(directory, "session.json"), JSON.stringify({ schemaVersion: "1.0", sessionId, project: project ? resolve(project) : null, createdAt: new Date().toISOString() }))
}

function copyLogEntry(source, destination) {
  const info = lstatSync(source)
  if (info.isFile()) copyFileSync(source, destination, constants.COPYFILE_EXCL)
  else if (info.isDirectory()) {
    mkdirSync(destination, { recursive: true })
    for (const entry of readdirSync(source)) copyLogEntry(join(source, entry), join(destination, entry))
  } else throw new Error(`日志目录包含非普通文件: ${source}`)
}

export class SkillLog {
  constructor(directory, sessionId) { this.directory = directory; this.sessionId = sessionId; this.available = true }
  get metadata() {
    try { this.directory = resolveRedirect(this.directory) } catch (error) { warning(error.message); this.available = false }
    return { sessionId: this.sessionId, directory: this.directory, timeline: join(this.directory, "session.log"), events: join(this.directory, "events.jsonl"), available: this.available }
  }
  write(action) {
    try {
      this.directory = resolveRedirect(this.directory)
      return locked(this.directory, () => {
        const redirected = resolveRedirect(this.directory)
        if (redirected !== this.directory) { this.directory = redirected; return locked(redirected, () => action(redirected)) }
        return action(this.directory)
      })
    } catch (error) {
      const previous = this.directory
      const fallback = join(temporaryRoot(), randomUUID())
      warning(`日志写入失败: ${error.message}；尝试临时日志: ${fallback}`)
      try {
        let project
        try { project = JSON.parse(readFileSync(join(previous, "session.json"), "utf8")).project } catch {}
        initialize(fallback, this.sessionId, project)
        // Retain readable prior diagnostics; do not copy an active writer's lock.
        for (const name of ["session.log", "events.jsonl", "commands", "evidence"]) {
          try {
            const path = join(previous, name)
            if (existsSync(path) && (name.endsWith(".log") || name.endsWith(".jsonl") ? statSync(path).isFile() : statSync(path).isDirectory())) copyLogEntry(path, join(fallback, name))
          }
          catch (copyError) { warning(`未能保留旧日志 ${name}: ${copyError.message}`) }
        }
        this.directory = fallback
        return locked(fallback, () => {
          const recovery = { schemaVersion: "1.0", eventId: randomUUID(), timestamp: new Date().toISOString(), sessionId: this.sessionId, pid: process.pid, stage: "session", source: "script", status: "recovered", previous, error: redactText(error.message) }
          appendFileSync(join(fallback, "events.jsonl"), `${JSON.stringify(recovery)}\n`)
          appendFileSync(join(fallback, "session.log"), `${recovery.timestamp} 日志恢复 ${JSON.stringify(recovery)}\n`)
          return action(fallback)
        })
      } catch (fallbackError) { this.available = false; warning(`日志不可用: ${fallbackError.message}；原日志: ${previous}`); return null }
    }
  }
  event(input) {
    const event = { ...redact(input), schemaVersion: "1.0", eventId: randomUUID(), timestamp: new Date().toISOString(), sessionId: this.sessionId, pid: process.pid }
    this.write((directory) => {
      appendFileSync(join(directory, "events.jsonl"), `${JSON.stringify(event)}\n`)
      appendFileSync(join(directory, "session.log"), `${event.timestamp} ${event.stage ?? "skill"} ${event.status ?? "info"} ${JSON.stringify(event)}\n`)
    })
    return event.eventId
  }
  artifact(name, content, { binary = false, ...details } = {}) {
    let data = binary ? content : redactText(Buffer.isBuffer(content) ? content.toString("utf8") : content)
    if (!binary && name.endsWith(".json")) {
      try { data = JSON.stringify(redact(JSON.parse(content.toString())), null, 2) } catch {}
    }
    const file = `${randomUUID()}-${basename(name).replace(/[^\p{L}\p{N}._-]/gu, "_")}`
    const result = this.write((directory) => { const path = join(directory, "evidence", file); writeFileSync(path, data); return path })
    if (result) this.event({ stage: "evidence", status: "saved", source: "script", ...details, path: result, relativePath: `evidence/${file}`, sha256: digest(data), sourceSha256: digest(content) })
    return result
  }
  migrate(project) {
    const destination = join(resolve(project), "os-feature-integration", "logs", this.sessionId)
    this.directory = resolveRedirect(this.directory)
    if (destination === this.directory) return this.metadata
    const previous = this.directory
    try {
      if (!statSync(resolve(project)).isDirectory()) throw new Error(`工程目录无效: ${project}`)
      locked(previous, () => {
        const manifest = JSON.parse(readFileSync(join(previous, "session.json"), "utf8"))
        initialize(destination, this.sessionId, project)
        locked(destination, () => {
          writeFileSync(join(destination, "session.json"), JSON.stringify({ ...manifest, project: resolve(project) }))
          for (const name of ["session.log", "events.jsonl", "commands", "evidence"]) if (existsSync(join(previous, name))) copyLogEntry(join(previous, name), join(destination, name))
          writeFileSync(join(previous, "redirect.tmp"), JSON.stringify({ directory: destination }))
          renameSync(join(previous, "redirect.tmp"), join(previous, "redirect.json"))
        })
      })
      this.directory = destination
      this.event({ stage: "session", status: "migrated", source: "script", previous, project: resolve(project) })
    } catch (error) { warning(`日志迁入失败: ${error.message}；实际位置: ${this.directory}`); this.event({ stage: "session", status: "warning", source: "script", error: error.message, requestedDirectory: destination }) }
    return this.metadata
  }
}

export function openLog({ project, session } = {}) {
  if (session) {
    const directory = resolveRedirect(session)
    const manifest = JSON.parse(readFileSync(join(directory, "session.json"), "utf8"))
    if (manifest.schemaVersion !== "1.0" || !/^[\w-]+$/.test(manifest.sessionId)) throw new Error("无效日志会话")
    if (project && manifest.project && resolve(project) !== resolve(manifest.project)) throw new Error("日志会话属于其他工程")
    const log = new SkillLog(directory, manifest.sessionId)
    if (project && !manifest.project) log.migrate(project)
    return log
  }
  const sessionId = randomUUID()
  let directory = project ? join(resolve(project), "os-feature-integration", "logs", sessionId) : join(temporaryRoot(), sessionId)
  try {
    if (project && !statSync(resolve(project)).isDirectory()) throw new Error(`工程目录无效: ${project}`)
    initialize(directory, sessionId, project)
  }
  catch (error) { directory = join(temporaryRoot(), sessionId); warning(`工程日志不可写: ${error.message}；实际位置: ${directory}`); initialize(directory, sessionId, project) }
  const log = new SkillLog(directory, sessionId)
  log.event({ stage: "session", status: "started", source: "script", project })
  return log
}

export const currentLog = () => context.getStore()?.log
export const logEvent = (event) => currentLog()?.event({ source: "script", ...context.getStore()?.fields, ...event })
export const withLog = (log, action, fields = {}) => context.run({ log, fields }, action)

export async function loggedStage(stage, action, details = {}) {
  const started = Date.now()
  const operationId = randomUUID()
  logEvent({ stage, status: "started", operationId, ...details })
  try {
    const result = await action()
    logEvent({ stage, status: "completed", operationId, durationMs: Date.now() - started, ...details })
    return result
  } catch (error) { logEvent({ stage, status: "failed", operationId, durationMs: Date.now() - started, error: error.message, ...details }); throw error }
}

export function cliLog(stage, argv = process.argv.slice(2)) {
  const value = (key) => { const i = argv.indexOf(`--${key}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined }
  let log
  try { log = openLog({ project: value("project"), session: value("log-session") }) }
  catch (error) {
    log = openLog({ project: value("project") })
    context.enterWith({ log, fields: {} })
    log.event({ stage, status: "failed", source: "script", error: error.message })
    throw error
  }
  const operationId = randomUUID()
  context.enterWith({ log, fields: { operationId }, started: Date.now() })
  log.event({ stage, status: "started", source: "script", operationId, argv })
  return log
}

export function logResult(stage, result, status = "completed") {
  const log = currentLog()
  log?.artifact(`${stage}.json`, JSON.stringify(redact(result), null, 2), { stage, status })
  logEvent({ stage, status, durationMs: context.getStore()?.started ? Date.now() - context.getStore().started : undefined, result })
  return { ...result, logging: log?.metadata }
}

export function executeLoggedCommand(stage, cwd, env, timeout = 600000, { log = currentLog(), passthrough = false } = {}) {
  const commandId = randomUUID(), started = Date.now()
  const fields = { ...context.getStore()?.fields, source: "script", stage: stage.name ?? "command", commandId }
  const files = { stdout: `commands/${commandId}.stdout.log`, stderr: `commands/${commandId}.stderr.log` }
  log?.event({ ...fields, status: "started", command: stage.command, args: stage.args, cwd, ...files })
  for (const file of Object.values(files)) log?.write((directory) => writeFileSync(join(directory, file), ""))
  return new Promise((done) => {
    let stdout = "", stderr = "", timedOut = false, interrupted = null, spawnError = null
    const stdoutDecoder = new StringDecoder("utf8"), stderrDecoder = new StringDecoder("utf8")
    const out = outputRedactor((text) => log?.write((directory) => appendFileSync(join(directory, files.stdout), text)))
    const err = outputRedactor((text) => log?.write((directory) => appendFileSync(join(directory, files.stderr), text)))
    const child = spawn(stage.command, stage.args, { cwd, env, shell: false, detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    const terminate = () => {
      if (!child.pid) return
      if (process.platform === "win32") {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
        killer.once("error", () => child.kill())
        killer.once("close", (code) => { if (code !== 0) child.kill() })
      } else { try { process.kill(-child.pid, "SIGKILL") } catch { child.kill("SIGKILL") } }
    }
    const stop = (signal) => { interrupted = signal; log?.event({ ...fields, status: "interrupted", signal }); terminate() }
    const onInt = () => stop("SIGINT"), onTerm = () => stop("SIGTERM")
    process.once("SIGINT", onInt); process.once("SIGTERM", onTerm)
    const timer = setTimeout(() => { timedOut = true; log?.event({ ...fields, status: "timeout", timeoutMs: timeout }); terminate() }, timeout)
    timer.unref()
    child.stdout.on("data", (data) => { stdout += stdoutDecoder.write(data); out.push(data); if (passthrough) process.stdout.write(data) })
    child.stderr.on("data", (data) => { stderr += stderrDecoder.write(data); err.push(data); if (passthrough) process.stderr.write(data) })
    child.once("error", (error) => { spawnError = error.message; err.push(`${error.message}\n`) })
    child.once("close", (code, signal) => {
      clearTimeout(timer); process.removeListener("SIGINT", onInt); process.removeListener("SIGTERM", onTerm)
      out.end(); err.end()
      stdout += stdoutDecoder.end(); stderr += stderrDecoder.end()
      const exitCode = timedOut || interrupted || spawnError ? null : code
      const reason = spawnError ?? (timedOut ? "命令超时" : interrupted || signal ? `终止信号: ${interrupted ?? signal}` : "")
      log?.event({ ...fields, status: timedOut ? "timeout" : interrupted || signal ? "interrupted" : exitCode === 0 ? "passed" : "failed", exitCode, signal, error: reason || undefined, durationMs: Date.now() - started, ...files })
      done({ exitCode, stdout, stderr: `${stderr}${reason ? `\n${reason}` : ""}`, timedOut, signal: interrupted ?? signal, commandId })
    })
  })
}

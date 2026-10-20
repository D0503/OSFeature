import { spawn } from "node:child_process"
import { access, mkdir, rmdir, utimes } from "node:fs/promises"
import { basename, delimiter, dirname, join, resolve } from "node:path"

const exists = async (path) => { try { await access(path); return true } catch { return false } }

export async function resolveBuildTools(sdkPath, env = process.env) {
  const explicit = env.DEVECO_CLI_STUDIO_PATH || env.DEVECO_CLI_CLT_PATH || env.DEVECO_HOME || env.DEVECO_PATH
  const sdkRoot = basename(sdkPath) === "default" ? dirname(sdkPath) : sdkPath
  const root = explicit ? resolve(explicit) : dirname(sdkRoot)
  const clt = !env.DEVECO_CLI_STUDIO_PATH && Boolean(env.DEVECO_CLI_CLT_PATH)
  const base = process.platform === "darwin" && !clt ? join(root, "Contents") : root
  const tools = clt ? root : join(base, "tools")
  const node = join(clt ? join(root, "tool") : tools, "node", ...(process.platform === "win32" ? ["node.exe"] : ["bin", "node"]))
  const javaHome = clt ? env.JAVA_HOME : process.platform === "darwin" ? join(base, "jbr", "Contents", "Home") : join(base, "jbr")
  const paths = { node, ohpm: join(tools, "ohpm", "bin", "pm-cli.js"), hvigor: join(tools, "hvigor", "bin", "hvigorw.js") }
  for (const [name, path] of Object.entries(paths)) if (!await exists(path)) throw new Error(`未找到 ${name}: ${path}；请配置 DEVECO_CLI_STUDIO_PATH 或 DEVECO_CLI_CLT_PATH`)
  if (!javaHome || !await exists(join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java"))) throw new Error("未找到构建 JDK；CLT 环境需配置 JAVA_HOME")
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH"
  return { ...paths, env: { ...env, JAVA_HOME: javaHome, DEVECO_SDK_HOME: sdkRoot, [pathKey]: `${join(javaHome, "bin")}${delimiter}${env[pathKey] ?? ""}` } }
}

export function buildStages(tools, { product, buildMode, module, modules }) {
  for (const value of [product, buildMode, ...(module ? [module] : [])]) if (!/^[\w.-]+$/.test(value)) throw new Error(`构建选择参数无效: ${value}`)
  const common = ["-p", `product=${product}`, "-p", `buildMode=${buildMode}`, "--analyze=normal", "--parallel", "--incremental", "--no-daemon"]
  let build = ["assembleApp"]
  if (module) {
    const selected = modules.find((item) => item.name === module)
    const task = { entry: "assembleHap", feature: "assembleHap", shared: "assembleHsp", har: "assembleHar" }[selected?.type]
    if (!task) throw new Error(`无法确定模块 ${module} 的构建类型`)
    build = [task, "--mode", "module", "-p", `module=${module}@default`]
  }
  return [
    { name: "ohpm install", command: tools.node, args: [tools.ohpm, "install", "--all"] },
    { name: "hvigor sync", command: tools.node, args: [tools.hvigor, "--sync", ...common] },
    { name: "hvigor build", command: tools.node, args: [tools.hvigor, ...build, ...common] },
  ]
}

export function executeBuildStage(stage, cwd, env, timeout = 600000) {
  return new Promise((done) => {
    const child = spawn(stage.command, stage.args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = "", timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill() }, timeout)
    timer.unref()
    child.stdout.on("data", (data) => { stdout += data.toString() })
    child.stderr.on("data", (data) => { stderr += data.toString() })
    child.once("error", (error) => { clearTimeout(timer); done({ exitCode: null, stdout, stderr: `${stderr}\n${error.message}` }) })
    child.once("close", (code, signal) => { clearTimeout(timer); done({ exitCode: timedOut ? null : code, stdout, stderr: `${stderr}${timedOut ? "\n构建阶段超时" : signal ? `\n终止信号: ${signal}` : ""}` }) })
  })
}

export async function runHvigorBuild(project, selection, { tools, runner = executeBuildStage } = {}) {
  const startedAt = new Date().toISOString()
  const log = []
  let exitCode = null, failedStage = null, locked = false, heartbeat
  const lock = join(project, ".hvigor", ".build-lock")
  try {
    tools ??= await resolveBuildTools(selection.sdkPath)
    const stages = buildStages(tools, selection)
    await mkdir(dirname(lock), { recursive: true })
    await mkdir(lock)
    locked = true
    heartbeat = setInterval(() => { const now = new Date(); utimes(lock, now, now).catch(() => {}) }, 2000)
    heartbeat.unref()
    for (const stage of stages) {
      failedStage = stage.name
      const command = [stage.command, ...stage.args].map((part) => JSON.stringify(part)).join(" ")
      log.push(`[${stage.name}]\n$ ${command}`)
      const result = await runner(stage, project, tools.env)
      log.push(result.stdout ?? "", result.stderr ?? "")
      exitCode = result.exitCode
      if (exitCode !== 0) break
      failedStage = null
    }
  } catch (error) {
    exitCode = null
    log.push(error.code === "EEXIST" ? "工程存在构建锁，请确认已有构建结束后再执行；不自动清理其他构建。" : error.message)
  } finally {
    clearInterval(heartbeat)
    if (locked) await rmdir(lock)
  }
  return { startedAt, endedAt: new Date().toISOString(), exitCode, stdout: log.filter(Boolean).join("\n"), stderr: "", command: "ohpm install --all → hvigor --sync --no-daemon → hvigor build --no-daemon", failedStage }
}

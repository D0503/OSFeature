#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rmdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { evaluateCompatibility, inspectProject, loadFeature, verifyInspection } from "./lib/project-tools.mjs"
import { runHvigorBuild } from "./lib/hvigor-build.mjs"
import { navigate, runDeveco, validateNavigation } from "./lib/development-device.mjs"
import { cacheDirectory, deriveVerdict, exists, fileHash, loadCollection, sameTarget, saveReport, validateChanges } from "./lib/development-report.mjs"

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const check = (status, summary) => ({ status, summary })
const requiredText = (v, name) => { if (typeof v !== "string" || !v.trim()) throw new Error(`${name} 必填`) }

export async function inspectVerification(request) {
  const { profile } = await loadFeature(skillRoot, request.feature)
  const inspection = await inspectProject(request.project, { sdkPath: request.sdk })
  const compatibility = evaluateCompatibility(inspection, profile)
  return { inspection, compatibility, staticResult: verifyInspection(inspection, compatibility, request.route) }
}

export function recomputeStaticCheck(run) {
  const findings = run.staticFindings ?? []
  if (findings.some((f) => f.status === "fail" || f.review?.status === "failed")) run.checks.static = check("failed", "静态检查存在失败项或复核确认的问题，需修复后重验")
  else if (findings.some((f) => f.status === "warn" && !f.review)) run.checks.static = check("inconclusive", findings.filter((v) => v.status === "fail" || (v.status === "warn" && !v.review)).map((v) => `${v.id}: ${v.message}`).join("；") || "静态检查存在待核对项")
  else run.checks.static = check("passed", findings.some((f) => f.review) ? "静态检查通过，warn 项已全部复核" : "静态检查通过")
}

function applyStaticReview(runs, review) {
  const results = review?.results
  if (!Array.isArray(results) || !results.length) throw new Error("staticReview.results 必须是非空数组")
  const warnIds = new Set(runs.flatMap((r) => (r.staticFindings ?? []).filter((f) => f.status === "warn").map((f) => f.id)))
  const byId = new Map()
  for (const item of results) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) throw new Error("staticReview.results[].id 必填")
    if (byId.has(item.id)) throw new Error(`staticReview 结果重复：${item.id}`)
    if (!warnIds.has(item.id)) throw new Error(`staticReview 引用的检查项不存在或不是 warn：${item.id}`)
    if (!["passed", "failed"].includes(item.status)) throw new Error(`staticReview.results 只允许 passed 或 failed：${item.id}`)
    requiredText(item.note, `staticReview 结果 ${item.id} 的 note`)
    byId.set(item.id, { status: item.status, note: item.note })
  }
  for (const run of runs) {
    const findings = run.staticFindings ?? []
    if (!findings.some((f) => f.status === "warn" && byId.has(f.id))) continue
    for (const finding of findings) if (finding.status === "warn" && byId.has(finding.id)) finding.review = structuredClone(byId.get(finding.id))
    recomputeStaticCheck(run)
  }
}

export async function applyJudgment(run, judgment, runs = [run]) {
  if (judgment?.schemaVersion !== "1.0" || judgment.runId !== run.runId || judgment.goal !== run.goal) throw new Error("判定必须绑定本次 runId 与 goal")
  if (judgment.visual || judgment.runtime) for (const key of ["install", "navigation", "build"]) if (run.checks[key].status !== "passed") throw new Error("构建、安装或目标页导航未通过，不能补录效果判定")
  for (const level of ["visual", "runtime"]) {
    const item = judgment[level]
    if (!item) continue
    if (!["passed", "failed", "inconclusive"].includes(item.status)) throw new Error(`${level}.status 无效`)
    requiredText(item.summary, `${level}.summary`)
    if (!Array.isArray(item.evidence) || !item.evidence.length) throw new Error(`${level} 缺少证据引用`)
    const evidence = []
    for (const ref of item.evidence) {
      const e = run.evidence.find((v) => v.id === ref.id && v.sha256 === ref.sha256)
      if (!e || !await exists(e.path) || await fileHash(e.path) !== e.sha256) throw new Error("判定证据不属于本次运行、已丢失或哈希不匹配")
      evidence.push(e)
    }
    if (level === "visual" && !evidence.some((v) => v.type === "screenshot")) throw new Error("视觉判定必须引用本次目标页面截图")
    if (level === "runtime" && !evidence.some((v) => ["runtime_log", "component_tree"].includes(v.type))) throw new Error("运行判定需要日志或交互组件树证据")
    run.checks[level] = check(item.status, item.summary)
  }
  if (!judgment.visual && !judgment.runtime && !judgment.staticReview) throw new Error("判定文件没有 visual、runtime 或 staticReview 结论")
  if (judgment.staticReview) applyStaticReview(runs, judgment.staticReview)
}

export async function verifyDevelopment(request, options = {}) {
  requiredText(request.project, "project")
  const output = resolve(request.output ?? join(request.project, "os-feature-integration"))
  const directory = cacheDirectory(output)
  await mkdir(directory, { recursive: true })
  const lock = join(directory, "lock")
  try { await mkdir(lock) } catch { throw new Error("同一报告已有验证正在执行，请等待其结束") }
  try {
    const { collection } = await loadCollection(output, request.project)
    if (request.resume) {
      if (!request.judgment || request.executeBuild || request.executeRun || request.navigate || request.captureScreenshot || request.captureLayout || request.changes) throw new Error("resume 仅允许补录 judgment，不执行构建或设备操作")
      const run = collection.runs.find((v) => v.runId === request.resume)
      if (!run) throw new Error("运行记录不存在或已被重验替换")
      await applyJudgment(run, request.judgment, collection.runs)
      const report = await saveReport(output, directory, collection)
      return { runId: run.runId, report, status: deriveVerdict(run), evidence: run.evidence }
    }
    for (const key of ["feature", "goal", "route"]) requiredText(request[key], key)
    const { feature, profile } = await loadFeature(skillRoot, request.feature)
    if (!profile.routes.some((r) => r.id === request.route)) throw new Error(`route 必须明确选择 ${profile.routes.map((r) => r.id).join(" 或 ")}；组合路线分别验证`)
    validateChanges(request.changes)
    if (request.navigate) validateNavigation(request.navigate)
    if (request.judgment) throw new Error("先执行验证，再用 --resume 与 --judgment 补录本次观察")
    const runId = randomUUID()
    const runDirectory = join(directory, runId)
    await mkdir(runDirectory)
    const run = {
      runId, project: resolve(request.project), feature: request.feature, featureName: feature.displayName, goal: request.goal, route: request.route,
      product: request.product ?? "default", buildMode: request.buildMode ?? "debug", module: request.module ?? null,
      changes: structuredClone(request.changes), createdAt: new Date().toISOString(), device: request.device ?? null, evidence: [],
      checks: Object.fromEntries(["static", "sdk", "build", "install", "navigation", "runtime", "visual"].map((key) => [key, check("not_run", "尚未执行")]))
    }
    const record = async (type, content, extension = "log") => {
      const id = `E${run.evidence.length + 1}`
      const path = join(runDirectory, `${id}.${extension}`)
      await writeFile(path, content)
      const item = { id, type, path, sha256: await fileHash(path) }
      run.evidence.push(item)
      return item
    }
    const call = async (args, type = "device_log") => {
      let result
      try { result = await (options.commandRunner ?? runDeveco)(args, request.project) }
      catch (error) { result = { exitCode: null, stdout: "", stderr: error.message } }
      await record(result.exitCode === 0 ? type : "command_failure", `${JSON.stringify(args)}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`)
      return result
    }
    const { inspection, compatibility, staticResult } = await (options.inspector ?? inspectVerification)(request)
    run.after = { sdk: inspection.localSdk.apiVersion ?? "unknown", compile: inspection.api.compile, target: inspection.api.target, compatible: inspection.api.compatible }
    await record("static", JSON.stringify({ inspection, compatibility, staticResult }, null, 2), "json")
    run.checks.sdk = compatibility.availableRoutes?.includes(run.route) && inspection.localSdk.status === "valid" ? check("passed", `本机 SDK API ${run.after.sdk}，${run.route} 路线可用`) : check("failed", "本机 SDK 或工程版本不满足所选路线，需先完成版本门禁")
    run.staticFindings = staticResult.checks.filter((v) => ["fail", "warn"].includes(v.status))
    const priorReviews = new Map(collection.runs.flatMap((r) => (r.staticFindings ?? []).filter((f) => f.review).map((f) => [f.id, f.review])))
    for (const finding of run.staticFindings) if (finding.status === "warn" && priorReviews.has(finding.id)) finding.review = structuredClone(priorReviews.get(finding.id))
    recomputeStaticCheck(run)
    if (staticResult.counts.fail && run.checks.static.status !== "failed") run.checks.static = check("failed", "静态门禁失败")
    run.checks.build = check("not_run", "未请求构建")
    if (run.checks.sdk.status === "failed" || run.checks.static.status === "failed") run.checks.build.summary = "SDK 或静态门禁失败，未构建"
    else if (request.executeBuild) {
      let result
      try { result = await (options.buildRunner ?? runHvigorBuild)(request.project, { product: run.product, buildMode: run.buildMode, module: run.module, modules: inspection.modules, sdkPath: inspection.localSdk.path }) }
      catch (error) { result = { exitCode: null, stderr: error.message } }
      await record("build_log", `${result.stdout ?? ""}\n${result.stderr ?? ""}`)
      run.checks.build = check(result.exitCode === 0 ? "passed" : "failed", result.exitCode === 0 ? "ohpm、Hvigor 同步与打包通过" : `构建失败：${result.failedStage ?? "工具或构建阶段"}；${(result.stderr || result.stdout || "无输出").slice(-1800)}`)
      if (result.exitCode !== 0) run.checks.build.reportSummary = `构建失败，停止于${{ "ohpm install": "依赖安装", "hvigor sync": "工程同步", "hvigor build": "HAP 打包" }[result.failedStage] ?? "构建工具执行阶段"}；未继续安装，修复后需重验`
    }
    const launchArgs = ["run", "--skip-build", "--product", run.product, "--build-mode", run.buildMode, "--device", request.device ?? ""]
    if (run.module) launchArgs.push("--module", run.module)
    if (request.ability) launchArgs.push("--ability", request.ability)
    run.checks.install.summary = !request.executeRun ? "未请求安装运行" : !request.device ? "未指定目标设备，需先选择设备" : "本轮构建未通过，未安装运行"
    if (request.executeRun && request.device && run.checks.build.status === "passed") {
      const info = await call(["device", "view", "--target", request.device, "--format", "json"])
      run.deviceInfo = info.exitCode === 0 ? info.stdout.trim() : "系统信息采集失败"
      const result = await call(launchArgs)
      run.checks.install = check(result.exitCode === 0 ? "passed" : "failed", result.exitCode === 0 ? "应用已安装并启动" : `安装或启动失败：${(result.stderr || result.stdout || "无输出").slice(-1200)}`)
    }
    run.checks.navigation.summary = run.checks.install.status !== "passed" ? "应用未成功安装启动" : "未提供目标页导航与断言"
    if (run.checks.install.status === "passed" && request.navigate) {
      try {
        await navigate(request.navigate, call, launchArgs, request.device, options.pause)
        run.checks.navigation = check("passed", "导航完成，目标页面断言通过")
      } catch (error) { run.checks.navigation = check("failed", error.message) }
    }
    if (run.checks.navigation.status === "passed") {
      run.checks.runtime = check("inconclusive", "已进入目标页，交互与启动时机仍需结合运行证据判定")
      const logArgs = ["log", "--device", request.device, "--from", "1m", "--tail", "200"]
      if (request.bundle) logArgs.push("--bundle-name", request.bundle)
      await call(logArgs, "runtime_log")
      if (request.captureLayout) await call(["ui", "layout", "--device", request.device, "--format", "json", "--mode", "full", "--depth", "0"], "component_tree")
      run.checks.visual = check("not_run", "尚未采集截图或提供视觉判定")
      if (request.captureScreenshot) {
        const path = join(runDirectory, "target.png")
        const result = await call(["ui", "screenshot", "--device", request.device, "--path", path])
        if (result.exitCode === 0 && await exists(path) && (await readFile(path)).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
          run.evidence.push({ id: `E${run.evidence.length + 1}`, type: "screenshot", path, sha256: await fileHash(path) })
          run.checks.visual = check("inconclusive", "已采集目标页截图，等待 AI 实际阅读并补录判定")
        } else run.checks.visual = check("not_run", "截图采集失败或文件不是有效 PNG，未完成视觉验证")
      }
    } else {
      run.checks.runtime.summary = `未完成目标页验证：${run.checks.navigation.summary}`
      run.checks.visual.summary = `未完成目标页视觉验证：${run.checks.build.status !== "passed" ? run.checks.build.summary : run.checks.install.status !== "passed" ? run.checks.install.summary : run.checks.navigation.summary}`
    }
    const previous = collection.runs.find((r) => sameTarget(r, run))
    if (previous) {
      for (const key of ["sdk", "compile", "target", "compatible"]) {
        if (Number.isInteger(previous.changes.before[key])) run.changes.before[key] = previous.changes.before[key]
      }
    }
    collection.runs = collection.runs.filter((r) => !sameTarget(r, run))
    collection.runs.push(run)
    const report = await saveReport(output, directory, collection)
    return { runId, report, status: deriveVerdict(run), evidence: run.evidence }
  } finally { await rmdir(lock) }
}

export function parseDevelopmentArgs(argv) {
  const flags = new Set(["execute-build", "execute-run", "capture-screenshot", "capture-layout"])
  const values = new Set(["project", "feature", "route", "goal", "changes", "sdk", "product", "module", "ability", "bundle", "build-mode", "device", "navigate", "output", "resume", "judgment"])
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "")
    if (!argv[i].startsWith("--") || (!flags.has(name) && !values.has(name))) throw new Error(`未知参数 ${argv[i]}`)
    if (name in args) throw new Error(`重复参数 ${name}`)
    if (flags.has(name)) args[name] = true
    else { if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`缺少 ${name} 值`); args[name] = argv[++i] }
  }
  return Object.fromEntries(Object.entries(args).map(([key, value]) => [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const request = parseDevelopmentArgs(process.argv.slice(2))
    for (const key of ["changes", "navigate", "judgment"]) if (request[key]) request[key] = JSON.parse(await readFile(request[key], "utf8"))
    const result = await verifyDevelopment(request)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status === "failed") process.exitCode = 1
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2 }
}

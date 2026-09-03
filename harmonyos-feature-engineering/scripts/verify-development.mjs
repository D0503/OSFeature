#!/usr/bin/env node

import { execFile, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { loadCapability, resolveScenario } from "./lib/capability-tools.mjs"
import { inspectDevelopmentProject, runStaticScenarioChecks, sdkCheckFromInspection } from "./lib/development-project.mjs"
import { compareFileBaseline } from "./snapshot-project-files.mjs"
import { deriveDevelopmentVerdict, validateDevelopmentReport } from "./validate-development-report.mjs"
import { renderDevelopmentReport } from "./render-development-report.mjs"

const execFileAsync = promisify(execFile)

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

function check(required, status, summary, evidenceRefs = [], extra = {}) {
  return { required, status, summary, evidenceRefs, ...extra }
}

function validateCliToken(value, label) {
  if (typeof value !== "string" || !value || /[\0\r\n]/.test(value)) throw new Error(`${label} 无效`)
  return value
}

async function devecoInvocation() {
  if (process.platform !== "win32") return { command: "devecocli", prefix: [] }
  const { stdout } = await execFileAsync("where.exe", ["devecocli.cmd"], { windowsHide: true })
  const wrapper = stdout.split(/\r?\n/).map((item) => item.trim()).find((item) => item.toLowerCase().endsWith(".cmd"))
  if (!wrapper) throw new Error("无法安全定位 devecocli.cmd")
  const entry = resolve(dirname(wrapper), "node_modules", "@deveco", "deveco-cli", "dist", "cli.js")
  if (!(await exists(entry))) throw new Error(`无法定位 devecocli Node 入口: ${entry}`)
  return { command: process.execPath, prefix: [entry] }
}

async function runDeveco(args, cwd) {
  for (const item of args) validateCliToken(item, "devecocli 参数")
  const invocation = await devecoInvocation()
  return await new Promise((resolveResult) => {
    const startedAt = new Date().toISOString()
    const child = spawn(invocation.command, [...invocation.prefix, ...args], {
      cwd,
      shell: false,
      windowsHide: true,
      timeout: 10 * 60 * 1000,
      env: process.env,
    })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", (error) => resolveResult({ startedAt, endedAt: new Date().toISOString(), exitCode: null, stdout, stderr: `${stderr}\n${error.message}`.trim(), command: `devecocli ${args.join(" ")}` }))
    child.on("close", (code) => resolveResult({ startedAt, endedAt: new Date().toISOString(), exitCode: code, stdout, stderr, command: `devecocli ${args.join(" ")}` }))
  })
}

async function appendCommandEvidence(evidence, outputDirectory, type, name, result, summary) {
  const content = [`$ ${result.command}`, result.stdout, result.stderr].filter(Boolean).join("\n")
  let path = null
  if (outputDirectory) {
    const evidenceDirectory = join(outputDirectory, "evidence")
    await mkdir(evidenceDirectory, { recursive: true })
    path = join(evidenceDirectory, name)
    await writeFile(path, content, "utf8")
  }
  const item = {
    id: `EVID-${String(evidence.length + 1).padStart(3, "0")}`,
    type,
    path,
    sha256: digest(content),
    capturedAt: result.endedAt,
    summary,
    command: result.command,
    exitCode: result.exitCode,
    excerpt: content.slice(-2000),
  }
  evidence.push(item)
  return item.id
}

async function appendObservationEvidence(evidence, item, fallbackSummary) {
  let sha256 = item.sha256 ?? null
  if (!sha256 && item.path && await exists(item.path)) sha256 = digest(await readFile(item.path))
  if (!sha256) sha256 = digest(item.summary ?? fallbackSummary)
  const evidenceItem = {
    id: `EVID-${String(evidence.length + 1).padStart(3, "0")}`,
    type: item.type,
    path: item.path ?? null,
    sha256,
    capturedAt: item.capturedAt ?? new Date().toISOString(),
    summary: item.summary ?? fallbackSummary,
  }
  evidence.push(evidenceItem)
  return evidenceItem.id
}

export async function runDevelopmentVerification(skillRoot, request, options = {}) {
  const capability = await loadCapability(skillRoot, request.feature ?? "immersive-light")
  const resolution = resolveScenario(capability, request.goal, request.target)
  if (resolution.status !== "resolved") return { report: null, resolution, rendered: null }
  const scenario = resolution.selected
  const inspection = await inspectDevelopmentProject(request.project, capability, {
    scenario,
    module: request.module,
    component: request.component,
    targetFiles: request.targetFiles ?? [],
    product: request.product,
    buildMode: request.buildMode,
    sdkPath: request.sdk,
  })
  const evidence = []
  const required = new Set(scenario.requiredChecks)
  const checks = Object.fromEntries(["static", "sdk", "build", "install", "runtime", "visual"].map((level) => [level, check(required.has(level), "not_run", "未执行。")]))

  const staticResult = await runStaticScenarioChecks(request.project, scenario, inspection)
  const staticText = JSON.stringify(staticResult)
  evidence.push({ id: "EVID-001", type: "static", path: null, sha256: digest(staticText), capturedAt: new Date().toISOString(), summary: `场景静态规则：${staticResult.status}`, details: staticResult })
  checks.static = check(required.has("static"), staticResult.status, staticResult.status === "passed" ? "场景静态规则通过。" : "场景静态规则存在失败或待人工确认项。", ["EVID-001"])

  const sdkResult = sdkCheckFromInspection(inspection)
  const sdkRefs = []
  for (const declaration of sdkResult.evidence ?? []) {
    const item = { id: `EVID-${String(evidence.length + 1).padStart(3, "0")}`, type: "sdk_declaration", path: declaration.path, sha256: declaration.sha256, capturedAt: inspection.inspectedAt, summary: "本机 SDK 声明文件" }
    evidence.push(item)
    sdkRefs.push(item.id)
  }
  checks.sdk = check(required.has("sdk"), sdkResult.status, sdkResult.message, sdkRefs)

  let buildResult = null
  if (inspection.compatibility.status !== "supported") {
    checks.build = check(required.has("build"), "blocked", `兼容门禁未通过：${inspection.compatibility.reasons.join("；")}`)
  } else if (options.executeBuild) {
    const product = validateCliToken(request.product ?? inspection.product.selected?.name ?? "default", "product")
    const buildMode = validateCliToken(request.buildMode ?? "debug", "build mode")
    const args = ["build", "--product", product, "--build-mode", buildMode]
    if (request.module) args.push("--modules", validateCliToken(request.module, "module"))
    buildResult = await runDeveco(args, request.project)
    const id = await appendCommandEvidence(evidence, options.outputDirectory, "build_log", "build.log", buildResult, buildResult.exitCode === 0 ? "devecocli build 成功" : "devecocli build 失败")
    checks.build = check(required.has("build"), buildResult.exitCode === 0 ? "passed" : "failed", buildResult.exitCode === 0 ? "真实 debug 构建通过。" : `构建失败，退出码 ${buildResult.exitCode ?? "unknown"}。`, [id], { command: buildResult.command, exitCode: buildResult.exitCode, repairAttempts: options.repairAttempts ?? 0 })
  } else {
    checks.build = check(required.has("build"), "not_run", "尚未执行 devecocli build。")
  }

  let runResult = null
  const observations = options.observations ?? {}
  if (options.executeRun && checks.build.status === "passed" && request.device) {
    const args = ["run", "--skip-build", "--device", validateCliToken(request.device, "device")]
    if (request.module) args.push("--module", validateCliToken(request.module, "module"))
    if (request.product) args.push("--product", validateCliToken(request.product, "product"))
    if (request.buildMode) args.push("--build-mode", validateCliToken(request.buildMode, "build mode"))
    runResult = await runDeveco(args, request.project)
    const id = await appendCommandEvidence(evidence, options.outputDirectory, "device_log", "device-run.log", runResult, runResult.exitCode === 0 ? "devecocli run 安装并拉起成功" : "devecocli run 失败")
    checks.install = check(required.has("install"), runResult.exitCode === 0 ? "passed" : "failed", runResult.exitCode === 0 ? "应用安装并拉起。" : "安装或拉起失败。", [id], { command: runResult.command, exitCode: runResult.exitCode })
    if (runResult.exitCode === 0) checks.runtime = check(required.has("runtime"), "inconclusive", "应用已拉起，但尚无可区分规范预期的运行观察。", [id])
    else checks.runtime = check(required.has("runtime"), "not_run", "安装/拉起失败，未进入运行观察。")
  } else {
    const reason = !options.executeRun ? "未请求运行验证。" : !request.device ? "未选择唯一设备；不自动创建或下载模拟器。" : "构建未通过，未运行。"
    checks.install = check(required.has("install"), "not_run", reason)
    checks.runtime = check(required.has("runtime"), "not_run", reason)
  }

  for (const level of ["runtime", "visual"]) {
    const observation = observations[level]
    if (!observation) continue
    const refs = []
    for (const item of observation.evidence ?? []) refs.push(await appendObservationEvidence(evidence, item, `${level} 观察证据`))
    checks[level] = check(required.has(level), observation.status, observation.summary, refs)
  }
  if (!observations.visual) checks.visual = check(required.has("visual"), "not_run", "没有截图、录屏或用户明确观察，不能判定视觉成功。")

  let changes = []
  if (options.baseline) changes = (await compareFileBaseline(options.baseline)).changes
  const conflictingFactRefs = scenario.factRefs.filter((id) => capability.factsData.facts.find((fact) => fact.id === id)?.normativeStatus === "conflicting")
  const report = {
    verificationVersion: "1.0",
    mode: "code-development-validation",
    input: {
      feature: capability.feature.id,
      project: resolve(request.project),
      goal: request.goal,
      module: request.module ?? null,
      component: request.component ?? null,
      targetFiles: request.targetFiles ?? [],
      product: request.product ?? inspection.product.selected?.name ?? null,
      buildMode: request.buildMode ?? "debug",
      device: request.device ?? null,
    },
    capabilityPackage: {
      featureId: capability.feature.id,
      version: capability.feature.packageVersion,
      digest: capability.lock.packageDigest,
      scenarioId: scenario.id,
      requiredChecks: scenario.requiredChecks,
      factRefs: scenario.factRefs,
      conflictingFactRefs,
    },
    projectBaseline: inspection,
    changes,
    compatibility: inspection.compatibility,
    checks,
    evidence,
    pendingVerifications: [],
    verdict: {
      status: "blocked",
      summary: "待计算。",
      matchedFactRefs: observations.matchedFactRefs ?? [],
    },
  }
  for (const level of scenario.requiredChecks) {
    if (["not_run", "blocked", "inconclusive"].includes(checks[level].status)) report.pendingVerifications.push({ id: `PENDING-${String(report.pendingVerifications.length + 1).padStart(3, "0")}`, level, reason: checks[level].summary, required: true })
  }
  report.verdict.status = deriveDevelopmentVerdict(report)
  report.verdict.summary = {
    passed: "所有必需验证层均有通过证据。",
    passed_with_spec_conflict: "实现与运行验证成功，但实际行为只匹配冲突规范中的一个预期。",
    build_passed_runtime_pending: "静态、SDK 和构建已通过，仍缺少必需设备运行或视觉证据。",
    inconclusive: "已执行的证据不足以区分规范预期或确认必需层。",
    failed: "至少一个已执行的必需验证层失败，或结果不匹配任何规范预期。",
    blocked: "工程、SDK、授权或核心执行前提未满足。",
  }[report.verdict.status]
  const validation = validateDevelopmentReport(report)
  if (!validation.valid) throw new Error(`生成的报告无效: ${validation.errors.join("; ")}`)
  const rendered = options.outputDirectory ? await renderDevelopmentReport(report, options.outputDirectory) : null
  return { report, resolution, rendered, buildResult, runResult }
}

function parseArgs(argv) {
  const flags = new Set(["execute-build", "execute-run"])
  const valued = new Set(["project", "feature", "goal", "target", "component", "module", "target-files", "product", "build-mode", "device", "sdk", "baseline", "observations", "output", "repair-attempts", "skill-root"])
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) throw new Error(`未知参数: ${token}`)
    const key = token.slice(2)
    if (flags.has(key)) { result[key] = true; continue }
    if (!valued.has(key)) throw new Error(`未知参数: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    result[key] = value
    index += 1
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.project || !args.goal) throw new Error("用法: node verify-development.mjs --project <绝对路径> --goal <开发目标> --execute-build [--execute-run --device <设备>] [--output <绝对目录>]")
  if (!isAbsolute(args.project)) throw new Error("project 必须是绝对路径")
  if (args.output && !isAbsolute(args.output)) throw new Error("output 必须是绝对路径")
  const repairAttempts = Number(args["repair-attempts"] ?? 0)
  if (!Number.isInteger(repairAttempts) || repairAttempts < 0 || repairAttempts > 2) throw new Error("repair-attempts 必须是 0 到 2")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const baseline = args.baseline ? JSON.parse(await readFile(args.baseline, "utf8")) : null
  const observations = args.observations ? JSON.parse(await readFile(args.observations, "utf8")) : null
  const result = await runDevelopmentVerification(args["skill-root"] ?? scriptRoot, {
    feature: args.feature,
    project: args.project,
    goal: args.goal,
    target: args.component ?? args.target,
    component: args.component ?? args.target,
    module: args.module,
    targetFiles: args["target-files"] ? args["target-files"].split(";").filter(Boolean) : [],
    product: args.product,
    buildMode: args["build-mode"],
    device: args.device,
    sdk: args.sdk,
  }, {
    executeBuild: Boolean(args["execute-build"]),
    executeRun: Boolean(args["execute-run"]),
    outputDirectory: args.output,
    baseline,
    observations,
    repairAttempts,
  })
  process.stdout.write(`${JSON.stringify(result.report ? { verdict: result.report.verdict, rendered: result.rendered, report: args.output ? undefined : result.report } : { resolution: result.resolution }, null, 2)}\n`)
  if (!result.report || ["failed", "blocked", "inconclusive"].includes(result.report.verdict.status)) process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

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
import { resolveReportOutputDirectory } from "./lib/report-output.mjs"
import { buildImplementationTrace } from "./lib/implementation-trace.mjs"
import { scenarioArtifactsDirectory } from "./lib/artifacts-dir.mjs"

const execFileAsync = promisify(execFile)

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex")
}

function nextEvidenceId(evidence) {
  return `EVID-${String(evidence.length + 1).padStart(3, "0")}`
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

const NAVIGATION_ACTIONS = new Set(["launch", "tap", "swipe", "input", "wait"])
const NAVIGATION_LOCATOR_BY = new Set(["text", "id", "type"])

function validateNavigationSteps(navigation) {
  const invalid = []
  if (navigation?.schemaVersion !== "1.0") invalid.push("schemaVersion 必须为 1.0")
  if (!Array.isArray(navigation?.steps) || !navigation.steps.length) invalid.push("steps 必须是非空数组")
  else {
    const seen = new Set()
    for (const [index, step] of navigation.steps.entries()) {
      const path = `steps[${index}]`
      if (typeof step?.stepId !== "string" || !step.stepId.trim()) invalid.push(`${path}.stepId 必须是非空字符串`)
      else if (seen.has(step.stepId)) invalid.push(`${path}.stepId 重复`)
      else seen.add(step.stepId)
      if (!NAVIGATION_ACTIONS.has(step?.action)) invalid.push(`${path}.action 仅支持 launch/tap/swipe/input/wait`)
      if (step?.action === "launch" && (typeof step?.target !== "string" || !step.target.trim())) invalid.push(`${path}.launch 必须提供 target`)
      if (step?.action === "tap") {
        const locator = step?.locator
        if (!locator || !NAVIGATION_LOCATOR_BY.has(locator.by) || typeof locator.value !== "string" || !locator.value.trim()) invalid.push(`${path}.tap 必须提供 locator（by: text|id|type + value）`)
      }
      if (step?.action === "swipe") {
        const hasDirection = typeof step?.direction === "string" && ["up", "down", "left", "right"].includes(step.direction)
        const hasCoords = Array.isArray(step?.from) && step.from.length === 2 && Array.isArray(step?.to) && step.to.length === 2 && [...step.from, ...step.to].every(Number.isFinite)
        if (!hasDirection && !hasCoords) invalid.push(`${path}.swipe 必须提供 direction(up|down|left|right) 或 from/to 坐标`)
      }
      if (step?.action === "input") {
        if (typeof step?.value !== "string" || !step.value.length) invalid.push(`${path}.input 必须提供 value`)
        if (step?.locator && (!NAVIGATION_LOCATOR_BY.has(step.locator.by) || typeof step.locator.value !== "string" || !step.locator.value.trim())) invalid.push(`${path}.input 的 locator 无效`)
      }
      if (step?.action === "wait" && (!Number.isInteger(step?.timeoutMs) || step.timeoutMs <= 0 || step.timeoutMs > 30000)) invalid.push(`${path}.wait 必须提供正整数 timeoutMs（不超过 30000）`)
      if (step?.expectPage !== undefined && typeof step.expectPage !== "string") invalid.push(`${path}.expectPage 必须是字符串`)
    }
  }
  return invalid
}

function parseLayoutBounds(bounds) {
  if (typeof bounds === "string") {
    const match = bounds.match(/\[?(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\]?/)
    if (match) return { cx: Math.round((Number(match[1]) + Number(match[3])) / 2), cy: Math.round((Number(match[2]) + Number(match[4])) / 2) }
  }
  if (Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite)) {
    return { cx: Math.round((bounds[0] + bounds[2]) / 2), cy: Math.round((bounds[1] + bounds[3]) / 2) }
  }
  return null
}

function findNodeInLayout(root, by, value) {
  let found = null
  const visit = (node) => {
    if (found || !node || typeof node !== "object") return
    const attrs = node.attributes ?? node
    const text = String(attrs.text ?? "")
    const id = String(attrs.id ?? "")
    const type = String(attrs.type ?? "")
    const matched = by === "text" ? text.includes(value) : by === "id" ? id === value : type === value
    if (matched) {
      const center = parseLayoutBounds(attrs.bounds ?? node.bounds)
      if (center) { found = center; return }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(root)
  return found
}

const FAITHFULNESS_VERDICTS = new Set(["faithful", "unfaithful", "cannot_determine"])

function validateFaithfulness(faithfulness, scenario) {
  const invalid = []
  if (faithfulness?.schemaVersion !== "1.0") invalid.push("schemaVersion 必须为 1.0")
  if (faithfulness?.scenarioId !== scenario.id) invalid.push(`scenarioId 必须为 ${scenario.id}`)
  if (!Array.isArray(faithfulness?.verdicts)) invalid.push("verdicts 必须是数组")
  else {
    const expected = new Set(scenario.factRefs)
    const provided = new Set()
    for (const [index, item] of faithfulness.verdicts.entries()) {
      const label = `verdicts[${index}]`
      if (!expected.has(item?.factId)) invalid.push(`${label}.factId 不属于场景 ${scenario.id}`)
      else if (provided.has(item.factId)) invalid.push(`${label}.factId 重复`)
      else provided.add(item.factId)
      if (!FAITHFULNESS_VERDICTS.has(item?.verdict)) invalid.push(`${label}.verdict 必须是 faithful/unfaithful/cannot_determine`)
      if (typeof item?.basis !== "string" || !item.basis.trim()) invalid.push(`${label}.basis 必须是非空字符串`)
    }
    for (const id of expected) if (!provided.has(id)) invalid.push(`缺少事实 ${id} 的判定`)
  }
  return invalid
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
  // 开发报告与 evidence 默认统一写入 <工程>/ohos-feature-engineering/<场景ID>/（过程产物单一目录），显式 --output 优先；
  const outputDirectory = options.outputDirectory !== undefined && options.outputDirectory !== null
    ? resolveReportOutputDirectory(options.outputDirectory)
    : scenarioArtifactsDirectory(request.project, scenario.id)
  if (options.baseline && resolve(options.baseline.projectRoot) !== resolve(request.project)) throw new Error("实施基线不属于目标工程")
  if (options.executeBuild || options.executeRun) {
    if (!options.faithfulness) {
      throw new Error(`场景 ${scenario.id} 未经事实忠实性对勘：先运行 scripts/verify-capability-sources.mjs crosscheck --scenario ${scenario.id} 获取材料包，逐条判定（faithful/unfaithful/cannot_determine）后经 --faithfulness 注入；未经对勘不得构建或运行。`)
    }
    const invalid = validateFaithfulness(options.faithfulness, scenario)
    if (invalid.length) throw new Error(`faithfulness 无效: ${invalid.join("; ")}`)
    const notFaithful = options.faithfulness.verdicts.filter((item) => item.verdict !== "faithful")
    if (notFaithful.length) {
      throw new Error(`事实忠实性门禁未过：${notFaithful.map((item) => `${item.factId}=${item.verdict}（${item.basis}）`).join("；")}。unfaithful 表示能力包事实与现网原文不符，须修正事实并重新审查后重试；cannot_determine 须补充对勘材料。`)
    }
  }
  buildImplementationTrace(capability, options.implementation, [], false, scenario.route)
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
    const id = await appendCommandEvidence(evidence, outputDirectory, "build_log", "build.log", buildResult, buildResult.exitCode === 0 ? "devecocli build 成功" : "devecocli build 失败")
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
    const id = await appendCommandEvidence(evidence, outputDirectory, "device_log", "device-run.log", runResult, runResult.exitCode === 0 ? "devecocli run 安装并拉起成功" : "devecocli run 失败")
    checks.install = check(required.has("install"), runResult.exitCode === 0 ? "passed" : "failed", runResult.exitCode === 0 ? "应用安装并拉起。" : "安装或拉起失败。", [id], { command: runResult.command, exitCode: runResult.exitCode })
    if (runResult.exitCode === 0) checks.runtime = check(required.has("runtime"), "inconclusive", "应用已拉起，但尚无可区分规范预期的运行观察。", [id])
    else checks.runtime = check(required.has("runtime"), "not_run", "安装/拉起失败，未进入运行观察。")
  } else {
    const reason = !options.executeRun ? "未请求运行验证。" : !request.device ? "未选择唯一设备；不自动创建或下载模拟器。" : "构建未通过，未运行。"
    checks.install = check(required.has("install"), "not_run", reason)
    checks.runtime = check(required.has("runtime"), "not_run", reason)
  }

  let navigationResult = null
  if (options.navigate) {
    const invalid = validateNavigationSteps(options.navigate)
    if (invalid.length) throw new Error(`route-steps 无效: ${invalid.join("; ")}`)
    if (!request.device) {
      navigationResult = { status: "skipped", reason: "未选择唯一设备，导航未执行。", executedSteps: [] }
    } else {
      const device = validateCliToken(request.device, "device")
      const executedSteps = []
      let failure = null
      const appendLayoutEvidence = async (layoutContent, stepId) => {
        const layoutPath = join(outputDirectory, "evidence", `nav-${stepId}-layout.json`)
        await mkdir(dirname(layoutPath), { recursive: true })
        await writeFile(layoutPath, `${layoutContent}\n`, "utf8")
        evidence.push({ id: nextEvidenceId(evidence), type: "component_tree", path: layoutPath, sha256: digest(`${layoutContent}\n`), capturedAt: new Date().toISOString(), summary: `导航步骤 ${stepId} 时的组件树。` })
      }
      const currentLayout = async () => {
        const result = await runDeveco(["ui", "layout", "--device", device, "--format", "json"], request.project)
        return { result, content: result.stdout.trim() }
      }
      for (const step of options.navigate.steps) {
        if (failure) break
        let command = null
        if (step.action === "launch") {
          if (checks.install.status === "passed") {
            executedSteps.push({ stepId: step.stepId, action: step.action, status: "passed", detail: "本轮已通过 devecocli run 拉起，跳过重复启动。" })
            continue
          }
          const args = ["run", "--skip-build", "--device", device]
          if (request.module) args.push("--module", validateCliToken(request.module, "module"))
          command = { args, summary: `导航步骤 ${step.stepId}：启动应用。` }
        } else if (step.action === "tap") {
          if (step.locator.by === "id") {
            command = { args: ["ui", "click", "--device", device, "--id", step.locator.value], summary: `导航步骤 ${step.stepId}：按 id 点击 ${step.locator.value}。` }
          } else {
            const { result: layoutResult, content } = await currentLayout()
            const tree = (() => { try { return JSON.parse(content) } catch { return null } })()
            const center = tree ? findNodeInLayout(tree, step.locator.by, step.locator.value) : null
            if (!center) {
              if (content) await appendLayoutEvidence(content, step.stepId)
              await appendCommandEvidence(evidence, outputDirectory, "device_log", `nav-${step.stepId}-layout-failed.log`, layoutResult, `导航步骤 ${step.stepId}：组件树采集失败。`)
              failure = { stepId: step.stepId, expected: `定位 ${step.locator.by}=${step.locator.value}`, actual: "组件树中未找到可点击节点或组件树不可解析" }
              break
            }
            command = { args: ["ui", "click", "--device", device, String(center.cx), String(center.cy)], summary: `导航步骤 ${step.stepId}：按 ${step.locator.by}=${step.locator.value} 中心坐标点击。` }
          }
        } else if (step.action === "swipe") {
          if (step.direction) command = { args: ["ui", "dircfling", "--device", device, step.direction], summary: `导航步骤 ${step.stepId}：向 ${step.direction} 滚动。` }
          else command = { args: ["ui", "swipe", "--device", device, String(step.from[0]), String(step.from[1]), String(step.to[0]), String(step.to[1])], summary: `导航步骤 ${step.stepId}：坐标滑动。` }
        } else if (step.action === "input") {
          const args = ["ui", "text", "--device", device, step.value]
          if (step.locator) {
            const { result: layoutResult, content } = await currentLayout()
            const tree = (() => { try { return JSON.parse(content) } catch { return null } })()
            const center = tree ? findNodeInLayout(tree, step.locator.by, step.locator.value) : null
            if (!center) {
              if (content) await appendLayoutEvidence(content, step.stepId)
              failure = { stepId: step.stepId, expected: `定位 ${step.locator.by}=${step.locator.value}`, actual: "组件树中未找到输入目标节点" }
              break
            }
            args.push(String(center.cx), String(center.cy))
          }
          command = { args, summary: `导航步骤 ${step.stepId}：输入文本。` }
        } else if (step.action === "wait") {
          await new Promise((resolveWait) => setTimeout(resolveWait, step.timeoutMs))
          executedSteps.push({ stepId: step.stepId, action: step.action, status: "passed", detail: `等待 ${step.timeoutMs}ms。` })
        }
        if (command) {
          const result = await runDeveco(command.args, request.project)
          const id = await appendCommandEvidence(evidence, outputDirectory, "device_log", `nav-${step.stepId}.log`, result, command.summary)
          if (result.exitCode !== 0) {
            failure = { stepId: step.stepId, expected: command.summary, actual: `命令退出码 ${result.exitCode ?? "unknown"}`, evidenceId: id }
            executedSteps.push({ stepId: step.stepId, action: step.action, status: "failed", reason: failure.actual })
            break
          }
          executedSteps.push({ stepId: step.stepId, action: step.action, status: "passed", evidenceId: id })
        }
        if (step.expectPage !== undefined && !failure) {
          const { result: layoutResult, content } = await currentLayout()
          const matched = layoutResult.exitCode === 0 && content.includes(step.expectPage)
          if (!matched) {
            if (content) await appendLayoutEvidence(content, step.stepId)
            else await appendCommandEvidence(evidence, outputDirectory, "device_log", `nav-${step.stepId}-layout-failed.log`, layoutResult, `导航步骤 ${step.stepId}：组件树采集失败。`)
            failure = { stepId: step.stepId, expected: step.expectPage, actual: "当前组件树未包含预期页面标识" }
            executedSteps.push({ stepId: step.stepId, action: step.action, status: "failed", reason: `expectPage=${step.expectPage} 未命中` })
            break
          }
          executedSteps[executedSteps.length - 1] = { ...executedSteps[executedSteps.length - 1], expectPage: step.expectPage, expectPageMatched: true }
        }
      }
      navigationResult = {
        status: failure ? "failed" : "passed",
        targetDescription: options.navigate.targetDescription ?? null,
        executedSteps,
        failure,
      }
      evidence.push({ id: nextEvidenceId(evidence), type: "device_log", path: null, sha256: digest(JSON.stringify(navigationResult)), capturedAt: new Date().toISOString(), summary: `导航编排：${navigationResult.status}${failure ? `（失败步骤 ${failure.stepId}）` : ""}`, details: navigationResult })
    }
  }

  const navigationFailed = navigationResult?.status === "failed"
  if (options.captureScreenshot && request.device && !navigationFailed) {
    const screenshotPath = join(outputDirectory, "evidence", "device-visual.png")
    await mkdir(dirname(screenshotPath), { recursive: true })
    const shotResult = await runDeveco(["ui", "screenshot", "--device", validateCliToken(request.device, "device"), "--path", screenshotPath], request.project)
    if (shotResult.exitCode === 0 && await exists(screenshotPath)) {
      evidence.push({ id: nextEvidenceId(evidence), type: "screenshot", path: screenshotPath, sha256: await sha256File(screenshotPath), capturedAt: shotResult.endedAt, summary: "设备屏幕截图（devecocli ui screenshot）。" })
    } else {
      await appendCommandEvidence(evidence, outputDirectory, "device_log", "screenshot-failed.log", shotResult, "截图采集失败。")
    }
  }

  if (options.captureLayout && request.device && !navigationFailed) {
    const layoutResult = await runDeveco(["ui", "layout", "--device", validateCliToken(request.device, "device"), "--format", "json", "--mode", "full", "--depth", "0"], request.project)
    const layoutContent = layoutResult.stdout.trim()
    if (layoutResult.exitCode === 0 && layoutContent) {
      const layoutPath = join(outputDirectory, "evidence", "device-layout.json")
      await mkdir(dirname(layoutPath), { recursive: true })
      await writeFile(layoutPath, `${layoutContent}\n`, "utf8")
      evidence.push({ id: nextEvidenceId(evidence), type: "component_tree", path: layoutPath, sha256: digest(`${layoutContent}\n`), capturedAt: layoutResult.endedAt, summary: "完整组件树（devecocli ui layout --mode full）。" })
    } else {
      await appendCommandEvidence(evidence, outputDirectory, "device_log", "layout-failed.log", layoutResult, "组件树采集失败。")
    }
  }

  for (const level of ["runtime", "visual"]) {
    const observation = observations[level]
    if (!observation) continue
    const refs = []
    for (const item of observation.evidence ?? []) refs.push(await appendObservationEvidence(evidence, item, `${level} 观察证据`))
    checks[level] = check(required.has(level), observation.status, observation.summary, refs)
  }

  if (options.judgment) {
    const judgment = options.judgment
    const invalid = []
    if (judgment.schemaVersion !== "1.0") invalid.push("schemaVersion 必须为 1.0")
    if (judgment.scenarioId !== scenario.id) invalid.push(`scenarioId 必须为 ${scenario.id}`)
    const visual = judgment.visual ?? {}
    if (!["passed", "failed", "inconclusive"].includes(visual.status)) invalid.push("visual.status 必须是 passed、failed 或 inconclusive")
    if (typeof visual.basis !== "string" || !visual.basis.trim()) invalid.push("visual.basis 必须是非空字符串")
    if (!Array.isArray(visual.evidence) || !visual.evidence.length) invalid.push("visual.evidence 必须是非空数组")
    else for (const [index, item] of visual.evidence.entries()) {
      if (!["screenshot", "component_tree"].includes(item?.type)) invalid.push(`visual.evidence[${index}].type 必须是 screenshot 或 component_tree`)
      else if (typeof item?.path !== "string" || !isAbsolute(item.path) || !(await exists(item.path))) invalid.push(`visual.evidence[${index}].path 必须是存在的绝对路径`)
    }
    const scenarioFactRefs = new Set(scenario.factRefs)
    if (!Array.isArray(judgment.matchedFactRefs)) invalid.push("matchedFactRefs 必须是数组")
    else for (const id of judgment.matchedFactRefs) if (!scenarioFactRefs.has(id)) invalid.push(`matchedFactRefs 引用了场景外事实 ${id}`)
    if (judgment.runtime !== undefined && judgment.runtime !== null) {
      if (!["passed", "failed", "inconclusive"].includes(judgment.runtime?.status)) invalid.push("runtime.status 必须是 passed、failed 或 inconclusive")
      if (typeof judgment.runtime?.summary !== "string" || !judgment.runtime.summary.trim()) invalid.push("runtime.summary 必须是非空字符串")
    }
    if (invalid.length) throw new Error(`visual-judgment 无效: ${invalid.join("; ")}`)

    const refs = []
    for (const item of visual.evidence) {
      const sha256 = await sha256File(item.path)
      const existing = evidence.find((candidate) => candidate.path === item.path && candidate.sha256 === sha256 && candidate.type === item.type)
      if (existing) refs.push(existing.id)
      else {
        const id = nextEvidenceId(evidence)
        evidence.push({ id, type: item.type, path: item.path, sha256, capturedAt: new Date().toISOString(), summary: `判图引用的${item.type === "screenshot" ? "截图" : "组件树"}。` })
        refs.push(id)
      }
    }
    const judgmentContent = JSON.stringify(judgment)
    const judgmentId = nextEvidenceId(evidence)
    evidence.push({ id: judgmentId, type: "visual_judgment", path: null, sha256: digest(judgmentContent), capturedAt: new Date().toISOString(), summary: visual.basis, details: judgment })
    checks.visual = check(required.has("visual"), visual.status, `模型判图：${visual.basis}`, [...new Set([judgmentId, ...refs])])
    if (judgment.runtime) checks.runtime = check(required.has("runtime"), judgment.runtime.status, judgment.runtime.summary, refs)
  } else if (!observations.visual) {
    const summary = navigationFailed
      ? `导航失败（步骤 ${navigationResult.failure?.stepId}），未到达目标页面，不能采集有效视觉证据。`
      : "没有截图、录屏、模型判定或用户明确观察，不能判定视觉成功。"
    checks.visual = check(required.has("visual"), "not_run", summary)
  }

  const changes = options.baseline ? (await compareFileBaseline(options.baseline)).changes : []
  const trace = buildImplementationTrace(capability, options.implementation, changes, Boolean(options.baseline), scenario.route)
  const conflictingFactRefs = scenario.factRefs.filter((id) => capability.factsData.facts.find((fact) => fact.id === id)?.normativeStatus === "conflicting")
  const report = {
    verificationVersion: "1.1",
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
      navigation: request.navigationPath ?? null,
      faithfulness: request.faithfulnessPath ?? null,
    },
    capabilityPackage: {
      featureId: capability.feature.id,
      version: capability.feature.packageVersion,
      digest: capability.lock.packageDigest,
      scenarioId: scenario.id,
      route: scenario.route,
      requiredChecks: scenario.requiredChecks,
      factRefs: scenario.factRefs,
      conflictingFactRefs,
    },
    projectBaseline: inspection,
    changes,
    ...trace,
    compatibility: inspection.compatibility,
    checks,
    evidence,
    pendingVerifications: [],
    verdict: {
      status: "blocked",
      summary: "待计算。",
      matchedFactRefs: options.judgment?.matchedFactRefs ?? observations.matchedFactRefs ?? [],
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
  const rendered = await renderDevelopmentReport(report, outputDirectory)
  return { report, resolution, rendered, buildResult, runResult }
}

function parseArgs(argv) {
  const flags = new Set(["execute-build", "execute-run", "capture-screenshot", "capture-layout"])
  const valued = new Set(["project", "feature", "goal", "target", "component", "module", "target-files", "product", "build-mode", "device", "sdk", "baseline", "implementation", "observations", "judgment", "navigate", "faithfulness", "output", "repair-attempts", "skill-root"])
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
  if (!args.project || !args.goal) throw new Error("用法: node verify-development.mjs --project <绝对路径> --goal <开发目标> [--faithfulness <faithfulness-judgment.json>] [--execute-build] [--execute-run --device <设备>] [--navigate <route-steps.json>] [--capture-screenshot] [--capture-layout] [--implementation <实施记录>] [--judgment <visual-judgment.json>] [--output <目录>]（报告与 evidence 默认写入 <工程>/ohos-feature-engineering/<场景ID>/）")
  if (!isAbsolute(args.project)) throw new Error("project 必须是绝对路径")
  const repairAttempts = Number(args["repair-attempts"] ?? 0)
  if (!Number.isInteger(repairAttempts) || repairAttempts < 0 || repairAttempts > 2) throw new Error("repair-attempts 必须是 0 到 2")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const baseline = args.baseline ? JSON.parse(await readFile(args.baseline, "utf8")) : null
  const implementation = args.implementation ? JSON.parse(await readFile(args.implementation, "utf8")) : null
  const observations = args.observations ? JSON.parse(await readFile(args.observations, "utf8")) : null
  const judgment = args.judgment ? JSON.parse(await readFile(args.judgment, "utf8")) : null
  const navigate = args.navigate ? JSON.parse(await readFile(args.navigate, "utf8")) : null
  const faithfulness = args.faithfulness ? JSON.parse(await readFile(args.faithfulness, "utf8")) : null
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
    navigationPath: args.navigate ?? null,
    faithfulnessPath: args.faithfulness ?? null,
  }, {
    executeBuild: Boolean(args["execute-build"]),
    executeRun: Boolean(args["execute-run"]),
    navigate,
    judgment,
    faithfulness,
    captureScreenshot: Boolean(args["capture-screenshot"]),
    captureLayout: Boolean(args["capture-layout"]),
    outputDirectory: args.output,
    baseline,
    implementation,
    observations,
    repairAttempts,
  })
  process.stdout.write(`${JSON.stringify(result.report ? { verdict: result.report.verdict, rendered: result.rendered } : { resolution: result.resolution }, null, 2)}\n`)
  if (!result.report || ["failed", "blocked", "inconclusive"].includes(result.report.verdict.status)) process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

#!/usr/bin/env node
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rmdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { evaluateCompatibility, inspectProject, loadFeature, verifyInspection } from "./lib/project-tools.mjs"
import { runHvigorBuild } from "./lib/hvigor-build.mjs"
import { navigate, runDeveco, validateNavigation } from "./lib/development-device.mjs"
import { parseDevecoJson } from "./lib/deveco-json.mjs"
import { deployProduct, discoverDeployment, planDeployment, verifyDeploymentArtifacts, verifyInstalledModules } from "./lib/development-deployment.mjs"
import { cacheDirectory, deriveVerdict, exists, fileHash, hash, loadCollection, sameTarget, saveReport, validateChanges } from "./lib/development-report.mjs"
import { WINDOW_PRIVACY_FEATURES, windowPrivacyScenarios, validateWindowPrivacyJudgment } from "./lib/window-privacy-runtime.mjs"

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const check = (status, summary) => ({ status, summary })
const requiredText = (v, name) => { if (typeof v !== "string" || !v.trim()) throw new Error(`${name} 必填`) }
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])

function imageExt(content) {
  if (content.subarray(0, 8).equals(PNG_MAGIC)) return "png"
  if (content.subarray(0, 3).equals(JPEG_MAGIC)) return "jpg"
  return null
}

function commandEvidence(args, result) {
  return `${JSON.stringify(args)}\nexitCode: ${result.exitCode ?? "unknown"}\n--- stdout ---\n${result.stdout ?? ""}\n--- stderr ---\n${result.stderr ?? ""}`
}

function nextEvidenceId(run) {
  return `E${Math.max(0, ...run.evidence.map((e) => Number(/^E(\d+)$/.exec(e.id)?.[1] ?? 0))) + 1}`
}

async function captureDeviceScreenshot(run, runDirectory, scenario, call) {
  const path = join(runDirectory, `target-${randomUUID()}.png`)
  const result = await call(["ui", "screenshot", "--device", run.device, "--path", path])
  if (result.exitCode !== 0 || !await exists(path) || !imageExt(await readFile(path))) {
    throw new Error("截图采集失败或文件不是有效 PNG/JPEG 图片")
  }
  if (scenario) run.evidence = run.evidence.filter((e) => e.type !== "screenshot" || e.scenario !== scenario)
  run.evidence.push({ id: nextEvidenceId(run), type: "screenshot", purpose: "target", path, sha256: await fileHash(path), ...(scenario ? { scenario } : {}) })
  const count = run.evidence.filter((e) => e.type === "screenshot").length
  run.checks.visual = check("inconclusive", `已采集目标页截图 ${count} 张，等待 AI 实际阅读并补录判定`)
}

function detectDeviceKind(deviceInfo, target) {
  let info = deviceInfo
  if (typeof info === "string") { try { info = parseDevecoJson(info, "device") } catch { return "unknown" } }
  const candidate = info?.device ?? info?.data ?? info
  const fields = [target, candidate?.name, candidate?.serial ?? candidate?.serialNumber, candidate?.deviceType ?? candidate?.type, candidate?.connectType]
  return fields.some((v) => typeof v === "string" && (/emulator|模拟器|simulator/i.test(v) || /^127\.0\.0\.1:\d+$/.test(v.trim()))) ? "emulator" : "physical"
}

export function detectAgentDeviceKind(deviceInfo, target) {
  let info = deviceInfo
  if (typeof info === "string") { try { info = parseDevecoJson(info, "device") } catch { info = null } }
  const candidate = info?.device ?? info?.data ?? info
  const values = [target, candidate?.name, candidate?.model, candidate?.serial ?? candidate?.serialNumber, candidate?.deviceType ?? candidate?.type, candidate?.kind, candidate?.deviceKind, candidate?.connectType]
  if (candidate?.isEmulator === true || values.some((v) => typeof v === "string" && (/emulator|模拟器|simulator/i.test(v) || /^127\.0\.0\.1:\d+$/.test(v)))) return "emulator"
  const form = candidate?.deviceType ?? candidate?.type
  const supported = typeof form === "string" && /^(phone|tablet)$/i.test(form)
  const physical = candidate?.isEmulator === false || /^(physical|real|真机)$/i.test(candidate?.deviceKind ?? "") || /^device$/i.test(candidate?.kind ?? "") || /^usb$/i.test(candidate?.connectType ?? "")
  return supported && physical ? "physical" : "unknown"
}

function requireAgentPhysical(run) {
  if (run.feature === "agent-framework-kit" && run.deviceKind !== "physical") throw new Error("Agent Framework Kit 运行与视觉验证需要已确认的 Phone/Tablet 真机，模拟器或设备类型未知不能验收")
  if (run.feature === "dlp-anti-peep" && detectPrivacyDeviceKind(run.deviceInfo, run.device) !== "physical") throw new Error("防窥保护效果验证需要已确认的 Phone 真机，模拟器或设备类型未知不能验收")
}

export function detectPrivacyDeviceKind(deviceInfo, target) {
  const kind = detectAgentDeviceKind(deviceInfo, target)
  if (kind !== "physical") return kind
  let info = deviceInfo
  if (typeof info === "string") { try { info = parseDevecoJson(info, "device") } catch { return "unknown" } }
  const device = info?.device ?? info?.data ?? info
  return /^phone$/i.test(device?.deviceType ?? device?.type ?? "") ? "physical" : "unknown"
}

async function importManualEvidence(run, runDirectory, manifest) {
  if (manifest?.schemaVersion !== "1.0" || manifest.runId !== run.runId || manifest.goal !== run.goal || !run.device || manifest.device !== run.device) throw new Error("手动证据必须绑定本轮 runId、goal 和 device")
  if (run.checks.build.status !== "passed") throw new Error("本轮构建未通过，不能导入手动验证")
  const build = run.evidence.find((e) => e.type === "build_log" && e.id === manifest.buildEvidence?.id)
  if (!build) throw new Error(`手动证据引用的构建证据 id 不在本轮运行中：${manifest.buildEvidence?.id}；请以本轮运行输出的 build_log 证据 id 与 sha256 为准`)
  if (build.sha256 !== manifest.buildEvidence?.sha256) throw new Error(`手动证据的构建哈希不匹配：期望 ${build.sha256}，实际填写 ${manifest.buildEvidence?.sha256}；请从本轮运行输出或 collection.json 复制`)
  if (!await exists(build.path) || await fileHash(build.path) !== build.sha256) throw new Error("本轮构建日志文件已丢失或内容哈希不符，请重新执行本轮构建验证")
  requiredText(manifest.provenance, "manualEvidence.provenance（设备、本轮构建产物与采集过程的关联依据）")
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error("manualEvidence.files 必须非空")
  const allowedTypes = new Set(["screenshot", "component_tree", "runtime_log", "install_log", "navigation_log", "device_info", "installed_modules"])
  const files = new Map()
  for (const item of manifest.files) {
    requiredText(item.key, "手动证据 key")
    if (files.has(item.key) || !allowedTypes.has(item.type)) throw new Error("手动证据 key 重复或 type 不支持")
    requiredText(item.path, "手动证据 path")
    const content = await readFile(resolve(item.path))
    if (!content.length || hash(content) !== item.sha256) throw new Error(`手动证据为空或哈希不匹配：${item.key}`)
    if (item.type === "screenshot" && !imageExt(content)) throw new Error(`手动截图不是有效 PNG/JPEG 图片：${item.key}；设备 snapshot_display 采集的 JPEG 可直接使用`)
    files.set(item.key, { ...item, content })
  }
  if (manifest.deviceInfo !== undefined) {
    const info = files.get(manifest.deviceInfo)
    if (info?.type !== "device_info") throw new Error("deviceInfo 必须引用设备信息 JSON 证据")
    const data = parseDevecoJson(info.content.toString("utf8"), "device")
    const device = data?.device ?? data?.data ?? data
    if ((device?.serial ?? device?.serialNumber) !== run.device) throw new Error("手动设备信息与本轮 device 不一致")
    if (run.deviceKind === "emulator") throw new Error("不能用手动证据覆盖本轮模拟器事实")
    run.deviceInfo = data
    run.deviceKind = detectAgentDeviceKind(data, run.device)
  }
  requireAgentPhysical(run)
  if (run.feature === "smart-reach" && run.deviceKind !== "physical") throw new Error("智感握姿手动验证仅允许已确认的真机")
  const stages = manifest.stages ?? {}
  let deploymentVerified = false
  for (const [key, stage] of Object.entries(stages)) {
    if (!["install", "navigation"].includes(key) || !["passed", "failed", "inconclusive"].includes(stage.status)) throw new Error(`手动阶段 key 仅支持 install/navigation（status 仅支持 passed/failed/inconclusive），收到：${key}/${stage.status}；运行观察结论不写在 stages 中，请在 --manual-evidence 导入后用 --judgment 的 runtime/visual 补录`)
    requiredText(stage.summary, `manualEvidence.stages.${key}.summary`)
    if (!Array.isArray(stage.evidence) || !stage.evidence.length || stage.evidence.some((id) => !files.has(id))) throw new Error("手动阶段缺少本次导入的证据引用")
    const types = stage.evidence.map((id) => files.get(id).type)
    if (stage.status === "passed" && key === "install") {
      if (!types.includes("install_log")) throw new Error("手动安装启动通过必须引用安装与启动日志，截图不能证明安装本轮产物")
      if (run.buildScope !== "product" || !run.deployment) throw new Error("手动安装通过需要本轮完整产品构建及部署产物清单，模块级构建或旧运行须重新执行完整验证")
      const ref = manifest.deploymentEvidence
      const saved = run.evidence.find((e) => e.type === "deployment_manifest" && e.id === ref?.id && e.sha256 === ref?.sha256)
      if (!saved || !await exists(saved.path) || await fileHash(saved.path) !== saved.sha256) throw new Error("手动安装必须引用本轮有效的 deployment_manifest 证据 id 与 sha256")
      const plan = JSON.parse(await readFile(saved.path, "utf8"))
      if (JSON.stringify(plan) !== JSON.stringify(run.deployment)) throw new Error("本轮部署清单与运行记录不一致，须重新构建验证")
      await verifyDeploymentArtifacts(run.project, run, plan)
      const info = files.get(manifest.installedModules)
      if (info?.type !== "installed_modules" || !stage.evidence.includes(manifest.installedModules)) throw new Error("手动安装通过须引用安装后设备应用信息 JSON（installed_modules），并通过 installedModules 指定其 key")
      verifyInstalledModules(plan, parseDevecoJson(info.content.toString("utf8"), "app"))
      deploymentVerified = true
    }
    if (stage.status === "passed" && key === "navigation") {
      if ((stages.install?.status ?? run.checks.install.status) !== "passed") throw new Error("安装启动未通过，不能将手动导航标记通过")
      if (stages.install?.status !== "passed" && !run.deploymentVerified) throw new Error("部署完整性尚未核验，不能将手动导航标记通过")
      if (!types.some((type) => ["component_tree", "navigation_log"].includes(type))) throw new Error("手动导航通过须引用页面断言日志或组件树")
    }
  }
  const imported = new Map()
  for (const [key, item] of files) {
    const id = nextEvidenceId(run)
    const ext = item.type === "screenshot" ? imageExt(item.content) : "log"
    const path = join(runDirectory, `${id}.${ext}`)
    await writeFile(path, item.content)
    const evidence = { id, type: item.type, path, sha256: item.sha256, origin: "manual", scenario: key, ...(item.type === "screenshot" ? { purpose: "target" } : {}) }
    run.evidence.push(evidence)
    imported.set(key, { id, sha256: item.sha256 })
  }
  run.manualVerification = { provenance: manifest.provenance, buildEvidence: manifest.buildEvidence }
  if (deploymentVerified) run.deploymentVerified = true
  for (const [key, stage] of Object.entries(stages)) run.checks[key] = { ...check(stage.status, `手动验证：${stage.summary}`), origin: "manual", evidence: stage.evidence.map((id) => imported.get(id)) }
  // 新证据需重新判定，旧的效果通过不能覆盖尚未阅读的证据。
  if ([...files.values()].some((e) => e.type === "screenshot")) run.checks.visual = check("inconclusive", "已导入手动截图，等待 AI 阅读并补录判定")
  if ([...files.values()].some((e) => ["runtime_log", "component_tree"].includes(e.type))) run.checks.runtime = check("inconclusive", "已导入手动运行证据，等待 AI 阅读并补录判定")
}

async function importDeveloperScreenshots(run, runDirectory, paths, purpose = "target") {
  if (!Array.isArray(paths) || !paths.length) return
  if (purpose === "target") {
    requireAgentPhysical(run)
    if (run.feature === "smart-reach" && run.deviceKind === "emulator") throw new Error("智感握姿视觉验证只能使用真机，不能在模拟器运行中导入截图")
  }
  for (const item of paths) {
    const source = resolve(item)
    if (!await exists(source)) throw new Error(`导入截图不存在：${item}`)
    const content = await readFile(source)
    const ext = imageExt(content)
    if (!ext) throw new Error(`导入截图不是有效 PNG/JPEG 图片：${item}`)
    const id = nextEvidenceId(run)
    const path = join(runDirectory, `${id}.${ext}`)
    await writeFile(path, content)
    run.evidence.push({ id, type: "screenshot", origin: "developer", purpose, path, sha256: hash(content) })
  }
  if (purpose === "target") run.checks.visual = check("inconclusive", `已导入开发者提供的真机截图 ${paths.length} 张，等待 AI 实际阅读并补录判定`)
}

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

function developerOnlyVisual(judgment, run) {
  const refs = judgment.visual?.evidence
  if (!Array.isArray(refs) || !refs.length) return false
  return refs.every((ref) => ["developer", "manual"].includes(run.evidence.find((v) => v.id === ref.id && v.sha256 === ref.sha256)?.origin))
}

export async function applyJudgment(run, judgment, runs = [run]) {
  if (judgment?.schemaVersion !== "1.0" || judgment.runId !== run.runId || judgment.goal !== run.goal) throw new Error("判定必须绑定本次 runId 与 goal")
  if (judgment.visual || judgment.runtime) {
    requireAgentPhysical(run)
    if (run.checks.build.status !== "passed") throw new Error("构建未通过，不能补录效果判定")
    if (judgment.runtime?.status === "passed" && run.checks.install.origin === "manual" && !run.deploymentVerified) throw new Error("手动部署完整性尚未核验，不能补录运行通过；请补齐本轮产物及设备模块清单")
    const partialManualRuntime = judgment.runtime?.status === "inconclusive" && run.manualVerification && judgment.runtime.evidence?.length && judgment.runtime.evidence.every((ref) => run.evidence.find((e) => e.id === ref.id && e.sha256 === ref.sha256)?.origin === "manual")
    if ((judgment.runtime && !partialManualRuntime) || (judgment.visual && !developerOnlyVisual(judgment, run))) for (const key of ["install", "navigation"]) if (run.checks[key].status !== "passed") throw new Error("安装或目标页导航未通过，不能补录效果通过；手动证据可补录未确认的运行观察及真机截图判定")
  }
  for (const level of ["visual", "runtime"]) {
    const item = judgment[level]
    if (!item) continue
    if (!["passed", "failed", "inconclusive"].includes(item.status)) throw new Error(`${level}.status 无效`)
    requiredText(item.summary, `${level}.summary`)
    if (!Array.isArray(item.evidence) || !item.evidence.length) throw new Error(`${level} 缺少证据引用`)
    const evidence = []
    for (const ref of item.evidence) {
      const e = run.evidence.find((v) => v.id === ref.id)
      if (!e) throw new Error(`判定引用的证据 id 不在本轮运行中：${ref.id}；${level} 判定只能引用本轮 evidence 列表中的 id/sha256（--manual-evidence 导入的证据以导入后返回的新 id 为准）`)
      if (e.sha256 !== ref.sha256) throw new Error(`判定引用的证据哈希不匹配：${ref.id} 期望 ${e.sha256}，实际填写 ${ref.sha256}`)
      if (!await exists(e.path) || await fileHash(e.path) !== e.sha256) throw new Error(`判定引用的证据文件已丢失或内容不符：${ref.id}`)
      evidence.push(e)
    }
    if (level === "visual" && !evidence.some((v) => v.type === "screenshot")) throw new Error("视觉判定必须引用本次目标页面截图")
    if (level === "visual" && evidence.some((v) => v.purpose === "fallback")) throw new Error("回退环境截图只能用于兼容方案回退判定，不能用于目标特性的视觉验收")
    if (level === "runtime" && !evidence.some((v) => ["runtime_log", "component_tree"].includes(v.type))) throw new Error("运行判定需要日志或交互组件树证据")
    validateWindowPrivacyJudgment(run, level, item, evidence)
    if (run.feature === "agent-framework-kit" && item.status === "passed") {
      if (level === "visual" && new Set(evidence.filter((e) => e.type === "screenshot").map((e) => e.sha256)).size < 2) throw new Error("Function 视觉通过需要入口与对话框打开状态两张不同截图")
      if (level === "runtime") {
        for (const scenario of ["entry-clicked", "dialog-opened", "dialog-closed"]) {
          const observation = item.observations?.find((v) => v.scenario === scenario)
          requiredText(observation?.note, `Function ${scenario} 观察说明`)
          if (!Array.isArray(observation.evidence) || !observation.evidence.length) throw new Error(`Function ${scenario} 缺少证据`)
          for (const ref of observation.evidence) {
            if (!evidence.some((e) => e.id === ref.id && e.sha256 === ref.sha256 && ["runtime_log", "component_tree"].includes(e.type))) throw new Error(`Function ${scenario} 必须引用本轮 runtime.evidence 中的日志或交互组件树`)
          }
        }
      }
    }
    if (level === "runtime" && item.observations !== undefined) {
      if (!Array.isArray(item.observations)) throw new Error("runtime.observations 必须是数组")
      for (const observation of item.observations) {
        requiredText(observation.scenario, "运行观察场景")
        requiredText(observation.note, "运行观察说明")
        if (!Array.isArray(observation.evidence) || !observation.evidence.length || observation.evidence.some((ref) => !evidence.some((e) => e.id === ref.id && e.sha256 === ref.sha256 && ["runtime_log", "component_tree"].includes(e.type)))) throw new Error("运行观察必须引用本轮 runtime.evidence 中的日志或组件树")
      }
    }
    run.checks[level] = { ...check(item.status, item.summary), evidence: structuredClone(item.evidence) }
    if (level === "runtime" && item.observations) run.checks.runtime.observations = structuredClone(item.observations)
  }
  if (judgment.fallback) {
    if (run.checks.build.status !== "passed") throw new Error("构建未通过，不能补录兼容方案回退判定")
    const item = judgment.fallback
    if (!["low-api", "unsupported", "disabled"].includes(item.condition)) throw new Error("fallback.condition 只支持 low-api、unsupported 或 disabled")
    if (!["passed", "failed", "inconclusive"].includes(item.status)) throw new Error("fallback.status 无效")
    requiredText(item.summary, "fallback.summary")
    if (!Array.isArray(item.evidence) || !item.evidence.length) throw new Error("fallback 缺少证据引用")
    const evidence = []
    for (const ref of item.evidence) {
      const e = run.evidence.find((v) => v.id === ref.id)
      if (!e) throw new Error(`判定引用的证据 id 不在本轮运行中：${ref.id}；fallback 判定只能引用本轮 evidence 列表中的 id/sha256（--manual-evidence、--import-screenshot 导入的证据以导入后返回的新 id 为准）`)
      if (e.sha256 !== ref.sha256) throw new Error(`判定引用的证据哈希不匹配：${ref.id} 期望 ${e.sha256}，实际填写 ${ref.sha256}`)
      if (!await exists(e.path) || await fileHash(e.path) !== e.sha256) throw new Error(`判定引用的证据文件已丢失或内容不符：${ref.id}`)
      evidence.push(e)
    }
    if (evidence.some((v) => v.type === "screenshot" && v.purpose === "target")) throw new Error("目标效果截图不能用于兼容方案回退判定；请核实回退环境并用 --screenshot-purpose fallback 导入实际回退截图")
    if (item.status === "passed" && !evidence.some((v) => v.type === "screenshot" && v.purpose === "fallback")) throw new Error("兼容方案回退通过必须引用 purpose=fallback 的运行截图；未标记用途的旧截图须确认来源后用 --import-screenshot --screenshot-purpose fallback 重新导入")
    run.checks.fallback = check(item.status, item.summary)
    const entry = run.changes.fallback.find((v) => v.condition === item.condition)
    if (entry && ["passed", "failed"].includes(item.status)) {
      entry.status = item.status
      entry.evidence = `${item.summary}（证据：${evidence.map((v) => v.id).join("、")}）`
    }
  }
  if (!judgment.visual && !judgment.runtime && !judgment.staticReview && !judgment.fallback) throw new Error("判定文件没有 fallback、visual、runtime 或 staticReview 结论")
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
    if (request.screenshotPurpose !== undefined && (!["target", "fallback"].includes(request.screenshotPurpose) || !request.importScreenshot?.length)) throw new Error("screenshot-purpose 仅支持 target/fallback，且须同时提供 import-screenshot")
    if (request.screenshotScenario !== undefined && (typeof request.screenshotScenario !== "string" || !request.screenshotScenario.trim() || request.screenshotScenario.length > 80 || /[\r\n]/.test(request.screenshotScenario))) throw new Error("screenshot-scenario 必须是 1–80 字的单行场景名")
    if (request.screenshotScenario && !request.captureScreenshot) throw new Error("screenshot-scenario 需要同时使用 capture-screenshot")
    if (request.resume) {
      if (request.executeBuild || request.executeRun || request.navigate || request.captureLayout || request.changes) throw new Error("resume 仅允许补录 judgment、导入截图或采集截图，不执行构建、安装或导航")
      if (!request.judgment && !request.importScreenshot?.length && !request.captureScreenshot && !request.manualEvidence) throw new Error("resume 需要提供 judgment、手动证据、导入截图或采集截图")
      const run = collection.runs.find((v) => v.runId === request.resume)
      if (!run) throw new Error("运行记录不存在或已被重验替换")
      if (run.feature === "agent-framework-kit" && run.deviceKind !== "emulator") run.deviceKind = detectAgentDeviceKind(run.deviceInfo, run.device)
      if (request.manualEvidence) await importManualEvidence(run, join(directory, run.runId), request.manualEvidence)
      if (request.captureScreenshot) {
        requiredText(request.screenshotScenario, "screenshot-scenario")
        if (request.device && request.device !== run.device) throw new Error("补采截图的设备必须与本轮安装设备一致")
        if (!run.device || run.checks.install.status !== "passed" || run.checks.navigation.status !== "passed") throw new Error("补采截图需要本轮安装和目标页导航已通过")
        if (run.feature === "smart-reach" || run.feature === "agent-framework-kit" || run.feature === "dlp-anti-peep") {
          const info = await (options.commandRunner ?? runDeveco)(["device", "view", "--target", run.device, "--format", "json"], request.project)
          const queryId = nextEvidenceId(run)
          const queryPath = join(directory, run.runId, `${queryId}.log`)
          await writeFile(queryPath, commandEvidence(["device", "view", "--target", run.device, "--format", "json"], info))
          run.evidence.push({ id: queryId, type: "device_log", path: queryPath, sha256: await fileHash(queryPath) })
          // Persist the query even if parsing or physical-device validation stops this resume.
          await saveReport(output, directory, collection)
          if (info.exitCode !== 0) throw new Error(`设备信息查询命令失败（退出码：${info.exitCode ?? "未知"}）；证据：${queryPath}`)
          const data = parseDevecoJson(info.stdout, "device")
          const kind = run.feature === "dlp-anti-peep" ? detectPrivacyDeviceKind(data, run.device) : run.feature === "agent-framework-kit" ? detectAgentDeviceKind(data, run.device) : detectDeviceKind(data, run.device)
          if (kind !== "physical") throw new Error("补采截图只能使用已确认的真机；Agent Framework Kit 还要求 Phone/Tablet")
          run.deviceKind = kind
          run.deviceInfo = data
        }
        try { await captureDeviceScreenshot(run, join(directory, run.runId), request.screenshotScenario, (args) => (options.commandRunner ?? runDeveco)(args, request.project)) }
        catch { run.checks.visual = check("not_run", "截图采集失败或文件不是有效 PNG，未完成视觉验证") }
      }
      await importDeveloperScreenshots(run, join(directory, run.runId), request.importScreenshot, request.screenshotPurpose)
      if (request.judgment) await applyJudgment(run, request.judgment, collection.runs)
      const report = await saveReport(output, directory, collection)
      return { runId: run.runId, report, status: deriveVerdict(run), evidence: run.evidence }
    }
    for (const key of ["feature", "goal", "route"]) requiredText(request[key], key)
    if (request.manualEvidence) throw new Error("手动证据须使用 --resume 绑定已有构建运行")
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
      product: request.product ?? "default", buildMode: request.buildMode ?? "debug", module: request.module ?? null, ability: request.ability,
      changes: structuredClone(request.changes), createdAt: new Date().toISOString(), device: request.device ?? null, evidence: [],
      checks: Object.fromEntries(["static", "sdk", "build", "install", "navigation", "runtime", "visual", "fallback"].map((key) => [key, check("not_run", "尚未执行")]))
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
      await record(result.exitCode === 0 ? type : "command_failure", commandEvidence(args, result))
      return result
    }
    const { inspection, compatibility, staticResult } = await (options.inspector ?? inspectVerification)(request)
    if (WINDOW_PRIVACY_FEATURES.includes(run.feature)) run.requiredRuntimeScenarios = windowPrivacyScenarios(run.feature, run.route, inspection)
    run.after = { sdk: inspection.localSdk.apiVersion ?? "unknown", compile: inspection.api.compile, target: inspection.api.target, compatible: inspection.api.compatible }
    await record("static", JSON.stringify({ inspection, compatibility, staticResult }, null, 2), "json")
    run.checks.sdk = compatibility.availableRoutes?.includes(run.route) && inspection.localSdk.status === "valid" ? check("passed", `本机 SDK API ${run.after.sdk}，${run.route} 路线可用`) : check("failed", "本机 SDK 或工程版本不满足所选路线，需先完成版本门禁")
    const routeMinApi = compatibility.routes?.[run.route]?.minApi ?? compatibility.sdk?.routes?.[run.route]?.minApi
    if (Number.isInteger(routeMinApi) && Number.isInteger(run.after.compatible) && routeMinApi > run.after.compatible) {
      run.checks.fallback = check("not_run", `存在低版本兼容分支（compatible API ${run.after.compatible} < 路线门槛 ${routeMinApi}），需在低版本环境实测回退表现后补录判定`)
    } else if (!Number.isInteger(run.after.compatible) || !Number.isInteger(routeMinApi)) {
      run.checks.fallback = check("not_run", "路线门槛或最低兼容 API 未知，需先确认版本关系再判断是否存在低版本回退分支")
    } else {
      run.checks.fallback = check("not_applicable", `工程最低兼容 API ${run.after.compatible} 不低于所选路线门槛 ${routeMinApi}，无低版本回退分支`)
    }
    run.staticFindings = staticResult.checks.filter((v) => ["fail", "warn"].includes(v.status))
    const priorReviews = new Map(collection.runs.flatMap((r) => (r.staticFindings ?? []).filter((f) => f.review).map((f) => [f.id, f.review])))
    for (const finding of run.staticFindings) if (run.feature !== "agent-framework-kit" && !WINDOW_PRIVACY_FEATURES.includes(run.feature) && finding.status === "warn" && priorReviews.has(finding.id)) finding.review = structuredClone(priorReviews.get(finding.id))
    recomputeStaticCheck(run)
    if (staticResult.counts.fail && run.checks.static.status !== "failed") run.checks.static = check("failed", "静态门禁失败")
    run.checks.build = check("not_run", "未请求构建")
    if (run.checks.sdk.status === "failed" || run.checks.static.status === "failed") run.checks.build.summary = "SDK 或静态门禁失败，未构建"
    else if (request.executeBuild) {
      let result
      let phase = "deployment discovery"
      run.buildScope = request.executeRun || !run.module ? "product" : "module"
      try {
        if (run.buildScope === "product") {
          run.expectedDeployment = await (options.deploymentDiscoverer ?? discoverDeployment)(request.project, run)
          await record("deployment_targets", JSON.stringify(run.expectedDeployment, null, 2), "json")
        }
        phase = "build"
        result = await (options.buildRunner ?? runHvigorBuild)(request.project, { product: run.product, buildMode: run.buildMode, module: request.executeRun ? undefined : run.module, modules: inspection.modules, sdkPath: inspection.localSdk.path })
      }
      catch (error) { result = { exitCode: null, stderr: error.message, failedStage: phase === "deployment discovery" ? phase : undefined } }
      await record(result.failedStage === "deployment discovery" ? "deployment_failure" : "build_log", `${result.stdout ?? ""}\n${result.stderr ?? ""}`)
      run.checks.build = check(result.exitCode === 0 ? "passed" : "failed", result.exitCode === 0 ? "ohpm、Hvigor 同步与打包通过" : `构建失败：${result.failedStage ?? "工具或构建阶段"}；${(result.stderr || result.stdout || "无输出").slice(-1800)}`)
      if (result.exitCode !== 0) run.checks.build.reportSummary = `构建失败，停止于${{ "ohpm install": "依赖安装", "hvigor sync": "工程同步", "hvigor build": "HAP 打包" }[result.failedStage] ?? "构建工具执行阶段"}；未继续安装，修复后需重验`
      if (result.failedStage === "deployment discovery") run.checks.build.reportSummary = `部署范围核验失败：${result.stderr}；未执行构建或安装`
      if (result.exitCode === 0 && run.buildScope === "product") {
        try {
          // 构建后立即冻结产物；签名资格在确认设备类型后、安装或手动验收前核验。
          run.deployment = await (options.deploymentPlanner ?? planDeployment)(request.project, run, { allowUnsigned: true, expected: run.expectedDeployment })
          run.deploymentEvidence = await record("deployment_manifest", JSON.stringify(run.deployment, null, 2), "json")
        } catch (error) { run.deploymentError = `完整部署产物核验失败：${error.message}` }
      }
    }
    let launchArgs = []
    run.checks.install.summary = !request.executeRun ? "未请求安装运行" : !request.device ? "未指定目标设备，需先选择设备" : "本轮构建未通过，未安装运行"
    if (run.deploymentError) run.checks.install = check("failed", run.deploymentError)
    if (request.executeRun && request.device && run.checks.build.status === "passed" && !run.deploymentError) {
      const info = await call(["device", "view", "--target", request.device, "--format", "json"])
      run.deviceInfo = info.exitCode === 0 ? info.stdout.trim() : "系统信息采集失败"
      let deviceError
      if (info.exitCode !== 0) deviceError = `设备信息查询命令失败（退出码：${info.exitCode ?? "未知"}）`
      else {
        try { run.deviceInfo = parseDevecoJson(info.stdout, "device") }
        catch (error) { deviceError = error.message }
      }
      if (info.exitCode === 0) run.deviceKind = run.feature === "dlp-anti-peep" ? detectPrivacyDeviceKind(run.deviceInfo, request.device) : run.feature === "agent-framework-kit" ? detectAgentDeviceKind(run.deviceInfo, request.device) : detectDeviceKind(run.deviceInfo, request.device)
      if (deviceError) {
        run.checks.install = { ...check("failed", deviceError), reportSummary: deviceError }
      } else if (run.feature === "agent-framework-kit" && run.deviceKind !== "physical") {
        run.checks.install = check("not_run", "Agent Framework Kit 需要已确认的 Phone/Tablet 真机，未执行安装运行")
      } else if (run.feature === "dlp-anti-peep" && run.deviceKind !== "physical") {
        run.checks.install = check("not_run", "防窥保护需要已确认的 Phone 真机，未执行安装运行")
      } else {
        try {
          const deployment = await (options.deploymentRunner ?? deployProduct)(request.project, run, call, record)
          launchArgs = deployment.launchArgs
          run.deployment = deployment.plan
          run.deploymentVerified = true
          run.checks.install = check("passed", "本轮 HAP/HSP 已安装，设备模块与版本核验通过，应用已启动")
        } catch (error) {
          run.checks.install = { ...check("failed", error.message), reportSummary: error.message }
        }
      }
    }
    run.checks.navigation.summary = run.checks.install.status !== "passed" ? "应用未成功安装启动" : "未提供目标页导航与断言"
    if (run.checks.install.status === "passed" && request.navigate) {
      try {
        await navigate(request.navigate, call, launchArgs, request.device, options.pause)
        run.checks.navigation = check("passed", "导航完成，目标页面断言通过")
      } catch (error) { run.checks.navigation = { ...check("failed", error.message), reportSummary: error.message } }
    }
    if (run.checks.navigation.status === "passed") {
      run.checks.runtime = check("inconclusive", "已进入目标页，交互与启动时机仍需结合运行证据判定")
      const logArgs = ["log", "--device", request.device, "--from", "1m", "--tail", "200"]
      if (request.bundle) logArgs.push("--bundle-name", request.bundle)
      await call(logArgs, "runtime_log")
      if (request.captureLayout) await call(["ui", "layout", "--device", request.device, "--format", "json", "--mode", "full", "--depth", "0"], "component_tree")
      run.checks.visual = check("not_run", "尚未采集截图或提供视觉判定")
      if (profile.featureId === "smart-reach" && run.deviceKind === "emulator") {
        run.checks.visual = check("not_run", "智感握姿视觉验证只能使用真机；检测到目标设备为模拟器，未采集截图")
      } else if (request.captureScreenshot) {
        try { await captureDeviceScreenshot(run, runDirectory, request.screenshotScenario, call) }
        catch { run.checks.visual = check("not_run", "截图采集失败或文件不是有效 PNG，未完成视觉验证") }
      }
    } else {
      run.checks.runtime.summary = `未完成目标页验证：${run.checks.navigation.summary}`
      run.checks.visual.summary = `未完成目标页视觉验证：${run.checks.build.status !== "passed" ? run.checks.build.summary : run.checks.install.status !== "passed" ? run.checks.install.summary : run.checks.navigation.summary}`
    }
    await importDeveloperScreenshots(run, runDirectory, request.importScreenshot, request.screenshotPurpose)
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
  const values = new Set(["project", "feature", "route", "goal", "changes", "sdk", "product", "module", "ability", "bundle", "build-mode", "device", "navigate", "output", "resume", "judgment", "import-screenshot", "screenshot-purpose", "screenshot-scenario", "manual-evidence"])
  const repeatable = new Set(["import-screenshot"])
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "")
    if (!argv[i].startsWith("--") || (!flags.has(name) && !values.has(name))) throw new Error(`未知参数 ${argv[i]}`)
    if (name in args && !repeatable.has(name)) throw new Error(`重复参数 ${name}`)
    if (flags.has(name)) args[name] = true
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`缺少 ${name} 值`)
      const value = argv[++i]
      if (repeatable.has(name)) { if (!args[name]) args[name] = []; args[name].push(value) } else args[name] = value
    }
  }
  return Object.fromEntries(Object.entries(args).map(([key, value]) => [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const request = parseDevelopmentArgs(process.argv.slice(2))
    for (const key of ["changes", "navigate", "judgment", "manualEvidence"]) if (request[key]) request[key] = JSON.parse(await readFile(request[key], "utf8"))
    const result = await verifyDevelopment(request)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status === "failed") process.exitCode = 1
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2 }
}

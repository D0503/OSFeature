import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { access, readFile, readdir, stat } from "node:fs/promises"
import { extname, isAbsolute, relative, resolve } from "node:path"
import { promisify } from "node:util"
import { sha256File } from "./capability-tools.mjs"

const execFileAsync = promisify(execFile)
const SKIP = new Set([".git", ".idea", ".hvigor", "build", "node_modules", "oh_modules"])
const TEXT_EXTENSIONS = new Set([".ets", ".ts", ".json", ".json5"])

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

function slash(path) {
  return path.replaceAll("\\", "/")
}

function maskComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\r\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function parseApi(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return Number(text)
  const parenthesized = text.match(/\((\d+)\)\s*$/)
  if (parenthesized) return Number(parenthesized[1])
  const platform = text.match(/^(\d+)\.0\.0$/)
  if (platform) return Number(platform[1])
  const api = text.match(/(?:api\s*)?(\d+)$/i)
  return api ? Number(api[1]) : null
}

function scalar(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = new RegExp(`(?:["']?${escaped}["']?)\\s*:\\s*(?:["']([^"']+)["']|(-?\\d+)|([A-Za-z_][\\w.]*))`, "i").exec(maskComments(content))
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function balancedObjects(arrayBody) {
  const objects = []
  let depth = 0
  let start = -1
  let quote = null
  let escaped = false
  for (let index = 0; index < arrayBody.length; index += 1) {
    const char = arrayBody[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (["'", '"', "`"].includes(char)) { quote = char; continue }
    if (char === "{") {
      if (depth === 0) start = index
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0 && start >= 0) {
        objects.push(arrayBody.slice(start, index + 1))
        start = -1
      }
    }
  }
  return objects
}

function arraySection(content, key) {
  const source = maskComments(content)
  const keyMatch = new RegExp(`(?:["']?${key}["']?)\\s*:\\s*\\[`, "i").exec(source)
  if (!keyMatch) return []
  const open = source.indexOf("[", keyMatch.index)
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (["'", '"', "`"].includes(char)) { quote = char; continue }
    if (char === "[") depth += 1
    else if (char === "]") {
      depth -= 1
      if (depth === 0) return balancedObjects(source.slice(open + 1, index))
    }
  }
  return []
}

async function walk(root) {
  const files = []
  async function visit(directory) {
    let entries = []
    try { entries = await readdir(directory, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) await visit(path)
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const info = await stat(path)
        if (info.size <= 2 * 1024 * 1024) files.push(path)
      }
    }
  }
  await visit(root)
  return files
}

function lineEvidence(content, match, path, root, id) {
  const line = content.slice(0, match.index).split(/\r?\n/).length
  const row = content.split(/\r?\n/)[line - 1]?.trim().slice(0, 240) ?? ""
  return { signal: id, path: slash(relative(root, path)), line, excerpt: row }
}

async function sdkInfo(projectRoot, explicitPath, profile) {
  const candidates = []
  if (explicitPath) candidates.push({ source: "option", path: resolve(explicitPath) })
  const propertiesPath = resolve(projectRoot, "local.properties")
  if (!explicitPath && await exists(propertiesPath)) {
    const content = await readFile(propertiesPath, "utf8")
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*(sdk\.dir|hwsdk\.dir)\s*[=:]\s*(.+?)\s*$/.exec(line)
      if (match) candidates.push({ source: `local.properties:${match[1]}`, path: isAbsolute(match[2]) ? match[2] : resolve(projectRoot, match[2]) })
    }
  }
  if (!candidates.length) {
    for (const key of ["DEVECO_SDK_HOME", "HARMONYOS_SDK_HOME", "OHOS_SDK_HOME"]) {
      if (process.env[key]) candidates.push({ source: `env:${key}`, path: process.env[key] })
    }
  }
  for (const candidate of candidates) {
    const roots = [candidate.path, resolve(candidate.path, "default")]
    for (const root of roots) {
      const manifestPath = resolve(root, "sdk-pkg.json")
      if (!(await exists(manifestPath))) continue
      try {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
        const data = manifest.data ?? manifest
        const declarationEvidence = []
        const combined = []
        for (const declaration of profile.sdk.requiredDeclarationGlobs) {
          const path = resolve(root, ...declaration.split("/"))
          if (await exists(path)) {
            const content = await readFile(path, "utf8")
            combined.push(content)
            declarationEvidence.push({ path: slash(path), sha256: await sha256File(path) })
          }
        }
        const all = combined.join("\n")
        const missingSymbols = profile.sdk.requiredSymbols.filter((symbol) => {
          if (symbol === "Material.empty") return !/\bempty\b/.test(all) || !/\bMaterial\b/.test(all)
          return !all.includes(symbol)
        })
        return {
          status: missingSymbols.length ? "incomplete" : "available",
          source: candidate.source,
          path: slash(root),
          manifestPath: slash(manifestPath),
          apiVersion: parseApi(data.apiVersion),
          version: data.version ?? null,
          platformVersion: data.platformVersion ?? null,
          releaseType: data.releaseType ?? null,
          declarations: declarationEvidence,
          missingSymbols,
        }
      } catch (error) {
        return { status: "invalid", source: candidate.source, path: slash(root), apiVersion: null, missingSymbols: profile.sdk.requiredSymbols, error: error instanceof Error ? error.message : String(error) }
      }
    }
  }
  return { status: "missing", source: null, path: null, apiVersion: null, missingSymbols: profile.sdk.requiredSymbols }
}

async function gitState(root) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", root, "status", "--porcelain=v1", "--untracked-files=all", "--", "."], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 })
    const entries = stdout.split(/\r?\n/).filter(Boolean).map((line) => ({ status: line.slice(0, 2), path: line.slice(3).trim() }))
    return { repository: true, dirty: entries.length > 0, entries }
  } catch {
    return { repository: false, dirty: null, entries: [] }
  }
}

export async function inspectDevelopmentProject(projectPath, capability, options = {}) {
  if (!isAbsolute(projectPath)) throw new Error("目标工程路径必须是绝对路径")
  const projectRoot = resolve(projectPath)
  if (!(await exists(projectRoot))) throw new Error(`目标工程不存在: ${projectRoot}`)
  const buildProfilePath = resolve(projectRoot, "build-profile.json5")
  const hasBuildProfile = await exists(buildProfilePath)
  const buildProfile = hasBuildProfile ? await readFile(buildProfilePath, "utf8") : ""
  const productObjects = arraySection(buildProfile, "products")
  let products = productObjects.map((item) => ({
    name: scalar(item, "name"),
    compatibleApi: parseApi(scalar(item, "compatibleSdkVersion")),
    targetApi: parseApi(scalar(item, "targetSdkVersion")),
    compileApi: parseApi(scalar(item, "compileSdkVersion")),
  }))
  if (!products.length && hasBuildProfile) products = [{
    name: scalar(buildProfile, "name") ?? "default",
    compatibleApi: parseApi(scalar(buildProfile, "compatibleSdkVersion")),
    targetApi: parseApi(scalar(buildProfile, "targetSdkVersion")),
    compileApi: parseApi(scalar(buildProfile, "compileSdkVersion")),
  }]
  const requestedProduct = options.product ?? null
  const selectedProduct = requestedProduct ? products.find((item) => item.name === requestedProduct) ?? null : products[0] ?? null
  const buildModes = arraySection(buildProfile, "buildModeSet").map((item) => scalar(item, "name")).filter(Boolean)
  const requestedBuildMode = options.buildMode ?? null
  const selectedBuildMode = requestedBuildMode ?? (buildModes.includes("debug") ? "debug" : buildModes[0] ?? "debug")

  const moduleEntries = arraySection(buildProfile, "modules")
  const declaredModules = moduleEntries.map((item) => ({ name: scalar(item, "name"), srcPath: scalar(item, "srcPath") })).filter((item) => item.name && item.srcPath)
  const modules = []
  for (const declared of declaredModules) {
    const moduleRoot = resolve(projectRoot, declared.srcPath)
    const descriptor = resolve(moduleRoot, "src", "main", "module.json5")
    const descriptorExists = await exists(descriptor)
    const content = descriptorExists ? await readFile(descriptor, "utf8") : ""
    const metadataDetected = /ohos\.arkui\.UIMaterial\.state/.test(content)
    modules.push({
      name: declared.name,
      path: slash(relative(projectRoot, moduleRoot)),
      descriptor: descriptorExists ? slash(relative(projectRoot, descriptor)) : null,
      type: descriptorExists ? scalar(content, "type") : null,
      metadataDetected,
      metadataValue: metadataDetected ? scalar(content.slice(content.indexOf("ohos.arkui.UIMaterial.state")), "value") : null,
    })
  }

  const files = await walk(projectRoot)
  const fileData = []
  for (const path of files) {
    const content = await readFile(path, "utf8")
    fileData.push({ path, relativePath: slash(relative(projectRoot, path)), content })
  }
  const signals = capability.profile.projectSignals.map((signal) => {
    const regex = new RegExp(signal.pattern, "gmi")
    const evidence = []
    for (const file of fileData) {
      if (!signal.extensions.includes(extname(file.path).toLowerCase())) continue
      regex.lastIndex = 0
      let match
      while ((match = regex.exec(file.content)) && evidence.length < 20) {
        evidence.push(lineEvidence(file.content, match, file.path, projectRoot, signal.id))
        if (match[0].length === 0) regex.lastIndex += 1
      }
    }
    return { id: signal.id, detected: evidence.length > 0, evidence }
  })

  const targetComponents = [...new Set(Object.values(capability.profile.supportedTargets).flat())]
  const componentEvidence = []
  for (const component of targetComponents) {
    const regex = new RegExp(`\\b${component.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "g")
    for (const file of fileData) {
      regex.lastIndex = 0
      const match = regex.exec(file.content)
      if (match) componentEvidence.push({ component, ...lineEvidence(file.content, match, file.path, projectRoot, "component") })
    }
  }
  const explicitTargetFiles = []
  for (const item of options.targetFiles ?? []) {
    const absolute = isAbsolute(item) ? resolve(item) : resolve(projectRoot, item)
    const rel = relative(projectRoot, absolute)
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`目标文件越出工程目录: ${item}`)
    const present = await exists(absolute)
    explicitTargetFiles.push({ path: slash(rel), exists: present, sha256: present ? await sha256File(absolute) : null })
  }

  const sdk = await sdkInfo(projectRoot, options.sdkPath, capability.profile)
  const git = await gitState(projectRoot)
  const model = modules.length && modules.every((item) => item.descriptor && item.type) ? "stage" : "unknown"
  const reasons = []
  let compatibilityStatus = "supported"
  if (!hasBuildProfile) { compatibilityStatus = "blocked"; reasons.push("根目录缺少 build-profile.json5") }
  else if (!selectedProduct) { compatibilityStatus = "insufficient_context"; reasons.push(requestedProduct ? `未找到 product ${requestedProduct}` : "无法解析 product") }
  if (model !== "stage") { compatibilityStatus = "blocked"; reasons.push("未确认 Stage 模型 module.json5") }
  if (options.module && !modules.some((item) => item.name === options.module)) { compatibilityStatus = "blocked"; reasons.push(`未找到 module ${options.module}`) }
  if (requestedBuildMode && buildModes.length && !buildModes.includes(requestedBuildMode)) { compatibilityStatus = "blocked"; reasons.push(`未找到 build mode ${requestedBuildMode}`) }
  if (explicitTargetFiles.some((item) => !item.exists)) { compatibilityStatus = "blocked"; reasons.push(`指定目标文件不存在: ${explicitTargetFiles.filter((item) => !item.exists).map((item) => item.path).join(", ")}`) }
  if (selectedProduct) {
    if (selectedProduct.targetApi === null) {
      compatibilityStatus = "insufficient_context"
      reasons.push("targetSdkVersion 未知")
    } else if ((selectedProduct.compileApi !== null && selectedProduct.compileApi < 26) || selectedProduct.targetApi < 26) {
      compatibilityStatus = "upgrade_required"
      reasons.push(`ArkUI 沉浸光感要求本机 SDK/显式 compile API 与 target API 达到 26；当前 ${selectedProduct.compileApi ?? "由本机 SDK 决定"}/${selectedProduct.targetApi}`)
    }
  }
  if (sdk.status === "missing" || sdk.status === "invalid") { compatibilityStatus = "blocked"; reasons.push("未定位到可用 HarmonyOS SDK") }
  else if (sdk.apiVersion === null) { compatibilityStatus = "blocked"; reasons.push("SDK API 无法解析") }
  else if (sdk.apiVersion < 26) { compatibilityStatus = "upgrade_required"; reasons.push(`本机 SDK API ${sdk.apiVersion} 低于 26`) }
  else if (sdk.missingSymbols.length) { compatibilityStatus = "blocked"; reasons.push(`SDK 缺少符号: ${sdk.missingSymbols.join(", ")}`) }
  if (options.scenario?.id === "IL-S001" && !modules.some((item) => item.type === "entry")) {
    compatibilityStatus = "blocked"
    reasons.push("应用级配置需要 entry module")
  }
  const misplacedMetadata = modules.filter((item) => item.metadataDetected && item.type !== "entry")
  if (misplacedMetadata.length) { compatibilityStatus = "blocked"; reasons.push(`非 entry 模块包含应用级 metadata: ${misplacedMetadata.map((item) => item.name).join(", ")}`) }

  return {
    inspectionVersion: "1.0",
    projectRoot: slash(projectRoot),
    inspectedAt: new Date().toISOString(),
    buildProfile: hasBuildProfile ? { path: slash(buildProfilePath), sha256: await sha256File(buildProfilePath) } : null,
    product: { requested: requestedProduct, available: products, selected: selectedProduct },
    buildMode: { requested: requestedBuildMode, available: buildModes, selected: selectedBuildMode },
    model,
    modules,
    sdk,
    git,
    targets: { requestedModule: options.module ?? null, requestedComponent: options.component ?? null, requestedFiles: explicitTargetFiles, detectedComponents: componentEvidence },
    signals,
    compatibility: {
      status: compatibilityStatus,
      reasons,
      authorizationRequired: compatibilityStatus === "upgrade_required" ? ["sdk-or-target-upgrade"] : [],
      canModify: compatibilityStatus === "supported",
      canBuild: compatibilityStatus === "supported",
    },
  }
}

function regexEvidence(file, pattern, projectRoot, id) {
  const regex = new RegExp(pattern, "gmi")
  const match = regex.exec(file.content)
  return match ? lineEvidence(file.content, match, file.path, projectRoot, id) : null
}

export async function runStaticScenarioChecks(projectPath, scenario, inspection) {
  const projectRoot = resolve(projectPath)
  const files = await walk(projectRoot)
  const fileData = []
  for (const path of files) fileData.push({ path, relativePath: slash(relative(projectRoot, path)), content: await readFile(path, "utf8") })
  const results = []
  for (const rule of scenario.staticRules) {
    const evidence = []
    let status = "passed"
    if (rule.kind === "require_any") {
      for (const pattern of rule.patterns) for (const file of fileData) {
        const match = regexEvidence(file, pattern, projectRoot, rule.id)
        if (match) evidence.push(match)
      }
      if (!evidence.length) status = rule.onMissing
    } else if (rule.kind === "conditional_require") {
      const applies = fileData.some((file) => new RegExp(rule.when, "mi").test(file.content))
      if (!applies) status = "not_run"
      else {
        for (const pattern of rule.patterns) {
          const match = fileData.map((file) => regexEvidence(file, pattern, projectRoot, rule.id)).find(Boolean)
          if (match) evidence.push(match)
          else status = rule.onMissing
        }
      }
    } else if (rule.kind === "forbid") {
      for (const file of fileData) {
        const match = regexEvidence(file, rule.pattern, projectRoot, rule.id)
        if (match) evidence.push(match)
      }
      if (evidence.length) status = rule.onViolation
    } else if (rule.kind === "forbid_pair") {
      for (const file of fileData) {
        const left = regexEvidence(file, rule.left, projectRoot, rule.id)
        const right = regexEvidence(file, rule.right, projectRoot, rule.id)
        if (left && right) evidence.push(left, right)
      }
      if (evidence.length) status = rule.onViolation
    } else if (rule.kind === "module_metadata_entry_only") {
      const violating = inspection.modules.filter((item) => item.metadataDetected && item.type !== "entry")
      if (violating.length) {
        status = rule.onViolation
        evidence.push(...violating.map((item) => ({ path: item.descriptor, line: null, excerpt: `${item.name}:${item.type}` })))
      }
    } else if (rule.kind === "manual") {
      status = rule.result
    } else {
      status = "inconclusive"
    }
    results.push({ id: rule.id, status, message: rule.message, evidence })
  }
  const status = results.some((item) => item.status === "failed") ? "failed" :
    results.some((item) => item.status === "inconclusive") ? "inconclusive" : "passed"
  return { status, rules: results }
}

export function sdkCheckFromInspection(inspection) {
  const sdk = inspection.sdk
  if (["missing", "invalid"].includes(sdk.status)) return { status: "blocked", message: "SDK 不可用", evidence: [] }
  if (sdk.apiVersion < 26 || sdk.missingSymbols.length) return { status: "failed", message: `SDK API/符号不满足: ${sdk.missingSymbols.join(", ")}`, evidence: sdk.declarations ?? [] }
  return { status: "passed", message: `SDK API ${sdk.apiVersion}，必需符号已找到`, evidence: sdk.declarations ?? [] }
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex")
}

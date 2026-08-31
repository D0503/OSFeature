import { access, readdir, readFile, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

const SKIP_DIRECTORIES = new Set([".git", ".idea", ".hvigor", "build", "node_modules", "oh_modules"])
const TEXT_EXTENSIONS = new Set([".ets", ".ts", ".json", ".json5"])

function slash(path) {
  return path.replaceAll("\\", "/")
}

function extension(path) {
  const match = path.match(/(\.[^./\\]+)$/)
  return match?.[1]?.toLowerCase() ?? ""
}

function lineNumber(content, index) {
  return content.slice(0, Math.max(0, index)).split(/\r?\n/).length
}

function excerpt(content, index, length = 100) {
  const lineStart = content.lastIndexOf("\n", index) + 1
  const lineEndValue = content.indexOf("\n", index)
  const lineEnd = lineEndValue === -1 ? content.length : lineEndValue
  return content.slice(lineStart, lineEnd).trim().slice(0, length)
}

function maskComments(content) {
  const chars = [...content]
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index]
    const next = chars[index + 1]
    if (lineComment) {
      if (current === "\n" || current === "\r") lineComment = false
      else chars[index] = " "
      continue
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        chars[index] = " "
        chars[index + 1] = " "
        index += 1
        blockComment = false
      } else if (current !== "\n" && current !== "\r") {
        chars[index] = " "
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (current === "\\") escaped = true
      else if (current === quote) quote = null
      continue
    }
    if (current === "'" || current === '"' || current === "`") {
      quote = current
      continue
    }
    if (current === "/" && next === "/") {
      chars[index] = " "
      chars[index + 1] = " "
      index += 1
      lineComment = true
    } else if (current === "/" && next === "*") {
      chars[index] = " "
      chars[index + 1] = " "
      index += 1
      blockComment = true
    }
  }
  return chars.join("")
}

function scalarMatcher(key, flags = "i") {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:["']?${escaped}["']?)\\s*:\\s*(?:["']([^"']+)["']|(-?\\d+(?:\\.\\d+)*)|(true|false))`, flags)
}

function parseScalar(content, key) {
  const searchable = maskComments(content)
  const matcher = scalarMatcher(key)
  const match = matcher.exec(searchable)
  if (!match) return { value: null, match: null }
  const value = match[1] ?? match[2] ?? match[3] ?? null
  return { value, match }
}

function parseApiLevel(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  const parenthesized = text.match(/\((\d+)\)\s*$/)
  if (parenthesized) return Number(parenthesized[1])
  if (/^\d+$/.test(text)) return Number(text)
  if (/^\d+\.\d+\.\d+$/.test(text)) return null
  const apiToken = text.match(/(?:api\s*)?(\d+)$/i)
  return apiToken ? Number(apiToken[1]) : null
}

function collectMatches(files, definition) {
  const evidence = []
  let count = 0
  for (const file of files) {
    const searchable = maskComments(file.content)
    const flags = definition.regex.flags.includes("g") ? definition.regex.flags : `${definition.regex.flags}g`
    const matcher = new RegExp(definition.regex.source, flags)
    for (const match of searchable.matchAll(matcher)) {
      count += 1
      if (evidence.length < 20) {
        evidence.push({
          kind: definition.id,
          path: file.path,
          line: lineNumber(file.content, match.index ?? 0),
          excerpt: excerpt(file.content, match.index ?? 0)
        })
      }
    }
  }
  return {
    detected: count > 0,
    count,
    evidence
  }
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function collectProjectFiles(projectRoot) {
  const files = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue
      const absolute = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolute)
        continue
      }
      if (!entry.isFile() || !TEXT_EXTENSIONS.has(extension(entry.name))) continue
      const info = await stat(absolute)
      if (info.size > 2 * 1024 * 1024) continue
      const content = await readFile(absolute, "utf8")
      files.push({ absolute, path: slash(relative(projectRoot, absolute)), content })
    }
  }
  await visit(projectRoot)
  return files
}

function firstConfigValue(files, key) {
  const candidates = []
  for (const file of files.filter((item) => /(?:^|\/)build-profile\.json5$/.test(item.path))) {
    const searchable = maskComments(file.content)
    for (const match of searchable.matchAll(scalarMatcher(key, "gi"))) {
      const api = parseApiLevel(match[1] ?? match[2] ?? match[3] ?? null)
      if (api === null) continue
      candidates.push({
        value: api,
        evidence: {
          kind: key,
          path: file.path,
          line: lineNumber(file.content, match.index ?? 0),
          excerpt: excerpt(file.content, match.index ?? 0)
        }
      })
    }
  }
  const values = new Set(candidates.map((candidate) => candidate.value))
  if (values.size !== 1) return { value: null, evidence: null, conflictingValues: [...values] }
  return { ...candidates[0], conflictingValues: [] }
}

function inspectModules(files) {
  const modules = []
  for (const file of files.filter((item) => /(?:^|\/)module\.json5$/.test(item.path))) {
    const name = parseScalar(file.content, "name")
    const type = parseScalar(file.content, "type")
    const metadataMaterial = /ohos\.arkui\.UIMaterial\.state/.exec(file.content)
    modules.push({
      path: file.path,
      name: typeof name.value === "string" ? name.value : "unknown",
      type: type.value === "entry" || type.value === "feature" || type.value === "shared" ? type.value : "unknown",
      applicationMaterialState: metadataMaterial ? parseScalar(file.content.slice(metadataMaterial.index), "value").value ?? "present" : null
    })
  }
  return modules
}

const SIGNALS = [
  { id: "hdsNavigation", regex: /\bHds(?:Navigation|NavDestination)\b/ },
  { id: "hdsTabs", regex: /\bHdsTabs\b/ },
  { id: "barFloatingStyle", regex: /\bbarFloatingStyle\b/ },
  { id: "adaptiveMaterial", regex: /\b(?:MaterialType|MaterialLevel)\.ADAPTIVE\b|\bADAPTIVE\b/ },
  { id: "hdsMaterialEffect", regex: /\bsystemMaterialEffect\b/ },
  { id: "uiMaterial", regex: /\buiMaterial\b|@kit\.ArkUI.*uiMaterial|@ohos\.arkui\.uiMaterial/ },
  { id: "systemMaterial", regex: /\bsystemMaterial\b/ },
  { id: "apiAvailable26", regex: /apiAvailable\s*\(\s*['"]26\.0\.0['"]\s*\)/ },
  { id: "materialSupported", regex: /isImmersiveMaterialSupported\s*\(/ },
  { id: "fallbackStyle", regex: /\b(?:backgroundColor|borderColor|borderWidth|backgroundBlurStyle)\s*\(/ },
  { id: "webComponent", regex: /\bWeb\s*\(|\bWebView\b|sameLayer/i },
  { id: "materialEmpty", regex: /\bMaterial\.empty\b/ }
]

export async function inspectProject(projectPath) {
  const projectRoot = resolve(projectPath)
  let projectInfo
  try {
    projectInfo = await stat(projectRoot)
  } catch {
    throw new Error(`工程路径不存在: ${projectRoot}`)
  }
  if (!projectInfo.isDirectory()) throw new Error(`工程路径不是目录: ${projectRoot}`)

  const files = await collectProjectFiles(projectRoot)
  const modules = inspectModules(files)
  const compatible = firstConfigValue(files, "compatibleSdkVersion")
  const target = firstConfigValue(files, "targetSdkVersion")
  const hasStageConfig = modules.length > 0
  const hasFaConfig = files.some((file) => /(?:^|\/)config\.json$/.test(file.path))
  const model = hasStageConfig && !hasFaConfig ? "stage" : hasFaConfig && !hasStageConfig ? "fa" : "unknown"
  const signals = Object.fromEntries(SIGNALS.map((definition) => [definition.id, collectMatches(files, definition)]))
  const unknown = []
  if (model === "unknown") unknown.push("model")
  if (compatible.value === null) unknown.push("compatibleApi")
  if (target.value === null) unknown.push("targetApi")
  if (modules.length === 0) unknown.push("modules")

  return {
    schemaVersion: "1.0",
    projectRoot: slash(projectRoot),
    model,
    api: {
      compatible: compatible.value ?? "unknown",
      target: target.value ?? "unknown"
    },
    modules,
    configurationFiles: files
      .filter((file) => /(?:build-profile\.json5|module\.json5|config\.json)$/.test(file.path))
      .map((file) => file.path),
    componentSystem: {
      hds: signals.hdsNavigation.detected || signals.hdsTabs.detected,
      arkuiMaterial: signals.uiMaterial.detected || signals.systemMaterial.detected
    },
    signals,
    evidence: [compatible.evidence, target.evidence].filter(Boolean),
    unknown,
    scan: {
      filesRead: files.length,
      skippedDirectories: [...SKIP_DIRECTORIES]
    }
  }
}

export function evaluateCompatibility(inspection, profile) {
  const compatible = Number.isInteger(inspection.api.compatible) ? inspection.api.compatible : null
  const target = Number.isInteger(inspection.api.target) ? inspection.api.target : null
  const stage = inspection.model === "stage"
  const entryModules = inspection.modules.filter((module) => module.type === "entry")

  const base = {
    schemaVersion: "1.0",
    featureId: profile.featureId,
    status: "insufficient_context",
    recommendedRoute: null,
    availableRoutes: [],
    upgradeOptions: [],
    decisionRequired: false,
    applicationLevel: {
      eligible: false,
      reasons: []
    },
    missingConditions: [],
    fallbackRequirements: [
      "preserve-standard-background-border",
      "check-device-material-capability"
    ]
  }

  if (!stage) {
    if (inspection.model === "fa") {
      return { ...base, status: "unsupported", missingConditions: ["Stage model is required"] }
    }
    return { ...base, missingConditions: ["Unable to determine Stage/FA model"] }
  }
  if (compatible === null) {
    return { ...base, missingConditions: ["Unable to determine compatible API level"] }
  }

  const routes = profile.routes
  const availableRoutes = []
  const guardedRoutes = []
  const upgradeOptions = []
  for (const route of routes) {
    if (compatible >= route.minApi) {
      availableRoutes.push(route.id)
    } else if (target !== null && target >= route.minApi) {
      availableRoutes.push(route.id)
      guardedRoutes.push(route.id)
    } else {
      upgradeOptions.push({
        route: route.id,
        upgradeTargetApi: route.minApi,
        note: `Upgrade targetSdkVersion/compileSdkVersion to ${route.minApi}, keep compatibleSdkVersion at ${compatible}, and protect lower devices at runtime`
      })
    }
  }

  if (availableRoutes.length === 0) {
    return {
      ...base,
      status: "upgrade_available",
      upgradeOptions,
      decisionRequired: true,
      missingConditions: [
        `Compatible API ${compatible} is below every route minimum; integration requires upgrading targetSdkVersion/compileSdkVersion while keeping compatibleSdkVersion for lower devices`
      ],
      fallbackRequirements: ["runtime-version-guard", "preserve-standard-background-border"]
    }
  }

  const recommendedRoute = [...routes]
    .filter((route) => availableRoutes.includes(route.id))
    .sort((a, b) => b.minApi - a.minApi)[0]?.id ?? null

  const reasons = []
  for (const route of routes.filter((item) => item.applicationLevel && availableRoutes.includes(item.id))) {
    if (target === null || target < route.applicationLevel.minTargetApi) {
      reasons.push(`Application-level material requires target API ${route.applicationLevel.minTargetApi} or later (${route.id})`)
    }
    if (route.applicationLevel.moduleTypes?.includes("entry") && entryModules.length === 0) {
      reasons.push(`Application-level material requires an entry module (${route.id})`)
    }
  }
  for (const id of guardedRoutes) {
    reasons.push(`Route ${id} exceeds compatibleSdkVersion; lower devices need runtime version guards and standard style fallback`)
  }

  const applicationLevelRoutes = routes.filter(
    (route) => route.applicationLevel && availableRoutes.includes(route.id)
  )
  const applicationLevelEligible = applicationLevelRoutes.some((route) =>
    target !== null &&
    target >= route.applicationLevel.minTargetApi &&
    (!route.applicationLevel.moduleTypes?.includes("entry") || entryModules.length > 0)
  )
  const effectiveApi = Math.max(compatible, target ?? compatible)

  return {
    ...base,
    status: reasons.length > 0 ? "conditional" : "supported",
    recommendedRoute,
    availableRoutes,
    upgradeOptions,
    decisionRequired: availableRoutes.length > 1 || upgradeOptions.length > 0,
    applicationLevel: {
      eligible: applicationLevelEligible,
      reasons
    },
    missingConditions: reasons,
    fallbackRequirements: effectiveApi >= 26
      ? ["apiAvailable-26", "isImmersiveMaterialSupported", "preserve-standard-background-border"]
      : ["query-hds-material-types-before-custom-level", "preserve-standard-background-border"]
  }
}

function check(id, label, status, evidence = [], message = "") {
  return { id, label, status, message, evidence }
}

export function verifyInspection(inspection, compatibility, routeOption = "auto") {
  const route = routeOption === "auto" ? compatibility.recommendedRoute : routeOption
  const s = inspection.signals
  const checks = []
  checks.push(check(
    "stage-model",
    "Stage model",
    inspection.model === "stage" ? "pass" : "fail",
    inspection.modules.map((module) => ({ path: module.path })),
    inspection.model === "stage" ? "Stage model detected" : "Stage model was not detected"
  ))

  if (!route || !compatibility.availableRoutes.includes(route)) {
    checks.push(check("route-eligibility", "Route eligibility", "fail", [], `Route ${route ?? "none"} is not available`))
  } else {
    checks.push(check("route-eligibility", "Route eligibility", "pass", [], `Route ${route} is available`))
  }

  if (route === "hds") {
    const hdsEvidence = [...s.hdsNavigation.evidence, ...s.hdsTabs.evidence]
    checks.push(check("hds-components", "HDS components", hdsEvidence.length ? "pass" : "fail", hdsEvidence, "HdsNavigation/HdsTabs usage"))
    checks.push(check("hds-material-entry", "HDS material entry", s.hdsMaterialEffect.detected ? "pass" : "fail", s.hdsMaterialEffect.evidence, "systemMaterialEffect is required"))
    checks.push(check("hds-adaptive-material", "Adaptive material", s.adaptiveMaterial.detected ? "pass" : "warn", s.adaptiveMaterial.evidence, "Prefer ADAPTIVE material"))
    checks.push(check(
      "floating-tabs",
      "Floating navigation tabs",
      !s.hdsTabs.detected ? "not_applicable" : s.barFloatingStyle.detected ? "pass" : "fail",
      [...s.hdsTabs.evidence, ...s.barFloatingStyle.evidence],
      "HdsTabs requires barFloatingStyle for floating navigation"
    ))
    checks.push(check("version-guard", "Version guard", "not_applicable", [], "HDS is the minimum API 23 route"))
    checks.push(check("capability-guard", "Device capability query", s.adaptiveMaterial.detected ? "pass" : "warn", s.adaptiveMaterial.evidence, "Custom material levels need a device capability query"))
  } else if (route === "arkui") {
    checks.push(check("arkui-import", "ArkUI uiMaterial import", s.uiMaterial.detected ? "pass" : "fail", s.uiMaterial.evidence, "uiMaterial usage is required"))
    checks.push(check("arkui-material-entry", "ArkUI systemMaterial entry", s.systemMaterial.detected ? "pass" : "fail", s.systemMaterial.evidence, "systemMaterial is required"))
    checks.push(check("version-guard", "API 26 version guard", s.apiAvailable26.detected ? "pass" : "fail", s.apiAvailable26.evidence, "Protect API 26 calls with apiAvailable"))
    checks.push(check("capability-guard", "Material capability guard", s.materialSupported.detected ? "pass" : "fail", s.materialSupported.evidence, "Check isImmersiveMaterialSupported"))
    const configured = inspection.modules.filter((module) => module.applicationMaterialState !== null)
    checks.push(check(
      "application-level-config",
      "Application-level material metadata",
      configured.length === 0 ? "not_applicable" : compatibility.applicationLevel.eligible ? "pass" : "fail",
      configured.map((module) => ({ path: module.path })),
      configured.length === 0 ? "Application-level material is optional" : compatibility.applicationLevel.eligible ? "Metadata is in an eligible project" : compatibility.applicationLevel.reasons.join("; ")
    ))
  }

  checks.push(check("fallback-style", "Fallback style", s.fallbackStyle.detected ? "pass" : "fail", s.fallbackStyle.evidence, "Keep a standard background or border fallback"))
  const compatibleApi = Number.isInteger(inspection.api.compatible) ? inspection.api.compatible : null
  const webRisk = s.webComponent.detected && compatibleApi !== null && compatibleApi <= 23 && (s.hdsMaterialEffect.detected || s.systemMaterial.detected)
  checks.push(check(
    "web-same-layer",
    "Web same-layer rendering",
    webRisk ? "warn" : "not_applicable",
    s.webComponent.evidence,
    webRisk ? "API 23 Web same-layer rendering may become transparent; disable material or same-layer rendering" : "No matching Web same-layer risk detected"
  ))
  const materialCount = (s.hdsMaterialEffect.count ?? s.hdsMaterialEffect.evidence.length) + (s.systemMaterial.count ?? s.systemMaterial.evidence.length)
  checks.push(check(
    "performance-risk",
    "Obvious material overuse",
    materialCount > 12 ? "warn" : "pass",
    [...s.hdsMaterialEffect.evidence, ...s.systemMaterial.evidence],
    materialCount > 12 ? "Many material entries were detected; measure frame time and power" : "No obvious material overuse detected"
  ))

  const counts = Object.fromEntries(["pass", "warn", "fail", "not_applicable"].map((status) => [status, checks.filter((item) => item.status === status).length]))
  return {
    schemaVersion: "1.0",
    featureId: compatibility.featureId,
    route,
    status: counts.fail > 0 ? "failed" : counts.warn > 0 ? "warnings" : "passed",
    counts,
    checks
  }
}

export function parseCliArgs(argv, definitions) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (!definitions.includes(key)) throw new Error(`Unknown option: --${key}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`)
    values[key] = value
    index += 1
  }
  return values
}

export async function loadFeature(skillRoot, featureId) {
  const registryPath = resolve(skillRoot, "references", "feature-registry.json")
  const registry = JSON.parse(await readFile(registryPath, "utf8"))
  const feature = registry.features.find((item) => item.id === featureId)
  if (!feature) throw new Error(`Feature is not registered: ${featureId}`)
  if (feature.status !== "ready") throw new Error(`Feature is not ready: ${featureId}`)
  const profilePath = resolve(skillRoot, feature.profile)
  const rel = relative(skillRoot, profilePath)
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || !(await exists(profilePath))) {
    throw new Error(`Feature profile is invalid: ${feature.profile}`)
  }
  const profile = JSON.parse(await readFile(profilePath, "utf8"))
  if (!profile || typeof profile !== "object" || profile.schemaVersion !== "1.0") {
    throw new Error(`Feature profile schemaVersion is invalid: ${feature.profile}`)
  }
  if (profile.featureId !== feature.id || !Array.isArray(profile.routes) || profile.routes.length === 0) {
    throw new Error(`Feature profile contract is invalid: ${feature.profile}`)
  }
  for (const route of profile.routes) {
    if (!route || typeof route.id !== "string" || !Number.isInteger(route.minApi) || route.requiresStage !== true || !Array.isArray(route.components)) {
      throw new Error(`Feature route contract is invalid: ${feature.profile}`)
    }
  }
  return { feature, profile, registryPath, profilePath }
}

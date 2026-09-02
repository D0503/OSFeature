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

function unescapePropertyPath(value) {
  return value.trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\:/g, ":")
    .replace(/\\\\/g, "\\")
}

function parseLocalProperties(content) {
  const values = new Map()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || line.startsWith("!")) continue
    const separator = line.search(/(?<!\\)[=:]/)
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = unescapePropertyPath(line.slice(separator + 1))
    if (key && value) values.set(key, value)
  }
  return values
}

async function sdkPackageAt(path) {
  const manifestPath = resolve(path, "sdk-pkg.json")
  if (!(await exists(manifestPath))) return null
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    const data = manifest?.data ?? manifest
    const apiVersion = parseApiLevel(data?.apiVersion)
    if (apiVersion === null) return { path, manifestPath, manifest, apiVersion: null }
    return {
      path,
      manifestPath,
      manifest,
      apiVersion,
      version: typeof data.version === "string" ? data.version : "unknown",
      platformVersion: typeof data.platformVersion === "string" ? data.platformVersion : "unknown",
      releaseType: typeof data.releaseType === "string" ? data.releaseType : "unknown"
    }
  } catch (error) {
    return { path, manifestPath, error: error instanceof Error ? error.message : String(error), apiVersion: null }
  }
}

async function findSdkPackages(candidatePath) {
  const candidate = resolve(candidatePath)
  const direct = await sdkPackageAt(candidate)
  if (direct) return [direct]

  const defaultPackage = await sdkPackageAt(resolve(candidate, "default"))
  if (defaultPackage) return [defaultPackage]

  let entries = []
  try {
    entries = await readdir(candidate, { withFileTypes: true })
  } catch {
    return []
  }
  const packages = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const item = await sdkPackageAt(resolve(candidate, entry.name))
    if (item) packages.push(item)
  }
  return packages
}

async function inspectLocalSdk(projectRoot, explicitSdkPath, preferredApi) {
  const localPropertiesPath = resolve(projectRoot, "local.properties")
  const candidates = []
  if (explicitSdkPath) {
    candidates.push({ source: "cli", path: explicitSdkPath, authoritative: true })
  } else if (await exists(localPropertiesPath)) {
    try {
      const properties = parseLocalProperties(await readFile(localPropertiesPath, "utf8"))
      for (const key of ["sdk.dir", "hwsdk.dir"]) {
        const value = properties.get(key)
        if (!value) continue
        candidates.push({
          source: `local.properties:${key}`,
          path: isAbsolute(value) ? value : resolve(projectRoot, value),
          authoritative: true,
          configurationPath: slash(relative(projectRoot, localPropertiesPath))
        })
      }
    } catch (error) {
      return {
        status: "invalid",
        source: "local.properties",
        path: null,
        apiVersion: "unknown",
        error: error instanceof Error ? error.message : String(error),
        evidence: []
      }
    }
  }

  if (candidates.length === 0) {
    for (const key of ["DEVECO_SDK_HOME", "HARMONYOS_SDK_HOME", "OHOS_SDK_HOME"]) {
      if (process.env[key]) candidates.push({ source: `env:${key}`, path: process.env[key], authoritative: false })
    }
  }

  if (candidates.length === 0) {
    return {
      status: "missing",
      source: null,
      path: null,
      apiVersion: "unknown",
      error: "未从 --sdk、local.properties 或受支持的环境变量定位本机 HarmonyOS SDK",
      evidence: []
    }
  }

  for (const candidate of candidates) {
    const packages = await findSdkPackages(candidate.path)
    if (packages.length === 0) {
      if (candidate.authoritative) {
        return {
          status: "invalid",
          source: candidate.source,
          path: slash(resolve(candidate.path)),
          apiVersion: "unknown",
          error: "SDK 路径中未找到可解析的 sdk-pkg.json",
          evidence: candidate.configurationPath ? [{ kind: "sdk-location", path: candidate.configurationPath }] : []
        }
      }
      continue
    }
    const validPackages = packages.filter((item) => Number.isInteger(item.apiVersion))
    const selected = validPackages.find((item) => item.apiVersion === preferredApi) ??
      validPackages.sort((a, b) => b.apiVersion - a.apiVersion)[0]
    if (!selected) {
      return {
        status: "invalid",
        source: candidate.source,
        path: slash(resolve(candidate.path)),
        apiVersion: "unknown",
        error: packages[0]?.error ?? "sdk-pkg.json 缺少有效 apiVersion",
        evidence: packages.map((item) => ({ kind: "sdk-manifest", path: slash(item.manifestPath) }))
      }
    }
    return {
      status: "valid",
      source: candidate.source,
      path: slash(resolve(selected.path)),
      apiVersion: selected.apiVersion,
      version: selected.version,
      platformVersion: selected.platformVersion,
      releaseType: selected.releaseType,
      evidence: [
        ...(candidate.configurationPath ? [{ kind: "sdk-location", path: candidate.configurationPath }] : []),
        { kind: "sdk-manifest", path: slash(selected.manifestPath) }
      ]
    }
  }

  return {
    status: "missing",
    source: null,
    path: null,
    apiVersion: "unknown",
    error: "候选路径中未找到可用的 HarmonyOS SDK",
    evidence: []
  }
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
  { id: "nativeNavigation", regex: /\b(?:Navigation|NavDestination)\s*\(/ },
  { id: "nativeTabs", regex: /\bTabs\s*\(/ },
  { id: "nativeTabsFloatingStyle", regex: /\bTabs\s*\([\s\S]{0,2500}?\.barFloatingStyle\s*\(/ },
  { id: "nativeTabsFloatingMaterial", regex: /\bTabs\s*\([\s\S]{0,2500}?\.barFloatingStyle\s*\(\s*\{[\s\S]{0,800}?\bsystemMaterial\s*:/ },
  { id: "barFloatingStyle", regex: /\bbarFloatingStyle\b/ },
  { id: "barPositionEnd", regex: /\bbarPosition\s*:\s*BarPosition\.End\b|\bbarPosition\s*\(\s*BarPosition\.End\s*\)/ },
  { id: "barOverlapTrue", regex: /\bbarOverlap\s*\(\s*true\s*\)/ },
  { id: "verticalFalse", regex: /\bvertical\s*\(\s*false\s*\)|\bvertical\s*:\s*false\b/ },
  { id: "barStyleStack", regex: /\bbarStyle\s*:\s*BarStyle\.STACK\b/ },
  { id: "barBackgroundConflict", regex: /\b(?:barBackgroundColor|barBackgroundBlurStyle)\s*\(/ },
  { id: "barHeight", regex: /\bbarHeight\s*\(/ },
  { id: "barBottomMarginPositive", regex: /\bbarBottomMargin\s*:\s*(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)\b/ },
  { id: "layoutBottomPadding", regex: /\bpadding\s*\(\s*\{[\s\S]{0,300}?\bbottom\s*:/ },
  { id: "scrollableContent", regex: /\b(?:List|Scroll|WaterFlow|Grid)\s*\(/ },
  { id: "contentEndOffset", regex: /\bcontentEndOffset\s*\(/ },
  { id: "miniBar", regex: /\bminiBar\s*:/ },
  { id: "miniBarBuilder", regex: /\bminiBarBuilder\s*:/ },
  { id: "barLayoutMode", regex: /\bbarLayoutMode\s*:/ },
  { id: "sdkApiVersion24Guard", regex: /\bsdkApiVersion\s*>=\s*24(?:\.0)?\b/ },
  { id: "standardTabs", regex: /\bTabs\s*\(/ },
  { id: "sdkApiVersion", regex: /\bsdkApiVersion\b/ },
  { id: "sdkApiVersion26Guard", regex: /\bsdkApiVersion\s*>=\s*26(?:\.0)?\b/ },
  { id: "adaptiveMaterial", regex: /\b(?:MaterialType|MaterialLevel)\.ADAPTIVE\b|\bADAPTIVE\b/ },
  { id: "hdsMaterialEffect", regex: /\bsystemMaterialEffect\b/ },
  { id: "uiMaterial", regex: /\buiMaterial\b|@kit\.ArkUI.*uiMaterial|@ohos\.arkui\.uiMaterial/ },
  { id: "systemMaterial", regex: /\bsystemMaterial\b/ },
  { id: "menuSystemMaterial", regex: /\bmenuSystemMaterial\b/ },
  { id: "backgroundSystemMaterial", regex: /\b(?:backgroundSystemMaterial|selectedBackgroundSystemMaterial|iconBackgroundSystemMaterial)\b/ },
  { id: "alphabetIndexer", regex: /\bAlphabetIndexer\s*\(/ },
  { id: "selectComponent", regex: /\bSelect\s*\(/ },
  { id: "toggleCheckbox", regex: /\bToggle\s*\(\s*\{[\s\S]{0,200}?\btype\s*:\s*ToggleType\.Checkbox\b/ },
  { id: "sliderComponent", regex: /\bSlider\s*\(/ },
  { id: "popupBackgroundConflict", regex: /\b(?:popupBackground|popupBackgroundBlurStyle)\s*\(/ },
  { id: "apiAvailable26", regex: /apiAvailable\s*\(\s*['"]26\.0\.0['"]\s*\)/ },
  { id: "materialSupported", regex: /isImmersiveMaterialSupported\s*\(/ },
  { id: "fallbackStyle", regex: /\b(?:backgroundColor|borderColor|borderWidth|backgroundBlurStyle)\s*\(/ },
  { id: "webComponent", regex: /\bWeb\s*\(|\bWebView\b|sameLayer/i },
  { id: "materialEmpty", regex: /\bMaterial\.empty\b/ }
]

export async function inspectProject(projectPath, options = {}) {
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
  const compile = firstConfigValue(files, "compileSdkVersion")
  const localSdk = await inspectLocalSdk(projectRoot, options.sdkPath, compile.value)
  const effectiveCompile = compile.value ?? (localSdk.status === "valid" ? localSdk.apiVersion : null)
  const hasStageConfig = modules.length > 0
  const hasFaConfig = files.some((file) => /(?:^|\/)config\.json$/.test(file.path))
  const model = hasStageConfig && !hasFaConfig ? "stage" : hasFaConfig && !hasStageConfig ? "fa" : "unknown"
  const signals = Object.fromEntries(SIGNALS.map((definition) => [definition.id, collectMatches(files, definition)]))
  const unknown = []
  if (model === "unknown") unknown.push("model")
  if (compatible.value === null) unknown.push("compatibleApi")
  if (target.value === null) unknown.push("targetApi")
  if (effectiveCompile === null) unknown.push("compileApi")
  if (modules.length === 0) unknown.push("modules")
  if (localSdk.status !== "valid") unknown.push("localSdk")

  return {
    schemaVersion: "1.0",
    projectRoot: slash(projectRoot),
    model,
    api: {
      compatible: compatible.value ?? "unknown",
      target: target.value ?? "unknown",
      compile: effectiveCompile ?? "unknown",
      compileSource: compile.value === null ? (localSdk.status === "valid" ? "local-sdk-default" : "unknown") : "build-profile"
    },
    localSdk,
    modules,
    configurationFiles: files
      .filter((file) => /(?:build-profile\.json5|module\.json5|config\.json)$/.test(file.path))
      .map((file) => file.path),
    componentSystem: {
      hds: signals.hdsNavigation.detected || signals.hdsTabs.detected,
      arkuiMaterial: signals.uiMaterial.detected || signals.systemMaterial.detected ||
        signals.menuSystemMaterial.detected || signals.backgroundSystemMaterial.detected,
      arkuiNativeNavigation: signals.nativeNavigation.detected || signals.nativeTabs.detected
    },
    signals,
    evidence: [compatible.evidence, target.evidence, compile.evidence, ...localSdk.evidence].filter(Boolean),
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
  const compile = Number.isInteger(inspection.api.compile) ? inspection.api.compile : null
  const stage = inspection.model === "stage"
  const entryModules = inspection.modules.filter((module) => module.type === "entry")
  const localSdk = inspection.localSdk
  const sdkApi = Number.isInteger(localSdk?.apiVersion) ? localSdk.apiVersion : null
  const sdkValid = localSdk?.status === "valid" && sdkApi !== null
  const sdk = {
    status: sdkValid ? "valid" : "insufficient_context",
    sdkStatus: localSdk?.status ?? "missing",
    sdkPath: localSdk?.path ?? null,
    apiVersion: sdkApi ?? "unknown",
    routes: sdkValid
      ? Object.fromEntries(profile.routes.map((route) => {
        const apiSatisfied = sdkApi >= route.minApi
        return [route.id, {
          status: apiSatisfied ? "supported" : "sdk_too_old",
          minApi: route.minApi,
          apiSatisfied
        }]
      }))
      : {}
  }

  const base = {
    schemaVersion: "1.0",
    featureId: profile.featureId,
    status: "insufficient_context",
    recommendedRoute: null,
    selectedRoutes: [],
    routeSelectionMode: profile.routeComposition?.mode ?? "exclusive",
    availableRoutes: [],
    upgradeOptions: [],
    decisionRequired: false,
    applicationLevel: {
      eligible: false,
      reasons: []
    },
    fallbackPolicy: profile.fallbackPolicy ?? null,
    sdk,
    missingConditions: [],
    fallbackRequirements: [
      "preserve-standard-background-border",
      "check-device-material-capability",
      "preserve-pre-integration-source-state"
    ]
  }

  if (!sdkValid) {
    return {
      ...base,
      missingConditions: [
        localSdk?.error ?? "本机 SDK 未定位或未通过验证；使用 --sdk 指定实际 SDK 路径"
      ]
    }
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
    const sdkRoute = sdk.routes[route.id]
    const sdkAvailable = sdkRoute?.status === "supported"
    const compileAvailable = compile === null ? sdkApi >= route.minApi : compile >= route.minApi
    const requiredTargetApi = route.minTargetApi ?? route.minApi
    const targetAvailable = route.minTargetApi === undefined || (target !== null && target >= route.minTargetApi)
    if (sdkAvailable && compileAvailable && targetAvailable && compatible >= route.minApi) {
      availableRoutes.push(route.id)
    } else if (sdkAvailable && compileAvailable && targetAvailable && target !== null && target >= route.minApi) {
      availableRoutes.push(route.id)
      guardedRoutes.push(route.id)
    } else {
      upgradeOptions.push({
        route: route.id,
        upgradeTargetApi: requiredTargetApi,
        upgradeCompileApi: route.minApi,
        upgradeLocalSdkApi: sdkAvailable ? null : route.minApi,
        sdkStatus: sdkRoute?.status ?? "not_checked",
        note: `Ensure the local SDK API and compileSdkVersion reach ${route.minApi}, targetSdkVersion reaches ${requiredTargetApi}, keep compatibleSdkVersion at ${compatible}, protect lower devices at runtime, and preserve the pre-integration source state on every fallback path`
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
        `No route is currently supported by both the project configuration and the verified local SDK API; install or select the required SDK version and upgrade compileSdkVersion/targetSdkVersion as needed while keeping compatibleSdkVersion for lower devices`
      ],
      fallbackRequirements: [
        "runtime-version-guard",
        "preserve-standard-background-border",
        "preserve-pre-integration-source-state"
      ]
    }
  }

  const recommendedRoute = [...routes]
    .filter((route) => availableRoutes.includes(route.id))
    .sort((a, b) => b.minApi - a.minApi)[0]?.id ?? null

  const detectedRouteSignals = {
    hds: Boolean(inspection.componentSystem?.hds),
    arkui: Boolean(inspection.componentSystem?.arkuiMaterial)
  }
  const selectedRoutes = routes
    .filter((route) => availableRoutes.includes(route.id) && detectedRouteSignals[route.id])
    .map((route) => route.id)
  const hasDetectedRouteSignal = Object.values(detectedRouteSignals).some(Boolean)
  if (selectedRoutes.length === 0 && !hasDetectedRouteSignal && recommendedRoute) selectedRoutes.push(recommendedRoute)

  const reasons = []
  for (const route of routes.filter((item) => detectedRouteSignals[item.id] && !availableRoutes.includes(item.id))) {
    const requiredTargetApi = route.minTargetApi ?? route.minApi
    reasons.push(`Detected ${route.id} integration signals, but the route is unavailable; require local SDK/compile API ${route.minApi} and target API ${requiredTargetApi}`)
  }
  for (const route of routes.filter((item) => item.applicationLevel && availableRoutes.includes(item.id))) {
    if (target === null || target < route.applicationLevel.minTargetApi) {
      reasons.push(`Application-level material requires target API ${route.applicationLevel.minTargetApi} or later (${route.id})`)
    }
    if (route.applicationLevel.moduleTypes?.includes("entry") && entryModules.length === 0) {
      reasons.push(`Application-level material requires an entry module (${route.id})`)
    }
  }
  for (const id of guardedRoutes) {
    reasons.push(`Route ${id} exceeds compatibleSdkVersion; lower devices need runtime version guards and must preserve the complete pre-integration source state`)
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
    selectedRoutes,
    availableRoutes,
    upgradeOptions,
    decisionRequired: availableRoutes.length > 1 || upgradeOptions.length > 0,
    applicationLevel: {
      eligible: applicationLevelEligible,
      reasons
    },
    missingConditions: reasons,
    fallbackRequirements: effectiveApi >= 26
      ? [
          ...(availableRoutes.includes("arkui") && compatible < 26 ? ["sdkApiVersion-26-tree-guard"] : []),
          "isImmersiveMaterialSupported",
          "preserve-standard-background-border",
          "preserve-pre-integration-source-state"
        ]
      : ["query-hds-material-types-before-custom-level", "preserve-standard-background-border", "preserve-pre-integration-source-state"]
  }
}

function check(id, label, status, evidence = [], message = "") {
  return { id, label, status, message, evidence }
}

export function verifyInspection(inspection, compatibility, routeOption = "auto") {
  if (routeOption === "auto" && (compatibility.selectedRoutes?.length ?? 0) > 1) {
    const routeResults = compatibility.selectedRoutes.map((route) => verifyInspection(inspection, compatibility, route))
    const checks = routeResults.flatMap((result) => result.checks.map((item) => ({
      ...item,
      id: `${result.route}:${item.id}`,
      route: result.route
    })))
    const counts = Object.fromEntries(["pass", "warn", "fail", "not_applicable"].map((status) => [status, checks.filter((item) => item.status === status).length]))
    return {
      schemaVersion: "1.0",
      featureId: compatibility.featureId,
      route: "composed",
      routes: compatibility.selectedRoutes,
      status: counts.fail > 0 ? "failed" : counts.warn > 0 ? "warnings" : "passed",
      counts,
      checks
    }
  }
  const route = routeOption === "auto"
    ? compatibility.selectedRoutes?.[0] ?? compatibility.recommendedRoute
    : routeOption
  const s = inspection.signals
  const compatibleApi = Number.isInteger(inspection.api.compatible) ? inspection.api.compatible : null
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
    checks.push(check(
      "floating-tabs-bottom-position",
      "Floating tabs bottom position",
      !s.hdsTabs.detected ? "not_applicable" : s.barPositionEnd.detected ? "pass" : "fail",
      [...s.hdsTabs.evidence, ...s.barPositionEnd.evidence],
      "Bottom floating tabs require BarPosition.End; preserve a separate large-screen branch when side navigation is intentional"
    ))
    checks.push(check(
      "floating-tabs-overlap",
      "Floating tabs overlap",
      !s.hdsTabs.detected ? "not_applicable" : s.barOverlapTrue.detected ? "pass" : "fail",
      [...s.hdsTabs.evidence, ...s.barOverlapTrue.evidence],
      "Floating HdsTabs require barOverlap(true) so the bar overlays TabContent"
    ))
    checks.push(check(
      "floating-tabs-height",
      "Floating tabs height",
      !s.hdsTabs.detected ? "not_applicable" : s.barHeight.detected ? "pass" : "warn",
      [...s.hdsTabs.evidence, ...s.barHeight.evidence],
      "Review the visible bar height; the migration snapshots use a 56vp baseline and one switches between 56 and 0 when hidden"
    ))
    const mayStackBottomSpacing = s.hdsTabs.detected && s.barBottomMarginPositive.detected && s.layoutBottomPadding.detected
    checks.push(check(
      "floating-tabs-bottom-spacing",
      "Floating tabs bottom spacing ownership",
      mayStackBottomSpacing ? "warn" : "not_applicable",
      [...s.barBottomMarginPositive.evidence, ...s.layoutBottomPadding.evidence],
      mayStackBottomSpacing
        ? "Positive barBottomMargin and bottom padding were both detected. Confirm component ancestry; if the parent/ancestor padding already moves the whole HdsTabs area, set barBottomMargin to 0. Content-only TabContent padding may serve a separate anti-occlusion purpose"
        : "No obvious duplicate positive barBottomMargin and bottom padding were detected"
    ))
    const hasScrollableTabRisk = s.hdsTabs.detected && s.scrollableContent.detected
    checks.push(check(
      "scrollable-tab-tail-clearance",
      "Scrollable Tab tail clearance",
      !hasScrollableTabRisk ? "not_applicable" : s.contentEndOffset.detected ? "pass" : "warn",
      [...s.scrollableContent.evidence, ...s.contentEndOffset.evidence],
      !hasScrollableTabRisk
        ? "No obvious scrollable content was detected with HdsTabs"
        : s.contentEndOffset.detected
          ? "At least one contentEndOffset was detected; manually verify every scrollable Tab and any Scroll/WaterFlow/Grid tail spacer, and keep HDS-only clearance out of the source fallback"
          : "Scrollable content and HdsTabs were detected without contentEndOffset. Check every Tab for a tail spacer, content padding, or equivalent clearance so the last actionable item can scroll above the floating bar"
    ))
    checks.push(check(
      "mini-bar-contract",
      "MiniBar contract",
      !s.miniBar.detected ? "not_applicable" : s.barFloatingStyle.detected && s.miniBarBuilder.detected ? "pass" : "fail",
      [...s.miniBar.evidence, ...s.miniBarBuilder.evidence, ...s.barFloatingStyle.evidence],
      "MiniBar must be configured inside barFloatingStyle and provide the required miniBarBuilder"
    ))
    const needsMiniBarLayoutGuard = s.miniBar.detected && s.barLayoutMode.detected && compatibleApi !== null && compatibleApi < 24
    checks.push(check(
      "mini-bar-layout-mode-version-guard",
      "MiniBar barLayoutMode version guard",
      !needsMiniBarLayoutGuard ? "not_applicable" : s.sdkApiVersion24Guard.detected ? "pass" : "fail",
      [...s.barLayoutMode.evidence, ...s.sdkApiVersion24Guard.evidence],
      !needsMiniBarLayoutGuard
        ? "barLayoutMode is absent or compatibleSdkVersion is API 24 or later"
        : "barLayoutMode starts at API 24; guard it with deviceInfo.sdkApiVersion >= 24 or omit it from the API 23 branch"
    ))
    const needsLowerVersionTree = compatibleApi !== null && compatibleApi < 23
    checks.push(check(
      "version-guard",
      "HDS lower-version guard",
      !needsLowerVersionTree ? "not_applicable" : s.sdkApiVersion.detected ? "pass" : "fail",
      s.sdkApiVersion.evidence,
      !needsLowerVersionTree ? "compatibleSdkVersion is API 23 or later" : "Use deviceInfo.sdkApiVersion for the API 23 HDS tree guard"
    ))
    checks.push(check(
      "source-tabs-fallback",
      "Source ordinary Tabs fallback",
      !needsLowerVersionTree || !s.hdsTabs.detected ? "not_applicable" : s.standardTabs.detected ? "pass" : "fail",
      [...s.hdsTabs.evidence, ...s.standardTabs.evidence],
      "When compatibleSdkVersion is below 23, keep the source ordinary Tabs tree for lower devices"
    ))
    checks.push(check(
      "source-experience-preservation",
      "Source experience preservation",
      !needsLowerVersionTree || !s.hdsTabs.detected ? "not_applicable" : "warn",
      s.standardTabs.evidence,
      "Static scanning cannot prove behavioral equivalence; compare the lower-version Tabs branch with the pre-integration breakpoints, orientation/window rules, properties, controllers, and events"
    ))
    checks.push(check("capability-guard", "Device capability query", s.adaptiveMaterial.detected ? "pass" : "warn", s.adaptiveMaterial.evidence, "Custom material levels need a device capability query"))
  } else if (route === "arkui") {
    checks.push(check("arkui-import", "ArkUI uiMaterial import", s.uiMaterial.detected ? "pass" : "fail", s.uiMaterial.evidence, "uiMaterial usage is required"))
    const materialEntryEvidence = [
      ...s.systemMaterial.evidence,
      ...s.menuSystemMaterial.evidence,
      ...s.backgroundSystemMaterial.evidence
    ]
    checks.push(check("arkui-material-entry", "ArkUI material entry", materialEntryEvidence.length ? "pass" : "fail", materialEntryEvidence, "Use systemMaterial or the component-specific material entry"))
    const needsLowerVersionTree = compatibleApi !== null && compatibleApi < 26
    checks.push(check(
      "version-guard",
      "API 26 lower-version tree guard",
      !needsLowerVersionTree ? "not_applicable" : s.sdkApiVersion26Guard.detected ? "pass" : "fail",
      s.sdkApiVersion26Guard.evidence,
      !needsLowerVersionTree
        ? "compatibleSdkVersion is API 26 or later"
        : "compatibleSdkVersion is below 26; guard the whole API 26 tree with deviceInfo.sdkApiVersion >= 26"
    ))
    checks.push(check("capability-guard", "Material capability guard", s.materialSupported.detected ? "pass" : "fail", s.materialSupported.evidence, "Check isImmersiveMaterialSupported"))

    const nativeNavigationMaterial = s.nativeNavigation.detected && s.systemMaterial.detected
    checks.push(check(
      "arkui-navigation-stack",
      "Native Navigation title material layout",
      !nativeNavigationMaterial ? "not_applicable" : s.barStyleStack.detected ? "pass" : "warn",
      [...s.nativeNavigation.evidence, ...s.barStyleStack.evidence],
      !nativeNavigationMaterial
        ? "No native Navigation title material target detected"
        : s.barStyleStack.detected
          ? "BarStyle.STACK detected for the native Navigation title material"
          : "BarStyle.STACK is recommended when the source design allows content to extend behind the title bar"
    ))

    const nativeTabsCandidate = s.nativeTabsFloatingStyle.detected
    const nativeTabsMaterial = s.nativeTabsFloatingMaterial.detected
    checks.push(check(
      "arkui-native-tabs-floating-style",
      "Native Tabs floating material entry",
      !nativeTabsCandidate ? "not_applicable" : nativeTabsMaterial ? "pass" : "fail",
      [...s.nativeTabsFloatingStyle.evidence, ...s.nativeTabsFloatingMaterial.evidence],
      "Native Tabs material requires FloatingTabBarStyle.systemMaterial"
    ))
    for (const [id, title, signal, message] of [
      ["arkui-native-tabs-overlap", "Native Tabs overlap", s.barOverlapTrue, "Native floating Tabs require barOverlap(true)"],
      ["arkui-native-tabs-horizontal", "Native Tabs horizontal layout", s.verticalFalse, "Native floating Tabs require vertical(false)"],
      ["arkui-native-tabs-bottom", "Native Tabs bottom position", s.barPositionEnd, "Native floating Tabs require BarPosition.End"]
    ]) {
      checks.push(check(
        id,
        title,
        !nativeTabsMaterial ? "not_applicable" : signal.detected ? "pass" : "fail",
        [...s.nativeTabs.evidence, ...signal.evidence],
        message
      ))
    }
    checks.push(check(
      "arkui-native-tabs-background-conflict",
      "Native Tabs material background conflict",
      !nativeTabsMaterial ? "not_applicable" : s.barBackgroundConflict.detected ? "warn" : "pass",
      [...s.barFloatingStyle.evidence, ...s.barBackgroundConflict.evidence],
      s.barBackgroundConflict.detected
        ? "barBackgroundColor/barBackgroundBlurStyle may cover the native Tabs material"
        : "No native Tabs bar background conflict detected"
    ))

    checks.push(check(
      "arkui-alphabet-indexer-background-conflict",
      "AlphabetIndexer popup material conflict",
      !s.alphabetIndexer.detected || !s.systemMaterial.detected ? "not_applicable" : s.popupBackgroundConflict.detected ? "warn" : "pass",
      [...s.alphabetIndexer.evidence, ...s.popupBackgroundConflict.evidence],
      s.popupBackgroundConflict.detected
        ? "popupBackground/popupBackgroundBlurStyle conflict with AlphabetIndexer immersive material"
        : "No AlphabetIndexer popup background conflict detected"
    ))

    checks.push(check(
      "arkui-select-dual-entry",
      "Select button and menu material entries",
      !s.selectComponent.detected || !s.systemMaterial.detected ? "not_applicable" : s.menuSystemMaterial.detected ? "pass" : "warn",
      [...s.selectComponent.evidence, ...s.systemMaterial.evidence, ...s.menuSystemMaterial.evidence],
      s.menuSystemMaterial.detected
        ? "Select button and menu material entries were both detected"
        : "Select button and dropdown menu are independent; verify whether menuSystemMaterial is also required"
    ))

    checks.push(check(
      "arkui-toggle-checkbox",
      "Toggle Checkbox support",
      !s.toggleCheckbox.detected || !s.systemMaterial.detected ? "not_applicable" : "warn",
      [...s.toggleCheckbox.evidence, ...s.systemMaterial.evidence],
      "ToggleType.Checkbox currently does not adapt immersive material; preserve the source visual style"
    ))
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

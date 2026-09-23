import { access, readdir, readFile, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

import { inspectEasyGo, evaluateEasyGo, verifyEasyGo } from "./easygo-tools.mjs"
import { inspectSmartReach, evaluateSmartReach, verifySmartReach } from "./smart-reach-tools.mjs"
import { inspectMaterialInventory } from "./material-inventory.mjs"

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
  const dotted = text.match(/^(\d+)\.(\d+)\.(\d+)(?:\((\d+)\))?$/)
  if (dotted) {
    const major = Number(dotted[1])
    // API 26 起采用点分 API 版本；旧系统版本不能直接取首段作为 API。
    if (major >= 26) return dotted[4] === undefined ? major : null
    return dotted[4] === undefined ? null : Number(dotted[4])
  }
  const parenthesized = text.match(/\((\d+)\)\s*$/)
  if (parenthesized) return Number(parenthesized[1])
  if (/^\d+$/.test(text)) return Number(text)
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
    const applicationMaterialState = metadataMaterial ? parseScalar(file.content.slice(metadataMaterial.index), "value").value ?? "present" : null
    const effectiveApplicationMaterialState = applicationMaterialState === null
      ? "default"
      : ["default", "enable", "disable"].includes(applicationMaterialState)
        ? applicationMaterialState
        : "invalid"
    modules.push({
      path: file.path,
      name: typeof name.value === "string" ? name.value : "unknown",
      type: type.value === "entry" || type.value === "feature" || type.value === "shared" ? type.value : "unknown",
      applicationMaterialState,
      effectiveApplicationMaterialState
    })
  }
  return modules
}

const SIGNALS = [
  { id: "outerBarWidth", regex: /\.\s*barWidth\s*\(/ },
  { id: "tabDirectionCandidate", regex: /\bvertical\s*(?:\((?!\s*false\s*\))|:(?!\s*false\b))/ },
  { id: "tabPositionCandidate", regex: /\bbarPosition\s*(?:\((?!\s*BarPosition\.End\s*\))|:(?!\s*BarPosition\.End\s*[,}]))/ },
  { id: "hdsNavigation", regex: /\bHds(?:Navigation|NavDestination)\b/ },
  { id: "hdsTabs", regex: /\bHdsTabs\b/ },
  { id: "nativeNavigation", regex: /\b(?:Navigation|NavDestination)\s*\(/ },
  { id: "nativeTabs", regex: /\bTabs\s*\(/ },
  { id: "nativeTabsFloatingStyle", regex: /\bTabs\s*\([\s\S]{0,2500}?\.barFloatingStyle\s*\(/ },
  { id: "nativeTabsFloatingMaterial", regex: /\bTabs\s*\([\s\S]{0,2500}?\.barFloatingStyle\s*\(\s*\{[\s\S]{0,800}?\bsystemMaterial\s*:/ },
  { id: "nativeTabsFloatingMaskColor", regex: /\bTabs\s*\([\s\S]{0,2500}?\.barFloatingStyle\s*\(\s*\{[\s\S]{0,800}?\bmaskColor\s*:/ },
  { id: "nativeTabsFloatingMaskTransparent", regex: /\bTabs\s*\([\s\S]{0,2500}?\.barFloatingStyle\s*\(\s*\{[\s\S]{0,800}?\bmaskColor\s*:\s*(?:Color\.Transparent\b|['"](?:transparent|#00000000)['"])/ },
  { id: "navigationTitleMaterial", regex: /\.title\s*\([\s\S]{0,1600}?\bsystemMaterial\s*:/ },
  { id: "allPageMaterialEntry", regex: /\b(?:ShowToastOptions|PopupOptions|TipsOptions|ContextMenuOptions|CustomDialogControllerOptions|AlertDialogParam|ActionSheetOptions|SheetOptions)\b[\s\S]{0,800}?\bsystemMaterial\s*:|\b(?:Select|Toggle|Slider)\s*\([\s\S]{0,1200}?\.systemMaterial\s*\(/ },
  { id: "ordinaryContentMaterialEntry", regex: /\b(?:Column|Row|Stack|Button|Chip)\s*\([^)]*\)[\s\S]{0,300}?\.systemMaterial\s*\(/ },
  { id: "outOfScopeMaterialLog", regex: /Material inactive:\s*out of scope\.\s*Use component in navigation title bar or Tabbar\./i },
  { id: "barFloatingStyle", regex: /\bbarFloatingStyle\b/ },
  { id: "barPositionEnd", regex: /\bbarPosition\s*:\s*BarPosition\.End\b|\bbarPosition\s*\(\s*BarPosition\.End\s*\)/ },
  { id: "barOverlapTrue", regex: /\bbarOverlap\s*\(\s*true\s*\)/ },
  { id: "verticalFalse", regex: /\bvertical\s*\(\s*false\s*\)|\bvertical\s*:\s*false\b/ },
  { id: "barStyleStack", regex: /\bbarStyle\s*:\s*BarStyle\.STACK\b/ },
  { id: "barBackgroundConflict", regex: /\b(?:barBackgroundColor|barBackgroundBlurStyle)\s*\(/ },
  { id: "barHeight", regex: /\bbarHeight\s*\(/ },
  { id: "barHeightAuto", regex: /\bbarHeight\s*\(\s*(['"])auto\1\s*\)/ },
  { id: "barBottomMarginPositive", regex: /\bbarBottomMargin\s*:\s*(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)\b/ },
  { id: "windowLayoutFullScreenCall", regex: /\bsetWindowLayoutFullScreen\s*\(/ },
  { id: "windowLayoutFullScreenTrue", regex: /\bsetWindowLayoutFullScreen\s*\(\s*true\s*[,)]/ },
  { id: "windowLayoutFullScreenFalse", regex: /\bsetWindowLayoutFullScreen\s*\(\s*false\s*[,)]/ },
  { id: "expandSystemBottom", regex: /\bexpandSafeArea\s*\(\s*\[\s*SafeAreaType\.SYSTEM\s*\]\s*,\s*\[\s*SafeAreaEdge\.BOTTOM\s*\]\s*\)/ },
  { id: "layoutBottomPadding", regex: /\bpadding\s*\(\s*\{[\s\S]{0,300}?\bbottom\s*:/ },
  { id: "scrollableContent", regex: /\b(?:List|Scroll|WaterFlow|Grid)\s*\(/ },
  { id: "contentEndOffset", regex: /\bcontentEndOffset\s*\(/ },
  { id: "scrollTailSpacer", regex: /\bBlank\s*\(\s*\)[\s\S]{0,240}?\.height\s*\(/ },
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
  { id: "toastComponent", regex: /\b(?:showToast|ShowToastOptions)\b/ },
  { id: "dialogComponent", regex: /\b(?:AlertDialog|CustomDialog(?:Controller(?:Options)?)?|ActionSheet)\b/ },
  { id: "menuComponent", regex: /\b(?:ContextMenuOptions|Menu|bindMenu|bindContextMenu)\b/ },
  { id: "selectionMenu", regex: /\bSelectionMenu\b/ },
  { id: "textSelectionMenu", regex: /\bcopyOption\b/ },
  { id: "chipComponent", regex: /\bChip\s*\(/ },
  { id: "chipGroup", regex: /\bChipGroup(?:V2)?\s*\(/ },
  { id: "selectComponent", regex: /\bSelect\s*\(/ },
  { id: "toggleComponent", regex: /\bToggle\s*\(/ },
  { id: "toggleCheckbox", regex: /\bToggle\s*\(\s*\{[\s\S]{0,200}?\btype\s*:\s*ToggleType\.Checkbox\b/ },
  { id: "sliderComponent", regex: /\bSlider\s*\(/ },
  { id: "segmentButton", regex: /\bSegmentButton(?:V2)?\s*\(/ },
  { id: "popupBackgroundConflict", regex: /\b(?:popupBackground|popupBackgroundBlurStyle)\s*\(\s*(?!\s*undefined\s*\))[^)]*\)/ },
  { id: "apiAvailable26", regex: /apiAvailable\s*\(\s*['"]26\.0\.0['"]\s*\)/ },
  { id: "materialSupported", regex: /isImmersiveMaterialSupported\s*\(/ },
  { id: "fallbackStyle", regex: /\b(?:backgroundColor|borderColor|borderWidth|backgroundBlurStyle)\s*\(/ },
  { id: "webComponent", regex: /\bWeb\s*\(|\bWebView\b|sameLayer/i },
  { id: "materialEmpty", regex: /\bMaterial\.empty\b/ },
  { id: "materialColor", regex: /\bmaterialColor\s*:/ },
  { id: "opaqueMaterialColor", regex: /\bmaterialColor\s*:\s*(?:Color\.(?!Transparent\b)\w+|['"]#(?:[0-9A-Fa-f]{6}|FF[0-9A-Fa-f]{6})['"])/ },
  { id: "colorInvertTrue", regex: /\bcolorInvert\s*:\s*true\b/ },
  { id: "hardcodedForegroundColor", regex: /\b(?:fontColor|fillColor|placeholderColor)\s*\(\s*(?:Color\.\w+|['"]#[0-9A-Fa-f]{6,8}['"])/ },
  { id: "applyShadowFalse", regex: /\bapplyShadow\s*:\s*false\b/ },
  { id: "customShadow", regex: /\.shadow\s*\(/ },
  { id: "componentBackgroundColor", regex: /\bbackgroundColor\s*(?:\(|:)/ },
  { id: "backgroundBlurConflict", regex: /\b(?:backgroundBlurStyle|backgroundEffect)\s*\(/ },
  { id: "lightEffectEnabled", regex: /\blightEffect\s*:\s*\{[^}]*\}/ },
  { id: "interactionFallback", regex: /\b(?:stateEffect|hoverEffect|pressed|hover|onTouch)\b/ }
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
    easyGo: inspectEasyGo(files, maskComments),
    smartReach: inspectSmartReach(files, maskComments),
    materialInventory: await inspectMaterialInventory(files, maskComments),
    evidence: [compatible.evidence, target.evidence, compile.evidence, ...localSdk.evidence].filter(Boolean),
    unknown,
    scan: {
      filesRead: files.length,
      skippedDirectories: [...SKIP_DIRECTORIES]
    }
  }
}

export function evaluateCompatibility(inspection, profile) {
  if (profile.featureId === "smart-reach") return evaluateSmartReach(inspection, profile)
  if (profile.featureId === "easygo-parallel") return evaluateEasyGo(inspection, profile)
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
        note: `Ensure the local SDK API and compileSdkVersion reach ${route.minApi}, targetSdkVersion reaches ${requiredTargetApi}, keep compatibleSdkVersion at ${compatible}, protect lower devices at runtime, and preserve the pre-integration source state on every fallback path${route.minApi === 26 || requiredTargetApi === 26 ? '. When writing API 26 to build-profile.json5, use the string "26.0.0" without a parenthesized suffix; preserve the existing compatibleSdkVersion value and format' : ''}`
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
    arkui: Boolean(inspection.componentSystem?.arkuiMaterial || inspection.componentSystem?.arkuiNativeNavigation)
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
          ...(availableRoutes.includes("arkui") && compatible < 26 ? ["sdkApiVersion-26-call-guard"] : []),
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

function effectiveArkuiMaterialState(inspection) {
  const entryModule = inspection.modules.find((module) => module.type === "entry")
  return entryModule?.effectiveApplicationMaterialState ?? "default"
}

export function verifyInspection(inspection, compatibility, routeOption = "auto") {
  if (compatibility.featureId === "smart-reach") return verifySmartReach(inspection, compatibility, routeOption)
  if (compatibility.featureId === "easygo-parallel") return verifyEasyGo(inspection, compatibility, routeOption)
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
      "Floating integration branches require BarPosition.End at every breakpoint; preserve original side navigation only in the legacy API branch"
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
      !s.hdsTabs.detected ? "not_applicable" : s.barHeightAuto?.detected ? "warn" : s.barHeight.detected ? "pass" : "warn",
      [...s.hdsTabs.evidence, ...s.barHeight.evidence, ...(s.barHeightAuto?.evidence ?? [])],
      (s.barHeightAuto?.detected ? "A barHeight('auto') candidate was detected; verify component and version branch ownership. " : "Review the visible bar height and resolve variable, conditional or wrapper values. ") +
      "HDS barHeight does not support auto: remove that configuration from the HDS branch without substituting a fixed height. Preserve valid numeric or dynamic heights and legacy ordinary Tabs configuration. Omitted barHeight is allowed; the migration snapshots use a 56vp baseline and one switches between 56 and 0 when hidden. Static scanning does not prove resolved values or branch coverage"
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
    const materialState = effectiveArkuiMaterialState(inspection)
    const materialEntryEvidence = [
      ...s.systemMaterial.evidence,
      ...s.menuSystemMaterial.evidence,
      ...s.backgroundSystemMaterial.evidence
    ]
    const usesExplicitMaterial = materialEntryEvidence.length > 0
    const tabsSystemDefault = ["default", "enable"].includes(materialState) && s.nativeTabsFloatingStyle.detected
    const enableDefaultTarget = [
      s.nativeNavigation,
      s.nativeTabsFloatingStyle,
      s.alphabetIndexer,
      s.toastComponent,
      s.dialogComponent,
      s.menuComponent,
      s.selectionMenu,
      s.textSelectionMenu,
      s.chipComponent,
      s.chipGroup,
      s.selectComponent,
      s.toggleComponent,
      s.sliderComponent,
      s.segmentButton
    ].some((signal) => signal.detected)
    const defaultTarget = [
      s.alphabetIndexer,
      s.toastComponent,
      s.dialogComponent,
      s.textSelectionMenu
    ].some((signal) => signal.detected)
    const usesApplicationDefault = tabsSystemDefault || (materialState === "enable"
      ? enableDefaultTarget
      : materialState === "default" && defaultTarget)
    checks.push(check(
      "arkui-import",
      "ArkUI uiMaterial import",
      !usesExplicitMaterial ? "not_applicable" : s.uiMaterial.detected ? "pass" : "fail",
      s.uiMaterial.evidence,
      !usesExplicitMaterial ? "Application-level defaults do not require a uiMaterial import" : "Explicit material entries require uiMaterial"
    ))
    checks.push(check(
      "arkui-material-entry",
      "ArkUI material entry",
      materialState === "disable" && (usesExplicitMaterial || s.nativeTabsFloatingStyle.detected)
        ? "fail"
        : usesExplicitMaterial || usesApplicationDefault
          ? "pass"
          : "fail",
      materialEntryEvidence,
      materialState === "disable"
        ? "MaterialState.DISABLE prevents both application defaults and explicit material"
        : usesApplicationDefault && !usesExplicitMaterial
          ? tabsSystemDefault
            ? "The effective native Tabs floating style uses the system default THIN material"
            : `MaterialState.${materialState.toUpperCase()} provides a default for a detected supported component`
          : "Use an application default that covers the target or an explicit component material entry"
    ))
    const needsVersionGuard = compatibleApi !== null && compatibleApi < 26
    checks.push(check(
      "version-guard",
      "API 26 runtime version guard",
      !needsVersionGuard ? "not_applicable" : "warn",
      [...new Set([...s.sdkApiVersion26Guard.evidence, ...s.sdkApiVersion.evidence])],
      !needsVersionGuard
        ? "compatibleSdkVersion is API 26 or later"
        : s.sdkApiVersion26Guard.detected
          ? "A literal API 26 version-check candidate was detected, not verified. Review its execution order and call chain to confirm that every API 26 call, enum and configuration is protected; an unrelated comparison does not prove coverage"
          : "Static scanning could not confirm API 26 protection. Review constant values, equivalent comparisons, Guard wrappers and their call chains; do not rewrite equivalent source code merely to match a literal pattern. Confirm all API 26 calls, enums and configuration remain protected on lower versions"
    ))
    checks.push(check(
      "capability-guard",
      "Material capability guard",
      !usesExplicitMaterial ? "not_applicable" : s.materialSupported.detected ? "pass" : "fail",
      s.materialSupported.evidence,
      !usesExplicitMaterial ? "Application-level default material is system managed" : "Check isImmersiveMaterialSupported for explicit material and preserve the source path"
    ))

    const nativeNavigationMaterial = s.navigationTitleMaterial.detected || (materialState === "enable" && s.nativeNavigation.detected)
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
    const nativeTabsMaterialActive = nativeTabsMaterial || tabsSystemDefault
    checks.push(check(
      "arkui-native-tabs-floating-style",
      "Native Tabs floating material entry",
      !nativeTabsCandidate
        ? "not_applicable"
        : materialState === "disable"
          ? "fail"
          : nativeTabsMaterialActive
            ? "pass"
            : "fail",
      [...s.nativeTabsFloatingStyle.evidence, ...s.nativeTabsFloatingMaterial.evidence],
      materialState === "disable"
        ? "MaterialState.DISABLE prevents native Tabs material"
        : nativeTabsMaterial
          ? "Explicit FloatingTabBarStyle.systemMaterial detected"
          : tabsSystemDefault
            ? "The complete floating layout uses the system default THIN material; explicit systemMaterial is optional"
            : "Complete barFloatingStyle, barOverlap(true), vertical(false), and BarPosition.End"
    ))
    for (const [id, title, signal, message] of [
      ["arkui-native-tabs-overlap", "Native Tabs overlap", s.barOverlapTrue, "Native floating Tabs require barOverlap(true)"],
      ["arkui-native-tabs-horizontal", "Native Tabs horizontal layout", s.verticalFalse, "Native floating Tabs require vertical(false)"],
      ["arkui-native-tabs-bottom", "Native Tabs bottom position", s.barPositionEnd, "Native floating Tabs require BarPosition.End"]
    ]) {
      checks.push(check(
        id,
        title,
        !nativeTabsCandidate ? "not_applicable" : signal.detected ? "pass" : "fail",
        [...s.nativeTabs.evidence, ...signal.evidence],
        message
      ))
    }
    checks.push(check(
      "arkui-native-tabs-background-conflict",
      "Native Tabs material background conflict",
      !nativeTabsMaterialActive ? "not_applicable" : s.barBackgroundConflict.detected ? "warn" : "pass",
      [...s.barFloatingStyle.evidence, ...s.barBackgroundConflict.evidence],
      s.barBackgroundConflict.detected
        ? "barBackgroundColor/barBackgroundBlurStyle may cover the native Tabs material"
        : "No native Tabs bar background conflict detected"
    ))

    checks.push(check(
      "arkui-native-tabs-mask-color",
      "Native Tabs floating mask color",
      !nativeTabsCandidate
        ? "not_applicable"
        : s.nativeTabsFloatingMaskTransparent?.detected
          ? "pass"
          : "warn",
      [...s.nativeTabsFloatingStyle.evidence, ...(s.nativeTabsFloatingMaskColor?.evidence ?? []), ...(s.nativeTabsFloatingMaskTransparent?.evidence ?? [])],
      !nativeTabsCandidate
        ? "No native Tabs floating style detected"
        : s.nativeTabsFloatingMaskTransparent?.detected
          ? "A transparent maskColor was detected on the floating style"
          : s.nativeTabsFloatingMaskColor?.detected
            ? "A non-transparent maskColor was detected. The integration default is maskColor: Color.Transparent; keep the custom color only when the design requires the gradient mask and verify scrolled-content visibility"
            : "Explicitly set maskColor: Color.Transparent in barFloatingStyle by default. Keep a non-transparent mask only when the design requires it, optionally with maskHeight, and preserve the source mask and background behavior in the legacy branch"
    ))

    checks.push(check(
      "arkui-alphabet-indexer-background-conflict",
      "AlphabetIndexer popup material conflict",
      !s.alphabetIndexer.detected || materialState === "disable" ? "not_applicable" : s.popupBackgroundConflict.detected ? "warn" : "pass",
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
    const signalCount = (signal) => signal.count ?? signal.evidence.length
    const provenScopeCount = signalCount(s.navigationTitleMaterial) + signalCount(s.nativeTabsFloatingMaterial) + signalCount(s.allPageMaterialEntry)
    const allExplicitScopesProven = provenScopeCount >= signalCount(s.systemMaterial)
    const confirmedOutOfScope = s.outOfScopeMaterialLog.detected || (
      s.ordinaryContentMaterialEntry.detected &&
      !s.nativeNavigation.detected &&
      !s.nativeTabs.detected &&
      !s.allPageMaterialEntry.detected
    )
    checks.push(check(
      "arkui-material-effect-scope",
      "ArkUI material effect scope",
      confirmedOutOfScope
        ? "fail"
        : !s.systemMaterial.detected
          ? "not_applicable"
          : allExplicitScopesProven
            ? "pass"
            : "warn",
      [...s.outOfScopeMaterialLog.evidence, ...s.ordinaryContentMaterialEntry.evidence, ...s.navigationTitleMaterial.evidence, ...s.nativeTabsFloatingMaterial.evidence, ...s.allPageMaterialEntry.evidence],
      confirmedOutOfScope
        ? s.outOfScopeMaterialLog.detected
          ? "Runtime evidence confirms that the material target is outside the supported scope"
          : "An explicit material entry was found on ordinary content while no supported title, floating TabBar, or all-page target exists"
        : !s.systemMaterial.detected
          ? "No explicit systemMaterial target detected"
          : allExplicitScopesProven
            ? "Every explicit material entry has a supported scope candidate"
            : "Static scanning cannot prove the component ancestry; verify navigation-title, bottom-floating-tabbar, or all-page component scope manually"
    ))

    checks.push(check(
      "arkui-material-color-opacity",
      "ArkUI materialColor opacity",
      !s.materialColor.detected ? "not_applicable" : s.opaqueMaterialColor.detected ? "warn" : "pass",
      [...s.materialColor.evidence, ...s.opaqueMaterialColor.evidence],
      s.opaqueMaterialColor.detected ? "An obviously opaque materialColor can cover the material filter" : "No obviously opaque materialColor literal detected"
    ))
    checks.push(check(
      "arkui-color-invert-resource",
      "ArkUI colorInvert resource colors",
      !s.colorInvertTrue.detected ? "not_applicable" : s.hardcodedForegroundColor.detected ? "warn" : "pass",
      [...s.colorInvertTrue.evidence, ...s.hardcodedForegroundColor.evidence],
      s.hardcodedForegroundColor.detected ? "Hard-coded foreground colors do not participate in automatic inversion; use supported resource colors" : "No obvious hard-coded foreground color conflict detected"
    ))
    checks.push(check(
      "arkui-shadow-conflict",
      "ArkUI material shadow conflict",
      !s.systemMaterial.detected || !s.customShadow.detected ? "not_applicable" : s.applyShadowFalse.detected ? "pass" : "warn",
      [...s.customShadow.evidence, ...s.applyShadowFalse.evidence],
      s.applyShadowFalse.detected ? "Material shadow is disabled before using a custom shadow" : "Custom shadow is present; set applyShadow:false when the custom shadow must win"
    ))
    checks.push(check(
      "arkui-background-blur-conflict",
      "ArkUI material background blur conflict",
      !s.systemMaterial.detected || !s.backgroundBlurConflict.detected ? "not_applicable" : "warn",
      s.backgroundBlurConflict.evidence,
      "backgroundBlurStyle/backgroundEffect can cover or duplicate the material filter"
    ))
    const defaultBackgroundConflict = materialState === "default" && defaultTarget &&
      (s.componentBackgroundColor.detected || s.backgroundBlurConflict.detected || s.customShadow.detected)
    checks.push(check(
      "arkui-default-state-background-conflict",
      "ArkUI DEFAULT component background conditions",
      materialState !== "default" || !defaultTarget
        ? "not_applicable"
        : defaultBackgroundConflict
          ? "warn"
          : "pass",
      [...s.componentBackgroundColor.evidence, ...s.backgroundBlurConflict.evidence, ...s.customShadow.evidence],
      defaultBackgroundConflict
        ? "DEFAULT material for Dialog, Toast, or AlphabetIndexer depends on leaving component background color, blur, and shadow unset; verify the matched property belongs to that component"
        : "No obvious background color, blur, or shadow conflict was detected for the DEFAULT component candidate"
    ))
    checks.push(check(
      "arkui-light-effect-fallback",
      "ArkUI lightEffect fallback feedback",
      !s.lightEffectEnabled.detected ? "not_applicable" : s.interactionFallback.detected ? "pass" : "warn",
      [...s.lightEffectEnabled.evidence, ...s.interactionFallback.evidence],
      s.interactionFallback.detected ? "A non-material interaction feedback candidate was detected" : "lightEffect can replace press/hover feedback; manually confirm a lower-tier and disabled fallback"
    ))

    const configured = inspection.modules.filter((module) => module.applicationMaterialState !== null)
    const invalidConfigured = configured.filter((module) => module.effectiveApplicationMaterialState === "invalid")
    const misplacedConfigured = configured.filter((module) => module.type !== "entry")
    checks.push(check(
      "application-level-config",
      "Application-level material metadata",
      configured.length === 0
        ? "not_applicable"
        : invalidConfigured.length > 0 || misplacedConfigured.length > 0 || !compatibility.applicationLevel.eligible
          ? "fail"
          : "pass",
      configured.map((module) => ({ path: module.path })),
      configured.length === 0
        ? "Application-level material is optional"
        : invalidConfigured.length > 0
          ? "Application material state must be default, enable, or disable"
          : misplacedConfigured.length > 0
            ? "Application material state metadata is only valid in an entry module"
          : compatibility.applicationLevel.eligible
            ? "Metadata is in an eligible project"
            : compatibility.applicationLevel.reasons.join("; ")
    ))
  }

  const hasFloatingTabs = route === "hds"
    ? s.hdsTabs.detected && s.barOverlapTrue.detected && s.barFloatingStyle.detected
    : route === "arkui"
      ? s.nativeTabsFloatingStyle.detected && s.barOverlapTrue.detected
      : false
  const hasFloatingStyle = route === "hds"
    ? s.hdsTabs.detected && s.barFloatingStyle.detected
    : route === "arkui" && s.nativeTabsFloatingStyle.detected
  const needsPaddingReview = hasFloatingStyle && s.layoutBottomPadding.detected
  const tabLayoutCandidates = [s.outerBarWidth, s.tabDirectionCandidate, s.tabPositionCandidate]
    .flatMap((signal) => signal?.evidence ?? [])
  checks.push(check(
    "floating-tabs-width-and-breakpoints",
    "Floating Tabs width and breakpoint layout",
    hasFloatingStyle ? "warn" : "not_applicable",
    tabLayoutCandidates,
    !hasFloatingStyle ? "No floating Tabs detected" :
      (tabLayoutCandidates.length ? "Outer barWidth or direction/position candidates detected. " : "No outer barWidth or side-layout candidate detected; this does not prove branch coverage. ") +
      "Review component ownership, wrappers and version branches. Remove outer .barWidth(...) only from the immersive integration branch; use barFloatingStyle.barWidth or its defaults. Use vertical(false) and BarPosition.End at every breakpoint, orientation and window size. Preserve original responsive side/bottom layout and widths only in the legacy API branch. Material disabled or unsupported-device fallback keeps bottom Tabs. Static coexistence is not a failure; verify layouts on target pages"
  ))
  checks.push(check(
    "floating-tabs-window-immersion",
    "Floating Tabs window immersion and safe-area ancestry",
    hasFloatingStyle ? "warn" : "not_applicable",
    [s.windowLayoutFullScreenCall, s.windowLayoutFullScreenTrue, s.windowLayoutFullScreenFalse, s.expandSystemBottom].flatMap((signal) => signal?.evidence ?? []),
    !hasFloatingStyle
      ? "No floating Tabs detected"
      : "Confirm the target window's effective setWindowLayoutFullScreen state through initialization, wrappers, parameters, conditions and later disabling calls; source candidates do not prove execution. HDS default barBottomMargin is 0; ArkUI default is 28vp. For integration, explicitly use 28vp when window immersion is enabled; otherwise use 0vp and expandSafeArea SYSTEM/BOTTOM on every first-level Tab page, actual scroll container and all its ancestors. Do not enable global window immersion automatically. Even a detected expansion cannot prove ancestor coverage; verify every page and preserve normal/standalone branches and top avoidance"
  ))
  checks.push(check(
    "floating-tabs-bottom-spacing",
    "Floating tabs bottom spacing ownership",
    needsPaddingReview ? "warn" : "not_applicable",
    [...s.barFloatingStyle.evidence, ...s.nativeTabsFloatingStyle.evidence, ...s.layoutBottomPadding.evidence],
    needsPaddingReview
      ? "Floating Tabs and bottom padding were detected with explicit or default bar spacing. Review padding purpose, component ancestry and branch ownership. Keep normal-Tab navigation-bar avoidance padding only in the normal branch; floating content should extend behind the bar. Preserve padding for other layout purposes and scrolling-tail clearance. Static coexistence does not prove a defect and must not trigger automatic margin zeroing or padding removal"
      : "No floating-Tab and bottom-padding coexistence candidate was detected"
  ))
  const hasScrollableTabRisk = hasFloatingTabs && s.scrollableContent.detected
  const tailClearanceEvidence = [...s.contentEndOffset.evidence, ...s.scrollTailSpacer.evidence]
  checks.push(check(
    "scrollable-tab-tail-clearance",
    "Scrollable Tab tail clearance",
    !hasScrollableTabRisk ? "not_applicable" : "warn",
    [...s.scrollableContent.evidence, ...tailClearanceEvidence, ...s.layoutBottomPadding.evidence],
    !hasScrollableTabRisk
      ? "No overlapping HDS or ArkUI floating Tabs with scrollable content were detected"
      : s.contentEndOffset.detected && s.scrollTailSpacer.detected
        ? "Both contentEndOffset and a Blank height candidate were detected. Review component paths, existing compensation and scroll ownership in each window mode before editing: these may duplicate the same clearance. A sibling Blank after a weighted/fill-height List or Tabs can shrink its viewport and leave fixed space behind the floating bar, especially when the outer Scroll is disabled. Coexistence is not proof of a defect; verify every Tab and inner list by scrolling content behind the bar and operating the last item"
        : tailClearanceEvidence.length
        ? "A tail-clearance candidate was detected, not verified. Record each Tab's actual scrolling child, existing compensation and window-dependent scroll ownership. A Blank outside a weighted/fill-height List or Tabs must not replace scrolling-tail clearance. Prefer updating the actual scroller's existing tail configuration once; page-level bottom padding is not tail-clearance evidence. Verify scrolling behind the bar and last-item operation on every Tab and inner list"
        : "Trace each Tab into its actual scrolling container, including nested children and scrollable/window conditions. Add tail clearance inside the scrolling content, not page-level bottom padding that shrinks the viewport and leaves fixed blank space behind the bar. Preserve existing spacing and apply compensation only where the host has actual floating-bar occlusion"
  ))

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

// Static evidence is deliberately conservative: source matches do not prove runtime routing.
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k)

// Read the JSON5 subset used by module manifests without evaluating application code.
export function readManifest(text) {
  let i = 0
  const skip = () => {
    while (i < text.length) {
      if (/\s/.test(text[i])) { i++; continue }
      if (text.slice(i, i + 2) === "//") { while (i < text.length && text[i] !== "\n") i++; continue }
      if (text.slice(i, i + 2) === "/*") {
        const end = text.indexOf("*/", i + 2)
        if (end < 0) throw new Error("Unterminated comment")
        i = end + 2; continue
      }
      break
    }
  }
  const string = () => {
    const quote = text[i++]
    let result = ""
    while (i < text.length) {
      const c = text[i++]
      if (c === quote) return result
      if (c !== "\\") { result += c; continue }
      const e = text[i++]
      if (e === "u" || e === "x") {
        const n = e === "u" ? 4 : 2, hex = text.slice(i, i + n)
        if (!new RegExp(`^[a-fA-F0-9]{${n}}$`).test(hex)) throw new Error("Invalid escape")
        result += String.fromCharCode(parseInt(hex, 16)); i += n
      } else result += ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" })[e] ?? e
    }
    throw new Error("Unterminated string")
  }
  const value = () => {
    skip()
    if (text[i] === '"' || text[i] === "'") return string()
    if (text[i] === "{" || text[i] === "[") {
      const map = text[i++] === "{", end = map ? "}" : "]", out = map ? Object.create(null) : []
      skip()
      while (text[i] !== end) {
        if (i >= text.length) throw new Error("Unterminated object/array")
        if (map) {
          skip()
          let key
          if (text[i] === '"' || text[i] === "'") key = string()
          else { const m = /^[A-Za-z_$][\w$]*/.exec(text.slice(i)); if (!m) throw new Error("Unsupported manifest key"); key = m[0]; i += key.length }
          skip()
          if (text[i++] !== ":") throw new Error("Expected colon")
          if (own(out, key)) throw new Error(`Duplicate key: ${key}`)
          out[key] = value()
        } else out.push(value())
        skip()
        if (text[i] === end) break
        if (text[i++] !== ",") throw new Error("Expected comma")
        skip()
      }
      i++; return out
    }
    const m = /^(?:true|false|null|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(text.slice(i))
    if (!m) throw new Error("Unsupported manifest value")
    i += m[0].length
    return m[0] === "null" ? null : m[0] === "true" ? true : m[0] === "false" ? false : Number(m[0])
  }
  const result = value(); skip()
  if (i !== text.length) throw new Error("Unexpected manifest suffix")
  return result
}

export function inspectEasyGo(files, maskComments) {
  const source = files.filter((f) => /\.(ets|ts)$/.test(f.path)).map((f) => ({ ...f, content: maskComments(f.content) }))
  const matches = (pattern, subset = source) => subset.flatMap((f) => [...f.content.matchAll(pattern)].map((m) => ({ path: f.path, line: f.content.slice(0, m.index).split(/\r?\n/).length, value: m[1] ?? m[0] })))
  const records = []
  for (const f of files.filter((f) => /(?:^|\/)module\.json5$/.test(f.path))) {
    const record = { modulePath: f.path, moduleType: "unknown", reference: null, configs: [], pages: null }
    try {
      const m = readManifest(f.content).module
      if (!object(m)) throw new Error("module object missing")
      record.moduleType = m.type
      record.reference = m.easyGo ?? null
      const prefix = f.path.slice(0, -"module.json5".length)
      record.routes = {
        navigation: matches(/\bNavigation\s*\(/g, source.filter((s) => s.path.startsWith(prefix))),
        router: matches(/(?:@ohos\.router|\brouter\s*\.\s*(?:pushUrl|replaceUrl|pushNamedRoute|replaceNamedRoute)\s*\()/g, source.filter((s) => s.path.startsWith(prefix)))
      }
      const resolveProfile = (reference) => {
        if (typeof reference !== "string" || !/^\$profile:[\w-]+$/.test(reference)) return []
        const name = reference.slice(9)
        return files.filter((file) => file.path.startsWith(`${prefix}resources/`) && file.path.endsWith(`/profile/${name}.json`))
      }
      const pagesFile = resolveProfile(m.pages).find((file) => file.path.includes("/resources/base/"))
      if (pagesFile) {
        try { const pages = JSON.parse(pagesFile.content).src; if (Array.isArray(pages) && pages.every((p) => typeof p === "string")) record.pages = pages } catch { /* Report unresolved page references during validation. */ }
      }
      for (const file of resolveProfile(record.reference)) {
        try { record.configs.push({ path: file.path, value: JSON.parse(file.content) }) }
        catch (error) { record.configs.push({ path: file.path, error: error.message }) }
      }
    } catch (error) { record.error = error.message }
    records.push(record)
  }
  return {
    records,
    navigation: matches(/\bNavigation\s*\(/g),
    router: matches(/(?:@ohos\.router|\brouter\s*\.\s*(?:pushUrl|replaceUrl|pushNamedRoute|replaceNamedRoute)\s*\()/g),
    navigationIds: matches(/\.id\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    pageNames: matches(/(?:\.name\s*\(|pushPathByName\s*\(|\bname\s*:\s*)\s*['"]([^'"]+)['"]/g),
    stateQueries: matches(/\.isEasySplit\s*\(/g)
  }
}

const fields26 = ["wideSplit", "squareSplit", "mode", "pagePairs", "transPages", "splitDividerColor", "drawableRectHook", "enableInSplitScreen"]
export function easyGoRequiredApi(inspection, profile) {
  let api = Math.min(...profile.routes.map((r) => r.minApi))
  if (inspection.easyGo?.stateQueries?.length) api = Math.max(api, profile.capabilities.isEasySplit.minApi)
  for (const r of inspection.easyGo?.records ?? []) for (const c of r.configs) {
    if (!object(c.value)) continue
    for (const device of Object.values(c.value)) {
      const d = device?.displayModeOptions
      for (const o of [d?.routerSplitOptions, d?.navigationSplitOptions]) {
        if (object(o)) for (const key of fields26) if (own(o, key)) api = Math.max(api, profile.capabilities[key].minApi)
      }
    }
  }
  return api
}

export function evaluateEasyGo(inspection, profile) {
  const requiredApi = easyGoRequiredApi(inspection, profile), sdk = inspection.localSdk
  const sdkValid = sdk?.status === "valid" && Number.isInteger(sdk.apiVersion)
  const base = {
    schemaVersion: "1.0", featureId: profile.featureId, requiredApi, status: "insufficient_context",
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false,
    routeSelectionMode: "exclusive", fallbackPolicy: profile.fallbackPolicy,
    fallbackRequirements: ["preserve-pre-integration-source-state", "verify-device-window-and-system-setting", ...(inspection.easyGo?.stateQueries?.length ? ["guard-isEasySplit-api24"] : [])],
    applicationLevel: { eligible: false, reasons: [] }, missingConditions: [],
    sdk: { status: sdkValid ? "valid" : "insufficient_context", sdkStatus: sdk?.status ?? "missing", sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? "unknown", routes: Object.fromEntries(profile.routes.map((r) => [r.id, sdkValid && sdk.apiVersion >= requiredApi])) }
  }
  if (!sdkValid) { base.missingConditions.push("本机 SDK 根清单未验证；使用 --sdk 指定 SDK"); return base }
  if (inspection.model !== "stage") { base.status = inspection.model === "fa" ? "unsupported" : "insufficient_context"; base.missingConditions.push("需要 Stage 工程"); return base }
  if (!inspection.modules.some((m) => m.type === "entry")) { base.status = "unsupported"; base.missingConditions.push("easyGo 仅支持 entry 模块"); return base }
  if (!Number.isInteger(inspection.api.compile) || !Number.isInteger(inspection.api.compatible)) { base.missingConditions.push("工程 compile/compatible API 无法确定"); return base }
  if (sdk.apiVersion < requiredApi || inspection.api.compile < requiredApi) {
    base.status = "upgrade_available"; base.decisionRequired = true
    base.upgradeOptions = profile.routes.map((r) => ({ route: r.id, requiredSdkApi: requiredApi, requiredCompileApi: requiredApi, keepCompatibleApi: inspection.api.compatible, note: `所用平行视界配置/API 需要 SDK 与 compile API ${requiredApi}；保留 compatible，资料未声明额外 target 门槛，不自动修改 target` }))
    base.missingConditions.push(`所用配置或查询接口要求 API ${requiredApi}`)
    return base
  }
  base.availableRoutes = profile.routes.map((r) => r.id)
  const detected = base.availableRoutes.filter((id) => inspection.easyGo?.[id]?.length)
  base.recommendedRoute = detected.length === 1 ? detected[0] : null
  base.decisionRequired = true
  // More than one available route still requires user choice under the shared contract.
  base.applicationLevel.eligible = true
  base.status = "conditional"
  base.missingConditions.push(detected.length > 1 ? "发现混合路由；确认目标并消除平行视界路由冲突" : "确认互斥技术路线，并在目标设备验证窗口条件和系统开关")
  return base
}

export function verifyEasyGo(inspection, compatibility, routeOption) {
  const route = routeOption === "auto" ? compatibility.selectedRoutes?.[0] ?? compatibility.recommendedRoute : routeOption
  const checks = [], records = inspection.easyGo?.records ?? []
  const add = (id, status, message, path) => checks.push({ id: `easygo-${id}`, label: message, status, message, evidence: path ? [{ path }] : [] })
  add("route", route && compatibility.availableRoutes.includes(route) ? "pass" : "fail", "所选 Router/Navigation 路线必须通过 SDK、工程与能力版本门禁")
  if (inspection.easyGo?.navigation?.length && inspection.easyGo?.router?.length) add("mixed-routing", "warn", "工程中同时存在 Router 与 Navigation，需确认生效范围并排查路由异常")
  let configured = 0
  for (const r of records) {
    if (r.error) { add("manifest", "warn", `模块清单无法静态解析：${r.error}`, r.modulePath); continue }
    if (r.reference === null) continue
    configured++
    add("entry", r.moduleType === "entry" ? "pass" : "fail", "easyGo 必须配置于 entry 模块", r.modulePath)
    if (typeof r.reference !== "string" || !/^\$profile:[\w-]+$/.test(r.reference)) { add("reference", "fail", "easyGo 必须引用 $profile:资源名", r.modulePath); continue }
    if (!r.configs.length || !r.configs.some((c) => c.path.includes("/resources/base/"))) add("resource", "fail", "引用的 base/profile JSON 资源不存在", r.modulePath)
    if (route && !r.routes?.[route]?.length) add("route-source", "warn", "所属模块未识别所选路由调用；核对依赖模块或动态封装", r.modulePath)
    for (const c of r.configs) {
      const fail = (id, message) => add(id, "fail", message, c.path)
      const warn = (id, message) => add(id, "warn", message, c.path)
      if (c.error || !object(c.value)) { fail("json", "资源必须为标准 JSON 对象"); continue }
      if (!own(c.value, "common")) fail("common", "缺少 common 默认设备配置")
      for (const [device, v] of Object.entries(c.value)) {
        if (!["common", "phone", "tablet"].includes(device)) { warn("device", `资料未定义设备键 ${device}`); continue }
        const d = v?.displayModeOptions
        if (!object(v) || !object(d)) { fail("display", `${device} 缺少 displayModeOptions 对象`); continue }
        for (const key of Object.keys(v)) if (key !== "displayModeOptions") warn("unknown-field", `${device}.${key} 不在资料定义中`)
        for (const key of Object.keys(d)) if (!["wideWindowMode", "squareWindowMode", "routerSplitOptions", "navigationSplitOptions"].includes(key)) warn("unknown-field", `${device}.displayModeOptions.${key} 不在资料定义中`)
        const modes = ["original", "routerSplit", "navigationSplit"]
        if (!modes.includes(d.wideWindowMode) || (own(d, "squareWindowMode") && !modes.includes(d.squareWindowMode))) fail("window-mode", `${device} 窗口模式无效或缺少 wideWindowMode`)
        const both = own(d, "routerSplitOptions") && own(d, "navigationSplitOptions")
        if (both) fail("exclusive", `${device} 两种 SplitOptions 不能同时存在`)
        for (const m of [d.wideWindowMode, d.squareWindowMode]) if (m && m !== "original" && !own(d, `${m}Options`)) fail("options", `${device} ${m} 缺少对应 Options`)
        if (device !== "common") add("override", "pass", `${device} 完整替代 common，不进行字段合并`, c.path)
        for (const id of ["router", "navigation"]) {
          const key = `${id}SplitOptions`
          if (!own(d, key)) continue
          if (route && route !== id) fail("route-conflict", `${device} 配置与选择的 ${route} 路线冲突`)
          const o = d[key]
          if (!object(o)) { fail("options", `${key} 必须是对象`); continue }
          const known = ["homePage", "relatedPage", "enableReducedContainerSize", "fullScreenPages", "supportLandscapeFullscreen", "dialogSupportSplit", ...fields26, ...(id === "navigation" ? ["homeNavigationId", "disablePlaceholder", "disableDivider"] : [])]
          for (const k of Object.keys(o)) if (!known.includes(k)) {
            if (id === "router" && ["homeNavigationId", "disablePlaceholder", "disableDivider"].includes(k)) fail("navigation-only", `${k} 仅支持 Navigation`)
            else warn("unknown-field", `${key}.${k} 不在资料定义中，需核对`)
          }
          for (const k of ["enableReducedContainerSize", "supportLandscapeFullscreen", "dialogSupportSplit", "drawableRectHook", "enableInSplitScreen", "disablePlaceholder", "disableDivider"]) if (own(o, k) && typeof o[k] !== "boolean") fail("type", `${k} 必须为布尔值`)
          for (const k of ["homePage", "relatedPage", "homeNavigationId"]) if (own(o, k) && (typeof o[k] !== "string" || !o[k].trim())) fail("type", `${k} 必须为非空字符串`)
          if (own(o, "relatedPage") && !o.homePage) fail("related", "relatedPage 必须同时配置 homePage")
          if (o.relatedPage) warn("related-parameters", "关联页不能接收动态参数，需确认可独立初始化")
          const pages = [o.homePage, o.relatedPage].filter((p) => typeof p === "string")
          for (const k of ["fullScreenPages", "transPages"]) {
            if (!own(o, k)) continue
            if (!Array.isArray(o[k]) || o[k].some((p) => typeof p !== "string" || !p.trim())) fail("pages-type", `${k} 必须为非空页面名组成的数组`)
            else pages.push(...o[k])
          }
          if (new Set(pages).size !== pages.length) fail("page-conflict", "主页、关联页、全屏页、过渡页配置重复")
          if (own(o, "mode") && ![0, 1].includes(o.mode)) fail("mode", "mode 仅允许整数 0（购物）或 1（导航）")
          if (o.transPages?.length && o.mode !== 0) warn("mode-effect", "transPages 仅在购物模式生效")
          if (own(o, "pagePairs")) {
            if (o.mode === 0) warn("mode-effect", "pagePairs 仅在导航模式生效")
            if (!Array.isArray(o.pagePairs)) fail("pairs", "pagePairs 必须为数组")
            else for (const pair of o.pagePairs) {
              if (!object(pair) || typeof pair.from !== "string" || !pair.from || typeof pair.to !== "string" || !pair.to) fail("pairs", "pagePairs.from/to 必须成对提供非空字符串")
              else { pages.push(pair.from); if (pair.to !== "*") pages.push(pair.to) }
            }
          }
          for (const k of ["wideSplit", "squareSplit"]) {
            if (!own(o, k)) continue
            const split = o[k]
            if (!object(split)) { fail("split", `${k} 必须为对象`); continue }
            if (own(split, "isDraggable") && typeof split.isDraggable !== "boolean") fail("split", "isDraggable 必须为布尔值")
            if (own(split, "ratio")) {
              const m = typeof split.ratio === "string" && /^\s*([1-9]\d*)\s*\|\s*([1-9]\d*)\s*$/.exec(split.ratio)
              if (!m) fail("ratio", 'ratio 格式必须为 "正整数 | 正整数"')
              else if (+m[1] / +m[2] < 0.5 || +m[1] / +m[2] > 2) warn("ratio", "比例超出 1:2～2:1，系统会使用边界值")
              if (split.isDraggable === true) warn("ratio", "开启拖拽后 ratio 失效，使用 1:2、1:1、2:1 三档")
            }
          }
          if (own(o, "splitDividerColor")) {
            if (!object(o.splitDividerColor) || Object.entries(o.splitDividerColor).some(([k, value]) => !["light", "dark"].includes(k) || typeof value !== "string" || !/^#[0-9a-f]{8}$/i.test(value))) fail("color", "splitDividerColor.light/dark 必须为 #AARRGGBB")
          }
          const modulePrefix = r.modulePath.slice(0, -"module.json5".length)
          for (const page of new Set(pages)) {
            if (id === "router") {
              if (r.pages === null) warn("page-unresolved", `无法解析 pages 资源，待核对 ${page}`)
              else if (!r.pages.includes(page)) fail("page-missing", `Router 页面 ${page} 不在所属模块 pages 列表`)
            } else if (page !== "navBar") {
              const found = inspection.easyGo.pageNames.some((p) => p.path.startsWith(modulePrefix) && p.value === page)
              warn("page-unresolved", `${page}：${found ? "发现页面名候选，仍需确认目标 NavDestination 路由注册" : "未解析到字面量名称，需核对动态路由/常量映射"}`)
            }
          }
          if (o.homeNavigationId) warn("navigation-id", `核对 homeNavigationId=${o.homeNavigationId} 属于全局路由 Navigation；通用 .id 匹配不能证明归属`)
        }
      }
      add("resource", "pass", "已读取引用资源；配置问题见逐项检查", c.path)
    }
  }
  if (!configured) add("configuration", "fail", "未找到 module.easyGo 配置")
  if (inspection.easyGo?.stateQueries?.length && inspection.api.compatible < 24) add("query-guard", "warn", "isEasySplit 从 API 24 支持，需沿调用链验证低版本保护")
  add("runtime", "not_applicable", "运行效果不属于静态检查；另行验证窗口/系统开关、分栏跳转与原始状态回退")
  const counts = Object.fromEntries(["pass", "warn", "fail", "not_applicable"].map((s) => [s, checks.filter((c) => c.status === s).length]))
  return { schemaVersion: "1.0", featureId: compatibility.featureId, route, status: counts.fail ? "failed" : counts.warn ? "warnings" : "passed", checks, counts }
}

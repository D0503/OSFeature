import { readManifest } from "./easygo-tools.mjs"

const MAIN_MANIFEST = /(?:^|\/)src\/main\/module\.json5$/
const PRODUCTION_SOURCE = /\.(ets|ts)$/
const NON_PRODUCTION = /(?:^|\/)(?:test|tests|ohosTest|mock)(?:\/|$)/
const ACTIVITY = "ohos.permission.ACTIVITY_MOTION"
const GESTURE = "ohos.permission.DETECT_GESTURE"
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Matches are evidence candidates, never proof of control flow or callback ownership.
export function inspectSmartReach(files, maskComments) {
  const source = files.filter((f) => PRODUCTION_SOURCE.test(f.path) && !NON_PRODUCTION.test(f.path))
  const records = files.filter((f) => MAIN_MANIFEST.test(f.path)).map((f) => {
    const record = { modulePath: f.path, moduleType: "unknown", permissions: [], permissionDeclarations: [], error: null }
    try {
      const m = readManifest(f.content).module
      if (!m || typeof m !== "object") throw new Error("module object missing")
      record.moduleType = m.type ?? "unknown"
      if (m.requestPermissions !== undefined && !Array.isArray(m.requestPermissions)) throw new Error("requestPermissions must be an array")
      record.permissionDeclarations = (m.requestPermissions ?? []).filter((p) => p && [ACTIVITY, GESTURE].includes(p.name))
      record.permissions = (m.requestPermissions ?? []).map((p) => p.name).filter((p) => typeof p === "string")
    } catch (error) { record.error = error.message }
    return record
  })
  const usages = []
  for (const f of source) {
    const code = maskComments(f.content)
    // Suppress documentation/log strings. Template expressions remain unresolved for review.
    const codePositions = code.replace(/'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g, (s) => s.replace(/[^\r\n]/g, " "))
    const isCode = (m) => codePositions[m.index] === code[m.index]
    const owner = records.filter((r) => f.path.startsWith(r.modulePath.slice(0, -"module.json5".length))).sort((a, b) => b.modulePath.length - a.modulePath.length)[0]
    const evidence = (m) => ({ path: f.path, line: code.slice(0, m.index).split(/\r?\n/).length, modulePath: owner?.modulePath ?? null })
    const aliases = new Set()
    for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@kit\.MultimodalAwarenessKit['"]/g)) {
      if (!isCode(m)) continue
      const binding = /(?:^|,)\s*motion(?:\s+as\s+(\w+))?\s*(?:,|$)/.exec(m[1])
      if (binding) aliases.add(binding[1] ?? "motion")
    }
    for (const m of code.matchAll(/import\s+(\w+)\s+from\s*['"]@ohos\.multimodalAwareness\.motion['"]/g)) if (isCode(m)) aliases.add(m[1])
    for (const alias of aliases) {
      const call = new RegExp(`\\b${escapeRegExp(alias)}\\s*\\.\\s*(on|off)\\s*\\(\\s*['"](holdingHandChanged|operatingHandChanged)['"]\\s*(?:,\\s*([^\\n,)]*))?`, "g")
      for (const m of code.matchAll(call)) {
        if (!isCode(m)) continue
        const callback = m[3]?.trim() ?? null
        usages.push({ ...evidence(m), route: m[2] === "holdingHandChanged" ? "holding-hand" : "operating-hand", operation: m[1], callback, callbackResolved: /^(?:this\.)?[A-Za-z_$][\w$]*$/.test(callback ?? "") })
      }
      for (const m of code.matchAll(new RegExp(`\\b${escapeRegExp(alias)}\\s*\\.\\s*getRecentOperatingHandStatus\\s*\\(`, "g"))) if (isCode(m)) usages.push({ ...evidence(m), route: "operating-hand", operation: "query" })
    }
    for (const m of code.matchAll(/\badaptToHandedness\s*:\s*([^,}\n]+)/g)) {
      if (!isCode(m)) continue
      const value = m[1].trim()
      usages.push({ ...evidence(m), route: "native-component", operation: "property", value, enabled: value === "true" ? true : value === "false" ? false : "unknown", hdsTabsCandidate: /\bHdsTabs\s*\(/.test(code), floatingStyleCandidate: /\.barFloatingStyle\s*\(/.test(code), overlapCandidate: /\.barOverlap\s*\(\s*true\s*\)/.test(code), horizontalCandidate: /\.vertical\s*\(\s*false\s*\)/.test(code), bottomCandidate: /\.barPosition\s*\(\s*BarPosition\.End\s*\)/.test(code) })
    }
  }
  return { records, usages }
}

export function evaluateSmartReach(inspection, profile) {
  const sdk = inspection.localSdk
  const sdkValid = sdk?.status === "valid" && Number.isInteger(sdk.apiVersion)
  const base = {
    schemaVersion: "1.0", featureId: profile.featureId, status: "insufficient_context",
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false,
    routeSelectionMode: "composable", fallbackPolicy: profile.fallbackPolicy,
    fallbackRequirements: ["preserve-pre-integration-source-state", "verify-runtime-api-device-permission-and-setting"],
    applicationLevel: { eligible: false, reasons: ["没有资料支持智感握姿应用级统一开关"] }, missingConditions: [],
    sdk: { status: sdkValid ? "valid" : "insufficient_context", sdkStatus: sdk?.status ?? "missing", sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? "unknown", routes: {} }
  }
  if (!sdkValid) { base.missingConditions.push("本机 SDK 根清单未验证；使用 --sdk 指定 SDK"); return base }
  if (inspection.model !== "stage") { base.status = inspection.model === "fa" ? "unsupported" : "insufficient_context"; base.missingConditions.push("需要 Stage 工程"); return base }
  const modules = inspection.smartReach?.records ?? []
  if (!modules.some((m) => ["entry", "feature"].includes(m.moduleType))) { base.missingConditions.push("未识别 src/main 下的 entry/feature 模块；库代码需定位最终承载 HAP"); return base }
  if (![inspection.api.compile, inspection.api.compatible].every(Number.isInteger)) { base.missingConditions.push("工程 compile/compatible API 无法确定"); return base }
  for (const r of profile.routes) {
    const apiSatisfied = sdk.apiVersion >= r.minApi
    base.sdk.routes[r.id] = { status: apiSatisfied ? "supported" : "sdk_too_old", minApi: r.minApi, apiSatisfied }
    if (apiSatisfied && inspection.api.compile >= r.minApi) base.availableRoutes.push(r.id)
    else base.upgradeOptions.push({ route: r.id, upgradeLocalSdkApi: apiSatisfied ? null : r.minApi, upgradeCompileApi: r.minApi, upgradeTargetApi: null, keepCompatibleApi: inspection.api.compatible, note: `本机 SDK 和 compile 至少 API ${r.minApi}；保留 target/compatible。低版本只运行原程序路径，不以其他感知替代所选能力。` })
  }
  const usages = inspection.smartReach?.usages ?? []
  base.selectedRoutes = base.availableRoutes.filter((id) => usages.some((u) => u.route === id && u.operation !== "off" && u.enabled !== false))
  // API availability does not express whether the target follows a holding or operating hand.
  base.recommendedRoute = base.selectedRoutes.length === 1 ? base.selectedRoutes[0] : null
  base.decisionRequired = base.availableRoutes.length > 1 || base.upgradeOptions.length > 0
  base.status = base.availableRoutes.length ? "conditional" : "upgrade_available"
  base.missingConditions.push("按目标组件与握持手/操作手语义确认路线；SDK 通过不代表设备识别能力通过")
  return base
}

export function verifySmartReach(inspection, compatibility, routeOption = "auto") {
  const chosen = routeOption === "auto" ? compatibility.selectedRoutes ?? [] : [routeOption]
  const checks = []
  const add = (id, status, message, evidence = [], route = null) => checks.push({ id: `smart-reach-${route ? `${route}-` : ""}${id}`, label: message, status, message, evidence, ...(route ? { route } : {}) })
  if (routeOption === "auto") {
    const unavailable = (inspection.smartReach?.usages ?? []).filter((u) => u.operation !== "off" && u.enabled !== false && !compatibility.availableRoutes.includes(u.route))
    for (const route of new Set(unavailable.map((u) => u.route))) add("eligibility", "fail", "已发现该路线调用但未通过 SDK/工程门禁；auto 不得跳过不兼容的组合路径", unavailable.filter((u) => u.route === route), route)
  }
  if (!chosen.length) add("route", "fail", "未识别已启用路线；明确 --route 并核对目标组件，普通 HdsTabs 不算智感握姿")
  for (const route of chosen) {
    const check = (id, status, message, evidence = []) => add(id, status, message, evidence, route)
    if (!compatibility.availableRoutes.includes(route)) { check("eligibility", "fail", "路线未通过 SDK/工程版本门禁或路线 ID 无效"); continue }
    check("eligibility", "pass", "路线已通过 SDK/compile 门禁；不代表运行能力通过")
    const usages = (inspection.smartReach?.usages ?? []).filter((u) => u.route === route)
    const active = usages.filter((u) => u.operation !== "off" && u.enabled !== false)
    if (!active.length) { check("implementation", "warn", "未发现启用配置或感知调用；可能未接入、已关闭或封装未解析，需确认，不能判为接入成功", usages); continue }
    check("implementation", "pass", "发现所选路线候选入口", active)
    const minApi = compatibility.sdk.routes[route]?.minApi
    if (!Number.isInteger(inspection.api.compatible) || inspection.api.compatible < minApi) check("version-guard", "warn", `沿调用链核对 API ${minApi} 保护，SysCap 不能代替版本保护`, active)
    if (route === "native-component") {
      check("component-ownership", "warn", "确认 adaptToHandedness 属于提供原生跟手接口的系统组件；当前实例仅 HdsTabs，不能外推普通 Tabs 或其他组件", active)
      for (const u of active) {
        if (![u.hdsTabsCandidate, u.floatingStyleCandidate, u.overlapCandidate, u.horizontalCandidate, u.bottomCandidate].every(Boolean)) check(`floating-${u.path}-${u.line}`, "warn", "未完整识别 HdsTabs 底部悬浮配置，核对组件归属、barOverlap(true)、vertical(false)、BarPosition.End 及 barFloatingStyle", [u])
        if (u.enabled === "unknown") check(`enabled-${u.path}-${u.line}`, "warn", "跟手开关为表达式，需确认实际启用条件和关闭路径", [u])
      }
      check("native-contract", "warn", "确认组件自身的硬件约束与关闭行为；不强加 motion 订阅或沉浸光感材质", active)
    } else {
      const owners = new Set(active.map((u) => u.modulePath))
      for (const owner of owners) {
        const record = inspection.smartReach.records.find((r) => r.modulePath === owner)
        const ev = active.filter((u) => u.modulePath === owner)
        if (!record || record.error) { check(`permission-owner-${owner}`, "warn", "无法解析承载 HAP 权限；库/封装调用须沿依赖追踪，其他模块的权限不能作为已满足证据", ev); continue }
        const activity = record.permissions.includes(ACTIVITY), gesture = record.permissions.includes(GESTURE)
        check(`permission-${owner}`, (route === "holding-hand" ? gesture : activity || gesture) ? "pass" : "fail", route === "holding-hand" ? "所属模块必须声明 DETECT_GESTURE" : "所属模块必须声明操作手权限（API 15–19: ACTIVITY_MOTION；20+: 两者择一）", [{ path: owner }])
        for (const permission of record.permissionDeclarations ?? []) {
          if (!record.permissions.includes(permission.name)) continue
          const reasonValid = typeof permission.reason === "string" && /^\$string:[A-Za-z_][A-Za-z0-9_]*$/.test(permission.reason)
          const scene = permission.usedScene
          const sceneValid = Array.isArray(scene?.abilities) && scene.abilities.length > 0 && scene.abilities.every((name) => typeof name === "string" && name.trim()) && ["inuse", "always"].includes(scene.when)
          check(`permission-fields-${owner}-${permission.name}`, reasonValid && sceneValid ? "pass" : "fail", `${permission.name} 的 user_grant 声明必须包含 reason 字符串资源引用及 usedScene.abilities/when`, [{ path: owner }])
          if (reasonValid && sceneValid) check(`permission-resources-${owner}-${permission.name}`, "warn", "核对 reason 资源可解析且用途准确，usedScene.abilities 属于实际使用能力的模块 Ability，页面可见期感知使用 inuse", [{ path: owner }])
        }
        if (route === "operating-hand" && gesture && !activity && inspection.api.compatible < 20) check(`permission-api-${owner}`, "warn", "仅 DETECT_GESTURE 无法覆盖 API 15–19；补充 ACTIVITY_MOTION 声明或将操作手增强限制到 API 20+", ev)
      }
      for (const u of active.filter((u) => u.operation === "on")) {
        const off = usages.filter((v) => v.operation === "off" && v.modulePath === u.modulePath)
        const paired = u.callbackResolved && off.some((v) => v.callbackResolved && v.callback === u.callback)
        check(`unsubscribe-${u.path}-${u.line}`, "warn", paired ? "发现同名回调退订候选；核对同一实例、订阅成功标志、可见期生命周期与幂等性" : "未识别同一回调退订；检查封装调用链，避免重复监听或 off(event) 清除其他监听", [u, ...off])
      }
      if (usages.some((u) => u.operation === "off" && !u.callback)) check("off-all", "warn", "off(event) 会取消该事件全部回调；仅退订本组件拥有的同一回调", usages.filter((u) => u.operation === "off" && !u.callback))
      check("capability-errors", "warn", "核对 SysCap、201/801/服务异常、停止后迟到回调与原路径恢复；不能靠关键字证明分支有效", active)
    }
    check("source-state", "warn", "对照基线验证关闭/不支持/低版本回退，未知状态不强制换边，交互期间不移位，功能和状态保持", active)
  }
  if (chosen.length > 1) add("composition", "warn", "组合路线逐目标验证；同一组件只能有一个位置决策者，禁止握持手与操作手竞争")
  add("runtime", "not_applicable", "静态结果不证明真实握姿识别；支持真机的左右手切换、系统设置和负向场景另行验收")
  const counts = Object.fromEntries(["pass", "warn", "fail", "not_applicable"].map((s) => [s, checks.filter((c) => c.status === s).length]))
  return { schemaVersion: "1.0", featureId: compatibility.featureId, route: chosen.length > 1 ? "composed" : chosen[0] ?? null, routes: chosen, status: counts.fail ? "failed" : counts.warn ? "warnings" : "passed", checks, counts }
}

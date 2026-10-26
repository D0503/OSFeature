import { readManifest } from "./easygo-tools.mjs"

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const maskStrings = (s) => s.replace(/'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g, (v) => v.replace(/[^\r\n]/g, " "))
const routeOf = { floatView: "float-view", floatingBall: "floating-ball", dlpAntiPeep: "status-observation" }
const permissionOf = { "float-view": "ohos.permission.FLOAT_VIEW", "floating-ball": "ohos.permission.USE_FLOAT_BALL", "status-observation": "ohos.permission.DLP_GET_HIDE_STATUS", "system-mask": "ohos.permission.DLP_GET_HIDE_STATUS" }
const methods = {
  floatView: ["create", "bind", "unbind", "isFloatViewEnabled", "getFloatViewLimits", "setUIContext", "setUIContextByName", "setWindowSize", "switchTemplate", "start", "stop", "setFloatViewVisibilityInApp", "restoreMainWindow", "getWindowProperties", "onStateChange", "offStateChange", "onRectChange", "offRectChange", "onLimitsChange", "offLimitsChange"],
  floatingBall: ["create", "isFloatingBallEnabled", "startFloatingBall", "updateFloatingBall", "stopFloatingBall", "on", "off", "getFloatingBallWindowInfo", "restoreMainWindow", "setFloatingBallVisibilityInApp", "onDestroy", "offDestroy"],
  dlpAntiPeep: ["isDlpAntiPeepSwitchOn", "getDlpAntiPeepInfo", "on", "off", "setAntiPeepMaskLayer", "requestAntiPeepOptions", "publishAntiPeepInformation", "passDlpAntiPeepInfo"]
}

// Only literals are resolved. Dynamic values and same-named receivers across scopes need review.
function splitTop(text) {
  const masked = maskStrings(text), stack = [], parts = []
  let start = 0
  for (let i = 0; i < masked.length; i++) {
    if ("({[".includes(masked[i])) stack.push(masked[i])
    else if (")}]".includes(masked[i])) stack.pop()
    else if (masked[i] === "," && !stack.length) { parts.push(text.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(text.slice(start).trim())
  return parts
}
function callArgs(code, start) {
  const masked = maskStrings(code)
  let depth = 1
  for (let i = start; i < masked.length; i++) {
    if (masked[i] === "(") depth++
    if (masked[i] === ")" && --depth === 0) return splitTop(code.slice(start, i))
  }
  return []
}
function literal(value) {
  const m = /^(['"])([^'"\\]*)\1$/.exec(value ?? "")
  return m ? m[2] : null
}
function object(value) {
  if (!value?.startsWith("{") || !value.endsWith("}")) return null
  const result = {}
  for (const part of splitTop(value.slice(1, -1))) {
    if (!part) continue
    const m = /^(\w+)\s*:\s*([\s\S]+)$/.exec(part)
    if (!m) return null
    result[m[1]] = m[2].trim()
  }
  return result
}

export function inspectWindowPrivacy(files, maskComments) {
  const records = files.filter((f) => /(?:^|\/)src\/main\/module\.json5$/.test(f.path)).map((f) => {
    const r = { modulePath: f.path, moduleType: "unknown", permissions: [], pages: [], error: null }
    try {
      const m = readManifest(f.content).module
      if (!m || !Array.isArray(m.requestPermissions ?? [])) throw new Error("invalid module/permissions")
      r.moduleType = m.type; r.deviceTypes = m.deviceTypes ?? []
      r.permissions = (m.requestPermissions ?? []).map((p) => p.name)
      const name = /^\$profile:(.+)$/.exec(m.pages ?? "")?.[1]
      const pageFile = files.find((p) => p.path === f.path.replace(/module\.json5$/, `resources/base/profile/${name}.json`))
      if (pageFile) r.pages = readManifest(pageFile.content).src ?? []
    } catch (e) { r.error = e.message }
    return r
  })
  const imports = [], usages = []
  for (const f of files.filter((f) => /\.(ets|ts)$/.test(f.path) && !/(?:^|\/)(?:test|tests|ohosTest|mock)(?:\/|$)/.test(f.path))) {
    const code = maskComments(f.content), positions = maskStrings(code)
    const isCode = (m) => positions[m.index] === code[m.index]
    const owner = records.filter((r) => f.path.startsWith(r.modulePath.slice(0, -"module.json5".length))).sort((a, b) => b.modulePath.length - a.modulePath.length)[0]
    const evidence = (index) => ({ path: f.path, line: code.slice(0, index).split(/\r?\n/).length, modulePath: owner?.modulePath ?? null })
    const bindings = { floatView: [], floatingBall: [], dlpAntiPeep: [] }
    for (const m of code.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s*from\s*['"](@kit\.(?:ArkUI|DeviceSecurityKit)|@ohos\.window\.(?:floatView|floatingBall))['"]/g)) {
      if (!isCode(m)) continue
      const keys = m[4] === "@kit.DeviceSecurityKit" ? ["dlpAntiPeep"] : ["floatView", "floatingBall"]
      for (const key of keys) {
        let name
        if (m[2]) name = `${m[2]}.${key}`
        if (m[3] && m[4].endsWith(`.${key}`)) name = m[3]
        if (m[1]) for (const part of m[1].split(",")) { const b = /^\s*(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(part); if (b?.[1] === key) name = b[2] ?? key }
        if (name) { bindings[key].push(name); imports.push({ ...evidence(m.index), api: key, name }) }
      }
    }
    for (const [api, names] of Object.entries(bindings)) {
      if (!names.length) continue
      const receivers = new Set(names)
      if (api !== "dlpAntiPeep") for (const name of names) {
        const type = api === "floatView" ? "FloatViewController" : "FloatingBallController"
        for (const m of code.matchAll(new RegExp(`\\b(\\w+)\\s*\\??\\s*:\\s*${escape(name)}\\.${type}\\b`, "g"))) if (isCode(m)) { receivers.add(m[1]); receivers.add(`this.${m[1]}`) }
        for (const m of code.matchAll(new RegExp(`\\b((?:this\\.)?\\w+)\\s*=\\s*await\\s+${escape(name)}\\.create\\s*\\(`, "g"))) if (isCode(m)) receivers.add(m[1])
      }
      for (const receiver of receivers) {
        const re = new RegExp(`(?<![\\w$.])${escape(receiver)}\\s*(?:\\?\\.|\\.)\\s*(${methods[api].join("|")})\\s*\\(`, "g")
        for (const m of code.matchAll(re)) {
          if (!isCode(m)) continue
          const args = callArgs(code, m.index + m[0].length), operation = m[1]
          if (["on", "off"].includes(operation) && !["dlpAntiPeep", "click", "stateChange"].includes(literal(args[0]))) continue
          const route = operation === "setAntiPeepMaskLayer" ? "system-mask" : routeOf[api]
          let minApi = api === "floatView" ? 26 : route === "system-mask" ? 21 : 20
          if (operation === "setFloatingBallVisibilityInApp") minApi = 24
          if (["onDestroy", "offDestroy"].includes(operation)) minApi = 26
          if (["requestAntiPeepOptions", "publishAntiPeepInformation"].includes(operation)) minApi = 23
          const props = object(args[operation === "bind" ? 2 : 0])
          if (api === "floatingBall" && props && ["titleColor", "contentColor", "textUpdateAnimationType"].some((k) => k in props)) minApi = 26
          usages.push({ ...evidence(m.index), api, route, operation, receiver, args, props, minApi, event: literal(args[0]) })
        }
      }
      if (api === "dlpAntiPeep") for (const receiver of receivers) {
        const re = new RegExp(`(?<![\\w$.])${escape(receiver)}\\s*\\.\\s*AntiPeepOptionsResult\\b`, "g")
        for (const m of code.matchAll(re)) if (isCode(m)) usages.push({ ...evidence(m.index), api, route: "status-observation", operation: "AntiPeepOptionsResult", receiver, args: [], minApi: 23 })
      }
      // Optional properties in indirect parameter objects still raise the package version.
      if (api === "floatingBall") for (const m of positions.matchAll(/\b(titleColor|contentColor|textUpdateAnimationType)\s*:/g)) usages.push({ ...evidence(m.index), api, route: "floating-ball", operation: "api26-parameter-candidate", minApi: 26, args: [] })
    }
  }
  const select = (apis) => ({ records, imports: imports.filter((i) => apis.includes(i.api)), usages: usages.filter((u) => apis.includes(u.api)) })
  return { floatViewBall: select(["floatView", "floatingBall"]), dlpAntiPeep: select(["dlpAntiPeep"]) }
}

const dataFor = (inspection, feature) => inspection[feature === "float-view-ball" ? "floatViewBall" : "dlpAntiPeep"] ?? { records: [], imports: [], usages: [] }
export function evaluateWindowPrivacy(inspection, profile) {
  const data = dataFor(inspection, profile.featureId), sdk = inspection.localSdk
  const sdkValid = sdk?.status === "valid" && Number.isInteger(sdk.apiVersion)
  const binding = data.usages.some((u) => u.operation === "bind")
  const detected = new Set(data.usages.map((u) => u.route))
  if (binding) { detected.clear(); detected.add("binding") }
  const routeRequirements = Object.fromEntries(profile.routes.map((r) => [r.id, Math.max(r.minApi, ...data.usages.filter((u) => r.id === "binding" ? ["float-view", "floating-ball"].includes(u.route) : u.route === r.id).map((u) => u.minApi))]))
  const selectedRoutes = profile.routes.filter((r) => detected.has(r.id)).map((r) => r.id)
  const result = {
    schemaVersion: "1.0", featureId: profile.featureId, status: "insufficient_context", routeSelectionMode: "composable",
    requiredApi: Math.max(...(selectedRoutes.length ? selectedRoutes : profile.routes.map((r) => r.id)).map((r) => routeRequirements[r])), routeRequirements,
    selectedRoutes, recommendedRoute: null, availableRoutes: [], upgradeOptions: [], decisionRequired: false, bindingDetected: binding,
    fallbackPolicy: profile.fallbackPolicy, fallbackRequirements: ["preserve-pre-integration-source-state", "verify-runtime-api-capability-permission"],
    applicationLevel: { eligible: false, reasons: ["按目标窗口或页面接入"] }, missingConditions: [],
    sdk: { status: sdkValid ? "valid" : "insufficient_context", sdkStatus: sdk?.status ?? "missing", sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? "unknown", routes: {} }
  }
  if (!sdkValid) { result.missingConditions.push("本机 SDK 根清单未验证；使用 --sdk 指定 SDK"); return result }
  if (inspection.model !== "stage") { result.status = inspection.model === "fa" ? "unsupported" : "insufficient_context"; result.missingConditions.push("需要 Stage 工程"); return result }
  if (!data.records.some((r) => ["entry", "feature"].includes(r.moduleType)) || ![inspection.api?.compile, inspection.api?.target, inspection.api?.compatible].every(Number.isInteger)) { result.missingConditions.push("需要可定位的 entry/feature HAP 与有效 compile/target/compatible API"); return result }
  for (const route of profile.routes) {
    const requiredApi = routeRequirements[route.id], requiredTargetApi = Math.max(requiredApi, route.minTargetApi ?? 0)
    const available = sdk.apiVersion >= requiredApi && inspection.api.compile >= requiredApi && inspection.api.target >= requiredTargetApi
    result.sdk.routes[route.id] = { minApi: route.minApi, requiredApi, apiSatisfied: sdk.apiVersion >= requiredApi, status: sdk.apiVersion >= requiredApi ? "supported" : "sdk_too_old" }
    if (available) result.availableRoutes.push(route.id)
    else result.upgradeOptions.push({ route: route.id, upgradeLocalSdkApi: sdk.apiVersion < requiredApi ? requiredApi : null, upgradeCompileApi: requiredApi, upgradeTargetApi: Math.max(inspection.api.target, requiredTargetApi), keepCompatibleApi: inspection.api.compatible, note: `SDK/有效 compile 至少 API ${requiredApi}，target 至少 API ${requiredTargetApi}；已有更高版本不降低，保留 compatible，升级须用户确认，低版本继续原业务路径` })
  }
  result.status = (selectedRoutes.length ? selectedRoutes.some((r) => !result.availableRoutes.includes(r)) : !result.availableRoutes.length) ? "upgrade_available" : "conditional"
  result.recommendedRoute = selectedRoutes.find((r) => result.availableRoutes.includes(r)) ?? result.availableRoutes[0] ?? null
  result.decisionRequired = result.availableRoutes.length > 1 || result.upgradeOptions.length > 0
  result.missingConditions.push(profile.featureId === "float-view-ball" ? "设备/窗口模式、前台状态、用户授权及 ACL 准入需运行核验；绑定选择 binding；同时选择两条独立路线不代表绑定" : "Phone 真机能力、人脸识别、受限权限和系统/应用防窥开关需核验；未知状态不是 PASS")
  return result
}

export function verifyWindowPrivacy(inspection, compatibility, routeOption = "auto") {
  const data = dataFor(inspection, compatibility.featureId), checks = []
  const routes = routeOption === "auto" ? compatibility.selectedRoutes : [routeOption]
  const add = (id, status, message, evidence = []) => checks.push({ id: `${compatibility.featureId}-${id}`, label: message, status, message, evidence })
  if (!routes.length) add("implementation", "warn", "未发现可确认的实现；先确认目标和路线，不能把导入当作接入成功", data.imports)
  for (const route of routes) add(`eligibility-${route}`, compatibility.availableRoutes.includes(route) ? "pass" : "fail", `${route} SDK/compile/target 门槛 ${compatibility.routeRequirements[route] ?? "未知"}，不代表设备或授权可用`)
  const bindingSelected = routes.includes("binding")
  const checkedRoutes = bindingSelected ? ["float-view", "floating-ball"] : routes
  const usages = data.usages.filter((u) => checkedRoutes.includes(u.route))
  if (bindingSelected && !compatibility.bindingDetected) add("binding-implementation", "fail", "选择 binding 但未发现 bind 调用；两个独立实现不能视为已绑定", data.imports)
  if (!bindingSelected && compatibility.bindingDetected) add("binding-route", "fail", "已发现绑定实现，请使用 binding 路线验证两端")
  for (const [i, u] of usages.entries()) {
    const owner = data.records.find((r) => r.modulePath === u.modulePath)
    if (!owner || !["entry", "feature"].includes(owner.moduleType)) add(`owner-${i}`, "warn", "追踪封装或 HAR 的实际宿主 HAP 与权限", [u])
    else add(`permission-${i}`, owner.error ? "warn" : owner.permissions.includes(permissionOf[u.route]) ? "pass" : "fail", `${permissionOf[u.route]} 须在实际宿主声明，声明不能证明授权或 ACL 已获批`, [u])
    if (u.operation === "setUIContext") {
      const path = literal(u.args[0])
      add(`page-${i}`, path === null || !owner || owner.moduleType === "har" ? "warn" : owner.pages.includes(path) ? "pass" : "fail", "setUIContext 路径须与本模块 pages profile 中的 src 一致；跨包使用 setUIContextByName", [u])
    }
    if (["startFloatingBall", "updateFloatingBall", "bind"].includes(u.operation)) {
      if (!u.props) add(`params-${i}`, "warn", "动态参数需核对模板、UTF-8 字节长度、图标像素字节数及 API 26 可选项", [u])
      else {
        const title = literal(u.props.title), content = literal(u.props.content)
        const bad = !("title" in u.props) || !("template" in u.props) || title !== null && (!title || Buffer.byteLength(title) > 64) || content !== null && Buffer.byteLength(content) > 64 || /(?:\.STATIC|^1)$/.test(u.props.template ?? "") && !("icon" in u.props) || ["titleColor", "contentColor"].some((k) => k in u.props) && !("backgroundColor" in u.props)
        add(`params-${i}`, bad ? "fail" : "warn", "模板参数校验：title 非空且≤64字节，content≤64字节，STATIC 要求 icon，文字颜色要求背景色；动态值和图标≤192KB须复核", [u])
        if (u.operation === "updateFloatingBall" && /(?:\.STATIC|^1)$/.test(u.props.template ?? "")) add(`static-update-${i}`, "fail", "STATIC 模板创建后不能更新", [u])
      }
    }
    if (u.operation === "setAntiPeepMaskLayer") {
      const value = Number(u.args[0])
      add(`window-id-${i}`, u.args.length && (!Number.isFinite(value) || Number.isInteger(value) && value > 0) ? "warn" : "fail", "windowId 必须为当前存活且可见的受保护窗口的正整数 ID；动态值、窗口所有权及销毁失效需复核", [u])
    }
    const off = { on: "off", onStateChange: "offStateChange", onRectChange: "offRectChange", onLimitsChange: "offLimitsChange", onDestroy: "offDestroy" }[u.operation]
    if (off) {
      const callback = u.args[u.operation === "on" ? 1 : 0]
      const match = usages.some((v) => v.path === u.path && v.receiver === u.receiver && v.operation === off && (u.operation !== "on" || v.event === u.event) && v.args[v.operation === "off" ? 1 : 0] === callback)
      add(`subscription-${i}`, "warn", match ? "发现配对退订候选；核对同一实例、回调所有权和退出/失败路径" : "未发现同一回调的配对退订；需补全清理或复核跨文件封装", [u])
    }
    if (u.operation === "passDlpAntiPeepInfo") add(`explicit-pass-${i}`, "warn", "放通会持续到锁屏或应用退出，只能来自明确用户操作，不能用于默认恢复或错误处理", [u])
  }
  if (bindingSelected || compatibility.bindingDetected) {
    add("binding", "warn", "绑定前两控制器必须未启动；绑定后只启动一端、停止一端会销毁两端；复核异步竞态、双权限和恢复失败路径", data.usages.filter((u) => u.operation === "bind"))
    if (!compatibility.availableRoutes.includes("binding")) add("binding-version", "fail", "绑定要求 SDK/compile/target 满足 API 26 及实际使用接口要求")
    for (const u of data.usages.filter((u) => u.operation === "bind")) {
      const owner = data.records.find((r) => r.modulePath === u.modulePath)
      if (owner && ["entry", "feature"].includes(owner.moduleType) && !owner.permissions.includes(permissionOf["floating-ball"])) add("binding-permission", "fail", "绑定还需要 USE_FLOAT_BALL 权限", [u])
    }
  }
  for (const route of checkedRoutes) if (!usages.some((u) => u.route === route)) add(`implementation-${route}`, "warn", "所选路线未发现实现，核对跨文件封装与目标")
  add("runtime-guards", "warn", "逐条复核运行 API/SysCap/设备可用性保护先于创建和调用；核对前台、权限、开关、异常与原业务回退", usages)
  add("lifecycle", "warn", compatibility.featureId === "float-view-ball" ? "复核窗口互斥、停止完成回调、资源释放、尺寸变化和主窗口恢复时机" : "复核查询失败保持未知、HIDE 去重、异步退出后失效、窗口销毁清理和蒙层失败不报成功", usages)
  add("runtime-evidence", "warn", "须按能力包运行场景采集证据；静态候选、构建与入口截图不能证明功能生效")
  const counts = Object.fromEntries(["pass", "warn", "fail", "not_applicable"].map((s) => [s, checks.filter((c) => c.status === s).length]))
  return { schemaVersion: "1.0", featureId: compatibility.featureId, route: routes.length === 1 ? routes[0] : "composed", routes, bindingDetected: compatibility.bindingDetected, status: counts.fail ? "failed" : counts.warn ? "warnings" : "passed", checks, counts }
}

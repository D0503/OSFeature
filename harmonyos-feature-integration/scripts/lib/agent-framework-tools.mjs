import { readManifest } from "./easygo-tools.mjs"

const FEATURE = "agent-framework-kit"
const ROUTE = "function-component"
const SAMPLE_ID = "agentproxy65481da1fa2293a8482d45"
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const strings = /'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g
const maskStrings = (s) => s.replace(strings, (v) => v.replace(/[^\r\n]/g, " "))

// Delimiters in strings/comments never participate in object boundaries.
function closing(code, start) {
  const masked = maskStrings(code)
  const stack = []
  const pairs = { "(": ")", "{": "}", "[": "]" }
  for (let i = start; i < masked.length; i++) {
    const c = masked[i]
    if (pairs[c]) stack.push(pairs[c])
    else if ([")", "}", "]"].includes(c)) {
      if (stack.pop() !== c) return -1
      if (!stack.length) return i
    }
  }
  return -1
}

function properties(object) {
  if (!object.startsWith("{") || closing(object, 0) !== object.length - 1) return null
  const code = maskStrings(object)
  const parts = []
  let start = 1
  for (let i = 1; i < code.length - 1; i++) {
    if (["(", "{", "["].includes(code[i])) {
      const end = closing(object, i)
      if (end < 0) return null
      i = end
    } else if (code[i] === ",") { parts.push(object.slice(start, i)); start = i + 1 }
  }
  parts.push(object.slice(start, -1))
  const result = { values: {}, unresolved: false }
  for (const part of parts.map((v) => v.trim()).filter(Boolean)) {
    const match = /^(?:([\w$]+)|['"]([\w$]+)['"])\s*:\s*([\s\S]+)$/.exec(part)
    if (match) result.values[match[1] ?? match[2]] = match[3].trim()
    else if (/^[\w$]+$/.test(part)) result.values[part] = part
    else result.unresolved = true
  }
  return result
}

function literal(expression, source) {
  if (!expression) return null
  const direct = /^(['"])([^'"\\]*)\1$/.exec(expression)
  if (direct) return direct[2]
  const name = /^(?:this\.)?([\w$]+)$/.exec(expression)?.[1]
  if (!name) return null
  const declaration = expression.startsWith("this.") ? "private\\s+(?:readonly\\s+)?" : "const\\s+"
  const positions = maskStrings(source)
  const values = [...source.matchAll(new RegExp(`\\b${declaration}${escape(name)}\\s*(?::\\s*string\\s*)?=\\s*(['"])([^'"\\\\]*)\\1`, "g"))].filter((m) => positions[m.index] === source[m.index])
  if (new RegExp(`\\bthis\\.${escape(name)}\\s*=(?!=)`).test(maskStrings(source))) return null
  return values.length === 1 ? values[0][2] : null
}

export function inspectAgentFramework(files, maskComments) {
  const appFile = files.find((f) => f.path === "AppScope/app.json5")
  const application = { type: "unknown", path: appFile?.path ?? null, error: null }
  if (appFile) {
    try {
      const app = readManifest(appFile.content).app
      if (!app || typeof app !== "object" || Array.isArray(app)) throw new Error("app object missing")
      const baseType = app.bundleType === undefined ? "app" : app.bundleType
      application.type = ["app", "atomicService"].includes(baseType) ? baseType : "unknown"
      const build = files.find((f) => f.path === "build-profile.json5")
      if (build) {
        const products = readManifest(build.content).app?.products
        if (products !== undefined && !Array.isArray(products)) throw new Error("products must be an array")
        application.products = (products ?? []).map((p) => ({ name: p.name ?? "unknown", type: p.bundleType === undefined ? baseType : p.bundleType }))
        const types = new Set(application.products.map((p) => p.type))
        if (types.size > 1 || [...types].some((t) => !["app", "atomicService"].includes(t))) application.type = "unknown"
        else if (types.size === 1) application.type = [...types][0]
      }
    } catch (error) { application.type = "unknown"; application.error = error.message }
  }
  const records = files.filter((f) => /(?:^|\/)src\/main\/module\.json5$/.test(f.path)).map((f) => {
    try {
      const m = readManifest(f.content).module
      if (!m || typeof m !== "object") throw new Error("module object missing")
      return { modulePath: f.path, moduleType: m.type ?? "unknown", deviceTypes: m.deviceTypes ?? [], error: null }
    } catch (error) { return { modulePath: f.path, moduleType: "unknown", deviceTypes: [], error: error.message } }
  })
  const imports = [], usages = []
  for (const file of files.filter((f) => /\.(ets|ts)$/.test(f.path) && !/(?:^|\/)(test|tests|ohosTest|mock)(?:\/|$)/.test(f.path))) {
    const code = maskComments(file.content), positions = maskStrings(code)
    const isCode = (m) => positions[m.index] === code[m.index]
    const owner = records.filter((m) => file.path.startsWith(m.modulePath.slice(0, -"module.json5".length))).sort((a, b) => b.modulePath.length - a.modulePath.length)[0]
    const evidence = (index) => ({ path: file.path, line: code.slice(0, index).split(/\r?\n/).length, modulePath: owner?.modulePath ?? null })
    const bindings = { FunctionComponent: [], FunctionController: [], AgentController: [], ButtonType: [] }
    for (const m of code.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+))\s*from\s*['"]@kit\.AgentFrameworkKit['"]/g)) {
      if (!isCode(m)) continue
      imports.push(evidence(m.index))
      if (m[2]) for (const key of Object.keys(bindings)) bindings[key].push(`${m[2]}.${key}`)
      else for (const part of m[1].split(",")) {
        const binding = /^\s*(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(part)
        if (binding && bindings[binding[1]]) bindings[binding[1]].push(binding[2] ?? binding[1])
      }
    }
    if (!Object.values(bindings).some((v) => v.length)) continue
    for (const name of bindings.FunctionComponent) {
      for (const m of code.matchAll(new RegExp(`\\b${escape(name)}\\s*\\(`, "g"))) {
        if (!isCode(m)) continue
        const begin = m.index + m[0].length - 1, end = closing(code, begin)
        const args = end < 0 ? "" : code.slice(begin + 1, end).trim()
        const props = properties(args)
        const options = props?.values.options ? properties(props.values.options) : null
        const rawId = props?.values.agentId
        usages.push({ ...evidence(m.index), operation: "component", resolved: !!props && !props.unresolved, hasAgentId: !!rawId, agentId: literal(rawId, code), hasOnError: !!props?.values.onError && !/^(?:(?:undefined|null|true|false|\d+(?:\.\d+)?)$|['"])/.test(props.values.onError), controller: props?.values.controller ?? null, optionsResolved: !props?.values.options || !!options && !options.unresolved })
        if (options?.values.buttonType === "2") usages.push({ ...evidence(m.index), operation: "api21-button" })
      }
    }
    for (const name of [...bindings.FunctionController, ...bindings.AgentController]) {
      for (const m of code.matchAll(new RegExp(`\\bnew\\s+${escape(name)}\\s*\\(`, "g"))) if (isCode(m)) usages.push({ ...evidence(m.index), operation: "controller" })
    }
    for (const name of bindings.ButtonType) {
      for (const m of code.matchAll(new RegExp(`\\b${escape(name)}\\s*\\.\\s*ICON_ABOVE_TITLE\\b`, "g"))) if (isCode(m)) usages.push({ ...evidence(m.index), operation: "api21-button" })
    }
    // Receivers are candidates; same spelling cannot prove controller identity across scopes.
    for (const m of code.matchAll(/\b((?:this\.)?[\w$]+)\s*(?:\?\.|\.)\s*(isAgentSupport|on|off)\s*\(\s*(?:['"](agentDialogOpened|agentDialogClosed)['"]\s*(?:,\s*([^,\n)]*))?)?/g)) {
      if (!isCode(m) || m[2] !== "isAgentSupport" && !m[3]) continue
      usages.push({ ...evidence(m.index), operation: m[2], receiver: m[1], event: m[3] ?? null, callback: m[4]?.trim() ?? null })
    }
  }
  return { application, records, imports, usages }
}

export function evaluateAgentFramework(inspection, profile) {
  const data = inspection.agentFramework ?? {}, sdk = inspection.localSdk
  const sdkValid = sdk?.status === "valid" && Number.isInteger(sdk.apiVersion)
  const minApi = profile.routes[0].minApi
  const requiredApi = Math.max(minApi, data.application?.type === "atomicService" ? profile.capabilities.atomicService.minApi : minApi, data.usages?.some((u) => u.operation === "api21-button") ? profile.capabilities.iconAboveTitle.minApi : minApi)
  const result = {
    schemaVersion: "1.0", featureId: FEATURE, status: "insufficient_context", requiredApi,
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false,
    routeSelectionMode: "exclusive", fallbackPolicy: profile.fallbackPolicy,
    fallbackRequirements: ["preserve-pre-integration-source-state", "verify-runtime-api-syscap-and-agent-availability"],
    applicationLevel: { eligible: false, reasons: ["Function 组件按目标页面接入，无应用级统一开关"] },
    missingConditions: [], sdk: { status: sdkValid ? "valid" : "insufficient_context", sdkStatus: sdk?.status ?? "missing", sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? "unknown", routes: {} }
  }
  if (!sdkValid) { result.missingConditions.push("本机 SDK 根清单未验证；使用 --sdk 指定 SDK"); return result }
  result.sdk.routes[ROUTE] = { minApi, requiredApi, apiSatisfied: sdk.apiVersion >= requiredApi, status: sdk.apiVersion >= requiredApi ? "supported" : "sdk_too_old" }
  if (inspection.model !== "stage") { result.status = inspection.model === "fa" ? "unsupported" : "insufficient_context"; result.missingConditions.push("需要 Stage 工程"); return result }
  if (!["app", "atomicService"].includes(data.application?.type)) { result.missingConditions.push("应用类型待确认：核对 AppScope/app.json5 与 product 的 bundleType；混合应用/元服务产物需先确定实际产物，不能按应用 API 20 推断元服务可用"); return result }
  if (!(data.records ?? []).some((m) => ["entry", "feature"].includes(m.moduleType))) { result.missingConditions.push("需定位实际承载组件的 entry/feature HAP"); return result }
  if (![inspection.api.compile, inspection.api.compatible].every(Number.isInteger)) { result.missingConditions.push("工程 compile/compatible API 无法确定"); return result }
  if (sdk.apiVersion < requiredApi || inspection.api.compile < requiredApi) {
    result.status = "upgrade_available"
    result.decisionRequired = true
    result.upgradeOptions.push({ route: ROUTE, upgradeLocalSdkApi: sdk.apiVersion < requiredApi ? requiredApi : null, upgradeCompileApi: requiredApi, upgradeTargetApi: null, keepCompatibleApi: inspection.api.compatible, note: `安装或切换 SDK，使有效 compile 至少 API ${requiredApi}；无需显式配置 compileSdkVersion，已有配置低于门槛时调整既有值；保留 target/compatible，旧系统继续原程序路径。` })
  } else {
    result.status = "conditional"
    result.availableRoutes = [ROUTE]
    result.recommendedRoute = ROUTE
    result.selectedRoutes = [ROUTE]
  }
  result.missingConditions.push("真机 Phone/Tablet、中国境内（不含港澳台）、SysCap、真实 agentId、平台关联与签名身份、账号/隐私/网络及 Agent 发布状态需运行核验")
  return result
}

export function verifyAgentFramework(inspection, compatibility, routeOption = "auto") {
  const route = routeOption === "auto" ? ROUTE : routeOption, checks = []
  const add = (id, status, message, evidence = []) => checks.push({ id: `agent-framework-${id}`, label: message, status, message, evidence })
  const data = inspection.agentFramework ?? {}, usages = data.usages ?? []
  const components = usages.filter((u) => u.operation === "component")
  if (route !== ROUTE || !compatibility.availableRoutes.includes(route)) add("eligibility", "fail", "Function 路线未通过 SDK、工程版本或应用类型门禁")
  else add("eligibility", "pass", `SDK/compile 满足 API ${compatibility.requiredApi}；不代表平台或设备能力已验证`)
  if (!components.length) add("implementation", "warn", "未发现 FunctionComponent 实例；核对导入、封装和目标页面，不能判为接入成功", data.imports ?? [])
  for (const [i, u] of components.entries()) {
    const key = `component-${i}`
    if (!u.resolved) add(`${key}-parameters`, "warn", "组件参数来自动态对象/展开或无法解析，需逐项复核 agentId/onError", [u])
    else add(`${key}-parameters`, u.hasAgentId && u.hasOnError ? "pass" : "fail", "FunctionComponent 必须提供 agentId 和有效 onError", [u])
    if (u.agentId === null) add(`${key}-id`, "warn", "agentId 为动态参数，复核真实值、1–64 字符长度与平台关联", [u])
    else add(`${key}-id`, u.agentId.length >= 1 && u.agentId.length <= 64 && u.agentId !== SAMPLE_ID && !/YOUR_|REPLACE_|<.*>|待填写/i.test(u.agentId) ? "warn" : "fail", "agentId 需为平台真实 ID（1–64 字符）；常量有效性及运行时重赋值仍须核对，不能复用示例 ID", [u])
    const owner = data.records?.find((m) => m.modulePath === u.modulePath)
    add(`${key}-owner`, "warn", owner && ["entry", "feature"].includes(owner.moduleType) ? "已定位承载 HAP；核对目标设备为 Phone/Tablet，其他声明设备走原路径" : "组件位于库或承载 HAP 未识别，需沿依赖定位实际应用与模块", [u])
    add(`${key}-initialization`, "warn", "参数只在实例化时生效；核对 agentId/options 改变时的销毁重建及旧回调、旧查询结果隔离", [u])
    if (!u.optionsResolved) add(`${key}-options`, "warn", "options 为动态对象，核对 ButtonType.ICON_ABOVE_TITLE 的 API 21 门槛及各参数范围", [u])
  }
  if (usages.length && inspection.api.compatible < compatibility.requiredApi) add("version-guard", "warn", `逐调用链核对 API ${compatibility.requiredApi} 保护，包含控制器创建、查询、组件构建、on/off；SysCap 不能替代版本保护`, usages)
  if (usages.some((u) => u.operation === "isAgentSupport")) add("availability-query", "warn", "isAgentSupport 可选：区分 false 与异常，处理异步迟到结果；隐私未授权不能永久隐藏唯一授权入口，登录/联网恢复后允许重新查询", usages.filter((u) => u.operation === "isAgentSupport"))
  for (const [i, u] of usages.filter((v) => v.operation === "on").entries()) {
    const off = usages.filter((v) => v.operation === "off" && v.path === u.path && v.receiver === u.receiver && v.event === u.event && v.callback === u.callback && !!v.callback)
    add(`subscription-${i}`, "warn", off.length ? "发现同名回调退订候选；复核同一控制器、同一回调、可见生命周期及控制器绑定" : "未识别配对退订，复核同一控制器的 on/off 回调和组件 controller 绑定", [u, ...off])
  }
  if (usages.some((u) => u.operation === "off" && !u.callback)) add("off-all", "warn", "off(event) 会清理该控制器该事件的全部回调，确认独占控制器或传入本组件回调", usages.filter((u) => u.operation === "off" && !u.callback))
  add("source-state", "warn", "对照接入前基线检查低版本、不支持、Agent 不可用和异常路径，保留原布局、交互、状态及业务行为")
  add("external-prerequisites", "warn", "开发者确认 Agent 与应用关联、手动签名/appid、测试发布、账号/隐私/网络；静态扫描不能确认平台状态")
  add("runtime", "not_applicable", "需 Phone/Tablet 真机完成点击、对话框打开和关闭验证；模拟器、按钮截图和构建结果不能证明拉起成功")
  const counts = Object.fromEntries(["pass", "warn", "fail", "not_applicable"].map((s) => [s, checks.filter((c) => c.status === s).length]))
  return { schemaVersion: "1.0", featureId: FEATURE, route, routes: [route], status: counts.fail ? "failed" : counts.warn ? "warnings" : "passed", checks, counts }
}

const FEATURE = 'gestures-share'
const ROUTE = 'gestures-share'
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const maskStrings = s => s.replace(/'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g, v => v.replace(/[^\r\n]/g, ' '))

export function inspectGesturesShare(files, maskComments) {
  const usages = []
  for (const file of files.filter(f => /\.(ets|ts)$/.test(f.path) && !/(?:^|\/)(test|tests|ohosTest|mock)(?:\/|$)/.test(f.path))) {
    const code = maskComments(file.content), positions = maskStrings(code), bindings = []
    for (const m of code.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+))\s*from\s*['"]@kit\.ShareKit['"]/g)) {
      if (positions[m.index] !== code[m.index]) continue
      if (m[2]) bindings.push(`${m[2]}.harmonyShare`)
      else for (const part of m[1].split(',')) {
        const b = /^\s*harmonyShare(?:\s+as\s+(\w+))?\s*$/.exec(part)
        if (b) bindings.push(b[1] ?? 'harmonyShare')
      }
    }
    for (const binding of bindings) {
      const regex = new RegExp(`\\b${escape(binding)}\\s*\\.\\s*(on|off)\\s*\\(\\s*['"]gesturesShare['"]`, 'g')
      for (const m of code.matchAll(regex)) {
        if (positions[m.index] !== code[m.index]) continue
        usages.push({ path: file.path, line: code.slice(0, m.index).split(/\r?\n/).length, operation: m[1], receiver: binding })
      }
    }
  }
  return { usages }
}

export function evaluateGesturesShare(inspection, profile) {
  const sdk = inspection.localSdk, requiredApi = profile.routes[0].minApi
  const valid = sdk?.status === 'valid' && Number.isInteger(sdk.apiVersion)
  const result = {
    schemaVersion: '1.0', featureId: FEATURE, status: 'insufficient_context', requiredApi,
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false,
    routeSelectionMode: 'exclusive', fallbackPolicy: profile.fallbackPolicy,
    fallbackRequirements: ['preserve-pre-integration-source-state', 'verify-runtime-api-syscap-and-device-settings'],
    applicationLevel: { eligible: false, reasons: ['只在可分享的前台目标页面注册'] }, missingConditions: [],
    sdk: { status: valid ? 'valid' : 'insufficient_context', sdkStatus: sdk?.status ?? 'missing', sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? 'unknown', routes: {} }
  }
  if (!valid) { result.missingConditions.push('本机 SDK 根清单未验证，使用 --sdk 指定实际 SDK'); return result }
  result.sdk.routes[ROUTE] = { minApi: requiredApi, requiredApi, apiSatisfied: sdk.apiVersion >= requiredApi, status: sdk.apiVersion >= requiredApi ? 'supported' : 'sdk_too_old' }
  if (inspection.model !== 'stage') { result.status = inspection.model === 'fa' ? 'unsupported' : 'insufficient_context'; result.missingConditions.push('需要 Stage 工程'); return result }
  const type = inspection.agentFramework?.application?.type
  if (type !== 'app') { result.missingConditions.push('当前资料覆盖普通应用；元服务或应用类型未知时须补充适用性证据，不推定支持'); return result }
  if (!inspection.modules.some(m => ['entry', 'feature'].includes(m.type))) { result.missingConditions.push('需定位实际承载的 entry/feature HAP'); return result }
  if (![inspection.api.compile, inspection.api.target, inspection.api.compatible].every(Number.isInteger)) { result.missingConditions.push('工程 compile/target/compatible API 待确认'); return result }
  if (sdk.apiVersion < requiredApi || inspection.api.compile < requiredApi || inspection.api.target < requiredApi) {
    result.status = 'upgrade_available'; result.decisionRequired = true
    result.upgradeOptions.push({ route: ROUTE, upgradeLocalSdkApi: sdk.apiVersion < requiredApi ? requiredApi : null, upgradeCompileApi: requiredApi, upgradeTargetApi: Math.max(inspection.api.target, requiredApi), keepCompatibleApi: inspection.api.compatible, note: '按通用策略升级 SDK/compile/target，保留 compatible；升级须用户确认，旧系统走原业务。' })
  } else {
    result.status = 'conditional'; result.availableRoutes = [ROUTE]; result.selectedRoutes = [ROUTE]; result.recommendedRoute = ROUTE
  }
  result.missingConditions.push('双端真机、硬件支持、系统隔空传送开关与信任关系需实测；链接直达按接收目标核实应用域名关联/手动签名，或元服务平台链接/有效期/参数接收，分别验证冷暖启动')
  return result
}

export function verifyGesturesShare(inspection, compatibility, routeOption = 'auto') {
  const route = routeOption === 'auto' ? ROUTE : routeOption, checks = []
  const add = (id, status, message, evidence = []) => checks.push({ id: `gestures-share-${id}`, label: message, status, message, evidence })
  const usages = inspection.gesturesShare?.usages ?? []
  add('eligibility', route === ROUTE && compatibility.availableRoutes.includes(route) ? 'pass' : 'fail', '核验 API20 SDK/compile、通用 target 策略、Stage 与普通应用门禁')
  add('implementation', usages.some(u => u.operation === 'on') ? 'warn' : 'fail', '需存在目标页面隔空传送订阅；候选须沿封装复核，不能以普通分享或导入代替', usages)
  for (const [i, u] of usages.filter(u => u.operation === 'on').entries()) add(`subscription-${i}`, 'warn', usages.some(v => v.operation === 'off' && v.path === u.path && v.receiver === u.receiver) ? '发现退订候选，复核同一窗口与实际注册回调、页面隐藏/后台/销毁及前台恢复' : '未发现本文件退订，沿调用链核对清理，禁止后台持续注册', [u])
  add('runtime-guards', 'warn', '逐调用链复核 API20 与 SysCap 在 on/off 前生效；复用已有窗口与可见生命周期；若工程异步获取窗口，检查返回时页面仍可分享', usages)
  add('payload', 'warn', '核对当前内容的 SharedData、UTD、文件/缩略图 URI、分享 Promise 与失败处理；回调后建议3秒内调用 target.share，不能等待网络下载')
  add('source-state', 'warn', '低版本、不支持、系统关闭、信任拒绝、分享失败均保留原业务与已有分享入口')
  add('runtime-evidence', 'warn', '双端真机验证抓取、释放、接收内容、页面/后台清理；选择链接直达时验证接收端冷暖启动与内容一致，模拟器不能证明手势传输')
  const counts = Object.fromEntries(['pass', 'warn', 'fail', 'not_applicable'].map(s => [s, checks.filter(c => c.status === s).length]))
  return { schemaVersion: '1.0', featureId: FEATURE, route, routes: [route], status: counts.fail ? 'failed' : 'warnings', checks, counts }
}

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function inspectCoreVisionCalls(files, maskComments, namespace, memberPattern, operationFor) {
  const namedImport = new RegExp(`^\\s*${namespace}(?:\\s+as\\s+(\\w+))?\\s*$`)
  const usages = []
  for (const file of files) {
    if (!/\.(?:ets|ts)$/.test(file.path) || /\.d\.(?:ets|ts)$|(?:^|\/)(?:test|tests|ohosTest|mock)(?:\/|$)/.test(file.path)) continue
    const code = maskComments(file.content)
    const positions = code.replace(/'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g, value => value.replace(/[^\r\n]/g, ' '))
    const bindings = new Set()
    for (const match of code.matchAll(/\bimport\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+))\s*from\s*(['"])@kit\.CoreVisionKit\3/g)) {
      if (positions[match.index] !== code[match.index]) continue
      if (match[2]) bindings.add(`${match[2]}.${namespace}`)
      else for (const part of match[1].split(',')) {
        const binding = namedImport.exec(part)
        if (binding) bindings.add(binding[1] ?? namespace)
      }
    }
    for (const binding of bindings) {
      const prefix = binding.split('.').map(escape).join('\\s*\\.\\s*')
      const pattern = new RegExp(`\\b${prefix}\\s*\\.\\s*${memberPattern}`, 'g')
      for (const match of positions.matchAll(pattern)) {
        usages.push({ path: file.path, line: code.slice(0, match.index).split('\n').length,
          index: match.index, operation: operationFor(match) })
      }
    }
  }
  return { usages }
}

export function evaluateCoreVisionRoute(inspection, profile, messages) {
  const route = profile.routes[0], sdk = inspection.localSdk, requiredApi = route.minApi
  const valid = sdk?.status === 'valid' && Number.isInteger(sdk.apiVersion)
  const result = {
    schemaVersion: '1.0', featureId: profile.featureId, status: 'insufficient_context', requiredApi,
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false,
    routeSelectionMode: profile.routeComposition.mode, fallbackPolicy: profile.fallbackPolicy,
    fallbackRequirements: ['preserve-pre-integration-source-state', 'verify-runtime-api-and-syscap'],
    applicationLevel: { eligible: false, reasons: [messages.trigger] }, missingConditions: [],
    sdk: { status: valid ? 'valid' : 'insufficient_context', sdkStatus: sdk?.status ?? 'missing', sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? 'unknown', routes: {} }
  }
  if (!valid) { result.missingConditions.push('本机 SDK 根清单未验证，使用 --sdk 指定实际 SDK'); return result }
  const apiSatisfied = sdk.apiVersion >= requiredApi
  result.sdk.routes[route.id] = { minApi: requiredApi, requiredApi, apiSatisfied, status: apiSatisfied ? 'supported' : 'sdk_too_old' }
  if (route.requiresStage && inspection.model !== 'stage') {
    result.status = inspection.model === 'fa' ? 'unsupported' : 'insufficient_context'
    result.missingConditions.push('需要 Stage 工程'); return result
  }
  const applicationType = inspection.agentFramework?.application?.type
  if (applicationType !== 'app') {
    if (applicationType === 'atomicService') result.status = 'unsupported'
    result.missingConditions.push('本能力包仅覆盖已确认的 Stage 普通应用，未确认元服务支持'); return result
  }
  if (!inspection.modules.some(module => route.moduleTypes.includes(module.type))) {
    result.missingConditions.push('需定位实际承载的 entry/feature HAP'); return result
  }
  const { compile, target, compatible } = inspection.api
  if (![compile, target, compatible].every(Number.isInteger)) {
    result.missingConditions.push('工程 compile/target/compatible API 待确认'); return result
  }
  if (!apiSatisfied || compile < requiredApi || target < requiredApi) {
    result.status = 'upgrade_available'
    result.decisionRequired = true
    result.upgradeOptions.push({ route: route.id, upgradeLocalSdkApi: apiSatisfied ? null : requiredApi,
      upgradeCompileApi: requiredApi, upgradeTargetApi: Math.max(target, requiredApi), keepCompatibleApi: compatible,
      note: messages.fallback })
  } else {
    result.status = 'conditional'
    result.availableRoutes = [route.id]
    result.selectedRoutes = [route.id]
    result.recommendedRoute = route.id
  }
  result.missingConditions.push(messages.runtime)
  return result
}

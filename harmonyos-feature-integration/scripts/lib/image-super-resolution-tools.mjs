const FEATURE = 'image-super-resolution'
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function inspectImageSuperResolution(files, maskComments) {
  const usages = []
  for (const file of files) {
    if (!/\.(?:ets|ts)$/.test(file.path) || /\.d\.(?:ets|ts)$|(?:^|\/)(?:test|tests|ohosTest|mock)(?:\/|$)/.test(file.path)) continue
    const code = maskComments(file.content)
    const positions = code.replace(/'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g, value => value.replace(/[^\r\n]/g, ' '))
    const bindings = new Set()
    for (const match of code.matchAll(/\bimport\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+))\s*from\s*(['"])@kit\.CoreVisionKit\3/g)) {
      if (positions[match.index] !== code[match.index]) continue
      if (match[2]) bindings.add(`${match[2]}.imageSuperResolution`)
      else for (const part of match[1].split(',')) {
        const binding = /^\s*imageSuperResolution(?:\s+as\s+(\w+))?\s*$/.exec(part)
        if (binding) bindings.add(binding[1] ?? 'imageSuperResolution')
      }
    }
    for (const binding of bindings) {
      const prefix = binding.split('.').map(escape).join('\\s*\\.\\s*')
      const pattern = new RegExp(`\\b${prefix}\\s*\\.\\s*ImageSRAnalyzer\\b(\\s*\\.\\s*create\\s*\\()?`, 'g')
      for (const match of positions.matchAll(pattern)) {
        usages.push({ path: file.path, line: code.slice(0, match.index).split('\n').length,
          index: match.index, operation: match[1] ? 'create' : 'ImageSRAnalyzer' })
      }
    }
  }
  return { usages }
}

export function evaluateImageSuperResolution(inspection, profile) {
  const route = profile.routes[0], sdk = inspection.localSdk, requiredApi = route.minApi
  const valid = sdk?.status === 'valid' && Number.isInteger(sdk.apiVersion)
  const result = {
    schemaVersion: '1.0', featureId: FEATURE, status: 'insufficient_context', requiredApi,
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false,
    routeSelectionMode: profile.routeComposition.mode, fallbackPolicy: profile.fallbackPolicy,
    fallbackRequirements: ['preserve-pre-integration-source-state', 'verify-runtime-api-and-syscap'],
    applicationLevel: { eligible: false, reasons: ['仅在目标图片业务操作中触发'] }, missingConditions: [],
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
      note: '升级 SDK/有效 compile 与 target 须确认，保留 compatible；旧系统走原图片业务。' })
  } else {
    result.status = 'conditional'
    result.availableRoutes = [route.id]
    result.selectedRoutes = [route.id]
    result.recommendedRoute = route.id
  }
  result.missingConditions.push('需在支持的 API 26+ 真机核实地区、SysCap 和实际单图处理，模拟器不可验收')
  return result
}

export function verifyImageSuperResolution(inspection, compatibility, routeOption) {
  const route = routeOption === 'auto' ? 'core-vision-image-sr' : routeOption
  const checks = []
  const add = (id, status, message, evidence = []) => checks.push({ id: `${FEATURE}-${id}`, label: message, status, message, evidence })
  const usages = inspection.imageSuperResolution?.usages ?? []
  add('eligibility', compatibility.availableRoutes.includes(route) ? 'pass' : 'fail', '核验 SDK/compile、通用 target 策略与 Stage 普通应用门禁')
  add('implementation', usages.some(usage => usage.operation === 'create') ? 'warn' : 'fail',
    '需定位实际 ImageSRAnalyzer.create；沿绑定复核 process 的单图请求、输出与 destroy，不以导入代替实现', usages)
  add('runtime-guards', 'warn', '沿调用链复核 API 26 及 VisionBase SysCap 守卫，确认创建、处理、清理均受保护', usages)
  add('input-lifecycle', 'warn', '复核实际输入两边尺寸、单飞、过期结果、异常与 PixelMap/Analyzer 释放')
  add('source-state', 'warn', '低版本、不支持、取消、非法输入和失败保留原图及接入前的图片业务')
  add('runtime-evidence', 'warn', '使用支持的真机验证处理、尺寸、对照图、重复操作及原流程回退')
  const counts = Object.fromEntries(['pass', 'warn', 'fail', 'not_applicable'].map(status => [status, checks.filter(check => check.status === status).length]))
  return { schemaVersion: '1.0', featureId: FEATURE, route, routes: [route], status: counts.fail ? 'failed' : 'warnings', checks, counts }
}

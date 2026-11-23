import { evaluateCoreVisionRoute, inspectCoreVisionCalls } from './core-vision-tools.mjs'

const FEATURE = 'text-search-image'

export function inspectTextSearchImage(files, maskComments) {
  return inspectCoreVisionCalls(files, maskComments, 'textSearchImage',
    '(init|insertImage|search|deleteImage|clearData|release)\\s*\\(', match => match[1])
}

export function evaluateTextSearchImage(inspection, profile) {
  return evaluateCoreVisionRoute(inspection, profile, {
    trigger: '仅在目标图片索引与检索业务中触发',
    fallback: '升级 SDK/有效 compile 与 target 须确认，保留 compatible；旧系统走原搜索或浏览业务。',
    runtime: '需在支持的 API 26+ 真机核实地区、SysCap 和实际入库与检索，模拟器不可验收'
  })
}

export function verifyTextSearchImage(inspection, compatibility, routeOption) {
  const route = routeOption === 'auto' ? 'core-vision-text-search-image' : routeOption
  const usages = inspection.textSearchImage?.usages ?? []
  const required = ['init', 'insertImage', 'search', 'release']
  const missing = required.filter(operation => !usages.some(usage => usage.operation === operation))
  const checks = []
  const add = (id, status, message, evidence = []) => checks.push({ id: `${FEATURE}-${id}`, label: message, status, message, evidence })
  const implementation = missing.length
    ? `未定位文搜图调用：${missing.join('、')}；如封装在依赖中，须追踪实际调用证据`
    : '已定位初始化、入库、查询和释放候选；须复核真实业务调用链'
  add('eligibility', compatibility.availableRoutes.includes(route) ? 'pass' : 'fail', '核验 SDK/compile、通用 target 策略与 Stage 普通应用门禁')
  add('implementation', missing.length ? 'fail' : 'warn', implementation, usages)
  add('runtime-guards', 'warn', '沿调用链核对 API 26 与 VisionBase SysCap 守卫覆盖所有 Kit 调用', usages)
  add('index-lifecycle', 'warn', '核对初始化布尔值、串行调用、同 scope、沙箱路径与过期结果；涉及清库时核对全库授权和重建')
  add('source-state', 'warn', '核对低版本、不支持、输入不可用与服务失败保留原业务')
  const counts = Object.fromEntries(['pass', 'warn', 'fail', 'not_applicable'].map(status => [status, checks.filter(check => check.status === status).length]))
  return { schemaVersion: '1.0', featureId: FEATURE, route, routes: [route], status: counts.fail ? 'failed' : 'warnings', checks, counts }
}

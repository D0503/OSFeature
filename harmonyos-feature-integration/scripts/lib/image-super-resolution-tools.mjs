import { evaluateCoreVisionRoute, inspectCoreVisionCalls } from './core-vision-tools.mjs'

const FEATURE = 'image-super-resolution'

export function inspectImageSuperResolution(files, maskComments) {
  return inspectCoreVisionCalls(files, maskComments, 'imageSuperResolution',
    'ImageSRAnalyzer\\b(\\s*\\.\\s*create\\s*\\()?', match => match[1] ? 'create' : 'ImageSRAnalyzer')
}

export function evaluateImageSuperResolution(inspection, profile) {
  return evaluateCoreVisionRoute(inspection, profile, {
    trigger: '仅在目标图片业务操作中触发',
    fallback: '升级 SDK/有效 compile 与 target 须确认，保留 compatible；旧系统走原图片业务。',
    runtime: '需在支持的 API 26+ 真机核实地区、SysCap 和实际单图处理，模拟器不可验收'
  })
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

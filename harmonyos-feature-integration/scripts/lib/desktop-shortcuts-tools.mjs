import { posix, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'
import { readManifest } from './easygo-tools.mjs'

const FEATURE = 'desktop-shortcuts'
const STATIC = 'static-shortcut', DYNAMIC = 'dynamic-shortcut'
const methods = { checkPinShortcutPermitted: 14, requestNewPinShortcut: 14, getPinShortcutInfos: 24, removePinShortcut: 24,
  setShortcutVisibleForSelf: 20, getAllShortcutInfoForSelf: 20, isShortcutSupported: 26 }
const maskStrings = s => s.replace(/'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g, v => v.replace(/[^\r\n]/g, ' '))
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const line = (s, i) => s.slice(0, i).split('\n').length

function argumentsAt(code, start) {
  const masked = maskStrings(code), args = [], stack = [')']
  let from = start + 1
  for (let i = from; i < masked.length; i++) {
    const c = masked[i]
    if ('([{'.includes(c)) stack.push({ '(': ')', '[': ']', '{': '}' }[c])
    else if (')]}'.includes(c)) {
      if (stack.pop() !== c) return []
      if (!stack.length) { args.push(code.slice(from, i).trim()); return args }
    } else if (c === ',' && stack.length === 1) { args.push(code.slice(from, i).trim()); from = i + 1 }
  }
  return []
}

// Resolve only immutable, unambiguous literals. Wrappers and computed values require review.
function literal(expression, source) {
  if (!expression) return undefined
  try { return readManifest(expression) } catch {}
  if (!/^[A-Za-z_$][\w$]*$/.test(expression)) return undefined
  const positions = maskStrings(source)
  if (new RegExp(`\\b${escape(expression)}\\s*(?:\\.[\\w$]+|\\[[^\\]]+\\])+(?:\\s*(?:\\.[\\w$]+|\\[[^\\]]+\\]))*\\s*(?:=(?!=)|\\+\\+|--)`).test(positions)) return undefined
  const declarations = [...source.matchAll(new RegExp(`\\bconst\\s+${escape(expression)}\\s*(?::[^=;\\n]+)?=\\s*`, 'g'))]
    .filter(m => positions[m.index] === source[m.index])
  if (declarations.length !== 1) return undefined
  const start = declarations[0].index + declarations[0][0].length
  const rest = source.slice(start)
  let value
  if (rest.startsWith('{')) {
    const masked = maskStrings(rest)
    let depth = 0
    for (let i = 0; i < masked.length; i++) {
      if (masked[i] === '{') depth++
      if (masked[i] === '}' && --depth === 0) { value = rest.slice(0, i + 1); break }
    }
  } else value = /^(['"])(?:\\.|(?!\1)[\s\S])*?\1/.exec(rest)?.[0]
  if (!value) return undefined
  try { return readManifest(value) } catch { return undefined }
}

export async function inspectDesktopShortcuts(files, maskComments, projectRoot) {
  files = files.filter(f => !/(?:^|\/)(?:test|tests|ohosTest|mock)(?:\/|$)/.test(f.path))
  const result = { configurations: [], usages: [], issues: [], warnings: [], targets: [] }
  const add = (path, message) => result.issues.push({ path, message })
  const appFile = files.find(f => f.path === 'AppScope/app.json5')
  let bundle
  try { bundle = readManifest(appFile?.content ?? '').app?.bundleName } catch {}
  result.bundleName = bundle ?? null
  for (const file of files.filter(f => /(?:^|\/)module\.json5$/.test(f.path))) {
    let module
    try { module = readManifest(file.content).module } catch { continue }
    if (!module) continue
    for (const ability of Array.isArray(module.abilities) ? module.abilities : []) {
      if (!ability || typeof ability !== 'object') continue
      result.targets.push({ moduleName: module.name, abilityName: ability.name })
      for (const meta of (Array.isArray(ability?.metadata) ? ability.metadata : []).filter(m => m?.name === 'ohos.ability.shortcuts')) {
        const config = { path: file.path, line: 1, module: module.name, moduleType: module.type, ability: ability.name, resource: meta.resource, shortcuts: [], requiredApi: 9 }
        result.configurations.push(config)
        if (!/^\$profile:[\w.-]+$/.test(meta.resource ?? '')) { add(file.path, '快捷方式 metadata 必须引用本模块 profile 资源'); continue }
        const base = posix.dirname(file.path), name = meta.resource.slice(9)
        config.profilePath = `${base}/resources/base/profile/${name}.json`
        const profile = files.find(f => f.path === config.profilePath)
        if (!profile) { add(file.path, `找不到 ${config.profilePath}`); continue }
        let data
        try { data = JSON.parse(profile.content.replace(/^\uFEFF/, '')) } catch { add(profile.path, '快捷方式 profile 不是合法 JSON'); continue }
        if (!Array.isArray(data?.shortcuts) || !data.shortcuts.length) { add(profile.path, 'shortcuts 必须为非空数组'); continue }
        config.shortcuts = data.shortcuts
        const ids = new Set()
        if (data.shortcuts.length > 4) result.warnings.push({ path: profile.path, message: '静态快捷方式最多展示4个，须确认超出部分的展示预期，不自动截断配置' })
        for (const shortcut of data.shortcuts) {
          if (!shortcut || typeof shortcut !== 'object') { add(profile.path, '快捷方式必须是对象'); continue }
          const id = shortcut.shortcutId
          if (typeof id !== 'string' || !id || Buffer.byteLength(id) > 63 || id.startsWith('$string:')) add(profile.path, 'shortcutId 必须是非空字面字符串且不超过63字节')
          if (ids.has(id)) add(profile.path, '同一配置存在重复 shortcutId')
          ids.add(id)
          if (shortcut.label !== undefined && (typeof shortcut.label !== 'string' || Buffer.byteLength(shortcut.label) > 255)) add(profile.path, '静态 label 不超过255字节')
          if (Object.hasOwn(shortcut, 'visible')) {
            if (typeof shortcut.visible !== 'boolean') add(profile.path, 'visible 必须是布尔值')
          }
          for (const [kind, value] of [['string', shortcut.label], ['media', shortcut.icon]]) {
            if (value === undefined || value === '') continue
            if (kind === 'string' && typeof value === 'string' && !value.startsWith('$')) continue
            const match = new RegExp(`^\\$${kind}:([\\w.-]+)$`).exec(value ?? '')
            if (!match) { add(profile.path, `快捷方式 ${kind} 资源引用缺失或非法`); continue }
            let found = false
            if (kind === 'string') {
              for (const resource of files.filter(f => f.path.startsWith(`${base}/resources/base/element/`) && f.path.endsWith('.json'))) {
                try { if (JSON.parse(resource.content).string?.some(s => s.name === match[1])) found = true } catch {}
              }
            } else if (projectRoot) {
              try { found = (await readdir(resolve(projectRoot, base, 'resources/base/media'))).some(n => n.slice(0, n.lastIndexOf('.')) === match[1]) } catch {}
            }
            if (!found) add(profile.path, `找不到本模块 base ${kind} 资源 ${match[1]}`)
          }
          if (!Array.isArray(shortcut.wants) || !shortcut.wants.length) { add(profile.path, 'wants 必须包含目标 UIAbility'); continue }
          for (const want of shortcut.wants) {
            if (!want || typeof want !== 'object') { add(profile.path, 'Want 必须是对象'); continue }
            const targetModule = want.moduleName ?? module.name
            const targetFiles = files.filter(f => /(?:^|\/)module\.json5$/.test(f.path))
            const targetExists = targetFiles.some(f => { try { const m = readManifest(f.content).module; return m.name === targetModule && m.abilities?.some(a => a?.name === want.abilityName) } catch { return false } })
            if (!want.bundleName || want.bundleName !== bundle || !targetExists) add(profile.path, '目标包、模块或 UIAbility 与当前工程不一致，需核对真实目标')
            if (Object.hasOwn(want, 'parameters')) {
              if (!want.parameters || typeof want.parameters !== 'object' || Array.isArray(want.parameters) || Object.entries(want.parameters).some(([k, v]) => k.length > 1024 || typeof v !== 'string' || v.length > 1024)) add(profile.path, 'Want parameters 仅支持字符串键值，长度均不超过1024')
            }
          }
        }
      }
    }
  }
  for (const file of files.filter(f => /\.(ets|ts)$/.test(f.path) && !/(?:^|\/)(?:test|tests|ohosTest|mock)(?:\/|$)/.test(f.path))) {
    const code = maskComments(file.content), positions = maskStrings(code), bindings = []
    for (const m of code.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|([\w$]+))\s*from\s*['"](@kit\.(?:AppGalleryKit|AbilityKit)|@ohos\.bundle\.shortcutManager)['"]/g)) {
      if (positions[m.index] !== code[m.index]) continue
      const owner = m[4] === '@kit.AppGalleryKit' ? 'productViewManager' : 'shortcutManager'
      if (m[2]) bindings.push({ receiver: `${m[2]}.${owner}`, owner })
      else if (m[3] && m[4].startsWith('@ohos.')) bindings.push({ receiver: m[3], owner })
      else for (const part of (m[1] ?? '').split(',')) {
        const b = new RegExp(`^\\s*${owner}(?:\\s+as\\s+([\\w$]+))?\\s*$`).exec(part)
        if (b) bindings.push({ receiver: b[1] ?? owner, owner })
      }
    }
    for (const { receiver, owner } of bindings) {
      for (const m of code.matchAll(new RegExp(`\\b${escape(receiver)}\\s*\\.\\s*(${Object.keys(methods).join('|')})\\s*\\(`, 'g'))) {
        if (positions[m.index] !== code[m.index] || (owner === 'shortcutManager') !== ['setShortcutVisibleForSelf', 'getAllShortcutInfoForSelf', 'isShortcutSupported'].includes(m[1])) continue
        const args = argumentsAt(code, m.index + m[0].lastIndexOf('('))
        result.usages.push({ path: file.path, line: line(code, m.index), operation: m[1], owner, requiredApi: methods[m[1]], args,
          values: args.map(a => literal(a, code)), resourceMode: m[1] === 'checkPinShortcutPermitted' ? (args.length === 5 ? 'preset' : args.length === 6 ? 'custom' : 'unknown') : undefined })
      }
    }
  }
  return result
}

export function evaluateDesktopShortcuts(inspection, profile) {
  const scanned = inspection.desktopShortcuts ?? { configurations: [], usages: [] }
  const staticApi = Math.max(9, ...scanned.configurations.map(c => c.requiredApi), ...scanned.usages.filter(u => u.owner === 'shortcutManager').map(u => u.requiredApi))
  const dynamicApi = Math.max(14, ...scanned.usages.map(u => u.requiredApi), ...scanned.usages.filter(u => u.resourceMode === 'preset').flatMap(u => scanned.configurations.filter(c => u.values[1] === undefined || c.shortcuts.some(s => s?.shortcutId === u.values[1])).map(c => c.requiredApi)))
  const sdk = inspection.localSdk, valid = sdk?.status === 'valid' && Number.isInteger(sdk.apiVersion)
  const result = { schemaVersion: '1.0', featureId: FEATURE, status: 'insufficient_context', requiredApi: scanned.usages.some(u => u.owner === 'productViewManager') ? Math.max(staticApi, dynamicApi) : staticApi,
    routeRequirements: { [STATIC]: staticApi, [DYNAMIC]: dynamicApi },
    recommendedRoute: null, selectedRoutes: [], availableRoutes: [], upgradeOptions: [], decisionRequired: false, routeSelectionMode: 'composable',
    fallbackPolicy: profile.fallbackPolicy, fallbackRequirements: ['preserve-pre-integration-source-state'], missingConditions: [],
    applicationLevel: { eligible: false, reasons: ['仅接入已确认的快捷方式及业务目标'] },
    sdk: { status: valid ? 'valid' : 'insufficient_context', sdkStatus: sdk?.status ?? 'missing', sdkPath: sdk?.path ?? null, apiVersion: sdk?.apiVersion ?? 'unknown', routes: {} } }
  if (!valid) { result.missingConditions.push('本机 SDK 根清单待核验，使用 --sdk 指定'); return result }
  if (inspection.model !== 'stage') { result.status = inspection.model === 'fa' ? 'unsupported' : 'insufficient_context'; result.missingConditions.push('需要 Stage 工程'); return result }
  if (!inspection.modules.some(m => m.type === 'entry')) { result.missingConditions.push('需定位 entry HAP 与实际桌面入口 UIAbility'); return result }
  if (![inspection.api.compile, inspection.api.target, inspection.api.compatible].every(Number.isInteger)) { result.missingConditions.push('工程 compile/target/compatible API 待确认'); return result }
  for (const route of profile.routes) {
    const requiredApi = route.id === STATIC ? staticApi : dynamicApi
    result.sdk.routes[route.id] = { minApi: route.minApi, requiredApi, apiSatisfied: sdk.apiVersion >= requiredApi, status: sdk.apiVersion >= requiredApi ? 'supported' : 'sdk_too_old' }
    if (sdk.apiVersion < requiredApi || inspection.api.compile < requiredApi || inspection.api.target < requiredApi) result.upgradeOptions.push({ route: route.id, requiredApi, upgradeLocalSdkApi: sdk.apiVersion < requiredApi ? requiredApi : null, upgradeCompileApi: Math.max(inspection.api.compile, requiredApi), upgradeTargetApi: Math.max(inspection.api.target, requiredApi), keepCompatibleApi: inspection.api.compatible })
    else result.availableRoutes.push(route.id)
  }
  result.status = result.availableRoutes.length ? 'conditional' : 'upgrade_available'
  result.decisionRequired = result.availableRoutes.length + result.upgradeOptions.length > 1 || result.upgradeOptions.length > 0
  if (!result.decisionRequired) { result.selectedRoutes = [...result.availableRoutes]; result.recommendedRoute = result.selectedRoutes[0] ?? null }
  result.missingConditions.push('确认目标设备的桌面支持；动态加桌只接受 Phone/Tablet/PC/2in1 真机；确认目标与资源方式，按实际新增能力重新门禁')
  return result
}

export function verifyDesktopShortcuts(inspection, compatibility, routeOption = 'auto') {
  const scan = inspection.desktopShortcuts ?? { configurations: [], usages: [], issues: [] }, checks = []
  const detected = [scan.configurations.length ? STATIC : null, scan.usages.some(u => u.owner === 'productViewManager') ? DYNAMIC : null].filter(Boolean)
  if (!detected.length && scan.usages.some(u => u.owner === 'shortcutManager')) detected.push(STATIC)
  const routes = routeOption === 'auto' ? (compatibility.selectedRoutes.length ? compatibility.selectedRoutes : detected) : String(routeOption).split(',')
  const add = (id, status, message, evidence = []) => checks.push({ id: `desktop-shortcuts-${id}`, label: message, status, message, evidence })
  add('routes', routes.length && routes.every(r => compatibility.availableRoutes.includes(r)) ? 'pass' : 'fail', '所选路线须满足本机 SDK、工程版本与模型门禁')
  for (const route of routes) {
    if (route === STATIC) {
      const managementOnly = !scan.configurations.length && scan.usages.some(u => u.owner === 'shortcutManager')
      add('static-entry', scan.configurations.length ? 'pass' : managementOnly ? 'warn' : 'fail', managementOnly ? '仅发现可选管理调用，按实际管理范围复核，不强制新增静态入口' : '目标 UIAbility 存在快捷方式 metadata 与 profile')
    }
    if (route === DYNAMIC) {
      const managementOnly = scan.usages.some(u => ['getPinShortcutInfos', 'removePinShortcut'].includes(u.operation)) && !scan.usages.some(u => ['checkPinShortcutPermitted', 'requestNewPinShortcut'].includes(u.operation))
      if (managementOnly) add('management-entry', 'warn', '仅发现已加桌管理调用，按实际管理范围复核，不强制新增加桌入口')
      else for (const operation of ['checkPinShortcutPermitted', 'requestNewPinShortcut']) add(operation, scan.usages.some(u => u.operation === operation) ? 'pass' : 'fail', `动态加桌需要 ${operation} 调用候选`)
      for (const [i, u] of scan.usages.filter(u => u.operation === 'checkPinShortcutPermitted').entries()) {
        if (u.resourceMode === 'preset') {
          const matches = scan.configurations.flatMap(c => c.shortcuts).filter(s => s && typeof s === 'object' && s.shortcutId === u.values[1])
          const resolved = [1, 2, 3, 4].every(n => u.values[n] !== undefined)
          const equal = (a, b) => JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b ?? {}).sort())
          const match = matches.some(s => s.label === `$string:${u.values[3]}` && s.icon === `$media:${u.values[4]}` && s.wants?.some(w => w.bundleName === u.values[2]?.bundleName && w.moduleName === u.values[2]?.moduleName && w.abilityName === u.values[2]?.abilityName && equal(w.parameters, u.values[2]?.parameters)))
          add(`preset-${i}`, resolved ? (match ? 'pass' : 'fail') : 'warn', '预置资源请求须与实际快捷方式配置一致；计算值沿调用链复核', [u])
        } else if (u.resourceMode === 'custom') {
          add(`custom-${i}`, u.values[5] !== undefined && u.values[5] !== '' ? 'fail' : 'warn', '自定义图标须为有效沙箱 png/webp 且≤100KB，backgroundIcon 为空；核对文件与 Want', [u])
        } else add(`overload-${i}`, 'warn', '无法确认重载，需沿封装核对真实参数', [u])
        const id = u.values[1], want = u.values[2]
        if (id !== undefined) add(`id-${i}`, typeof id === 'string' && id.length > 0 && Buffer.byteLength(id) <= 63 ? 'pass' : 'fail', '动态 shortcutId 为非空字符串且不超过63字节', [u])
        if (want !== undefined) {
          const valid = want && typeof want === 'object' && !Array.isArray(want) && typeof want.bundleName === 'string' && want.bundleName.length > 0 && typeof want.abilityName === 'string' && want.abilityName.length > 0 && Object.keys(want).every(k => ['bundleName', 'moduleName', 'abilityName', 'parameters'].includes(k)) && (!Object.hasOwn(want, 'parameters') || (want.parameters && typeof want.parameters === 'object' && !Array.isArray(want.parameters) && Object.entries(want.parameters).every(([k, v]) => k.length <= 1024 && typeof v === 'string' && v.length <= 1024)))
          add(`want-${i}`, valid ? 'pass' : 'fail', '动态 Want 仅使用受支持字段与合法字符串参数，并指定真实目标', [u])
          if (valid) add(`target-${i}`, want.bundleName === scan.bundleName && scan.targets?.some(t => t.abilityName === want.abilityName && (!want.moduleName || t.moduleName === want.moduleName)) ? 'pass' : 'fail', '动态目标与当前工程实际 UIAbility 一致', [u])
        }
        if (u.resourceMode === 'custom' && u.values[3] !== undefined) add(`label-${i}`, typeof u.values[3] === 'string' && u.values[3].length > 0 && u.values[3].length <= 255 ? 'pass' : 'fail', '自定义 label 为非空文本且不超过255字符', [u])
        if (u.resourceMode === 'custom' && typeof u.values[4] === 'string') add(`icon-${i}`, /^\//.test(u.values[4]) && /\.(png|webp)$/i.test(u.values[4]) ? 'warn' : 'fail', '图标须为沙箱绝对文件路径且格式 png/webp；实际可读性和大小待运行核验', [u])
      }
      add('transaction', 'warn', '复核 code/tid/expired、参数变更使旧校验失效、用户点击请求、防并发、拒绝与成功后的 tid 清理')
      add('physical-device', 'warn', '动态路线必须在支持的真机验收系统确认、桌面图标与冷暖启动，模拟器不能判通过')
    }
  }
  for (const [i, issue] of scan.issues.entries()) add(`configuration-${i}`, 'fail', issue.message, [issue])
  for (const [i, warning] of (scan.warnings ?? []).entries()) add(`display-${i}`, 'warn', warning.message, [warning])
  add('routing-and-fallback', 'warn', '复核冷暖启动、页面就绪、业务目标白名单与事件消费；旧版本及失败保留原业务和已有入口')
  add('optional-capabilities', 'warn', '配置查询不等于已加桌查询，隐藏不等于删除；可选能力须经需求确认并独立门禁')
  const counts = Object.fromEntries(['pass', 'warn', 'fail', 'not_applicable'].map(s => [s, checks.filter(c => c.status === s).length]))
  return { schemaVersion: '1.0', featureId: FEATURE, route: routes.length === 1 ? routes[0] : 'composed', routes, status: counts.fail ? 'failed' : counts.warn ? 'warnings' : 'passed', checks, counts }
}

export function desktopShortcutManagementOperations(inspection, route) {
  const scan = inspection.desktopShortcuts
  if (!scan) return []
  if (route === STATIC && !scan.configurations.length) return [...new Set(scan.usages.filter(u => u.owner === 'shortcutManager').map(u => u.operation))]
  if (route === DYNAMIC && !scan.usages.some(u => ['checkPinShortcutPermitted', 'requestNewPinShortcut'].includes(u.operation))) return [...new Set(scan.usages.filter(u => ['getPinShortcutInfos', 'removePinShortcut'].includes(u.operation)).map(u => u.operation))]
  return []
}

import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { inspectProject } from './project-tools.mjs'
import { readManifest } from './easygo-tools.mjs'

const skip = new Set(['.git', '.idea', '.hvigor', 'build', 'node_modules', 'oh_modules', 'ohosTest', 'test', 'tests', 'mock'])
const slash = s => s.replaceAll('\\', '/')
const line = (s, i) => s.slice(0, i).split('\n').length
const anchors = {
  'gestures-share': /(?!)/g,
  'immersive-light': /\b(?:HdsNavigation|HdsNavDestination|HdsTabs|uiMaterial|systemMaterial|barFloatingStyle|miniBar|miniBarBuilder|miniBarWidth|applyMiniBarStyle|HdsBarStyle|HdsBarLayoutMode)\b/g,
  'easygo-parallel': /\b(?:isEasySplit|easyGo)\b/g,
  'smart-reach': /\b(?:adaptToHandedness|operatingHandChanged|holdingHandChanged|getRecentOperatingHandStatus)\b/g,
  'agent-framework-kit': /\b(?:FunctionComponent|FunctionController|agentFramework)\b/g,
  'float-view-ball': /\b(?:floatView|floatingBall)\b/g,
  'dlp-anti-peep': /\b(?:dlpAntiPeep|requestAntiPeepOptions|publishAntiPeepInformation|setAntiPeepMaskLayer)\b/g
}

// Preserve offsets; strings remain available separately for imports and event names.
export function maskSource(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`/g,
    value => value.replace(/[^\r\n]/g, ' '))
}

async function walk(root, accept) {
  const files = []
  async function visit(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue
      const path = resolve(dir, item.name)
      if (item.isDirectory() && !skip.has(item.name)) await visit(path)
      else if (item.isFile() && accept(item.name)) files.push({ path, content: await readFile(path, 'utf8') })
    }
  }
  await visit(root)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

export function apiLevel(value) {
  if (Number.isInteger(value)) return value
  const text = String(value ?? '')
  const match = /\((\d+)\)$/.exec(text) ?? /^(\d+)(?:\.\d+\.\d+)?$/.exec(text)
  // Older platform versions require an explicit API mapping; do not treat 6.1.0 as API 6.
  return match && (text.includes('(') || !text.includes('.') || +match[1] >= 20) ? +match[1] : null
}

export function productContexts(config, selected) {
  const products = config.app?.products ?? []
  const list = products.length ? products : [{ name: 'default' }]
  if (selected && !list.some(p => p.name === selected)) throw new Error(`Unknown product: ${selected}`)
  return list.filter(p => !selected || p.name === selected).map(p => {
    const value = p.compatibleSdkVersion ?? config.app?.compatibleSdkVersion
    return { product: p.name, compatibleSdkVersion: value ?? null, compatibleApi: apiLevel(value),
      compileSdkVersion: p.compileSdkVersion ?? config.app?.compileSdkVersion ?? null,
      targetSdkVersion: p.targetSdkVersion ?? config.app?.targetSdkVersion ?? null,
      source: p.compatibleSdkVersion !== undefined ? `app.products[${p.name}].compatibleSdkVersion` : 'app.compatibleSdkVersion' }
  })
}

// Each overload is retained. Name matches are declaration candidates, never resolved bindings.
export function declarationCandidates(content, path, names) {
  const result = []
  for (const match of content.matchAll(/\/\*\*([\s\S]*?)\*\/\s*([^\r\n]+)/g)) {
    const signature = match[2].trim()
    const name = /^(?:(?:export|declare|default|static|readonly|abstract|async)\s+)*(?:(?:class|interface|enum|namespace|function|const|let|type)\s+)?([\w$]+)/.exec(signature)?.[1]
    if (!names.has(name)) continue
    const since = [...match[1].matchAll(/@since\s+([^\s*]+)/g)].map(m => m[1])
    result.push({ symbol: name, path: slash(path), line: line(content, match.index), signature,
      since, api: since.length === 1 ? apiLevel(since[0]) : null,
      syscap: /@syscap\s+([^\s*]+)/.exec(match[1])?.[1] ?? null,
      resolution: 'candidate-requires-owner-import-and-overload-review' })
  }
  return result
}

export async function auditProject(skillRoot, options) {
  const root = resolve(options.project)
  const registry = JSON.parse(await readFile(resolve(skillRoot, 'references/feature-registry.json'), 'utf8'))
  if (options.feature && !registry.features.some(f => f.id === options.feature)) throw new Error(`Unknown feature: ${options.feature}`)
  const configPath = resolve(root, 'build-profile.json5')
  const config = readManifest(await readFile(configPath, 'utf8'))
  const products = productContexts(config, options.product)
  const inspection = await inspectProject(root, { sdkPath: options.sdk, product: options.product ?? products[0]?.product })
  const files = await walk(root, name => /\.(ets|ts|json5?)$/.test(name) && !/\.d\.(ts|ets)$/.test(name))
  const features = []
  for (const feature of registry.features.filter(f => !options.feature || f.id === options.feature)) {
    if (feature.status !== 'ready') throw new Error(`Feature not ready: ${feature.id}`)
    const candidates = []
    for (const file of files) {
      const code = maskSource(file.content)
      const imports = [...file.content.matchAll(/^\s*import\s+[^;\n]+/gm)].map(m => ({ line: line(file.content, m.index), text: m[0].trim() }))
      const hits = [...code.matchAll(new RegExp(anchors[feature.id]?.source ?? '(?!)', 'g'))]
      // Aliased imports and motion event strings cannot be located using masked identifiers alone.
      const imported = imports.some(i => new RegExp(anchors[feature.id]?.source ?? '(?!)').test(i.text))
      const eventHits = feature.id === 'smart-reach' ? [...file.content.matchAll(/['"](?:operatingHandChanged|holdingHandChanged)['"]/g)].filter(m => /\b(?:on|off)\s*\(\s*$/.test(code.slice(Math.max(0, m.index - 30), m.index))) : []
      if (feature.id === 'gestures-share') {
        const events = (inspection.gesturesShare?.usages ?? []).filter(u => u.path === slash(relative(root, file.path)))
        for (const u of events) eventHits.push({ index: file.content.split('\n').slice(0, u.line - 1).reduce((n, s) => n + s.length + 1, 0), 0: u.operation })
      }
      const configuration = feature.id === 'easygo-parallel' && (/easy_go\.json$/.test(file.path) || /\beasyGo\s*:/.test(code))
      if (!hits.length && !imported && !eventHits.length && !configuration) continue
      const positions = [...hits, ...eventHits]
      if (!positions.length) positions.push({ index: 0, 0: configuration ? 'easyGo configuration' : 'aliased import' })
      const guards = [...code.matchAll(/\b(?:apiAvailable|sdkApiVersion|canIUse|isImmersiveMaterialSupported|isFloatViewEnabled|isFloatingBallEnabled)\b/g)]
        .map(m => ({ line: line(code, m.index), expression: file.content.split(/\r?\n/)[line(code, m.index) - 1].trim() }))
      // Member names are a search aid for AI follow-up, not evidence of ownership.
      const relatedSymbols = [...new Set([...code.matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)].map(m => m[1]))]
      const relatedUsages = [...code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)/g)]
        .map(m => ({ receiver: m[1], symbol: m[2], line: line(code, m.index),
          expression: file.content.split(/\r?\n/)[line(code, m.index) - 1].trim(), status: 'needs-binding-review' }))
      for (const hit of positions) candidates.push({ id: `${feature.id}:${slash(relative(root, file.path))}:${hit.index}`,
        path: slash(relative(root, file.path)), line: line(code, hit.index), symbol: hit[0], imports, relatedSymbols, relatedUsages, guardCandidates: guards,
        status: configuration ? 'runtime-verification-required' : 'needs-review',
        note: 'File signals do not prove guard coverage; trace aliases, receivers, wrappers, initialization and cleanup.' })
    }
    if (candidates.length) features.push({ id: feature.id, entry: feature.entry,
      policy: `references/features/${feature.id}/compatibility-audit.md`, candidates })
  }
  const names = new Set(features.flatMap(f => f.candidates.flatMap(c => [c.symbol, ...c.relatedSymbols])))
  const diagnostics = []
  for (const feature of registry.features) {
    if ((!options.feature || feature.id === options.feature) && !anchors[feature.id]) diagnostics.push(`Feature ${feature.id} has no scanner signals; inspect its package manually.`)
  }
  let declarations = []
  if (inspection.localSdk.status === 'valid') {
    try {
      const sdkFiles = await walk(inspection.localSdk.path, name => /\.d\.(ts|ets)$/.test(name))
      declarations = sdkFiles.flatMap(f => declarationCandidates(f.content, f.path, names))
      if (!sdkFiles.length) diagnostics.push('SDK declaration files not found; provide the actual compile SDK location.')
    } catch (error) { diagnostics.push(`SDK declaration scan incomplete: ${error.message}`) }
  } else diagnostics.push(inspection.localSdk.error ?? 'SDK unavailable')
  return { schemaVersion: '1.0', mode: 'scan', project: slash(root), configPath: slash(configPath), products,
    sdk: inspection.localSdk, features, declarations, diagnostics,
    reviewRequired: features.length > 0,
    limitations: ['Candidates require AI binding, inherited @since and overload review; no automatic pass/fail.',
      'Product/module overrides and dependency wrappers require source review.',
      'A discovered SDK is not proof of the active compile SDK for every product.'],
    verification: { build: 'not-run', high: 'not-run', low: 'not-run' } }
}

const cell = v => String(v ?? '').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ')
export function renderAuditReport(audit, review = {}) {
  const findings = review.findings ?? []
  const valid = new Set(['protected', 'missing-protection', 'not-required', 'needs-review'])
  const ids = new Set(audit.features.flatMap(f => f.candidates.map(c => c.id)))
  for (const f of findings) {
    if (!ids.has(f.candidateId) || !valid.has(f.status) || !f.evidence?.length) throw new Error('Review finding requires a known candidateId, status and evidence')
    if (f.status === 'protected' && !f.sdkEvidence?.length) throw new Error('Protected finding requires SDK declaration evidence')
  }
  const verification = review.verification ?? audit.verification
  const complete = ['build', 'high', 'low'].every(k => verification[k]?.status === 'pass' && verification[k]?.evidence?.length)
  const counts = Object.fromEntries([...valid].map(status => [status, findings.filter(f => f.status === status).length]))
  const unreviewed = [...ids].filter(id => !findings.some(f => f.candidateId === id)).length
  return `# ${review.mode === 'repair' ? '兼容性改造报告' : '兼容性扫描报告'}\n\n工程：${audit.project}\n\n` +
    `## 版本与范围\n\n${audit.products.map(p => `- ${p.product}：compatibleSdkVersion=${p.compatibleSdkVersion ?? '未知'}（API ${p.compatibleApi ?? '未知'}）`).join('\n')}\n\n` +
    `SDK：${cell(audit.sdk.path ?? '未定位')}；API ${audit.sdk.apiVersion}\n\n命中候选特性：${audit.features.map(f => f.id).join('、') || '未识别到已注册特性'}\n\n` +
    `复核结论数量：${cell(JSON.stringify(counts))}；尚未复核候选：${unreviewed}。数量按提交的逐调用／product 结论计，候选不等于已确认接入。\n\n` +
    `## 检查结果\n\n| 位置 | 结论 | SDK 与源码证据 | 回退与修改 |\n|---|---|---|---|\n` +
    audit.features.flatMap(f => f.candidates.map(c => {
      const rows = findings.filter(r => r.candidateId === c.id)
      return (rows.length ? rows : [{ status: c.status }]).map(r => `| ${cell(`${c.path}:${c.line} ${c.symbol}`)} | ${cell(r.status)} | ${cell([...(r.sdkEvidence ?? []), ...(r.evidence ?? [])].join('; '))} | ${cell([r.policy, r.change, r.pendingChoice].filter(Boolean).join('; '))} |`).join('\n')
    })).join('\n') +
    `\n\n## 验证\n\n${['build', 'high', 'low'].map(k => `- ${k}：${cell(JSON.stringify(verification[k] ?? 'not-run'))}`).join('\n')}\n\n` +
    `验证状态：${complete ? '所提交构建及高低版本运行证据齐全；仍须核对版本矩阵和场景覆盖' : '未完成；不能宣告改造验证通过'}\n\n` +
    `## 待确认与限制\n\n${[...audit.diagnostics, ...audit.limitations, ...(review.pending ?? [])].map(s => `- ${cell(s)}`).join('\n')}\n`
}

#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { auditProject, productContexts, declarationCandidates, maskSource, apiLevel, renderAuditReport } from '../scripts/lib/compatibility-audit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = await mkdtemp(resolve(tmpdir(), 'compatibility-audit-'))
const project = resolve(temp, 'project'), sdk = resolve(temp, 'sdk')
await mkdir(project); await mkdir(sdk)
const put = (name, content) => writeFile(resolve(project, name), content)
const config = `{ app: { compatibleSdkVersion: '6.1.0(23)', products: [
  {name:'legacy', compatibleSdkVersion: 20}, {name:'modern', compatibleSdkVersion:'26.0.0'}] } }`
await put('build-profile.json5', config)
await writeFile(resolve(sdk, 'sdk-pkg.json'), JSON.stringify({ apiVersion: 26, version: '26.0.0' }))
await writeFile(resolve(sdk, 'material.d.ts'), `
/** @since 26 */
declare namespace uiMaterial {
/** @since 26.0.1\n * @syscap SystemCapability.ArkUI.ArkUI.Full */
function getMaterialInfo(value: string): void;
/** @since 26 */
function getMaterialInfo(value: number): void;
/** @since 26 */
class ImmersiveMaterial {}
}`)
const source = `import { uiMaterial as material } from '@kit.ArkUI';
// uiMaterial.getMaterialInfo(); canIUse('fake')
const sample = "uiMaterial.getMaterialInfo()";
const obj = new material.ImmersiveMaterial();
if (deviceInfo.apiAvailable('26.0.0')) { material.getMaterialInfo(1); }
material.getMaterialInfo('unprotected');`
await put('Page.ets', source)
await put('Hands.ets', `motion.on('holdingHandChanged', callback);`)
await put('OnlyComment.ets', `// floatingBall.create();\nconst s = 'floatView.create()';`)
await put('easy_go.json', '{"common": {"mode":"shopping"}}')
await mkdir(resolve(project, 'build'))
await put('build/Generated.ets', 'dlpAntiPeep.getDlpAntiPeepInfo();')
await put('Tabs.ets', 'HdsTabs() {}')
await put('MiniBarOptions.ets', 'export const options = { miniBar: { miniBarBuilder: buildPlayer, miniBarWidth: widths } };')
await put('MiniBarController.ets', 'controller.applyMiniBarStyle(HdsBarStyle.COLLAPSE);')
await put('MiniBarComment.ets', '// miniBar: {}\nconst label = "applyMiniBarStyle";')
for (const [name, body] of Object.entries({
  early: "if (!deviceInfo.apiAvailable('26.0.0')) return; uiMaterial.getMaterialInfo();",
  wrong: 'if (deviceInfo.sdkApiVersion < 20) { uiMaterial.getMaterialInfo(); }',
  constant: 'const LEVEL = 26; if (deviceInfo.sdkApiVersion >= LEVEL) uiMaterial.getMaterialInfo();',
  wrapper: 'if (Guard.available()) uiMaterial.getMaterialInfo();',
  bypass: 'if (business || deviceInfo.sdkApiVersion >= 26) uiMaterial.getMaterialInfo();',
  cleanup: 'function exit() { uiMaterial.getMaterialInfo(); }',
  field: 'class Page { value = uiMaterial.getMaterialInfo(); }'
})) await put(`${name}.ets`, body)

assert.equal(apiLevel('6.1.0'), null)
assert.equal(apiLevel('6.1.0(23)'), 23)
assert.equal(apiLevel('26.0.1'), 26)
assert.equal(maskSource(`// uiMaterial\n'uiMaterial'`).includes('uiMaterial'), false)
assert.deepEqual(productContexts({app:{compatibleSdkVersion:23,products:[{name:'a'},{name:'b',compatibleSdkVersion:26}]}}).map(p=>p.compatibleApi), [23,26])
assert.throws(()=>productContexts({app:{products:[{name:'a'}]}}, 'missing'), /Unknown product/)
assert.equal(declarationCandidates('/** @since 26 */\nfunction unrelated():void;', 'a', new Set(['getMaterialInfo'])).length, 0)

const result = await auditProject(root, {project, sdk})
assert.deepEqual(result.products.map(p=>p.compatibleApi), [20,26])
assert.ok(result.features.some(f=>f.id==='immersive-light'))
assert.ok(result.features.some(f=>f.id==='smart-reach'))
assert.ok(result.features.some(f=>f.id==='easygo-parallel'))
assert.ok(!result.features.some(f=>['float-view-ball','dlp-anti-peep'].includes(f.id)))
assert.equal(result.declarations.filter(d=>d.symbol==='getMaterialInfo').length, 2)
assert.ok(result.declarations.some(d=>d.since.includes('26.0.1') && d.syscap))
const candidate = result.features.find(f=>f.id==='immersive-light').candidates.find(c=>c.path==='Page.ets')
assert.equal(candidate.status, 'needs-review')
assert.ok(candidate.guardCandidates.length)
assert.ok(candidate.relatedUsages.some(u=>u.receiver==='material' && u.symbol==='getMaterialInfo' && u.line===6))
assert.ok(!candidate.guardCandidates.some(g=>g.expression.includes('fake')))
assert.ok(result.features.flatMap(f=>f.candidates).every(c=>c.status!=='protected'))
const materialCandidates = result.features.find(f=>f.id==='immersive-light').candidates
assert.ok(materialCandidates.some(c=>c.path==='MiniBarOptions.ets' && c.symbol==='miniBar'))
assert.ok(materialCandidates.some(c=>c.path==='MiniBarController.ets' && c.symbol==='applyMiniBarStyle'))
assert.ok(!materialCandidates.some(c=>c.path==='MiniBarComment.ets'))
assert.equal((await auditProject(root,{project,sdk,product:'modern',feature:'immersive-light'})).products.length,1)
assert.throws(()=>renderAuditReport(result,{findings:[{candidateId:candidate.id,status:'protected',evidence:['source:1']}]}),/SDK declaration evidence/)
assert.match(renderAuditReport(result), /未完成/)
assert.equal(await readFile(resolve(project,'Page.ets'),'utf8'),source)
assert.equal(await readFile(resolve(project,'build-profile.json5'),'utf8'),config)
const invalidSdk = await auditProject(root,{project,sdk:resolve(temp,'missing')})
assert.ok(invalidSdk.features.length)
assert.ok(invalidSdk.diagnostics.length)
const empty = resolve(temp,'empty'); await mkdir(empty)
await writeFile(resolve(empty,'build-profile.json5'), '{app:{}}')
assert.equal((await auditProject(root,{project:empty,sdk})).features.length,0)
const cmd = spawnSync(process.execPath,[resolve(root,'scripts/audit-compatibility.mjs'),'--project',project,'--sdk',sdk,'--format','markdown'],{encoding:'utf8'})
assert.equal(cmd.status,0,cmd.stdout+cmd.stderr)
assert.match(cmd.stdout,/兼容性扫描报告/)
assert.equal(spawnSync(process.execPath,[resolve(root,'scripts/audit-compatibility.mjs'),'--project',project,'--feature','invalid'],{encoding:'utf8'}).status,2)
for (const id of ['immersive-light','easygo-parallel','smart-reach','agent-framework-kit','float-view-ball','dlp-anti-peep']) {
  const policy = await readFile(resolve(root,`references/features/${id}/compatibility-audit.md`),'utf8')
  assert.ok(policy.length > 200)
  assert.match(await readFile(resolve(root,`references/features/${id}/README.md`),'utf8'), /compatibility-audit.md/)
}
console.log('Compatibility audit tests passed: products, SDK overloads/patch versions, aliases, event literals, false signals, read-only CLI, reports and policies.')

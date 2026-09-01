#!/usr/bin/env node

import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { validateRegistry, validateSkillStructure } from "../scripts/validate-structure.mjs"

const evalDir = dirname(fileURLToPath(import.meta.url))
const skillRoot = resolve(evalDir, "..")
const registryPath = resolve(skillRoot, "references", "feature-registry.json")
const featureDir = resolve(skillRoot, "references", "features", "immersive-light")

const structure = await validateSkillStructure(skillRoot)
assert.deepEqual(structure.errors, [])
assert.deepEqual(structure.counts, { features: 1, ready: 1 })

const registry = JSON.parse(await readFile(registryPath, "utf8"))
assert.equal(registry.features.length, 1)
assert.deepEqual(registry.features[0], {
  id: "immersive-light",
  displayName: "沉浸光感",
  aliases: ["沉浸光感实现", "悬浮导航Tab", "悬浮导航 Tab", "Immersive Light", "HDS 沉浸材质"],
  status: "ready",
  entry: "references/features/immersive-light/README.md",
  profile: "references/features/immersive-light/profile.json"
})
assert.doesNotMatch(JSON.stringify(registry), /碰一碰/)

function matchFeature(prompt) {
  const normalized = prompt.trim().toLocaleLowerCase("en-US")
  return registry.features.find((feature) => [feature.id, feature.displayName, ...feature.aliases]
    .some((key) => {
      const routeKey = key.trim().toLocaleLowerCase("en-US")
      return /[^\u0000-\u007f]/.test(routeKey) ? normalized.includes(routeKey) : normalized === routeKey || normalized.includes(routeKey)
    })) ?? null
}

assert.equal(matchFeature("请接入沉浸光感")?.id, "immersive-light")
assert.equal(matchFeature("悬浮导航Tab怎么实现")?.id, "immersive-light")
assert.equal(matchFeature("请接入碰一碰"), null)
assert.equal(matchFeature("帮我实现窗口沉浸式并处理安全区"), null)

const invalidStatus = structuredClone(registry)
invalidStatus.features[0].status = "draft"
assert.ok((await validateRegistry(invalidStatus, skillRoot)).some((error) => error.path.endsWith(".status")))

const duplicateId = structuredClone(registry)
duplicateId.features.push(structuredClone(duplicateId.features[0]))
assert.ok((await validateRegistry(duplicateId, skillRoot)).some((error) => error.message === "id 必须唯一"))

const missingEntry = structuredClone(registry)
missingEntry.features[0].entry = "references/features/immersive-light/MISSING.md"
assert.ok((await validateRegistry(missingEntry, skillRoot)).some((error) => error.message === "entry 指向的文件不存在"))

const skill = await readFile(resolve(skillRoot, "SKILL.md"), "utf8")
assert.match(skill, /完整读取 \[特性注册表\]/)
assert.match(skill, /注册项的 `status` 必须为 `ready`/)
assert.match(skill, /命中后完整读取注册项的 `entry`/)
assert.match(skill, /未注册特性/)
assert.match(skill, /窗口沉浸式.*不是.*沉浸光感/)
assert.match(skill, /harmonyos-doc-review/)
assert.match(skill, /普通 ArkUI/)
assert.match(skill, /悬浮导航Tab/)
assert.match(skill, /验证本机 SDK/)
assert.match(skill, /sdk-pkg\.json/)
assert.match(skill, /所有低版本、不支持、未授权或特性关闭路径都必须保留接入前的源程序状态/)

const entry = await readFile(resolve(featureDir, "README.md"), "utf8")
const compatibility = await readFile(resolve(featureDir, "compatibility.md"), "utf8")
const implementation = await readFile(resolve(featureDir, "implementation.md"), "utf8")
const validation = await readFile(resolve(featureDir, "performance-validation.md"), "utf8")
const assetsCatalog = await readFile(resolve(featureDir, "assets-catalog.md"), "utf8")
const floatingTabsAsset = await readFile(resolve(featureDir, "assets", "FloatingTabsMainEntry.ets"), "utf8")
const hdsGuardAsset = await readFile(resolve(featureDir, "assets", "HdsMaterialGuard.ets"), "utf8")
const profile = JSON.parse(await readFile(resolve(featureDir, "profile.json"), "utf8"))
const sharedCompatibility = await readFile(resolve(skillRoot, "references", "shared", "compatibility-model.md"), "utf8")
const featureContract = await readFile(resolve(skillRoot, "references", "feature-package-contract.md"), "utf8")
const projectDiscoveryWorkflow = await readFile(resolve(skillRoot, "references", "workflows", "project-discovery.md"), "utf8")
const designWorkflow = await readFile(resolve(skillRoot, "references", "workflows", "integration-design.md"), "utf8")
const implementationWorkflow = await readFile(resolve(skillRoot, "references", "workflows", "implementation.md"), "utf8")
const verificationWorkflow = await readFile(resolve(skillRoot, "references", "workflows", "verification.md"), "utf8")
const planTemplate = await readFile(resolve(skillRoot, "assets", "templates", "integration-plan.md"), "utf8")
const reportTemplate = await readFile(resolve(skillRoot, "assets", "templates", "integration-report.md"), "utf8")

assert.match(entry, /状态：`ready`/)
assert.match(entry, /API 23～25[\s\S]*HDS/)
assert.match(entry, /API 26\+[\s\S]*uiMaterial/)
assert.match(entry, /compatibility\.md/)
assert.match(entry, /implementation\.md/)
assert.match(entry, /performance-validation\.md/)
assert.match(entry, /assets-catalog\.md/)
assert.match(entry, /悬浮导航Tab/)

assert.match(compatibility, /HarmonyOS 6\.1\.0、API 23/)
assert.match(compatibility, /HdsNavigation[^\n]*HarmonyOS 5\.1\.0、API 18/)
assert.match(compatibility, /HdsTabs[^\n]*HarmonyOS 6\.0\.0、API 20/)
assert.match(compatibility, /组件存在[^\n]*特性可用/)
assert.match(compatibility, /targetAPIVersion >= 26\.0\.0/)
assert.match(compatibility, /Stage 模型/)
assert.match(compatibility, /hdsMaterial\.MaterialLevel[\s\S]*uiMaterial\.MaterialLevel/)
assert.match(compatibility, /uiMaterial\.Material\.empty/)
assert.match(compatibility, /低版本整树分支必须保留源程序接入前的体验/)

assert.match(implementation, /HdsNavigation/)
assert.match(implementation, /uiMaterial\.ImmersiveMaterial/)
assert.match(implementation, /deviceInfo\.apiAvailable\('26\.0\.0'\)/)
assert.match(implementation, /uiMaterial\.isImmersiveMaterialSupported\(\)/)
assert.match(implementation, /ohos\.arkui\.UIMaterial\.state/)
assert.match(implementation, /barOverlap\(true\)/)
assert.match(implementation, /barHeight\(56\)/)
assert.match(implementation, /大断点.*显式设计决策/)
assert.match(implementation, /低版本分支必须保留源程序体验/)

assert.match(assetsCatalog, /三组对照均出现的迁移模式（3\/3）/)
assert.match(assetsCatalog, /原始对照工程被移除不会影响能力包/)
assert.match(assetsCatalog, /所有断点.*底部 `HdsTabs`/)
assert.match(assetsCatalog, /56vp.*显示态基线/)
assert.match(assetsCatalog, /animationDuration\(0\).*只出现在 Mall 和 News/)
assert.match(assetsCatalog, /expandSafeArea.*不是材质生效的统一前提/)
assert.match(assetsCatalog, /barFloatingStyle\.barWidth/)
assert.match(assetsCatalog, /Spatialization 官方示例/)
assert.match(assetsCatalog, /低版本普通 `Tabs` 分支必须保留源程序原有体验/)
assert.match(floatingTabsAsset, /HdsTabs\(/)
assert.match(floatingTabsAsset, /barPosition: BarPosition\.End/)
assert.match(floatingTabsAsset, /barOverlap\(true\)/)
assert.match(floatingTabsAsset, /barFloatingStyle\(/)
assert.match(floatingTabsAsset, /barHeight\(56\)/)
assert.match(floatingTabsAsset, /sourceUsesSideTabs/)
assert.match(hdsGuardAsset, /deviceInfo\.sdkApiVersion/)
assert.match(hdsGuardAsset, /HDS_MIN_API_VERSION: number = 23/)

assert.match(validation, /高、中、低算力设备/)
assert.match(validation, /Web 同层渲染/)
assert.match(validation, /测试矩阵/)
assert.match(validation, /验收标准/)
assert.match(validation, /API 23 以下设备逐项对照接入前源程序/)
assert.equal(profile.featureId, "immersive-light")
const hdsRoute = profile.routes.find((route) => route.id === "hds")
assert.equal(hdsRoute?.minApi, 23)
assert.equal(hdsRoute?.minApiMeaning, "immersive-material-capability")
assert.equal(hdsRoute?.componentFamilyMinApi, 18)
assert.deepEqual(hdsRoute?.componentBaselines, [
  { component: "HdsNavigation", minApi: 18 },
  { component: "HdsNavDestination", minApi: 18 },
  { component: "HdsTabs", minApi: 20 }
])
assert.equal(profile.routes.find((route) => route.id === "arkui")?.minApi, 26)
assert.equal(profile.routes.find((route) => route.id === "arkui")?.applicationLevel.minTargetApi, 26)
assert.ok(profile.routes.every((route) => !("sdkRequirements" in route)))
assert.equal(profile.documents.assets, "assets-catalog.md")
assert.match(JSON.stringify(profile), /snapshot-first-verify-on-change-or-conflict/)
assert.ok(profile.constraints.some((item) => item.id === "fallback-source-experience"))
assert.equal(profile.fallbackPolicy.baseline, "pre-integration-source-state")
assert.ok(profile.fallbackPolicy.appliesWhen.includes("feature-disabled"))
assert.ok(profile.fallbackPolicy.preserve.includes("state-data-controllers-events-and-lifecycle"))
assert.match(sharedCompatibility, /所有能力包都必须声明 `fallbackPolicy\.baseline: pre-integration-source-state`/)
assert.match(featureContract, /不是生成一套新的“低配实现”/)
assert.match(projectDiscoveryWorkflow, /建立“源程序状态基线”/)
assert.match(designWorkflow, /只在增强分支引入新特性/)
assert.match(implementationWorkflow, /不得为回退路径另造一套与源程序不同的简化实现/)
assert.match(verificationWorkflow, /与实施前源程序状态基线逐项对照/)
assert.match(planTemplate, /接入前源程序状态基线/)
assert.match(reportTemplate, /源程序状态保留对照/)

for (const path of [
  "scripts/inspect-project.mjs",
  "scripts/check-compatibility.mjs",
  "scripts/verify-integration.mjs",
  "scripts/validate-feature-package.mjs",
  "references/workflows/project-discovery.md",
  "references/workflows/feasibility-check.md",
  "references/workflows/integration-design.md",
  "references/workflows/implementation.md",
  "references/workflows/verification.md",
  "references/workflows/troubleshooting.md",
  "references/shared/compatibility-model.md",
  "references/shared/output-contracts.md",
  "assets/templates/integration-plan.md",
  "assets/templates/integration-report.md",
  "assets/templates/feature-package-template.md"
]) {
  await access(resolve(skillRoot, path))
}

const combinedSkill = [skill, entry, compatibility, implementation, validation].join("\n")
const removedState = ["place", "holder"].join("")
assert.equal(combinedSkill.includes(removedState), false)

const evals = JSON.parse(await readFile(resolve(evalDir, "evals.json"), "utf8"))
assert.equal(evals.skill_name, "harmonyos-os-feature-integration")
assert.equal(evals.evals.length, 12)
assert.ok(evals.evals.every((item) => item.prompt && item.expected_output && Array.isArray(item.expectations)))
const floatingTabEval = evals.evals.find((item) => item.id === 5)
assert.match(floatingTabEval?.prompt ?? "", /悬浮导航Tab/)
assert.ok(floatingTabEval?.expectations.some((item) => item.includes("immersive-light")))
const upgradeEval = evals.evals.find((item) => item.id === 9)
assert.match(upgradeEval?.prompt ?? "", /API 20/)
assert.ok(upgradeEval?.expectations.some((item) => item.includes("由用户决定")))
const componentBaselineEval = evals.evals.find((item) => item.id === 10)
assert.match(componentBaselineEval?.prompt ?? "", /HdsNavigation/)
assert.ok(componentBaselineEval?.expectations.some((item) => item.includes("组件自身")))
assert.ok(componentBaselineEval?.expectations.some((item) => item.includes("API 23")))
const floatingLayoutEval = evals.evals.find((item) => item.id === 11)
assert.match(floatingLayoutEval?.prompt ?? "", /LG\/XL/)
assert.ok(floatingLayoutEval?.expectations.some((item) => item.includes("barOverlap(true)")))
assert.ok(floatingLayoutEval?.expectations.some((item) => item.includes("大屏")))
const sourceExperienceEval = evals.evals.find((item) => item.id === 12)
assert.match(sourceExperienceEval?.prompt ?? "", /API 20～22/)
assert.ok(sourceExperienceEval?.expectations.some((item) => item.includes("保留源程序原有体验")))

process.stdout.write(`${JSON.stringify({ status: "passed", assertions: 111 })}\n`)

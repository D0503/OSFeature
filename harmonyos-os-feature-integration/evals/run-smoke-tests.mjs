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

const entry = await readFile(resolve(featureDir, "README.md"), "utf8")
const compatibility = await readFile(resolve(featureDir, "compatibility.md"), "utf8")
const implementation = await readFile(resolve(featureDir, "implementation.md"), "utf8")
const validation = await readFile(resolve(featureDir, "performance-validation.md"), "utf8")
const profile = JSON.parse(await readFile(resolve(featureDir, "profile.json"), "utf8"))

assert.match(entry, /状态：`ready`/)
assert.match(entry, /API 23～25[\s\S]*HDS/)
assert.match(entry, /API 26\+[\s\S]*uiMaterial/)
assert.match(entry, /compatibility\.md/)
assert.match(entry, /implementation\.md/)
assert.match(entry, /performance-validation\.md/)
assert.match(entry, /悬浮导航Tab/)

assert.match(compatibility, /HarmonyOS 6\.1\.0、API 23/)
assert.match(compatibility, /targetAPIVersion >= 26\.0\.0/)
assert.match(compatibility, /Stage 模型/)
assert.match(compatibility, /hdsMaterial\.MaterialLevel[\s\S]*uiMaterial\.MaterialLevel/)
assert.match(compatibility, /uiMaterial\.Material\.empty/)

assert.match(implementation, /HdsNavigation/)
assert.match(implementation, /uiMaterial\.ImmersiveMaterial/)
assert.match(implementation, /deviceInfo\.apiAvailable\('26\.0\.0'\)/)
assert.match(implementation, /uiMaterial\.isImmersiveMaterialSupported\(\)/)
assert.match(implementation, /ohos\.arkui\.UIMaterial\.state/)

assert.match(validation, /高、中、低算力设备/)
assert.match(validation, /Web 同层渲染/)
assert.match(validation, /测试矩阵/)
assert.match(validation, /验收标准/)
assert.equal(profile.featureId, "immersive-light")
assert.equal(profile.routes.find((route) => route.id === "hds")?.minApi, 23)
assert.equal(profile.routes.find((route) => route.id === "arkui")?.minApi, 26)
assert.equal(profile.routes.find((route) => route.id === "arkui")?.applicationLevel.minTargetApi, 26)
assert.match(JSON.stringify(profile), /snapshot-first-verify-on-change-or-conflict/)

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
assert.equal(evals.evals.length, 8)
assert.ok(evals.evals.every((item) => item.prompt && item.expected_output && Array.isArray(item.expectations)))
const floatingTabEval = evals.evals.find((item) => item.id === 5)
assert.match(floatingTabEval?.prompt ?? "", /悬浮导航Tab/)
assert.ok(floatingTabEval?.expectations.some((item) => item.includes("immersive-light")))

process.stdout.write(`${JSON.stringify({ status: "passed", assertions: 52 })}\n`)

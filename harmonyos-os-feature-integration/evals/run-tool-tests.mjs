#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { evaluateCompatibility, inspectProject, verifyInspection } from "../scripts/lib/project-tools.mjs"

const evalDir = dirname(fileURLToPath(import.meta.url))
const skillRoot = resolve(evalDir, "..")
const fixture23 = resolve(evalDir, "fixtures", "api23-hds")
const fixture26 = resolve(evalDir, "fixtures", "api26-arkui")
const sdk23 = resolve(evalDir, "fixtures", "sdk-api23")
const sdk26 = resolve(evalDir, "fixtures", "sdk-api26")
const profile = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(resolve(skillRoot, "references", "features", "immersive-light", "profile.json"), "utf8")))
let assertions = 0

function equal(actual, expected) {
  assertions += 1
  assert.equal(actual, expected)
}

function ok(value) {
  assertions += 1
  assert.ok(value)
}

function run(script, args, expectedCode = 0) {
  const result = spawnSync(process.execPath, [resolve(skillRoot, "scripts", script), ...args], { encoding: "utf8" })
  equal(result.status, expectedCode)
  equal(result.stderr, "")
  return JSON.parse(result.stdout)
}

const inspection23 = await inspectProject(fixture23, { sdkPath: sdk23 })
equal(inspection23.model, "stage")
equal(inspection23.api.compatible, 23)
equal(inspection23.api.target, 23)
equal(inspection23.api.compile, 23)
equal(inspection23.localSdk.status, "valid")
equal(inspection23.localSdk.apiVersion, 23)
equal(inspection23.modules[0].type, "entry")
equal(inspection23.signals.hdsTabs.detected, true)
equal(inspection23.signals.barFloatingStyle.detected, true)
equal(inspection23.signals.barPositionEnd.detected, true)
equal(inspection23.signals.barOverlapTrue.detected, true)
equal(inspection23.signals.barHeight.detected, true)
equal(inspection23.signals.adaptiveMaterial.detected, true)

const compatibility23 = evaluateCompatibility(inspection23, profile)
equal(compatibility23.sdk.routes.hds.status, "supported")
equal(compatibility23.sdk.routes.arkui.status, "sdk_too_old")
equal(compatibility23.status, "supported")
equal(compatibility23.recommendedRoute, "hds")
equal(compatibility23.selectedRoutes.join(","), "hds")
equal(compatibility23.routeSelectionMode, "composable")
equal(compatibility23.availableRoutes.join(","), "hds")
equal(compatibility23.applicationLevel.eligible, false)
equal(compatibility23.upgradeOptions.map((option) => option.route).join(","), "arkui")
equal(compatibility23.upgradeOptions[0].upgradeTargetApi, 26)
equal(compatibility23.decisionRequired, true)
const verification23 = verifyInspection(inspection23, compatibility23, "auto")
equal(verification23.status, "passed")
equal(verification23.counts.fail, 0)

const missingFloatingLayout = structuredClone(inspection23)
missingFloatingLayout.signals.barPositionEnd = { detected: false, evidence: [] }
missingFloatingLayout.signals.barOverlapTrue = { detected: false, evidence: [] }
const failedFloatingLayout = verifyInspection(missingFloatingLayout, compatibility23, "hds")
equal(failedFloatingLayout.status, "failed")
ok(failedFloatingLayout.checks.some((item) => item.id === "floating-tabs-bottom-position" && item.status === "fail"))
ok(failedFloatingLayout.checks.some((item) => item.id === "floating-tabs-overlap" && item.status === "fail"))

const missingFloatingHeight = structuredClone(inspection23)
missingFloatingHeight.signals.barHeight = { detected: false, evidence: [] }
const warnedFloatingHeight = verifyInspection(missingFloatingHeight, compatibility23, "hds")
equal(warnedFloatingHeight.status, "warnings")
ok(warnedFloatingHeight.checks.some((item) => item.id === "floating-tabs-height" && item.status === "warn"))

const duplicateBottomSpacing = structuredClone(inspection23)
duplicateBottomSpacing.signals.barBottomMarginPositive = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
duplicateBottomSpacing.signals.layoutBottomPadding = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:40"] }
const warnedBottomSpacing = verifyInspection(duplicateBottomSpacing, compatibility23, "hds")
equal(warnedBottomSpacing.status, "warnings")
ok(warnedBottomSpacing.checks.some((item) => item.id === "floating-tabs-bottom-spacing" && item.status === "warn"))
duplicateBottomSpacing.signals.barBottomMarginPositive = { detected: false, evidence: [] }
const normalizedBottomSpacing = verifyInspection(duplicateBottomSpacing, compatibility23, "hds")
equal(normalizedBottomSpacing.status, "passed")
ok(normalizedBottomSpacing.checks.some((item) => item.id === "floating-tabs-bottom-spacing" && item.status === "not_applicable"))

const missingScrollableTailClearance = structuredClone(inspection23)
missingScrollableTailClearance.signals.scrollableContent = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:10"] }
missingScrollableTailClearance.signals.contentEndOffset = { detected: false, evidence: [] }
const warnedScrollableTailClearance = verifyInspection(missingScrollableTailClearance, compatibility23, "hds")
equal(warnedScrollableTailClearance.status, "warnings")
ok(warnedScrollableTailClearance.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "warn"))
missingScrollableTailClearance.signals.contentEndOffset = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:30"] }
const detectedScrollableTailClearance = verifyInspection(missingScrollableTailClearance, compatibility23, "hds")
equal(detectedScrollableTailClearance.status, "passed")
ok(detectedScrollableTailClearance.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "pass"))

const missingMiniBarBuilder = structuredClone(inspection23)
missingMiniBarBuilder.signals.miniBar = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
missingMiniBarBuilder.signals.miniBarBuilder = { detected: false, evidence: [] }
const failedMiniBarContract = verifyInspection(missingMiniBarBuilder, compatibility23, "hds")
equal(failedMiniBarContract.status, "failed")
ok(failedMiniBarContract.checks.some((item) => item.id === "mini-bar-contract" && item.status === "fail"))

const unguardedMiniBarLayout = structuredClone(inspection23)
unguardedMiniBarLayout.signals.miniBar = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
unguardedMiniBarLayout.signals.miniBarBuilder = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:21"] }
unguardedMiniBarLayout.signals.barLayoutMode = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:22"] }
unguardedMiniBarLayout.signals.sdkApiVersion24Guard = { detected: false, evidence: [] }
const failedMiniBarLayoutGuard = verifyInspection(unguardedMiniBarLayout, compatibility23, "hds")
equal(failedMiniBarLayoutGuard.status, "failed")
ok(failedMiniBarLayoutGuard.checks.some((item) => item.id === "mini-bar-layout-mode-version-guard" && item.status === "fail"))
unguardedMiniBarLayout.signals.sdkApiVersion24Guard = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:5"] }
const guardedMiniBarLayout = verifyInspection(unguardedMiniBarLayout, compatibility23, "hds")
equal(guardedMiniBarLayout.status, "passed")
ok(guardedMiniBarLayout.checks.some((item) => item.id === "mini-bar-layout-mode-version-guard" && item.status === "pass"))

const inspection26 = await inspectProject(fixture26, { sdkPath: sdk26 })
equal(inspection26.model, "stage")
equal(inspection26.api.compatible, 26)
equal(inspection26.api.target, 26)
equal(inspection26.api.compile, 26)
equal(inspection26.localSdk.apiVersion, 26)
equal(inspection26.modules[0].applicationMaterialState, "enable")
equal(inspection26.signals.uiMaterial.detected, true)
equal(inspection26.signals.systemMaterial.detected, true)
equal(inspection26.signals.apiAvailable26.detected, false)
equal(inspection26.signals.sdkApiVersion26Guard.detected, true)
equal(inspection26.signals.materialSupported.detected, true)
equal(inspection26.signals.nativeTabs.detected, true)
equal(inspection26.signals.nativeTabsFloatingStyle.detected, true)
equal(inspection26.signals.nativeTabsFloatingMaterial.detected, true)
equal(inspection26.signals.verticalFalse.detected, true)
equal(inspection26.componentSystem.arkuiNativeNavigation, true)

const compatibility26 = evaluateCompatibility(inspection26, profile)
equal(compatibility26.sdk.routes.hds.status, "supported")
equal(compatibility26.sdk.routes.arkui.status, "supported")
equal(compatibility26.status, "supported")
equal(compatibility26.recommendedRoute, "arkui")
equal(compatibility26.selectedRoutes.join(","), "arkui")
equal(compatibility26.availableRoutes.join(","), "hds,arkui")
equal(compatibility26.applicationLevel.eligible, true)
equal(compatibility26.upgradeOptions.length, 0)
equal(compatibility26.decisionRequired, true)
const verification26 = verifyInspection(inspection26, compatibility26, "auto")
equal(verification26.status, "passed")
equal(verification26.counts.fail, 0)
ok(verification26.checks.some((item) => item.id === "arkui-native-tabs-floating-style" && item.status === "pass"))
ok(verification26.checks.some((item) => item.id === "arkui-native-tabs-horizontal" && item.status === "pass"))

const invalidNativeTabs = structuredClone(inspection26)
invalidNativeTabs.signals.verticalFalse = { detected: false, evidence: [] }
invalidNativeTabs.signals.barOverlapTrue = { detected: false, evidence: [] }
const failedNativeTabs = verifyInspection(invalidNativeTabs, compatibility26, "arkui")
equal(failedNativeTabs.status, "failed")
ok(failedNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-horizontal" && item.status === "fail"))
ok(failedNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-overlap" && item.status === "fail"))

const hybridInspection26 = structuredClone(inspection26)
hybridInspection26.componentSystem.hds = true
for (const signal of [
  "hdsNavigation",
  "hdsTabs",
  "barFloatingStyle",
  "barPositionEnd",
  "barOverlapTrue",
  "barHeight",
  "hdsMaterialEffect",
  "adaptiveMaterial"
]) {
  hybridInspection26.signals[signal] = structuredClone(inspection23.signals[signal])
}
const hybridCompatibility26 = evaluateCompatibility(hybridInspection26, profile)
equal(hybridCompatibility26.selectedRoutes.join(","), "hds,arkui")
equal(hybridCompatibility26.recommendedRoute, "arkui")
const hybridVerification26 = verifyInspection(hybridInspection26, hybridCompatibility26, "auto")
equal(hybridVerification26.route, "composed")
equal(hybridVerification26.routes.join(","), "hds,arkui")
equal(hybridVerification26.status, "passed")

const hdsOnlyInspection26 = structuredClone(hybridInspection26)
hdsOnlyInspection26.componentSystem.arkuiMaterial = false
hdsOnlyInspection26.signals.uiMaterial = { detected: false, evidence: [] }
hdsOnlyInspection26.signals.systemMaterial = { detected: false, evidence: [] }
const hdsOnlyCompatibility26 = evaluateCompatibility(hdsOnlyInspection26, profile)
equal(hdsOnlyCompatibility26.recommendedRoute, "arkui")
equal(hdsOnlyCompatibility26.selectedRoutes.join(","), "hds")
equal(verifyInspection(hdsOnlyInspection26, hdsOnlyCompatibility26, "auto").route, "hds")

const api22 = structuredClone(inspection23)
api22.api.compatible = 22
api22.api.target = 22
const compatibility22 = evaluateCompatibility(api22, profile)
equal(compatibility22.status, "upgrade_available")
equal(compatibility22.recommendedRoute, null)
equal(compatibility22.availableRoutes.length, 0)
equal(compatibility22.upgradeOptions.map((option) => option.route).join(","), "hds,arkui")
equal(compatibility22.upgradeOptions[0].upgradeTargetApi, 23)
equal(compatibility22.decisionRequired, true)

const hdsComponentOnly18 = structuredClone(inspection23)
hdsComponentOnly18.api.compatible = 18
hdsComponentOnly18.api.target = 18
hdsComponentOnly18.api.compile = 18
hdsComponentOnly18.localSdk.apiVersion = 18
hdsComponentOnly18.signals.hdsNavigation = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:1"] }
hdsComponentOnly18.signals.hdsTabs = { detected: false, evidence: [] }
hdsComponentOnly18.componentSystem.hds = true
const compatibilityComponentOnly18 = evaluateCompatibility(hdsComponentOnly18, profile)
equal(hdsComponentOnly18.componentSystem.hds, true)
equal(compatibilityComponentOnly18.sdk.routes.hds.status, "sdk_too_old")
equal(compatibilityComponentOnly18.status, "upgrade_available")
equal(compatibilityComponentOnly18.availableRoutes.length, 0)
equal(compatibilityComponentOnly18.upgradeOptions[0].route, "hds")
equal(compatibilityComponentOnly18.upgradeOptions[0].upgradeLocalSdkApi, 23)
equal(compatibilityComponentOnly18.upgradeOptions[0].upgradeCompileApi, 23)
equal(compatibilityComponentOnly18.upgradeOptions[0].upgradeTargetApi, 23)

const upgradedTarget = structuredClone(inspection26)
upgradedTarget.api.compatible = 22
upgradedTarget.api.target = 26
const compatibilityUpgraded = evaluateCompatibility(upgradedTarget, profile)
equal(compatibilityUpgraded.status, "conditional")
equal(compatibilityUpgraded.recommendedRoute, "arkui")
equal(compatibilityUpgraded.availableRoutes.join(","), "hds,arkui")
equal(compatibilityUpgraded.upgradeOptions.length, 0)
equal(compatibilityUpgraded.decisionRequired, true)
ok(compatibilityUpgraded.missingConditions.some((item) => item.includes("runtime version guards")))
equal(compatibilityUpgraded.fallbackPolicy.baseline, "pre-integration-source-state")
ok(compatibilityUpgraded.fallbackRequirements.includes("preserve-pre-integration-source-state"))
ok(compatibilityUpgraded.fallbackRequirements.includes("sdkApiVersion-26-tree-guard"))

const lowCompatibleHds = structuredClone(inspection23)
lowCompatibleHds.api.compatible = 20
lowCompatibleHds.api.target = 23
const lowCompatibleHdsCompatibility = evaluateCompatibility(lowCompatibleHds, profile)
equal(lowCompatibleHdsCompatibility.status, "conditional")
equal(lowCompatibleHdsCompatibility.fallbackPolicy.baseline, "pre-integration-source-state")
ok(lowCompatibleHdsCompatibility.fallbackRequirements.includes("preserve-pre-integration-source-state"))
const missingSourceFallback = verifyInspection(lowCompatibleHds, lowCompatibleHdsCompatibility, "hds")
equal(missingSourceFallback.status, "failed")
ok(missingSourceFallback.checks.some((item) => item.id === "version-guard" && item.status === "fail"))
ok(missingSourceFallback.checks.some((item) => item.id === "source-tabs-fallback" && item.status === "fail"))
lowCompatibleHds.signals.sdkApiVersion = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:1"] }
lowCompatibleHds.signals.standardTabs = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
const preservedSourceFallback = verifyInspection(lowCompatibleHds, lowCompatibleHdsCompatibility, "hds")
equal(preservedSourceFallback.status, "warnings")
ok(preservedSourceFallback.checks.some((item) => item.id === "source-experience-preservation" && item.status === "warn"))

const lowTarget = structuredClone(inspection26)
lowTarget.api.compatible = 25
lowTarget.api.target = 25
const compatibilityLowTarget = evaluateCompatibility(lowTarget, profile)
equal(compatibilityLowTarget.status, "conditional")
equal(compatibilityLowTarget.availableRoutes.join(","), "hds")
equal(compatibilityLowTarget.recommendedRoute, "hds")
equal(compatibilityLowTarget.selectedRoutes.length, 0)
equal(compatibilityLowTarget.applicationLevel.eligible, false)
ok(compatibilityLowTarget.upgradeOptions.some((item) => item.route === "arkui" && item.upgradeTargetApi === 26))
ok(compatibilityLowTarget.missingConditions.some((item) => item.includes("target API 26")))

const lowCompile = structuredClone(inspection26)
lowCompile.api.compile = 23
const compatibilityLowCompile = evaluateCompatibility(lowCompile, profile)
equal(compatibilityLowCompile.availableRoutes.join(","), "hds")
equal(compatibilityLowCompile.recommendedRoute, "hds")
ok(compatibilityLowCompile.upgradeOptions.some((option) => option.route === "arkui" && option.upgradeCompileApi === 26))

const missingProtection = structuredClone(inspection26)
missingProtection.signals.materialSupported = { detected: false, evidence: [] }
missingProtection.signals.fallbackStyle = { detected: false, evidence: [] }
const failedVerification = verifyInspection(missingProtection, compatibility26, "arkui")
equal(failedVerification.status, "failed")
ok(failedVerification.checks.some((item) => item.id === "version-guard" && item.status === "not_applicable"))
ok(failedVerification.checks.some((item) => item.id === "capability-guard" && item.status === "fail"))
ok(failedVerification.checks.some((item) => item.id === "fallback-style" && item.status === "fail"))

const lowCompatibleArkui = structuredClone(inspection26)
lowCompatibleArkui.api.compatible = 22
const lowCompatibleArkuiCompatibility = evaluateCompatibility(lowCompatibleArkui, profile)
lowCompatibleArkui.signals.sdkApiVersion26Guard = { detected: false, evidence: [] }
const failedArkuiTreeGuard = verifyInspection(lowCompatibleArkui, lowCompatibleArkuiCompatibility, "arkui")
ok(failedArkuiTreeGuard.checks.some((item) => item.id === "version-guard" && item.status === "fail"))
lowCompatibleArkui.signals.sdkApiVersion26Guard = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:5"] }
const guardedArkuiTree = verifyInspection(lowCompatibleArkui, lowCompatibleArkuiCompatibility, "arkui")
ok(guardedArkuiTree.checks.some((item) => item.id === "version-guard" && item.status === "pass"))

const missingSdkInspection = await inspectProject(fixture23, { sdkPath: resolve(evalDir, "fixtures", "missing-sdk") })
equal(missingSdkInspection.localSdk.status, "invalid")
const missingSdkCompatibility = evaluateCompatibility(missingSdkInspection, profile)
equal(missingSdkCompatibility.status, "insufficient_context")
const autoSdkInspection = await inspectProject(fixture23)
equal(autoSdkInspection.localSdk.status, "valid")
equal(autoSdkInspection.localSdk.source, "local.properties:sdk.dir")

const cliInspection = run("inspect-project.mjs", ["--project", fixture23, "--sdk", sdk23])
equal(cliInspection.api.compatible, 23)
equal(cliInspection.localSdk.status, "valid")
const cliCompatibility = run("check-compatibility.mjs", ["--project", fixture26, "--feature", "immersive-light", "--sdk", sdk26])
equal(cliCompatibility.recommendedRoute, "arkui")
equal(cliCompatibility.selectedRoutes.join(","), "arkui")
equal(cliCompatibility.sdk.routes.arkui.status, "supported")
const cliVerification = run("verify-integration.mjs", ["--project", fixture26, "--feature", "immersive-light", "--route", "auto", "--sdk", sdk26])
equal(cliVerification.status, "passed")
const unknownFeature = run("check-compatibility.mjs", ["--project", fixture26, "--feature", "touch-to-share", "--sdk", sdk26], 2)
equal(unknownFeature.status, "error")

process.stdout.write(`${JSON.stringify({ status: "passed", assertions })}\n`)

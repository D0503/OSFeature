#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
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

const versionProject = await mkdtemp(resolve(tmpdir(), "os-feature-version-"))
await cp(fixture26, versionProject, { recursive: true })
const versionProfilePath = resolve(versionProject, "build-profile.json5")
const versionProfile = await readFile(versionProfilePath, "utf8")
for (const [configured, expected] of [["26.0.0", 26], ["26.0.1", 26], ["6.1.0(23)", 23], ["6.1.0", "unknown"], ["26.0.0(26)", "unknown"]]) {
  await writeFile(versionProfilePath, versionProfile.replace('targetSdkVersion: "26.0.0"', `targetSdkVersion: "${configured}"`))
  const inspected = await inspectProject(versionProject, { sdkPath: sdk26 })
  equal(inspected.api.target, expected)
  if (configured === "26.0.0") ok(evaluateCompatibility(inspected, profile).availableRoutes.includes("arkui"))
}
equal(inspection23.api.compile, 23)
equal(inspection23.localSdk.status, "valid")
equal(inspection23.localSdk.apiVersion, 23)
equal(inspection23.modules[0].type, "entry")
equal(inspection23.modules[0].effectiveApplicationMaterialState, "default")
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
ok(compatibility23.upgradeOptions[0].note.includes('"26.0.0" without a parenthesized suffix'))
equal(compatibility23.decisionRequired, true)
const verification23 = verifyInspection(inspection23, compatibility23, "auto")
equal(verification23.status, "warnings")
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
const defaultBottomSpacing = verifyInspection(duplicateBottomSpacing, compatibility23, "hds")
equal(defaultBottomSpacing.status, "warnings")
ok(defaultBottomSpacing.checks.some((item) => item.id === "floating-tabs-bottom-spacing" && item.status === "warn"))
const ordinaryTabsPadding = structuredClone(duplicateBottomSpacing)
ordinaryTabsPadding.signals.barFloatingStyle = { detected: false, evidence: [] }
ok(verifyInspection(ordinaryTabsPadding, compatibility23, "hds").checks.some((item) => item.id === "floating-tabs-bottom-spacing" && item.status === "not_applicable"))

const missingScrollableTailClearance = structuredClone(inspection23)
missingScrollableTailClearance.signals.scrollableContent = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:10"] }
missingScrollableTailClearance.signals.contentEndOffset = { detected: false, evidence: [] }
const warnedScrollableTailClearance = verifyInspection(missingScrollableTailClearance, compatibility23, "hds")
equal(warnedScrollableTailClearance.status, "warnings")
ok(warnedScrollableTailClearance.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "warn"))
missingScrollableTailClearance.signals.contentEndOffset = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:30"] }
const detectedScrollableTailClearance = verifyInspection(missingScrollableTailClearance, compatibility23, "hds")
equal(detectedScrollableTailClearance.status, "warnings")
ok(detectedScrollableTailClearance.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "warn"))

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
equal(guardedMiniBarLayout.status, "warnings")
ok(guardedMiniBarLayout.checks.some((item) => item.id === "mini-bar-layout-mode-version-guard" && item.status === "pass"))

const inspection26 = await inspectProject(fixture26, { sdkPath: sdk26 })
equal(inspection26.model, "stage")
equal(inspection26.api.compatible, 26)
equal(inspection26.api.target, 26)
equal(inspection26.api.compile, 26)
equal(inspection26.localSdk.apiVersion, 26)
equal(inspection26.modules[0].applicationMaterialState, "enable")
equal(inspection26.modules[0].effectiveApplicationMaterialState, "enable")
equal(inspection26.signals.uiMaterial.detected, false)
equal(inspection26.signals.systemMaterial.detected, false)
equal(inspection26.signals.apiAvailable26.detected, false)
equal(inspection26.signals.sdkApiVersion26Guard.detected, false)
equal(inspection26.signals.materialSupported.detected, false)
equal(inspection26.signals.nativeTabs.detected, true)
equal(inspection26.signals.nativeTabsFloatingStyle.detected, true)
equal(inspection26.signals.nativeTabsFloatingMaterial.detected, false)
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
equal(verification26.status, "warnings")
equal(verification26.counts.fail, 0)
ok(verification26.checks.some((item) => item.id === "arkui-native-tabs-floating-style" && item.status === "pass"))
ok(verification26.checks.some((item) => item.id === "arkui-native-tabs-floating-style" && item.message.includes("default THIN")))
ok(verification26.checks.some((item) => item.id === "arkui-import" && item.status === "not_applicable"))
ok(verification26.checks.some((item) => item.id === "capability-guard" && item.status === "not_applicable"))
ok(verification26.checks.some((item) => item.id === "arkui-native-tabs-horizontal" && item.status === "pass"))

const defaultNativeTabs = structuredClone(inspection26)
defaultNativeTabs.modules[0].applicationMaterialState = null
defaultNativeTabs.modules[0].effectiveApplicationMaterialState = "default"
const passedDefaultNativeTabs = verifyInspection(defaultNativeTabs, compatibility26, "arkui")
equal(passedDefaultNativeTabs.status, "warnings")
ok(passedDefaultNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-floating-style" && item.status === "pass" && item.message.includes("default THIN")))

const explicitDefaultNativeTabs = structuredClone(defaultNativeTabs)
explicitDefaultNativeTabs.signals.uiMaterial = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:1"] }
explicitDefaultNativeTabs.signals.systemMaterial = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
explicitDefaultNativeTabs.signals.nativeTabsFloatingMaterial = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
explicitDefaultNativeTabs.signals.materialSupported = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:5"] }
const passedExplicitDefaultNativeTabs = verifyInspection(explicitDefaultNativeTabs, compatibility26, "arkui")
equal(passedExplicitDefaultNativeTabs.status, "warnings")
ok(passedExplicitDefaultNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-floating-style" && item.message.includes("Explicit")))

const disabledNativeTabs = structuredClone(explicitDefaultNativeTabs)
disabledNativeTabs.modules[0].applicationMaterialState = "disable"
disabledNativeTabs.modules[0].effectiveApplicationMaterialState = "disable"
const failedDisabledNativeTabs = verifyInspection(disabledNativeTabs, compatibility26, "arkui")
equal(failedDisabledNativeTabs.status, "failed")
ok(failedDisabledNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-floating-style" && item.status === "fail"))

const invalidMaterialState = structuredClone(inspection26)
invalidMaterialState.modules[0].applicationMaterialState = "enabled"
invalidMaterialState.modules[0].effectiveApplicationMaterialState = "invalid"
const failedInvalidMaterialState = verifyInspection(invalidMaterialState, compatibility26, "arkui")
ok(failedInvalidMaterialState.checks.some((item) => item.id === "application-level-config" && item.status === "fail"))

const misplacedMaterialState = structuredClone(inspection26)
misplacedMaterialState.modules[0].type = "feature"
const failedMisplacedMaterialState = verifyInspection(misplacedMaterialState, compatibility26, "arkui")
ok(failedMisplacedMaterialState.checks.some((item) => item.id === "application-level-config" && item.status === "fail"))

const invalidNativeTabs = structuredClone(inspection26)
invalidNativeTabs.signals.verticalFalse = { detected: false, evidence: [] }
invalidNativeTabs.signals.barOverlapTrue = { detected: false, evidence: [] }
const failedNativeTabs = verifyInspection(invalidNativeTabs, compatibility26, "arkui")
equal(failedNativeTabs.status, "failed")
ok(failedNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-horizontal" && item.status === "fail"))
ok(failedNativeTabs.checks.some((item) => item.id === "arkui-native-tabs-overlap" && item.status === "fail"))

const missingArkuiScrollableTailClearance = structuredClone(inspection26)
missingArkuiScrollableTailClearance.signals.scrollableContent = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:10"] }
missingArkuiScrollableTailClearance.signals.contentEndOffset = { detected: false, evidence: [] }
missingArkuiScrollableTailClearance.signals.scrollTailSpacer = { detected: false, evidence: [] }
const warnedArkuiScrollableTailClearance = verifyInspection(missingArkuiScrollableTailClearance, compatibility26, "arkui")
equal(warnedArkuiScrollableTailClearance.status, "warnings")
ok(warnedArkuiScrollableTailClearance.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "warn"))
missingArkuiScrollableTailClearance.signals.scrollTailSpacer = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:30"] }
const detectedArkuiScrollableTailClearance = verifyInspection(missingArkuiScrollableTailClearance, compatibility26, "arkui")
equal(detectedArkuiScrollableTailClearance.status, "warnings")
ok(detectedArkuiScrollableTailClearance.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "warn"))

const pagePaddingOnly = structuredClone(missingArkuiScrollableTailClearance)
pagePaddingOnly.signals.scrollTailSpacer = { detected: false, evidence: [] }
pagePaddingOnly.signals.layoutBottomPadding = { detected: true, evidence: ["entry/src/main/ets/pages/Home.ets:20"] }
const pagePaddingResult = verifyInspection(pagePaddingOnly, compatibility26, "arkui")
ok(pagePaddingResult.checks.some((item) => item.id === "scrollable-tab-tail-clearance" && item.status === "warn" && item.message.includes("not page-level bottom padding")))

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
equal(hybridVerification26.status, "warnings")

const hdsOnlyInspection26 = structuredClone(hybridInspection26)
hdsOnlyInspection26.componentSystem.arkuiMaterial = false
hdsOnlyInspection26.componentSystem.arkuiNativeNavigation = false
hdsOnlyInspection26.signals.uiMaterial = { detected: false, evidence: [] }
hdsOnlyInspection26.signals.systemMaterial = { detected: false, evidence: [] }
hdsOnlyInspection26.signals.nativeNavigation = { detected: false, evidence: [] }
hdsOnlyInspection26.signals.nativeTabs = { detected: false, evidence: [] }
hdsOnlyInspection26.signals.nativeTabsFloatingStyle = { detected: false, evidence: [] }
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
ok(compatibilityUpgraded.fallbackRequirements.includes("sdkApiVersion-26-call-guard"))

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
missingProtection.signals.uiMaterial = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:1"] }
missingProtection.signals.systemMaterial = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
missingProtection.signals.nativeTabsFloatingMaterial = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Index.ets:20"] }
missingProtection.signals.materialSupported = { detected: false, evidence: [] }
missingProtection.signals.fallbackStyle = { detected: false, evidence: [] }
const failedVerification = verifyInspection(missingProtection, compatibility26, "arkui")
equal(failedVerification.status, "failed")
ok(failedVerification.checks.some((item) => item.id === "version-guard" && item.status === "not_applicable"))
ok(failedVerification.checks.some((item) => item.id === "capability-guard" && item.status === "fail"))
ok(failedVerification.checks.some((item) => item.id === "fallback-style" && item.status === "fail"))

const parameterRisks = structuredClone(explicitDefaultNativeTabs)
parameterRisks.signals.materialColor = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:10"] }
parameterRisks.signals.opaqueMaterialColor = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:10"] }
parameterRisks.signals.colorInvertTrue = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:11"] }
parameterRisks.signals.hardcodedForegroundColor = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:12"] }
parameterRisks.signals.customShadow = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:13"] }
parameterRisks.signals.applyShadowFalse = { detected: false, count: 0, evidence: [] }
parameterRisks.signals.backgroundBlurConflict = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:14"] }
parameterRisks.signals.lightEffectEnabled = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Risks.ets:15"] }
parameterRisks.signals.interactionFallback = { detected: false, count: 0, evidence: [] }
const warnedParameterRisks = verifyInspection(parameterRisks, compatibility26, "arkui")
for (const id of ["arkui-material-color-opacity", "arkui-color-invert-resource", "arkui-shadow-conflict", "arkui-background-blur-conflict", "arkui-light-effect-fallback"]) {
  ok(warnedParameterRisks.checks.some((item) => item.id === id && item.status === "warn"))
}

const outOfScopeMaterial = structuredClone(explicitDefaultNativeTabs)
outOfScopeMaterial.signals.nativeTabsFloatingMaterial = { detected: false, count: 0, evidence: [] }
outOfScopeMaterial.signals.outOfScopeMaterialLog = { detected: true, count: 1, evidence: ["hilog:1"] }
const failedOutOfScopeMaterial = verifyInspection(outOfScopeMaterial, compatibility26, "arkui")
ok(failedOutOfScopeMaterial.checks.some((item) => item.id === "arkui-material-effect-scope" && item.status === "fail"))

const confirmedOrdinaryContentMaterial = structuredClone(explicitDefaultNativeTabs)
confirmedOrdinaryContentMaterial.signals.nativeTabsFloatingMaterial = { detected: false, count: 0, evidence: [] }
confirmedOrdinaryContentMaterial.signals.navigationTitleMaterial = { detected: false, count: 0, evidence: [] }
confirmedOrdinaryContentMaterial.signals.allPageMaterialEntry = { detected: false, count: 0, evidence: [] }
confirmedOrdinaryContentMaterial.signals.nativeNavigation = { detected: false, count: 0, evidence: [] }
confirmedOrdinaryContentMaterial.signals.nativeTabs = { detected: false, count: 0, evidence: [] }
confirmedOrdinaryContentMaterial.signals.nativeTabsFloatingStyle = { detected: false, count: 0, evidence: [] }
confirmedOrdinaryContentMaterial.signals.ordinaryContentMaterialEntry = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Card.ets:10"] }
const failedOrdinaryContentMaterial = verifyInspection(confirmedOrdinaryContentMaterial, compatibility26, "arkui")
ok(failedOrdinaryContentMaterial.checks.some((item) => item.id === "arkui-material-effect-scope" && item.status === "fail"))

const unknownScopeMaterial = structuredClone(explicitDefaultNativeTabs)
unknownScopeMaterial.signals.nativeTabsFloatingMaterial = { detected: false, count: 0, evidence: [] }
unknownScopeMaterial.signals.navigationTitleMaterial = { detected: false, count: 0, evidence: [] }
unknownScopeMaterial.signals.allPageMaterialEntry = { detected: false, count: 0, evidence: [] }
const warnedUnknownScope = verifyInspection(unknownScopeMaterial, compatibility26, "arkui")
ok(warnedUnknownScope.checks.some((item) => item.id === "arkui-material-effect-scope" && item.status === "warn"))

const indexerDefault = structuredClone(inspection26)
indexerDefault.signals.alphabetIndexer = { detected: true, count: 1, evidence: ["Indexer.ets:10"] }
indexerDefault.signals.systemMaterial = { detected: false, count: 0, evidence: [] }
indexerDefault.signals.popupBackgroundConflict = { detected: false, count: 0, evidence: [] }
ok(verifyInspection(indexerDefault, compatibility26, "arkui").checks.some((item) => item.id === "arkui-alphabet-indexer-background-conflict" && item.status === "pass"))
indexerDefault.signals.popupBackgroundConflict = { detected: true, count: 1, evidence: ["Indexer.ets:12"] }
ok(verifyInspection(indexerDefault, compatibility26, "arkui").checks.some((item) => item.id === "arkui-alphabet-indexer-background-conflict" && item.status === "warn"))

const enabledSliderDefault = structuredClone(inspection26)
for (const id of ["nativeTabs", "nativeTabsFloatingStyle", "barOverlapTrue", "verticalFalse", "barPositionEnd"]) {
  enabledSliderDefault.signals[id] = { detected: false, count: 0, evidence: [] }
}
enabledSliderDefault.signals.sliderComponent = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Slider.ets:10"] }
const enabledSliderResult = verifyInspection(enabledSliderDefault, compatibility26, "arkui")
ok(enabledSliderResult.checks.some((item) => item.id === "arkui-material-entry" && item.status === "pass"))
const defaultSlider = structuredClone(enabledSliderDefault)
defaultSlider.modules[0].applicationMaterialState = null
defaultSlider.modules[0].effectiveApplicationMaterialState = "default"
const defaultSliderResult = verifyInspection(defaultSlider, compatibility26, "arkui")
ok(defaultSliderResult.checks.some((item) => item.id === "arkui-material-entry" && item.status === "fail"))

const defaultDialog = structuredClone(defaultSlider)
defaultDialog.signals.sliderComponent = { detected: false, count: 0, evidence: [] }
defaultDialog.signals.dialogComponent = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Dialog.ets:10"] }
defaultDialog.signals.componentBackgroundColor = { detected: false, count: 0, evidence: [] }
const defaultDialogResult = verifyInspection(defaultDialog, compatibility26, "arkui")
ok(defaultDialogResult.checks.some((item) => item.id === "arkui-material-entry" && item.status === "pass"))
ok(defaultDialogResult.checks.some((item) => item.id === "arkui-default-state-background-conflict" && item.status === "pass"))
defaultDialog.signals.componentBackgroundColor = { detected: true, count: 1, evidence: ["entry/src/main/ets/pages/Dialog.ets:11"] }
const warnedDefaultDialog = verifyInspection(defaultDialog, compatibility26, "arkui")
ok(warnedDefaultDialog.checks.some((item) => item.id === "arkui-default-state-background-conflict" && item.status === "warn"))

const lowCompatibleArkui = structuredClone(inspection26)
lowCompatibleArkui.api.compatible = 22
const lowCompatibleArkuiCompatibility = evaluateCompatibility(lowCompatibleArkui, profile)
lowCompatibleArkui.signals.sdkApiVersion26Guard = { detected: false, evidence: [] }
const unconfirmedArkuiCallGuard = verifyInspection(lowCompatibleArkui, lowCompatibleArkuiCompatibility, "arkui")
ok(unconfirmedArkuiCallGuard.checks.some((item) => item.id === "version-guard" && item.status === "warn"))
lowCompatibleArkui.signals.sdkApiVersion = { detected: true, evidence: ["commons/ImmersiveMaterialGuard.ets:40"] }
const constantArkuiCallGuard = verifyInspection(lowCompatibleArkui, lowCompatibleArkuiCompatibility, "arkui")
ok(constantArkuiCallGuard.checks.some((item) => item.id === "version-guard" && item.status === "warn" && item.evidence.includes("commons/ImmersiveMaterialGuard.ets:40")))
lowCompatibleArkui.signals.sdkApiVersion26Guard = { detected: true, evidence: ["entry/src/main/ets/pages/Index.ets:5"] }
const guardedArkuiCalls = verifyInspection(lowCompatibleArkui, lowCompatibleArkuiCompatibility, "arkui")
ok(guardedArkuiCalls.checks.some((item) => item.id === "version-guard" && item.status === "warn"))

const missingSdkInspection = await inspectProject(fixture23, { sdkPath: resolve(evalDir, "fixtures", "missing-sdk") })
equal(missingSdkInspection.localSdk.status, "invalid")
const missingSdkCompatibility = evaluateCompatibility(missingSdkInspection, profile)
equal(missingSdkCompatibility.status, "insufficient_context")
const autoSdkInspection = await inspectProject(fixture23)
equal(autoSdkInspection.localSdk.status, "valid")
equal(autoSdkInspection.localSdk.source, "local.properties:sdk.dir")

const cliInspection = run("inspect-project.mjs", ["--project", fixture23, "--sdk", sdk23])
for (const [inspection, compatibility, route] of [[inspection23, compatibility23, "hds"], [inspection26, compatibility26, "arkui"]]) {
  const duplicate = structuredClone(inspection)
  duplicate.signals.scrollableContent = { detected: true, evidence: ["BenefitPage.ets:140"] }
  duplicate.signals.contentEndOffset = { detected: true, evidence: ["CouponListSection.ets:196", "TaskListSection.ets:139"] }
  duplicate.signals.scrollTailSpacer = { detected: true, evidence: ["BenefitPage.ets:180"] }
  const result = verifyInspection(duplicate, compatibility, route)
  const tail = result.checks.find((v) => v.id === "scrollable-tab-tail-clearance")
  equal(tail.status, "warn")
  ok(tail.message.includes("may duplicate the same clearance"))
  ok(tail.message.includes("sibling Blank"))
  equal(tail.evidence.filter((v) => typeof v === "string").length, 4)
  duplicate.signals.scrollTailSpacer = { detected: false, evidence: [] }
  const single = verifyInspection(duplicate, compatibility, route).checks.find((v) => v.id === "scrollable-tab-tail-clearance")
  equal(single.status, "warn")
  ok(!single.message.includes("may duplicate the same clearance"))
}
await writeFile(versionProfilePath, versionProfile)
const paddingSourcePath = resolve(versionProject, "entry", "src", "main", "ets", "pages", "Index.ets")
for (const route of ["hds", "arkui"]) {
  const tabs = route === "hds" ? "HdsTabs" : "Tabs"
  for (const [scenario, source, expected] of [
    ["explicit-margin", `Column() { ${tabs}() {}.barOverlap(true).barFloatingStyle({ barBottomMargin: 28 }) }.padding({ bottom: windowBottomPadding })`, "warn"],
    ["default-margin", `Column() { ${tabs}() {}.barOverlap(true).barFloatingStyle({ adaptToHandedness: true }) }.padding({ bottom: windowBottomPadding })`, "warn"],
    ["normal-branch-only", `Column() { if (useFloatingTab) { ${tabs}() {}.barOverlap(true).barFloatingStyle({}) } else { Tabs() {} } }.padding({ bottom: useFloatingTab ? 0 : windowBottomPadding })`, "warn"],
    ["scroll-content", `${tabs}() { TabContent() { Scroll() { Column() { Text('content') }.padding({ bottom: tailClearance }) } } }.barOverlap(true).barFloatingStyle({})`, "warn"],
    ["other-layout", `Column() { ${tabs}() {}.barOverlap(true).barFloatingStyle({}) }.padding({ bottom: businessPanelSpace })`, "warn"],
    ["ordinary-tabs", "Tabs() {}.padding({ bottom: windowBottomPadding })", "not_applicable"],
    ["floating-without-padding", `${tabs}() {}.barOverlap(true).barFloatingStyle({})`, "not_applicable"]
  ]) {
    await writeFile(paddingSourcePath, source)
    const inspected = await inspectProject(versionProject, { sdkPath: sdk26 })
    const result = verifyInspection(inspected, evaluateCompatibility(inspected, profile), route)
    const spacing = result.checks.find((item) => item.id === "floating-tabs-bottom-spacing")
    equal(spacing.status, expected)
    equal(await readFile(paddingSourcePath, "utf8"), source)
    if (expected === "warn") ok(spacing.message.includes("Static coexistence does not prove a defect"))
  }
}
equal(cliInspection.api.compatible, 23)
const bottomExpansion = ".expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])"
const inventorySource = `
import { Chip as ProjectChip } from '@kit.ArkUI';
Navigation() {} NavDestination() {} Tabs() {} AlphabetIndexer({})
Button('ok') Select([]) Toggle({ type: ToggleType.Switch }) Slider({})
Chip({}) ProjectChip({}) ChipGroup({}) ChipGroupV2({}) SegmentButton({}) SegmentButtonV2({})
SelectionMenu({}) Text('copy').copyOption(CopyOptions.InApp)
promptAction.showToast({ message: 'notice' })
Text('popup').bindPopup(show, { message: 'help' })
Text('tips').bindTips({ message: 'tip' })
Column() {}.bindSheet(show, builder)
Text('menu').bindMenu(items).bindContextMenu(builder, ResponseType.LongPress)
AlertDialog.show({}) ActionSheet.show({}) CalendarPickerDialog.show({})
DatePickerDialog.show({}) TimePickerDialog.show({}) TextPickerDialog.show({})
new CustomDialogController({ builder: dialog })
const popup: PopupOptions = {}; const tips: TipsOptions = {}; const sheet: SheetOptions = {};
HdsTabs() {} HdsNavigation() {} HdsNavDestination() {}
// Button('comment').bindPopup(true, {})
/* Text('comment').bindSheet(true, builder) */
const example = "Button('text').bindPopup(true, {})";
`
await writeFile(paddingSourcePath, inventorySource)
const inventoried = (await inspectProject(versionProject, { sdkPath: sdk26 })).materialInventory
for (const id of inventoried.matrixComponents) ok(inventoried.candidates.some((c) => c.componentId === id))
equal(inventoried.candidates.filter((c) => c.componentId === "button").length, 1)
equal(inventoried.candidates.filter((c) => c.componentId === "chip").length, 2)
equal(inventoried.candidates.filter((c) => c.componentId === "popup").length, 2)
ok(inventoried.candidates.some((c) => c.componentId === "dialog-sheet" && c.entry.includes("bindSheet")))
ok(inventoried.candidates.some((c) => c.kind === "configuration-reference"))
equal(inventoried.candidates.filter((c) => c.route === "hds").length, 3)
ok(inventoried.unresolvedEntrypoints.length > 0)
ok(inventoried.candidates.every((c) => c.status === "pending" && c.path && c.line > 0))
await writeFile(paddingSourcePath, Array.from({ length: 27 }, (_, i) => `Text('${i}').bindPopup(show, { message: 'help' })`).join("\n"))
const manyCandidates = (await inspectProject(versionProject, { sdkPath: sdk26 })).materialInventory.candidates
equal(manyCandidates.filter((c) => c.componentId === "popup").length, 27)
equal(new Set(manyCandidates.map((c) => c.id)).size, manyCandidates.length)
ok(manyCandidates.some((c) => c.line === 27))
for (const [source, count, expected] of [
  ["HdsTabs() {}.barHeight('auto')", 1, "warn"],
  ['HdsTabs() {}.barHeight("auto")', 1, "warn"],
  ["HdsTabs() {}.barHeight(56)", 0, "pass"],
  ["HdsTabs() {}.barHeight(hidden ? 0 : 56)", 0, "pass"],
  ["HdsTabs() {}", 0, "warn"],
  ["HdsTabs() {}.barHeight(56) // .barHeight('auto')\n/* .barHeight(\"auto\") */", 0, "pass"],
  ["if (apiReady) { HdsTabs() {}.barHeight(56) } else { Tabs() {}.barHeight('auto') }", 1, "warn"],
  ["Tabs() {}.barHeight('auto')", 1, "not_applicable"]
]) {
  await writeFile(paddingSourcePath, source)
  const inspected = await inspectProject(versionProject, { sdkPath: sdk26 })
  equal(inspected.signals.barHeightAuto.count, count)
  const compatibility = evaluateCompatibility(inspected, profile)
  const result = verifyInspection(inspected, compatibility, "hds")
  equal(result.checks.find((v) => v.id === "floating-tabs-height").status, expected)
  ok(!verifyInspection(inspected, compatibility, "arkui").checks.some((v) => v.id === "floating-tabs-height"))
  equal(await readFile(paddingSourcePath, "utf8"), source)
}
for (const route of ["hds", "arkui"]) {
  const tabs = route === "hds" ? "HdsTabs" : "Tabs"
  const floating = `${tabs}({ barPosition: BarPosition.End }) {}.vertical( false ).barOverlap(true).barFloatingStyle({ barWidth: customWidth })`
  for (const [source, widthCount, directionCount, positionCount, status] of [
    [floating, 0, 0, 0, "warn"],
    [floating.replace("barWidth: customWidth", ""), 0, 0, 0, "warn"],
    [`${floating}.barWidth(oldWidth)`, 1, 0, 0, "warn"],
    [`if (apiReady) { ${floating} } else { Tabs({ barPosition: oldPosition }) {}.vertical(isLarge).barWidth(oldWidth) }`, 1, 1, 1, "warn"],
    [floating.replace(".vertical( false )", ".vertical(getDirection(breakpoint))"), 0, 1, 0, "warn"],
    [floating.replace("BarPosition.End", "isLarge ? BarPosition.Start : BarPosition.End"), 0, 0, 1, "warn"],
    [floating.replace("BarPosition.End", "BarPosition.End === position ? position : BarPosition.Start"), 0, 0, 1, "warn"],
    [`${floating}\n// .barWidth(oldWidth).vertical(true)\n/* barPosition: oldPosition */`, 0, 0, 0, "warn"],
    ["Tabs({ barPosition: oldPosition }) {}.vertical(isLarge).barWidth(oldWidth)", 1, 1, 1, "not_applicable"]
  ]) {
    await writeFile(paddingSourcePath, source)
    const inspected = await inspectProject(versionProject, { sdkPath: sdk26 })
    equal(inspected.signals.outerBarWidth.count, widthCount)
    equal(inspected.signals.tabDirectionCandidate.count, directionCount)
    equal(inspected.signals.tabPositionCandidate.count, positionCount)
    const result = verifyInspection(inspected, evaluateCompatibility(inspected, profile), route)
    const layout = result.checks.find((v) => v.id === "floating-tabs-width-and-breakpoints")
    equal(layout.status, status)
    if (status === "warn") ok(layout.message.includes("legacy API branch"))
    equal(await readFile(paddingSourcePath, "utf8"), source)
  }
}
for (const [source, transparentCount, maskCount, status, fragment] of [
  ["Tabs() {}.barOverlap(true).barFloatingStyle({ maskColor: Color.Transparent })", 1, 1, "pass", "transparent maskColor"],
  [`Tabs() {}.barOverlap(true).barFloatingStyle({ maskColor: '#00000000' })`, 1, 1, "pass", "transparent maskColor"],
  ["Tabs() {}.barOverlap(true).barFloatingStyle({ maskColor: Color.Gray })", 0, 1, "warn", "non-transparent maskColor"],
  ["Tabs() {}.barOverlap(true).barFloatingStyle({ barBottomMargin: 0 })", 0, 0, "warn", "Explicitly set maskColor"],
  ["Tabs() {}.barOverlap(true).barFloatingStyle({})", 0, 0, "warn", "Explicitly set maskColor"],
  ["HdsTabs() {}.barOverlap(true).barFloatingStyle({})", 0, 0, "not_applicable", null]
]) {
  await writeFile(paddingSourcePath, source)
  const inspected = await inspectProject(versionProject, { sdkPath: sdk26 })
  equal(inspected.signals.nativeTabsFloatingMaskTransparent.count, transparentCount)
  equal(inspected.signals.nativeTabsFloatingMaskColor.count, maskCount)
  const compatibility = evaluateCompatibility(inspected, profile)
  const result = verifyInspection(inspected, compatibility, "arkui")
  const mask = result.checks.find((v) => v.id === "arkui-native-tabs-mask-color")
  equal(mask.status, status)
  if (fragment) ok(mask.message.includes(fragment))
  ok(!verifyInspection(inspected, compatibility, "hds").checks.some((v) => v.id === "arkui-native-tabs-mask-color"))
  equal(await readFile(paddingSourcePath, "utf8"), source)
}
for (const route of ["hds", "arkui"]) {
  const tabs = route === "hds" ? "HdsTabs" : "Tabs"
  for (const [windowSource, trueCount, falseCount, callCount] of [
    ["await mainWindow.setWindowLayoutFullScreen(true);", 1, 0, 1],
    ["", 0, 0, 0],
    ["// windowClass.setWindowLayoutFullScreen(true);\n/* win.setWindowLayoutFullScreen(false); */", 0, 0, 0],
    ["function setFull(isFull: boolean) { win.setWindowLayoutFullScreen(isFull); }", 0, 0, 1],
    ["if (condition) { otherWindow.setWindowLayoutFullScreen(true); }", 1, 0, 1],
    ["win.setWindowLayoutFullScreen(true); win.setWindowLayoutFullScreen(false);", 1, 1, 2]
  ]) {
    for (const expandAncestors of [false, true]) {
      const source = `${windowSource}\nColumn() { ${tabs}() { TabContent() { Stack() { Scroll() { Text('content') }${bottomExpansion} }${expandAncestors ? bottomExpansion : ""} }${expandAncestors ? bottomExpansion : ""} }.barOverlap(true).barFloatingStyle({ barBottomMargin: 0 })${expandAncestors ? bottomExpansion : ""} }${expandAncestors ? bottomExpansion : ""}`
      await writeFile(paddingSourcePath, source)
      const inspected = await inspectProject(versionProject, { sdkPath: sdk26 })
      equal(inspected.signals.windowLayoutFullScreenTrue.count, trueCount)
      equal(inspected.signals.windowLayoutFullScreenFalse.count, falseCount)
      equal(inspected.signals.windowLayoutFullScreenCall.count, callCount)
      equal(inspected.signals.expandSystemBottom.count, expandAncestors ? 5 : 1)
      const result = verifyInspection(inspected, evaluateCompatibility(inspected, profile), route)
      equal(result.checks.find((v) => v.id === "floating-tabs-window-immersion").status, "warn")
      equal(await readFile(paddingSourcePath, "utf8"), source)
    }
  }
  await writeFile(paddingSourcePath, `Tabs() { TabContent() { Scroll() {}${bottomExpansion} } }`)
  const ordinary = await inspectProject(versionProject, { sdkPath: sdk26 })
  equal(verifyInspection(ordinary, evaluateCompatibility(ordinary, profile), route).checks.find((v) => v.id === "floating-tabs-window-immersion").status, "not_applicable")
}
equal(cliInspection.localSdk.status, "valid")
const cliCompatibility = run("check-compatibility.mjs", ["--project", fixture26, "--feature", "immersive-light", "--sdk", sdk26])
equal(cliCompatibility.recommendedRoute, "arkui")
equal(cliCompatibility.selectedRoutes.join(","), "arkui")
equal(cliCompatibility.sdk.routes.arkui.status, "supported")
const cliVerification = run("verify-integration.mjs", ["--project", fixture26, "--feature", "immersive-light", "--route", "auto", "--sdk", sdk26])
equal(cliVerification.status, "warnings")
const unknownFeature = run("check-compatibility.mjs", ["--project", fixture26, "--feature", "touch-to-share", "--sdk", sdk26], 2)
equal(unknownFeature.status, "error")

process.stdout.write(`${JSON.stringify({ status: "passed", assertions })}\n`)

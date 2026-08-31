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

const inspection23 = await inspectProject(fixture23)
equal(inspection23.model, "stage")
equal(inspection23.api.compatible, 23)
equal(inspection23.api.target, 23)
equal(inspection23.modules[0].type, "entry")
equal(inspection23.signals.hdsTabs.detected, true)
equal(inspection23.signals.barFloatingStyle.detected, true)
equal(inspection23.signals.adaptiveMaterial.detected, true)

const compatibility23 = evaluateCompatibility(inspection23, profile)
equal(compatibility23.status, "supported")
equal(compatibility23.recommendedRoute, "hds")
equal(compatibility23.availableRoutes.join(","), "hds")
equal(compatibility23.applicationLevel.eligible, false)
equal(compatibility23.upgradeOptions.map((option) => option.route).join(","), "arkui")
equal(compatibility23.upgradeOptions[0].upgradeTargetApi, 26)
equal(compatibility23.decisionRequired, true)
const verification23 = verifyInspection(inspection23, compatibility23, "auto")
equal(verification23.status, "passed")
equal(verification23.counts.fail, 0)

const inspection26 = await inspectProject(fixture26)
equal(inspection26.model, "stage")
equal(inspection26.api.compatible, 26)
equal(inspection26.api.target, 26)
equal(inspection26.modules[0].applicationMaterialState, "enable")
equal(inspection26.signals.uiMaterial.detected, true)
equal(inspection26.signals.systemMaterial.detected, true)
equal(inspection26.signals.apiAvailable26.detected, true)
equal(inspection26.signals.materialSupported.detected, true)

const compatibility26 = evaluateCompatibility(inspection26, profile)
equal(compatibility26.status, "supported")
equal(compatibility26.recommendedRoute, "arkui")
equal(compatibility26.availableRoutes.join(","), "hds,arkui")
equal(compatibility26.applicationLevel.eligible, true)
equal(compatibility26.upgradeOptions.length, 0)
equal(compatibility26.decisionRequired, true)
const verification26 = verifyInspection(inspection26, compatibility26, "auto")
equal(verification26.status, "passed")
equal(verification26.counts.fail, 0)

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

const upgradedTarget = structuredClone(inspection23)
upgradedTarget.api.compatible = 22
upgradedTarget.api.target = 26
const compatibilityUpgraded = evaluateCompatibility(upgradedTarget, profile)
equal(compatibilityUpgraded.status, "conditional")
equal(compatibilityUpgraded.recommendedRoute, "arkui")
equal(compatibilityUpgraded.availableRoutes.join(","), "hds,arkui")
equal(compatibilityUpgraded.upgradeOptions.length, 0)
equal(compatibilityUpgraded.decisionRequired, true)
ok(compatibilityUpgraded.missingConditions.some((item) => item.includes("runtime version guards")))

const lowTarget = structuredClone(inspection26)
lowTarget.api.target = 25
lowTarget.modules[0].type = "feature"
const compatibilityLowTarget = evaluateCompatibility(lowTarget, profile)
equal(compatibilityLowTarget.status, "conditional")
equal(compatibilityLowTarget.applicationLevel.eligible, false)
ok(compatibilityLowTarget.applicationLevel.reasons.some((item) => item.includes("target API 26")))
ok(compatibilityLowTarget.applicationLevel.reasons.some((item) => item.includes("entry module")))

const missingProtection = structuredClone(inspection26)
missingProtection.signals.apiAvailable26 = { detected: false, evidence: [] }
missingProtection.signals.materialSupported = { detected: false, evidence: [] }
missingProtection.signals.fallbackStyle = { detected: false, evidence: [] }
const failedVerification = verifyInspection(missingProtection, compatibility26, "arkui")
equal(failedVerification.status, "failed")
ok(failedVerification.checks.some((item) => item.id === "version-guard" && item.status === "fail"))
ok(failedVerification.checks.some((item) => item.id === "capability-guard" && item.status === "fail"))
ok(failedVerification.checks.some((item) => item.id === "fallback-style" && item.status === "fail"))

const cliInspection = run("inspect-project.mjs", ["--project", fixture23])
equal(cliInspection.api.compatible, 23)
const cliCompatibility = run("check-compatibility.mjs", ["--project", fixture26, "--feature", "immersive-light"])
equal(cliCompatibility.recommendedRoute, "arkui")
const cliVerification = run("verify-integration.mjs", ["--project", fixture26, "--feature", "immersive-light", "--route", "auto"])
equal(cliVerification.status, "passed")
const unknownFeature = run("check-compatibility.mjs", ["--project", fixture26, "--feature", "touch-to-share"], 2)
equal(unknownFeature.status, "error")

process.stdout.write(`${JSON.stringify({ status: "passed", assertions })}\n`)

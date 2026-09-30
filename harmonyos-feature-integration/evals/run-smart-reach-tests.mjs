import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { evaluateCompatibility, inspectProject, verifyInspection } from "../scripts/lib/project-tools.mjs"
import { verifyDevelopment } from "../scripts/verify-development.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = (name) => join(root, "evals/fixtures", name)
const profile = JSON.parse(await readFile(join(root, "references/features/smart-reach/profile.json"), "utf8"))
const sdk = fixture("sdk-api23")
const base = await inspectProject(fixture("smart-reach-api23"), { sdkPath: sdk })
const compat = (i) => evaluateCompatibility(i, profile)
const verify = (i, route = "auto") => verifyInspection(i, compat(i), route)
const has = (result, id, status) => result.checks.some((c) => c.id.includes(id) && c.status === status)
const mutate = (fn) => { const i = structuredClone(base); fn(i); return i }

assert.deepEqual(compat(base).availableRoutes, ["native-component", "operating-hand", "holding-hand"])
assert.deepEqual(compat(base).selectedRoutes, ["native-component", "holding-hand"])
assert.equal(compat(base).routeSelectionMode, "composable")
assert.equal(compat(base).recommendedRoute, null)
assert.equal(compat(base).decisionRequired, true)
assert.equal(verify(base).route, "composed")
assert.equal(verify(base).counts.fail, 0)
assert.ok(has(verify(base), "composition", "warn"))
assert.ok(has(verify(base), "version-guard", "warn"))
assert.ok(has(verify(base), "source-state", "warn"))
assert.doesNotMatch(JSON.stringify(verify(base).checks.map((c) => c.id)), /hds-material|easygo-|arkui-/)

for (const [api, expected] of [[14, []], [15, ["operating-hand"]], [19, ["operating-hand"]], [20, ["operating-hand", "holding-hand"]], [22, ["operating-hand", "holding-hand"]], [23, ["native-component", "operating-hand", "holding-hand"]]]) {
  for (const limiting of ["sdk", "compile", "both"]) {
    const i = mutate((v) => { if (limiting !== "compile") v.localSdk.apiVersion = api; if (limiting !== "sdk") v.api.compile = api; v.api.target = 14 })
    assert.deepEqual(compat(i).availableRoutes, expected)
    assert.equal(compat(i).status, expected.length ? "conditional" : "upgrade_available")
    assert.ok(compat(i).upgradeOptions.every((o) => o.upgradeTargetApi === null && o.keepCompatibleApi === 14))
  }
}
assert.equal(compat(mutate((i) => { i.localSdk.status = "missing" })).status, "insufficient_context")
assert.equal(compat(mutate((i) => { i.model = "fa" })).status, "unsupported")
assert.equal(compat(mutate((i) => { i.api.compile = "unknown" })).status, "insufficient_context")
assert.equal(compat(mutate((i) => { i.smartReach.records = [] })).status, "insufficient_context")
assert.ok(has(verify(base, "hds"), "eligibility", "fail"))
assert.ok(has(verify(mutate((i) => { i.localSdk.apiVersion = 20 })), "native-component-eligibility", "fail"), "Auto cannot silently omit an ineligible composed route")
assert.ok(has(verify(mutate((i) => { i.smartReach.records[0].permissions = [] }), "holding-hand"), "permission-", "fail"))
assert.ok(has(verify(mutate((i) => { i.smartReach.records[0].error = "invalid manifest" }), "holding-hand"), "permission-owner", "warn"))
assert.ok(has(verify(mutate((i) => { i.smartReach.usages = i.smartReach.usages.filter((u) => u.operation !== "off") }), "holding-hand"), "unsubscribe", "warn"))
assert.ok(has(verify(mutate((i) => { i.smartReach.usages.find((u) => u.operation === "off").callback = null }), "holding-hand"), "off-all", "warn"))
const native = verify(base, "native-component")
assert.equal(native.counts.fail, 0)
assert.ok(!native.checks.some((c) => /unsubscribe|permission-/.test(c.id)), "Native property does not require manual motion subscription or permission declaration")
assert.equal(verify(mutate((i) => { i.smartReach.records[0].permissions = [] }), "native-component").counts.fail, 0)
const noGuardNeeded = verify(mutate((i) => { i.api.compatible = 23 }), "holding-hand")
assert.ok(!has(noGuardNeeded, "version-guard", "warn"))

// File fixtures exercise real scanning, module ownership, aliases and non-production exclusions.
const work = await mkdtemp(join(tmpdir(), "smart-reach-tests-"))
const project = join(work, "project")
await cp(fixture("smart-reach-api23"), project, { recursive: true })
const page = join(project, "entry/src/main/ets/pages/Index.ets")
const manifest = join(project, "entry/src/main/module.json5")
const scan = () => inspectProject(project, { sdkPath: sdk })
await writeFile(page, `import { motion as sense } from '@kit.MultimodalAwarenessKit';
sense.on('operatingHandChanged', this.cb);
sense.off('operatingHandChanged', this.cb);
sense.getRecentOperatingHandStatus();`)
let inspected = await scan()
assert.deepEqual(compat(inspected).selectedRoutes, ["operating-hand"])
assert.equal(inspected.smartReach.usages.length, 3)
assert.ok(has(verify(inspected), "permission-api-", "warn"), "Gesture alone does not cover API 15–19")
await writeFile(manifest, `{module:{name:'entry',type:'entry',requestPermissions:[{name:'ohos.permission.ACTIVITY_MOTION',reason:'$string:gesture_reason',usedScene:{abilities:['EntryAbility'],when:'inuse'}}]}}`)
inspected = await scan()
assert.ok(has(verify(inspected), "permission-", "pass"))
assert.ok(!has(verify(inspected), "authorization", "warn"))
assert.ok(!has(verify(inspected), "permission-api-", "warn"))
assert.ok(has(verify(inspected), "permission-fields-", "pass"))
for (const route of ["operating-hand", "holding-hand"]) {
  const original = structuredClone(route === "operating-hand" ? inspected : base)
  for (const change of [
    (p) => { delete p.reason },
    (p) => { p.reason = "literal reason" },
    (p) => { delete p.usedScene },
    (p) => { p.usedScene.abilities = [] },
    (p) => { p.usedScene.abilities = [""] },
    (p) => { delete p.usedScene.when },
    (p) => { p.usedScene.when = "foreground" }
  ]) {
    const invalid = structuredClone(original)
    change(invalid.smartReach.records[0].permissionDeclarations[0])
    assert.ok(has(verify(invalid, route), "permission-fields-", "fail"))
  }
}

await writeFile(page, `import motion from '@ohos.multimodalAwareness.motion'; motion.getRecentOperatingHandStatus();`)
inspected = await scan()
assert.equal(inspected.smartReach.usages[0].operation, "query")
assert.ok(!verify(inspected).checks.some((c) => /unsubscribe/.test(c.id)))

await writeFile(manifest, `{module:{name:'entry',type:'entry'}}`)
await mkdir(join(project, "other/src/main"), { recursive: true })
await writeFile(join(project, "other/src/main/module.json5"), `{module:{name:'other',type:'feature',requestPermissions:[{name:'ohos.permission.ACTIVITY_MOTION',reason:'$string:gesture_reason',usedScene:{abilities:['EntryAbility'],when:'inuse'}}]}}`)
assert.ok(has(verify(await scan()), "permission-", "fail"), "Another HAP permission cannot satisfy the calling HAP")

await writeFile(page, `HdsTabs() {} // adaptToHandedness: true\n/* motion.on('holdingHandChanged', cb); */`)
await mkdir(join(project, "entry/src/ohosTest/ets"), { recursive: true })
await writeFile(join(project, "entry/src/ohosTest/ets/Test.ets"), `import { motion } from '@kit.MultimodalAwarenessKit'; motion.on('holdingHandChanged', cb);`)
inspected = await scan()
assert.deepEqual(inspected.smartReach.usages, [])
await writeFile(page, `import { motion } from '@kit.MultimodalAwarenessKit'; const log = "motion.on('holdingHandChanged', cb)"; const example = 'adaptToHandedness: true';`)
assert.deepEqual((await scan()).smartReach.usages, [], "Documentation strings are not implementation")
assert.deepEqual(compat(inspected).selectedRoutes, [])
assert.ok(has(verify(inspected), "route", "fail"))
await writeFile(page, `HdsTabs() {}.barFloatingStyle({adaptToHandedness: false})`)
inspected = await scan()
assert.deepEqual(compat(inspected).selectedRoutes, [])
assert.ok(has(verify(inspected, "native-component"), "implementation", "warn"))
await writeFile(page, `HdsTabs() {}.barFloatingStyle({adaptToHandedness: this.enabled})`)
assert.ok(verify(await scan(), "native-component").checks.some((c) => c.id.includes("enabled-") && c.status === "warn"))
await writeFile(page, `import { motion } from '@kit.MultimodalAwarenessKit'; motion.off('holdingHandChanged', cb);`)
assert.deepEqual(compat(await scan()).selectedRoutes, [])

const cli = (script, args) => {
  const run = spawnSync(process.execPath, [join(root, "scripts", script), ...args], { encoding: "utf8" })
  assert.equal(run.stderr, "")
  return { code: run.status, result: JSON.parse(run.stdout) }
}
const args = ["--project", fixture("smart-reach-api23"), "--sdk", sdk, "--feature", "smart-reach"]
assert.equal(cli("check-compatibility.mjs", args).result.status, "conditional")
assert.equal(cli("verify-integration.mjs", args).result.route, "composed")
assert.equal(cli("verify-integration.mjs", [...args, "--route", "holding-hand"]).code, 0)
assert.equal(cli("verify-integration.mjs", [...args, "--route", "hds"]).code, 2)
assert.equal(cli("validate-feature-package.mjs", ["--feature", "smart-reach"]).result.status, "valid")

const run = await verifyDevelopment({
  project: fixture("smart-reach-api23"), sdk, feature: "smart-reach", route: "holding-hand", goal: "侧边按钮跟随握持手", output: join(work, "report"),
  changes: { schemaVersion: "1.0", page: "pages/Index", component: "Button", category: "握持手感知", effect: "侧边按钮随有效左右手状态移动", files: ["entry/src/main/ets/pages/Index.ets"], before: { sdk: 23, compile: 23, target: 20, compatible: 14 }, fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原位置、业务和状态", status: "not_run" })) }
})
assert.equal(run.status, "inconclusive")
const report = await readFile(run.report, "utf8")
assert.match(report, /智感握姿接入汇总报告/)
assert.match(report, /握持手感知/)
assert.doesNotMatch(report, /沉浸光感|systemMaterialEffect|材质关闭/)
console.log("Smart Reach tests passed: scanning, API/permission gates, CLI and report")

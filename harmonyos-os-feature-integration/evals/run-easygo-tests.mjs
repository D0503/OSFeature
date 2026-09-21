#!/usr/bin/env node
import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { inspectProject, evaluateCompatibility, verifyInspection, loadFeature } from "../scripts/lib/project-tools.mjs"
import { readManifest } from "../scripts/lib/easygo-tools.mjs"
import { verifyDevelopment } from "../scripts/verify-development.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = (name) => join(root, "evals/fixtures", name)
const { profile } = await loadFeature(root, "easygo-parallel")
const inspect = (name, api) => inspectProject(fixture(name), { sdkPath: fixture(`sdk-api${api}`) })
const router = await inspect("easygo-router-api23", 23)
const navigation = await inspect("easygo-navigation-api26", 26)
const query = await inspect("easygo-navigation-api24", 24)
const compat = (i) => evaluateCompatibility(i, profile)
const verify = (i, route = "router") => verifyInspection(i, compat(i), route)
const has = (result, id, status) => result.checks.some((c) => c.id === `easygo-${id}` && (!status || c.status === status))
assert.equal(router.easyGo.records[0].reference, "$profile:parallel_config")
assert.ok(router.easyGo.records[0].configs[0].path.endsWith("parallel_config.json"))
assert.equal(compat(router).requiredApi, 23)
assert.equal(compat(router).recommendedRoute, "router")
assert.equal(compat(router).routeSelectionMode, "exclusive")
assert.deepEqual(compat(router).selectedRoutes, [])
assert.equal(compat(router).decisionRequired, true)
assert.equal(verify(router).counts.fail, 0)
assert.ok(has(verify(router), "runtime", "not_applicable"))
assert.equal(compat(navigation).requiredApi, 26)
assert.equal(verify(navigation, "navigation").counts.fail, 0)
assert.equal(compat(query).requiredApi, 24)
assert.ok(has(verify(query, "navigation"), "query-guard", "warn"))
assert.equal(compat(await inspect("easygo-navigation-api24", 23)).status, "upgrade_available")
assert.equal(compat(await inspect("easygo-navigation-api26", 23)).status, "upgrade_available")
const mutate = (fn, original = router) => { const i = structuredClone(original); fn(i); return i }
const options = (i) => i.easyGo.records[0].configs[0].value.common.displayModeOptions.routerSplitOptions
const invalid = (fn, id) => assert.ok(has(verify(mutate(fn)), id, "fail"), id)
const warn = (fn, id) => assert.ok(has(verify(mutate(fn)), id, "warn"), id)
assert.equal(compat(mutate((i) => { i.api.compile = 22 })).status, "upgrade_available")
assert.equal(compat(mutate((i) => { i.api.target = 12 })).status, "conditional", "No undocumented target API requirement")
assert.equal(compat(mutate((i) => { i.localSdk.status = "invalid" })).status, "insufficient_context")
assert.equal(compat(mutate((i) => { i.localSdk = null })).status, "insufficient_context")
assert.equal(compat(mutate((i) => { i.model = "fa" })).status, "unsupported")
assert.equal(compat(mutate((i) => { i.modules[0].type = "feature" })).status, "unsupported")
invalid((i) => { i.easyGo.records[0].moduleType = "feature" }, "entry")
invalid((i) => { i.easyGo.records[0].configs = [] }, "resource")
invalid((i) => { i.easyGo.records[0].reference = "../easy_go.json" }, "reference")
invalid((i) => { i.easyGo.records[0].configs[0].error = "malformed" }, "json")
invalid((i) => { i.easyGo.records[0].configs[0].value = [] }, "json")
invalid((i) => { delete i.easyGo.records[0].configs[0].value.common }, "common")
invalid((i) => { i.easyGo.records[0].configs[0].value.common.displayModeOptions.navigationSplitOptions = {} }, "exclusive")
invalid((i) => { options(i).fullScreenPages = ["pages/Index"] }, "page-conflict")
invalid((i) => { options(i).homePage = "pages/Missing" }, "page-missing")
invalid((i) => { delete options(i).homePage; options(i).relatedPage = "pages/Details" }, "related")
invalid((i) => { options(i).homeNavigationId = "not-router" }, "navigation-only")
invalid((i) => { options(i).enableReducedContainerSize = "true" }, "type")
invalid((i) => { options(i).mode = 2 }, "mode")
invalid((i) => { options(i).pagePairs = [{ from: "pages/Index" }] }, "pairs")
invalid((i) => { options(i).wideSplit = { ratio: "1:1" } }, "ratio")
invalid((i) => { options(i).splitDividerColor = { light: "#ffffff" } }, "color")
warn((i) => { i.easyGo.records[0].pages = null }, "page-unresolved")
warn((i) => { options(i).wideSplit = { ratio: "4 | 1" } }, "ratio")
warn((i) => { options(i).wideSplit = { ratio: "1 | 1", isDraggable: true } }, "ratio")
warn((i) => { options(i).relatedPage = "pages/Details" }, "related-parameters")
const overrides = mutate((i) => {
  i.easyGo.records[0].configs[0].value.tablet = { displayModeOptions: { wideWindowMode: "original", squareWindowMode: "original" } }
})
assert.equal(verify(overrides).counts.fail, 0)
assert.ok(has(verify(overrides), "override", "pass"))
invalid((i) => { i.easyGo.records[0].configs[0].value.phone = { displayModeOptions: { squareWindowMode: "original" } } }, "window-mode")
const enhanced = mutate((i) => {
  i.api.compile = 26; i.localSdk.apiVersion = 26
  Object.assign(options(i), { mode: 0, transPages: ["pages/Edit"], fullScreenPages: ["pages/Full"], wideSplit: { ratio: "1 | 2" }, splitDividerColor: { light: "#FF000000", dark: "#FFFFFFFF" }, enableInSplitScreen: true })
})
assert.equal(verify(enhanced).counts.fail, 0)
assert.equal(compat(enhanced).requiredApi, 26)
assert.ok(has(verify(navigation, "router"), "route-conflict", "fail"))
const dynamic = mutate((i) => { i.easyGo.records[0].configs[0].value.common.displayModeOptions.navigationSplitOptions.homePage = "DynamicDestination" }, navigation)
assert.ok(has(verify(dynamic, "navigation"), "page-unresolved", "warn"))
for (const i of [router, navigation, query]) {
  assert.doesNotMatch(JSON.stringify(compat(i)), /isImmersiveMaterialSupported|query-hds|check-device-material/)
  assert.ok(verify(i, i === router ? "router" : "navigation").checks.every((c) => c.id.startsWith("easygo-")))
}

for (const route of ["router", "navigation"]) {
  for (const api of [23, 26]) {
    const name = `${route}-${api === 26 ? "shopping-api26" : "api23"}.json`
    const config = JSON.parse(await readFile(join(root, "references/features/easygo-parallel/assets", name), "utf8"))
    const o = config.common.displayModeOptions[`${route}SplitOptions`]
    assert.equal(o.enableReducedContainerSize, true, `${name}: new integration default`)
    if (api === 26) assert.equal(o.drawableRectHook, true, `${name}: API 26 default`)
    else assert.equal(Object.hasOwn(o, "drawableRectHook"), false, `${name}: no API 26 field`)
    const i = mutate((i) => {
      i.api.compile = api; i.localSdk.apiVersion = api
      i.easyGo.records[0].configs[0].value = config
    }, route === "router" ? router : navigation)
    assert.equal(compat(i).requiredApi, api)
    assert.equal(verify(i, route).counts.fail, 0, `${name}: usable configuration`)
    const explicitFalse = structuredClone(i)
    const chosen = explicitFalse.easyGo.records[0].configs[0].value.common.displayModeOptions[`${route}SplitOptions`]
    chosen.enableReducedContainerSize = false
    if (api === 26) chosen.drawableRectHook = false
    assert.equal(verify(explicitFalse, route).counts.fail, 0, `${name}: false is valid`)
    assert.equal(chosen.enableReducedContainerSize, false, "Verification must not overwrite user choice")
    if (api === 26) assert.equal(chosen.drawableRectHook, false)
  }
}
// Isolate drawableRectHook from shopping mode so its version gate is tested independently.
for (const value of [true, false]) {
  const hook = mutate((i) => { options(i).drawableRectHook = value })
  assert.equal(compat(hook).requiredApi, 26)
  assert.equal(compat(hook).status, "upgrade_available")
  assert.ok(has(verify(hook), "route", "fail"))
  hook.api.compile = 26; hook.localSdk.apiVersion = 26
  assert.equal(verify(hook).counts.fail, 0)
  delete options(hook).drawableRectHook
  hook.api.compile = 23; hook.localSdk.apiVersion = 23
  assert.equal(compat(hook).requiredApi, 23)
  assert.equal(verify(hook).counts.fail, 0, "Keeping API 23 remains supported")
}
for (const [i, route, hook] of [[router, "router", false], [query, "navigation", false], [navigation, "navigation", true]]) {
  const o = i.easyGo.records[0].configs[0].value.common.displayModeOptions[`${route}SplitOptions`]
  assert.equal(o.enableReducedContainerSize, true)
  assert.equal(Object.hasOwn(o, "drawableRectHook"), hook)
  if (hook) assert.equal(o.drawableRectHook, true)
}

assert.equal(readManifest("{module: { easyGo: '$profile:custom',}, // comment\n value: null}").value, null)
assert.throws(() => readManifest("{module: {easyGo: 'a', easyGo: 'b'}}"), /Duplicate/)
assert.throws(() => readManifest("{module: process.exit()}"), /Unsupported/)
const work = await mkdtemp(join(tmpdir(), "easygo-tests-"))
const project = join(work, "project")
await cp(fixture("easygo-router-api23"), project, { recursive: true })
const manifest = join(project, "entry/src/main/module.json5")
await writeFile(manifest, "{module:{name:'entry',type:'entry',abilities:[{easyGo:'$profile:parallel_config'}]}}")
let scanned = await inspectProject(project, { sdkPath: fixture("sdk-api23") })
assert.ok(has(verify(scanned), "configuration", "fail"), "Nested easyGo must not count as module.easyGo")
await writeFile(manifest, "{module:{name:'entry',type:'entry',easyGo:'$profile:parallel_config'}}")
const localized = join(project, "entry/src/main/resources/tablet/profile")
await mkdir(localized, { recursive: true })
await writeFile(join(localized, "parallel_config.json"), JSON.stringify({ common: { displayModeOptions: { wideWindowMode: "routerSplit", routerSplitOptions: { mode: 0 } } } }))
scanned = await inspectProject(project, { sdkPath: fixture("sdk-api23") })
assert.equal(scanned.easyGo.records[0].configs.length, 2)
assert.equal(compat(scanned).requiredApi, 26, "Resource variants must not bypass field version checks")

const cli = spawnSync(process.execPath, [join(root, "scripts/verify-integration.mjs"), "--project", fixture("easygo-router-api23"), "--feature", "easygo-parallel", "--route", "router", "--sdk", fixture("sdk-api23")], { encoding: "utf8" })
assert.equal(cli.status, 0, cli.stdout + cli.stderr)
assert.equal(JSON.parse(cli.stdout).featureId, "easygo-parallel")
const badCli = spawnSync(process.execPath, [join(root, "scripts/verify-integration.mjs"), "--project", fixture("easygo-router-api23"), "--feature", "easygo-parallel", "--route", "hds"], { encoding: "utf8" })
assert.equal(badCli.status, 2)

const request = {
  project: fixture("easygo-router-api23"), feature: "easygo-parallel", route: "router", goal: "主页分栏", sdk: fixture("sdk-api23"), output: join(work, "report"),
  changes: { schemaVersion: "1.0", page: "pages/Index", component: "Router", category: "导航模式", effect: "entry 已配置 Router 分栏，运行效果待验证", files: ["entry/src/main/module.json5"], before: { sdk: 23, compile: 23, target: 23, compatible: 23 }, fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原路由及状态", status: "not_run" })) }
}
const run = await verifyDevelopment(request)
assert.equal(run.status, "inconclusive")
const report = await readFile(run.report, "utf8")
assert.match(report, /平行视界接入汇总报告/)
assert.match(report, /Router/)
assert.match(report, /导航模式/)
assert.match(report, /特性关闭/)
assert.doesNotMatch(report, /沉浸光感|HDS|材质关闭/)
await assert.rejects(verifyDevelopment({ ...request, route: "hds", output: join(work, "invalid-route") }), /route/)
console.log("EasyGo tests passed: scanning, API 23/24/26, configuration, exclusivity, CLI and report")

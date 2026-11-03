import assert from "node:assert/strict"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { applyJudgment, detectDeviceKind, verifyDevelopment } from "../scripts/verify-development.mjs"
import { cacheDirectory, exists, fileHash, loadCollection, saveReport } from "../scripts/lib/development-report.mjs"
import { evaluateCompatibility, inspectProject, loadFeature } from "../scripts/lib/project-tools.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const work = await mkdtemp(join(tmpdir(), "feature-executor-regression-"))
const fixture = (name) => join(root, "evals/fixtures", name)
const output = join(work, "report"), project = fixture("easygo-router-api23")
try {
  const { profile } = await loadFeature(root, "easygo-parallel")
  const inspection = await inspectProject(project, { sdkPath: fixture("sdk-api23") })
  const compatibility = evaluateCompatibility(inspection, profile)
  assert.equal(compatibility.sdk.routes.router.minApi, 23)
  assert.equal(compatibility.sdk.routes.router.requiredApi, 23)
  assert.equal(compatibility.sdk.routes.router.apiSatisfied, true)
  const changes = {
    schemaVersion: "1.0", page: "Index", component: "Router", category: "分栏", effect: "配置分栏",
    files: ["entry/src/main/module.json5"], before: { sdk: 23, compile: 23, target: 23, compatible: 23 },
    fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原业务", status: "not_run" }))
  }
  const request = { project, feature: "easygo-parallel", route: "router", goal: "分栏", sdk: fixture("sdk-api23"), output, changes }
  await verifyDevelopment(request)
  let { collection, directory } = await loadCollection(output, project)
  assert.equal(collection.runs[0].checks.fallback.status, "not_applicable", "基础 API23 且 compatible23 无低版本分支")
  for (const [compatible, requiredApi, expected] of [[22, 23, "not_run"], [23, 24, "not_run"], [24, 24, "not_applicable"]]) {
    const adjusted = structuredClone(inspection)
    adjusted.api.compatible = compatible
    await verifyDevelopment(request, { inspector: async () => ({ inspection: adjusted, compatibility: { ...compatibility, sdk: { ...compatibility.sdk, routes: { router: { minApi: 23, requiredApi } } } }, staticResult: { counts: { fail: 0 }, checks: [] } }) })
    const state = await loadCollection(output, project)
    assert.equal(state.collection.runs[0].checks.fallback.status, expected)
  }

  for (const [data, expected] of [[undefined, "unknown"], [{ name: "Phone" }, "unknown"], [{ kind: "device" }, "physical"], [{ connectType: "USB" }, "physical"], [{ isEmulator: false }, "physical"], [{ kind: "emulator", connectType: "USB" }, "emulator"], [{ isEmulator: true, kind: "device" }, "emulator"]]) assert.equal(detectDeviceKind(data, "target"), expected)
  assert.equal(detectDeviceKind({ kind: "device" }, "127.0.0.1:1234"), "emulator")

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
  const screenshot = join(work, "target.png")
  await writeFile(screenshot, png)
  const evidence = { id: "E1", type: "screenshot", purpose: "target", path: screenshot, sha256: await fileHash(screenshot) }
  const baseRun = { runId: "smart", goal: "握姿", feature: "smart-reach", device: "phone", checks: Object.fromEntries(["build", "install", "navigation"].map((key) => [key, { status: "passed" }])), evidence: [evidence], changes: structuredClone(changes) }
  for (const deviceInfo of [{ name: "未知设备" }, { kind: "emulator" }]) {
    for (const level of ["runtime", "visual"]) await assert.rejects(applyJudgment({ ...structuredClone(baseRun), deviceKind: "physical", deviceInfo }, { schemaVersion: "1.0", runId: "smart", goal: "握姿", [level]: { status: "passed", summary: "观察", evidence: [{ id: evidence.id, sha256: evidence.sha256 }] } }), /已确认的真机/)
  }
  const physicalRun = { ...structuredClone(baseRun), deviceKind: "physical", deviceInfo: { kind: "device" } }
  await applyJudgment(physicalRun, { schemaVersion: "1.0", runId: "smart", goal: "握姿", visual: { status: "passed", summary: "实际观察", evidence: [{ id: evidence.id, sha256: evidence.sha256 }] } })
  assert.equal(physicalRun.checks.visual.status, "passed")

  const unknownRequest = { ...request, feature: "smart-reach", route: "holding-hand", output: join(work, "unknown-smart"), importScreenshot: [screenshot] }
  await assert.rejects(verifyDevelopment(unknownRequest, { inspector: async () => ({ inspection, compatibility: { availableRoutes: ["holding-hand"] }, staticResult: { counts: { fail: 0 }, checks: [] } }) }), /已确认的真机/)

  const captureOutput = join(work, "capture")
  const captureOptions = {
    inspector: async () => ({ inspection, compatibility, staticResult: { counts: { fail: 0 }, checks: [] } }),
    deploymentDiscoverer: async () => ({ modules: [] }), deploymentPlanner: async () => ({ modules: [] }),
    deploymentRunner: async () => ({ plan: {}, launchArgs: [] }),
    buildRunner: async () => ({ exitCode: 0, stdout: "fixture build" }),
    commandRunner: async (args) => {
      if (args[1] === "screenshot") await writeFile(args[args.indexOf("--path") + 1], Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]))
      return { exitCode: 0, stdout: args[0] === "device" ? JSON.stringify({ name: "未知身份设备" }) : args[1] === "layout" ? JSON.stringify({ id: "target-page" }) : "", stderr: "" }
    }, pause: async () => {}
  }
  const captureRequest = { ...request, output: captureOutput, executeBuild: true, executeRun: true, device: "phone", captureScreenshot: true, navigate: { schemaVersion: "1.0", steps: [{ stepId: "target", action: "wait", timeoutMs: 1, expectPage: { by: "id", value: "target-page" } }] } }
  const captured = await verifyDevelopment(captureRequest, captureOptions)
  assert.ok(captured.evidence.find((e) => e.type === "screenshot").path.endsWith(".jpg"), "CLI 返回 JPEG 时自动采集与报告均使用 JPG")
  const smartCaptured = await verifyDevelopment({ ...captureRequest, feature: "smart-reach", route: "holding-hand", output: join(work, "smart-capture") }, { ...captureOptions, inspector: async () => ({ inspection, compatibility: { availableRoutes: ["holding-hand"] }, staticResult: { counts: { fail: 0 }, checks: [] } }) })
  assert.ok(!smartCaptured.evidence.some((e) => e.type === "screenshot"), "未知身份的握姿设备不采集目标截图")
  await assert.rejects(verifyDevelopment({ project, output: join(work, "smart-capture"), resume: smartCaptured.runId, captureScreenshot: true, screenshotScenario: "左手" }, captureOptions), /已确认的真机/)

  const review = join(work, "review.json")
  await writeFile(review, "{}")
  for (const format of [[], ["--format", "json"]]) {
    const result = spawnSync(process.execPath, [join(root, "scripts/audit-compatibility.mjs"), "--project", join(work, "missing"), "--review", review, ...format], { encoding: "utf8" })
    assert.equal(result.status, 2)
    assert.match(result.stdout, /--review requires --format markdown/, "先验证参数，不扫描工程或丢弃 review")
  }
  const validReview = spawnSync(process.execPath, [join(root, "scripts/audit-compatibility.mjs"), "--project", project, "--sdk", fixture("sdk-api23"), "--format", "markdown", "--review", review], { encoding: "utf8" })
  assert.equal(validReview.status, 0, validReview.stdout + validReview.stderr)

  // Migrate an old .png-named JPEG, preserve PNG, then remove only unreferenced images.
  const jpeg = join(work, "legacy.png")
  await writeFile(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]))
  const jpegHash = await fileHash(jpeg)
  const legacyPath = join(output, "evidence", `${jpegHash}.png`)
  await mkdir(dirname(legacyPath), { recursive: true })
  await copyFile(jpeg, legacyPath)
  await writeFile(join(output, "integration-report.md"), `<img src="evidence/${jpegHash}.png" alt="目标页面截图" width="270" />`)
  const run = collection.runs[0]
  delete run.featureName
  run.feature = "float-view-ball"
  run.evidence.push({ id: "J1", type: "screenshot", sha256: jpegHash, path: legacyPath }, { ...evidence })
  const report = await saveReport(output, directory, collection)
  assert.match(await readFile(report, "utf8"), /闪控窗／球接入汇总报告/)
  assert.match(await readFile(report, "utf8"), new RegExp(`${jpegHash}\\.jpg`))
  assert.equal(await exists(legacyPath), false)
  const jpegEvidence = run.evidence.find((e) => e.id === "J1")
  assert.equal(await fileHash(jpegEvidence.path), jpegHash)
  assert.ok(jpegEvidence.path.endsWith(".jpg"))
  const legacyJpeg = jpegEvidence.path.replace(/\.jpg$/, ".jpeg")
  await copyFile(jpegEvidence.path, legacyJpeg)
  await writeFile(report, (await readFile(report, "utf8")).replace(`${jpegHash}.jpg`, `${jpegHash}.jpeg`))
  await saveReport(output, directory, collection)
  assert.equal(await exists(legacyJpeg), false, "旧 JPEG 扩展名附件也参与清理")
  const retainedPng = run.evidence.find((e) => e.id === "E1").path
  run.feature = "dlp-anti-peep"
  run.evidence = run.evidence.filter((e) => e.id !== "J1")
  await saveReport(output, directory, collection)
  assert.match(await readFile(report, "utf8"), /防窥保护接入汇总报告/)
  assert.equal(await exists(jpegEvidence.path), false, "不再引用的 JPG 被清理")
  assert.equal(await exists(retainedPng), true, "仍引用的 PNG 保留")
  console.log("Executor regression tests passed")
} finally {
  await rm(work, { recursive: true, force: true })
  await rm(cacheDirectory(output), { recursive: true, force: true })
  await rm(cacheDirectory(join(work, "unknown-smart")), { recursive: true, force: true })
  await rm(cacheDirectory(join(work, "capture")), { recursive: true, force: true })
  await rm(cacheDirectory(join(work, "smart-capture")), { recursive: true, force: true })
}

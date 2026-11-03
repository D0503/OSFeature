import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { inspectProject } from "../scripts/lib/project-tools.mjs"
import { applyJudgment, inspectVerification, verifyDevelopment } from "../scripts/verify-development.mjs"
import { cacheDirectory, fileHash, loadCollection } from "../scripts/lib/development-report.mjs"
import { moduleArtifactHashes, projectInputHash } from "../scripts/lib/verification-inputs.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const work = await mkdtemp(join(tmpdir(), "verification-context-"))
const project = join(work, "project"), output = join(work, "report")
try {
  await cp(join(root, "evals/fixtures/easygo-router-api23"), project, { recursive: true })
  const sdk = join(root, "evals/fixtures/sdk-api26"), configPath = join(project, "build-profile.json5")
  const config = JSON.parse(await readFile(configPath, "utf8"))
  config.app.compileSdkVersion = 26
  config.app.compatibleSdkVersion = 20
  config.app.products = [
    { name: "default", compileSdkVersion: 23, targetSdkVersion: 23 },
    { name: "modern", targetSdkVersion: 26 }
  ]
  await writeFile(configPath, JSON.stringify(config))
  let inspection = await inspectProject(project, { sdkPath: sdk, product: "modern" })
  assert.deepEqual(inspection.api, { compatible: 20, target: 26, compile: 26, compileSource: "build-profile" })
  assert.equal(inspection.product, "modern")
  await writeFile(join(project, "entry/build-profile.json5"), "{compileSdkVersion: 20, targetSdkVersion: 20}")
  assert.equal((await inspectProject(project, { sdkPath: sdk, product: "modern" })).api.compile, 26)
  assert.equal((await inspectProject(project, { sdkPath: sdk })).api.target, 23)
  assert.equal((await inspectVerification({ project, sdk, product: "modern", feature: "easygo-parallel", route: "router" })).inspection.api.target, 26)
  await assert.rejects(inspectProject(project, { sdkPath: sdk, product: "missing" }), /product/)
  config.app.products[1].compileSdkVersion = "invalid"
  await writeFile(configPath, JSON.stringify(config))
  assert.equal((await inspectProject(project, { sdkPath: sdk, product: "modern" })).api.compile, "unknown")
  delete config.app.products[1].compileSdkVersion
  delete config.app.compileSdkVersion
  await writeFile(configPath, JSON.stringify(config))
  assert.equal((await inspectProject(project, { sdkPath: sdk, product: "modern" })).api.compileSource, "local-sdk-default")
  config.app.compileSdkVersion = 26
  config.app.products[0].name = "legacy"
  await writeFile(configPath, JSON.stringify(config))
  await assert.rejects(inspectProject(project, { sdkPath: sdk }), /--product/)
  config.app.products[0].name = "default"
  await writeFile(configPath, JSON.stringify(config))
  for (const script of ["inspect-project.mjs", "check-compatibility.mjs", "verify-integration.mjs"]) {
    const args = [join(root, "scripts", script), "--project", project, "--sdk", sdk, "--product", "modern"]
    if (script !== "inspect-project.mjs") args.push("--feature", "easygo-parallel")
    const result = spawnSync(process.execPath, args, { encoding: "utf8" })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }

  const changes = { schemaVersion: "1.0", page: "Index", component: "Router", category: "split", effect: "split", files: ["entry/src/main/module.json5"], before: { sdk: 26, compile: 26, target: 26, compatible: 20 }, fallback: ["low-api", "unsupported", "disabled"].map(condition => ({ condition, behavior: "preserve", status: "not_run" })) }
  const request = { project, sdk, output, product: "modern", feature: "easygo-parallel", route: "router", goal: "split", changes }
  inspection = await inspectProject(project, { sdkPath: sdk, product: "modern" })
  const inspector = async () => ({ inspection, compatibility: { availableRoutes: ["router"] }, staticResult: { counts: { fail: 0 }, checks: [{ id: "guard", status: "warn", message: "review required" }] } })
  const a = await verifyDevelopment(request, { inspector })
  const b = await verifyDevelopment({ ...request, goal: "other", changes: { ...changes, page: "Other" } }, { inspector })
  const review = (runId, goal = "split") => ({ schemaVersion: "1.0", runId, goal, staticReview: { results: [{ id: "guard", status: "passed", note: "checked current code" }] } })
  await verifyDevelopment({ project, output, resume: a.runId, judgment: review(a.runId) })
  let state = (await loadCollection(output, project)).collection
  assert.equal(state.runs.find(r => r.runId === a.runId).checks.static.status, "passed")
  assert.equal(state.runs.find(r => r.runId === b.runId).checks.static.status, "inconclusive")
  await applyJudgment(state.runs[0], review(a.runId), state.runs)
  assert.equal(state.runs[1].staticFindings[0].review, undefined)
  const retry = await verifyDevelopment(request, { inspector })
  state = (await loadCollection(output, project)).collection
  assert.equal(state.runs.find(r => r.runId === retry.runId).staticFindings[0].review, undefined)
  const resume = { project, output, resume: retry.runId, judgment: review(retry.runId) }
  await verifyDevelopment(resume)
  const source = join(project, "entry/src/main/ets/pages/Index.ets"), original = await readFile(source)
  await writeFile(source, "changed source")
  await assert.rejects(verifyDevelopment(resume), /源码或配置已变化/)
  await writeFile(source, original)
  await unlink(source)
  await assert.rejects(verifyDevelopment(resume), /源码或配置已变化/)
  await writeFile(source, original)
  const extra = join(project, "entry/src/main/resources/new-resource.bin")
  await writeFile(extra, "new resource")
  await assert.rejects(verifyDevelopment(resume), /源码或配置已变化/)
  await unlink(extra)
  await writeFile(configPath, JSON.stringify({ ...config, app: { ...config.app, targetSdkVersion: 27 } }))
  await assert.rejects(verifyDevelopment(resume), /源码或配置已变化/)
  await writeFile(configPath, JSON.stringify(config))
  await verifyDevelopment(resume)

  const artifactDirectory = join(project, "entry/build/modern/outputs/default")
  await mkdir(artifactDirectory, { recursive: true })
  const artifact = join(artifactDirectory, "entry.hap")
  const buildRunner = async () => { await writeFile(artifact, "built package"); return { exitCode: 0 } }
  const built = await verifyDevelopment({ ...request, executeBuild: true }, { inspector, buildRunner, deploymentDiscoverer: async () => ({}), deploymentPlanner: async () => ({ modules: [{ path: artifact, sha256: await fileHash(artifact) }] }) })
  const builtResume = { project, output, resume: built.runId, judgment: review(built.runId) }
  await verifyDevelopment(builtResume)
  await writeFile(artifact, "different build")
  await assert.rejects(verifyDevelopment(builtResume), /构建产物已变化/)
  await unlink(artifact)
  await assert.rejects(verifyDevelopment(builtResume), /构建产物已变化或丢失/)
  await writeFile(artifact, "built package")
  assert.equal((await moduleArtifactHashes(project, { module: "entry", product: "modern" }, inspection.modules))[0].sha256, await fileHash(artifact))
  const moduleOutput = join(work, "module-report")
  const moduleRun = await verifyDevelopment({ ...request, output: moduleOutput, executeBuild: true, module: "entry" }, { inspector, buildRunner })
  await writeFile(artifact, "modified module package")
  await assert.rejects(verifyDevelopment({ project, output: moduleOutput, resume: moduleRun.runId, judgment: review(moduleRun.runId) }), /构建产物已变化/)
  await writeFile(artifact, "built package")
  const initialHash = await projectInputHash(project, output)
  await mkdir(output, { recursive: true })
  await writeFile(join(output, "input.json5"), "process data")
  await writeFile(join(artifactDirectory, "generated.ts"), "generated output")
  assert.equal(await projectInputHash(project, output), initialHash)
  assert.equal(await projectInputHash(project, work), initialHash, "位于工程之外的报告目录不能排除整个工程")
  await assert.rejects(projectInputHash(project, join(project, "entry")), /不得覆盖工程源码或模块目录/)
  const cache = join(cacheDirectory(output), "collection.json")
  state = JSON.parse(await readFile(cache, "utf8"))
  delete state.runs.find(r => r.runId === built.runId).inputHash
  await writeFile(cache, JSON.stringify(state))
  await assert.rejects(verifyDevelopment(builtResume), /缺少工程输入快照/)
  console.log("Verification context tests passed: product selection, run-scoped reviews, source/resource/config and artifact invalidation")
} finally {
  if (dirname(work) !== resolve(tmpdir())) throw new Error("Unexpected test temporary path")
  await rm(work, { recursive: true, force: true })
}

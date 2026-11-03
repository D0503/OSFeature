import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { evaluateCompatibility, inspectProject, loadFeature, verifyInspection } from "../scripts/lib/project-tools.mjs"
import { readJsonFile } from "../scripts/lib/json-file.mjs"
import { loadCollection } from "../scripts/lib/development-report.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const work = await mkdtemp(join(tmpdir(), "feature-input-boundaries-"))
try {
  const project = join(work, "project"), sdk = join(root, "evals/fixtures/sdk-api26")
  await cp(join(root, "evals/fixtures/api26-arkui"), project, { recursive: true })
  const manifest = join(project, "entry/src/main/module.json5")
  const { profile } = await loadFeature(root, "immersive-light")
  for (const [metadata, expected] of [
    ['// { name: "ohos.arkui.UIMaterial.state", value: "disable" }\n', "default"],
    ['/* { name: "ohos.arkui.UIMaterial.state", value: "disable" } */', "default"],
    ['/* name: "ohos.arkui.UIMaterial.state" */ { name: "other", value: "invalid" }', "default"],
    ['// { name: "ohos.arkui.UIMaterial.state", value: "disable" }\n { name: "ohos.arkui.UIMaterial.state", value: "enable" }', "enable"],
    ['/* { name: "ohos.arkui.UIMaterial.state", value: "disable" } */ { name: "ohos.arkui.UIMaterial.state", value: "default" }', "default"],
    ['{ name: "ohos.arkui.UIMaterial.state", value: "enable" }', "enable"],
    ['{ name: "ohos.arkui.UIMaterial.state", value: "enabled" }', "invalid"]
  ]) {
    await writeFile(manifest, `{ module: { name: "entry", type: "entry", metadata: [${metadata}] } }`)
    const inspection = await inspectProject(project, { sdkPath: sdk })
    assert.equal(inspection.modules[0].effectiveApplicationMaterialState, expected, metadata)
    const result = verifyInspection(inspection, evaluateCompatibility(inspection, profile), "arkui")
    assert.equal(result.checks.find(c => c.id === "application-level-config").status === "fail", expected === "invalid")
  }
  const input = join(work, "用户输入.json")
  await writeFile(input, '\uFEFF{"message":"内容"}')
  assert.deepEqual(await readJsonFile(input), { message: "内容" })
  await writeFile(input, '{"message":"plain"}')
  assert.deepEqual(await readJsonFile(input), { message: "plain" })
  await writeFile(input, '\uFEFF{"broken":')
  await assert.rejects(readJsonFile(input), error => error.message.includes(input) && /JSON/.test(error.message))
  const missing = join(work, "missing.json")
  await assert.rejects(readJsonFile(missing), error => error.message.includes(missing))

  const project23 = join(work, "project23"), output = join(work, "report")
  await cp(join(root, "evals/fixtures/easygo-router-api23"), project23, { recursive: true })
  await writeFile(join(project23, "entry/src/main/ets/pages/Index.ets"), "@Entry\n@Component\nstruct Index { build() { Text('fixture') } }\n")
  const changes = { schemaVersion: "1.0", page: "Index", component: "Router", category: "split", effect: "split", files: ["entry/src/main/module.json5"], before: { sdk: 23, compile: 23, target: 23, compatible: 23 }, fallback: ["low-api", "unsupported", "disabled"].map(condition => ({ condition, behavior: "preserve", status: "not_run" })) }
  const changesPath = join(work, "changes.json"), navPath = join(work, "navigate.json")
  const bom = async (path, value) => writeFile(path, "\uFEFF" + JSON.stringify(value))
  await bom(changesPath, changes)
  await bom(navPath, { schemaVersion: "1.0", steps: [{ stepId: "page", action: "wait", timeoutMs: 1, expectPage: { by: "id", value: "page" } }] })
  const run = (script, args) => spawnSync(process.execPath, [join(root, "scripts", script), ...args], { encoding: "utf8" })
  const initial = run("verify-development.mjs", ["--project", project23, "--feature", "easygo-parallel", "--route", "router", "--sdk", join(root, "evals/fixtures/sdk-api23"), "--goal", "split", "--changes", changesPath, "--navigate", navPath, "--output", output])
  assert.equal(initial.status, 0, initial.stderr)
  const result = JSON.parse(initial.stdout), saved = (await loadCollection(output, project23)).collection.runs[0]
  const warn = saved.staticFindings.find(f => f.status === "warn")
  assert.ok(warn)
  const judgment = join(work, "judgment.json")
  await bom(judgment, { schemaVersion: "1.0", runId: result.runId, goal: "split", staticReview: { results: [{ id: warn.id, status: "passed", note: "checked current fixture" }] } })
  const resumed = run("verify-development.mjs", ["--project", project23, "--resume", result.runId, "--judgment", judgment, "--output", output])
  assert.equal(resumed.status, 0, resumed.stderr)
  const manual = join(work, "manual.json")
  await bom(manual, {})
  const manualResult = run("verify-development.mjs", ["--project", project23, "--resume", result.runId, "--manual-evidence", manual, "--output", output])
  assert.match(manualResult.stderr, /手动证据必须绑定/)
  const review = join(work, "review.json")
  await bom(review, {})
  const auditArgs = ["--project", project23, "--sdk", join(root, "evals/fixtures/sdk-api23"), "--format", "markdown", "--review", review]
  const audit = run("audit-compatibility.mjs", auditArgs)
  assert.equal(audit.status, 0, audit.stdout + audit.stderr)
  for (const flag of ["--changes", "--navigate", "--judgment", "--manual-evidence"]) {
    const broken = run("verify-development.mjs", ["--project", project23, flag, input])
    assert.equal(broken.status, 2)
    assert.ok(broken.stderr.includes(input), broken.stderr)
  }
  await writeFile(review, "\uFEFF{")
  const brokenReview = run("audit-compatibility.mjs", auditArgs)
  assert.equal(brokenReview.status, 2)
  assert.ok(JSON.parse(brokenReview.stdout).error.includes(review))
  console.log("Input boundary tests passed: commented metadata, BOM user JSON and file-specific parse errors")
} finally {
  if (dirname(work) !== resolve(tmpdir())) throw new Error("Unexpected test temporary path")
  await rm(work, { recursive: true, force: true })
}

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import { writeFrozenSnapshot } from "../scripts/lib/fetch-official.mjs"
import { captureFileBaseline } from "../scripts/snapshot-project-files.mjs"
import { validateImplementation } from "../scripts/validate-implementation.mjs"

const digest = (s) => createHash("sha256").update(s).digest("hex")
const root = await mkdtemp(join(tmpdir(), "official-implementation-"))
let count = 0
const check = (condition, message) => { assert.ok(condition, message); count++ }
try {
  const project = join(root, "project"), frozenDirectory = join(root, "frozen")
  await mkdir(project)
  await writeFile(join(project, "Index.ets"), "old\nkeep\ntail")
  const baseline = await captureFileBaseline(project, ["Index.ets"])
  await writeFile(join(project, "Index.ets"), "new\nkeep\nchanged")
  const body = "API contract\nSample code"
  const page = { snapshotId: "api", officialUrl: "https://developer.huawei.com/consumer/cn/doc/test", title: "fixture", contentSha256: digest(body), contentMarkdown: body }
  const frozen = await writeFrozenSnapshot(frozenDirectory, [page])
  const criteria = { frozenAt: frozen.frozenAt, snapshots: frozen.snapshots, criteria: [{ id: "C01", snapshotId: "api", anchor: "API contract" }] }
  const source = { snapshotId: "api", lineStart: 1, lineEnd: 1, sha256: digest("API contract") }
  const review = { status: "passed", basis: "Index.ets implements the contract in the designated range" }
  const record = {
    developmentMode: "demo",
    requirements: [{ criteriaId: "C01", strength: "required", disposition: "implement", approach: "Implement with official API", sources: [source], review }],
    steps: [{ id: "S01", description: "Implement contract", status: "applied", locations: ["before", "after"].map((version) => ({ path: "Index.ets", version, lineStart: 1, lineEnd: 3 })), basis: [{ type: "criteria", criteriaId: "C01", reason: "API contract" }] }],
  }
  const validate = (implementation, extra = {}) => validateImplementation({ project, frozenDirectory, criteria, baseline, implementation, ...extra })
  check((await validate(record)).valid, "Demo without sample passes")
  for (const usage of ["adopted", "reference"]) {
    const demo = structuredClone(record)
    demo.requirements[0].samples = [{ usage, scope: "Material component only; remaining implementation follows API", source, keyPoints: [{ description: "Material API", adaptation: "Keep core call", review }] }]
    check((await validate(demo)).valid, `Demo ${usage} sample passes`)
    if (usage === "adopted") {
      delete demo.requirements[0].samples[0].keyPoints
      check(!(await validate(demo)).valid, "Adopted Demo key points required")
      demo.developmentMode = "existing_project"
      check((await validate(demo)).valid, "Existing project does not require sample structure")
    }
  }
  const plan = structuredClone(record)
  delete plan.steps[0].locations
  delete plan.requirements[0].review
  check((await validate(plan, { phase: "plan", baseline: null })).valid, "Plan does not require completed code or review")
  const badCases = [
    ["mode", (r) => { delete r.developmentMode }],
    ["snapshot", (r) => { r.requirements[0].sources[0].snapshotId = "missing" }],
    ["hash", (r) => { r.requirements[0].sources[0].sha256 = digest("wrong") }],
    ["line", (r) => { r.requirements[0].sources[0].lineEnd = 500 }],
    ["review", (r) => { r.requirements[0].review.status = "failed" }],
    ["unresolved", (r) => { r.requirements[0].review.status = "unresolved" }],
    ["same file uncovered", (r) => { r.steps[0].locations.forEach((loc) => { loc.lineEnd = 1 }) }],
    ["engineering bypass", (r) => { r.steps[0].basis = [{ type: "engineering_choice", reason: "Needed", constraint: "Existing architecture" }] }],
    ["false existing", (r) => { r.steps[0].status = "existing" }],
  ]
  for (const [label, mutate] of badCases) {
    const bad = structuredClone(record); mutate(bad)
    check(!(await validate(bad)).valid, `${label} rejected`)
  }
  const existing = structuredClone(record)
  existing.developmentMode = "existing_project"
  existing.steps[0].status = "existing"
  existing.steps[0].locations = existing.steps[0].locations.filter((loc) => loc.version === "after")
  const unchanged = await captureFileBaseline(project, ["Index.ets"])
  check((await validate(existing, { baseline: unchanged })).valid, "Existing code needs no artificial diff")
  for (const kind of ["added", "deleted"]) {
    const path = `${kind}.ets`
    if (kind === "deleted") await writeFile(join(project, path), "material")
    const fileBaseline = await captureFileBaseline(project, [path])
    if (kind === "added") await writeFile(join(project, path), "material")
    else await rm(join(project, path))
    const fileRecord = structuredClone(record)
    fileRecord.steps[0].locations = [{ path, version: kind === "added" ? "after" : "before", lineStart: 1, lineEnd: 1 }]
    check((await validate(fileRecord, { baseline: fileBaseline })).valid, `${kind} files do not require nonexistent code positions`)
  }
  check((await validate(record, { criteria: { ...criteria, strategy: "reuse" } })).valid, "Reused criteria retains source validation")
  await writeFile(join(frozenDirectory, "snapshots", "api.md"), "tampered")
  check(!(await validate(record)).valid, "Tampered full snapshot rejected")
  await writeFile(join(frozenDirectory, "snapshots", "api.md"), body)
  const paths = { criteria: join(root, "criteria.json"), implementation: join(root, "implementation.json"), baseline: join(root, "baseline.json") }
  for (const [key, value] of Object.entries({ criteria, implementation: record, baseline })) await writeFile(paths[key], JSON.stringify(value))
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/validate-implementation.mjs")
  const output = execFileSync(process.execPath, [script, "--project", project, "--criteria", paths.criteria, "--implementation", paths.implementation, "--baseline", paths.baseline, "--frozen", frozenDirectory, "--phase", "applied"], { encoding: "utf8", windowsHide: true })
  check(JSON.parse(output).valid, "CLI applied validation passes")
  console.log(`${count} implementation checks passed`)
} finally {
  if (dirname(root) === resolve(tmpdir()) && root.startsWith(join(resolve(tmpdir()), "official-implementation-"))) await rm(root, { recursive: true, force: true })
}

import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildStages, executeBuildStage, runHvigorBuild } from "../scripts/lib/hvigor-build.mjs"

const root = await mkdtemp(join(tmpdir(), "hvigor-build-tests-"))
const tools = { node: process.execPath, ohpm: join(root, "ohpm.cjs"), hvigor: join(root, "hvigor.cjs"), env: process.env }
const selection = { product: "custom", buildMode: "release", modules: [{ name: "entry", type: "entry" }, { name: "library", type: "har" }, { name: "shared", type: "shared" }] }
try {
  const stages = buildStages(tools, selection)
  assert.deepEqual(stages[0].args.slice(1), ["install", "--all"])
  for (const stage of stages.slice(1)) {
    assert.ok(stage.args.includes("--no-daemon"))
    assert.ok(stage.args.includes("product=custom"))
    assert.ok(stage.args.includes("buildMode=release"))
  }
  assert.ok(stages[2].args.includes("assembleApp"))
  for (const [module, task] of [["entry", "assembleHap"], ["library", "assembleHar"], ["shared", "assembleHsp"]]) {
    const stage = buildStages(tools, { ...selection, module })[2]
    assert.ok(stage.args.includes(task))
    assert.ok(stage.args.includes(`module=${module}@default`))
  }
  assert.throws(() => buildStages(tools, { ...selection, module: "missing" }))
  for (let failure = 0; failure < 3; failure++) {
    const calls = []
    const result = await runHvigorBuild(root, selection, { tools, runner: async (stage) => {
      calls.push(stage.name)
      return { exitCode: calls.length - 1 === failure ? 9 : 0, stdout: "fixture output" }
    } })
    assert.equal(result.exitCode, 9)
    assert.equal(calls.length, failure + 1)
    assert.equal(result.failedStage, stages[failure].name)
    assert.match(result.stdout, /fixture output/)
  }
  await writeFile(tools.ohpm, "console.log('installed')")
  await writeFile(tools.hvigor, "if (!process.argv.includes('--no-daemon')) process.exitCode=5; console.log(process.argv.slice(2).join(' '))")
  const success = await runHvigorBuild(root, selection, { tools })
  assert.equal(success.exitCode, 0)
  assert.match(success.stdout, /installed/)
  assert.match(success.stdout, /assembleApp/)
  assert.equal(await readFile(tools.hvigor, "utf8"), "if (!process.argv.includes('--no-daemon')) process.exitCode=5; console.log(process.argv.slice(2).join(' '))")
  const lock = join(root, ".hvigor", ".build-lock")
  await mkdir(lock)
  const locked = await runHvigorBuild(root, selection, { tools, runner: () => { throw new Error("must not execute") } })
  assert.equal(locked.exitCode, null)
  assert.match(locked.stdout, /构建锁/)
  const missing = await executeBuildStage({ command: join(root, "missing"), args: [] }, root, process.env, 1000)
  assert.equal(missing.exitCode, null)
  const timed = await executeBuildStage({ command: process.execPath, args: ["-e", "setInterval(()=>{},1000)"] }, root, process.env, 100)
  assert.equal(timed.exitCode, null)
  assert.match(timed.stderr, /超时/)
  console.log("ok - no-daemon stages, module tasks, failure short-circuit, lock, subprocess and timeout")
} finally {
  await rm(root, { recursive: true, force: true })
}

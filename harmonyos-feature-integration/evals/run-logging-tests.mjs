import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { openLog, outputRedactor, redact, executeLoggedCommand } from "../scripts/lib/skill-log.mjs"
import { verifyDevelopment } from "../scripts/verify-development.mjs"
import { cacheDirectory } from "../scripts/lib/development-report.mjs"
import { inspectProject } from "../scripts/lib/project-tools.mjs"

const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const root = await mkdtemp(join(tmpdir(), "skill-logging-中文-"))
const events = async (log) => (await readFile(log.metadata.events, "utf8")).trim().split("\n").map((line) => JSON.parse(line))
const run = (args) => new Promise((done, reject) => {
  const child = spawn(process.execPath, args, { windowsHide: true })
  let stdout = "", stderr = ""
  child.stdout.on("data", (data) => { stdout += data })
  child.stderr.on("data", (data) => { stderr += data })
  child.on("error", reject)
  child.on("close", (code) => done({ code, stdout, stderr }))
})
const delay = (ms) => new Promise((done) => setTimeout(done, ms))

// The temporary entry continues to resolve after migration, including another writer.
const log = openLog()
const original = log.metadata.directory
log.event({ stage: "recognition", source: "ai", status: "completed", summary: "命中特性" })
log.artifact("before-project.json", JSON.stringify({ result: "识别完成" }))
log.migrate(root)
assert.notEqual(log.metadata.directory, original)
assert.equal(openLog({ session: original }).metadata.directory, log.metadata.directory)
assert.equal((await events(log))[1].stage, "recognition")
const migratedEvidence = (await events(log)).find((e) => e.stage === "evidence")
assert.equal(JSON.parse(await readFile(join(log.metadata.directory, migratedEvidence.relativePath), "utf8")).result, "识别完成")

const blocked = join(root, "不可写工程")
await writeFile(blocked, "file instead of directory")
const fallback = openLog({ project: blocked })
assert.ok(!fallback.metadata.directory.startsWith(blocked))
fallback.event({ stage: "fallback", status: "completed" })
assert.ok((await events(fallback)).some((e) => e.stage === "fallback"))
const damaged = openLog({ project: root })
const damagedPath = damaged.metadata.events
await rename(damagedPath, `${damagedPath}.bak`)
await mkdir(damagedPath)
damaged.event({ stage: "write-recovery", status: "completed" })
assert.notEqual(damaged.metadata.events, damagedPath)
assert.ok((await events(damaged)).some((e) => e.stage === "write-recovery"))

// Multi-process appends must leave every JSON record and its timeline intact.
const worker = join(root, "writer.mjs")
await writeFile(worker, `import {openLog} from ${JSON.stringify(pathToFileURL(join(skill, "scripts/lib/skill-log.mjs")).href)};
const log=openLog({session:process.argv[2]});for(let i=0;i<40;i++)log.event({stage:"concurrent",status:"completed",index:i,worker:process.argv[3]});`)
const workers = await Promise.all(Array.from({ length: 4 }, (_, i) => run([worker, original, String(i)])))
assert.ok(workers.every((r) => r.code === 0), JSON.stringify(workers))
const concurrent = (await events(log)).filter((e) => e.stage === "concurrent")
assert.equal(concurrent.length, 160)
assert.equal(new Set(concurrent.map((e) => `${e.worker}:${e.index}`)).size, 160)
assert.equal((await readFile(log.metadata.timeline, "utf8")).split("\n").filter((l) => l.includes('"stage":"concurrent"')).length, 160)

let sanitized = ""
const redactor = outputRedactor((value) => { sanitized += value })
for (const part of ["ready\npa", "ssword=un", "ique-pass\nto", "ken: unique-token\n-----BEGIN PRIVATE ", "KEY-----\nunique-key\n-----END PRIVATE KEY-----\n正常输出\n"]) redactor.push(Buffer.from(part))
redactor.end()
assert.ok(sanitized.includes("正常输出"))
for (const secret of ["unique-pass", "unique-token", "unique-key"]) assert.ok(!sanitized.includes(secret), sanitized)
assert.equal(redact({ env: { PATH: "private" }, args: ["--token", "abc"], signing: { keyPassword: "xyz" } }).args[1], "[REDACTED]")
const jsonArtifact = log.artifact("redacted.json", JSON.stringify({ password: "secret-value", version: "6.1.0(23)" }))
assert.equal(JSON.parse(await readFile(jsonArtifact, "utf8")).version, "6.1.0(23)")
assert.ok(!(await readFile(jsonArtifact, "utf8")).includes("secret-value"))

const command = join(root, "long-command.mjs")
await writeFile(command, 'console.log("运行中");process.stderr.write("pass");setTimeout(()=>process.stderr.write("word=unique-command-secret\\n"),30);setTimeout(()=>{console.log("结束");process.exit(7)},1200)')
let ended = false
const commandPromise = executeLoggedCommand({ name: "live-test", command: process.execPath, args: [command] }, root, process.env, 10000, { log }).then((r) => { ended = true; return r })
let started
for (let i = 0; i < 80; i++) {
  started = (await events(log)).find((e) => e.stage === "live-test" && e.status === "started")
  if (started && (await readFile(join(log.metadata.directory, started.stdout), "utf8")).includes("运行中")) break
  await delay(10)
}
assert.equal(ended, false, "命令结束前可读取输出")
assert.ok((await readFile(join(log.metadata.directory, started.stdout), "utf8")).includes("运行中"))
const result = await commandPromise
assert.equal(result.exitCode, 7)
assert.ok(!(await readFile(join(log.metadata.directory, started.stderr), "utf8")).includes("unique-command-secret"))
assert.equal((await events(log)).find((e) => e.commandId === result.commandId && e.status === "failed").exitCode, 7)
const sleeper = join(root, "sleep.mjs")
await writeFile(sleeper, 'console.log("waiting");setInterval(()=>{},1000)')
const timeout = await executeLoggedCommand({ name: "timeout-test", command: process.execPath, args: [sleeper] }, root, process.env, 100, { log })
assert.equal(timeout.timedOut, true)
assert.ok((await events(log)).some((e) => e.commandId === timeout.commandId && e.status === "timeout"))
const interruptedPromise = executeLoggedCommand({ name: "interrupt-test", command: process.execPath, args: [sleeper] }, root, process.env, 10000, { log })
setTimeout(() => process.emit("SIGTERM"), 80)
assert.equal((await interruptedPromise).signal, "SIGTERM")
const missing = await executeLoggedCommand({ command: join(root, "missing-executable"), args: [] }, root, process.env, 1000, { log })
assert.equal(missing.exitCode, null)
assert.ok((await events(log)).some((e) => e.commandId === missing.commandId && e.status === "failed"))

// One integration session retains a failed gate, failed build, repair and new build.
const changes = { schemaVersion: "1.0", page: "首页", component: "Tabs", category: "材质", effect: "材质接入", files: ["Home.ets"], before: { sdk: 26, compile: 26, target: 26, compatible: 23 }, fallback: ["low-api", "unsupported", "disabled"].map((condition) => ({ condition, behavior: "保留原行为", status: "not_run" })) }
const request = { project: root, feature: "immersive-light", route: "arkui", goal: "首页材质", changes, executeBuild: true, logSession: log.metadata.directory }
const inspect = { inspection: { localSdk: { status: "valid", path: root, apiVersion: 26 }, api: { compile: 26, target: 26, compatible: 23 }, modules: [] }, compatibility: { availableRoutes: ["arkui"] }, staticResult: { counts: { fail: 0, warn: 0 }, checks: [] } }
let builds = 0
const gate = await verifyDevelopment(request, { inspector: async () => ({ ...inspect, compatibility: { availableRoutes: [], reason: "SDK 配置格式不匹配" } }), buildRunner: async () => { builds++; throw new Error("must not build") } })
assert.equal(builds, 0)
assert.equal(gate.status, "failed")
assert.ok((await events(log)).some((e) => e.stage === "sdk" && e.compatibility?.reason === "SDK 配置格式不匹配"))
const failed = await verifyDevelopment(request, { inspector: async () => inspect, buildRunner: async () => ({ exitCode: 1, stderr: "ERROR targetSdkVersion invalid" }) })
log.event({ stage: "repair", status: "completed", source: "ai", summary: "按 SDK schema 修正版本格式", runId: failed.runId, retryOf: failed.runId, files: ["build-profile.json5"] })
const success = await verifyDevelopment(request, { inspector: async () => inspect, buildRunner: async () => ({ exitCode: 0, stdout: "BUILD SUCCESSFUL" }) })
assert.equal(success.status, "inconclusive")
assert.equal(success.logging.sessionId, log.sessionId)
assert.ok((await events(log)).some((e) => e.stage === "retry" && e.previousRunId === failed.runId && e.runId === success.runId))
const png = join(root, "manual.png")
await writeFile(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"))
const manual = await verifyDevelopment({ project: root, resume: success.runId, importScreenshot: [png] })
assert.equal(manual.logging.sessionId, log.sessionId)
const markdown = await readFile(manual.report, "utf8")
assert.ok(markdown.includes(`logs/${log.sessionId}/session.log`))
assert.equal((markdown.match(/^## /gm) ?? []).length, 4, "不增加报告章节")
assert.match(markdown, /\| 验证阶段 \| 结果 \| 说明 \|\n\|---\|---\|---\|\n\| 静态检查 \|/, "日志链接不拆开阶段表格")

const legacyOutput = join(root, "legacy-output")
const legacy = await verifyDevelopment({ ...request, output: legacyOutput }, { inspector: async () => inspect, buildRunner: async () => ({ exitCode: 0, stdout: "legacy build" }) })
const legacyCache = join(cacheDirectory(legacyOutput), "collection.json")
const legacyCollection = JSON.parse(await readFile(legacyCache, "utf8"))
delete legacyCollection.runs[0].logging
await writeFile(legacyCache, JSON.stringify(legacyCollection))
const resumedLegacy = await verifyDevelopment({ project: root, output: legacyOutput, resume: legacy.runId, importScreenshot: [png] })
assert.notEqual(resumedLegacy.logging.sessionId, log.sessionId)
const legacyEvents = await events(openLog({ session: resumedLegacy.logging.directory }))
assert.ok(legacyEvents.some((e) => e.stage === "resume" && e.legacy && e.runId === legacy.runId))
assert.ok(!legacyEvents.some((e) => e.stage === "build" && e.status === "started"), "不补造历史构建")

// Persistent copies remain useful after temporary source evidence disappears.
for (const item of success.evidence) if (item.path.startsWith(cacheDirectory(join(root, "os-feature-integration")))) await unlink(item.path)
const persisted = await readdir(join(log.metadata.directory, "evidence"))
const contents = await Promise.all(persisted.filter((p) => !p.endsWith(".png")).map((p) => readFile(join(log.metadata.directory, "evidence", p), "utf8")))
assert.ok(contents.some((v) => v.includes("ERROR targetSdkVersion invalid")))
assert.ok(contents.some((v) => v.includes("BUILD SUCCESSFUL")))
assert.ok((await events(log)).some((e) => e.stage === "repair"))

const cli = join(skill, "scripts/skill-log.mjs")
const cliExec = await run([cli, "exec", "--log-session", log.metadata.directory, "--", process.execPath, "-e", "console.log('raw stdout');process.exit(9)"])
assert.equal(cliExec.code, 9)
assert.equal(cliExec.stdout, "raw stdout\n")
const bad = await run([join(skill, "scripts/inspect-project.mjs"), "--log-session", log.metadata.directory, "--wrong"])
assert.equal(bad.code, 2)
assert.ok(JSON.parse(bad.stdout).logging.directory)
const missingProject = join(root, "nonexistent-project")
const badProject = await run([join(skill, "scripts/inspect-project.mjs"), "--project", missingProject])
assert.equal(badProject.code, 2)
assert.ok(JSON.parse(badProject.stdout).logging.directory)
await assert.rejects(access(missingProject), "日志不能创建不存在的工程，改变原检查结果")
const finish = await run([cli, "finish", "--log-session", log.metadata.directory, "--status", "inconclusive", "--summary", "视觉验证未完成"])
assert.equal(finish.code, 0)
assert.equal(JSON.parse(finish.stdout).logging.sessionId, log.sessionId)

// Diagnostic JSON must not create false source matches.
await writeFile(join(root, "build-profile.json5"), '{"app":{"products":[{"name":"default","compileSdkVersion":26,"targetSdkVersion":26,"compatibleSdkVersion":23}]},"modules":[]}')
await mkdir(join(root, "os-feature-integration", "logs", "fake"), { recursive: true })
await writeFile(join(root, "os-feature-integration", "logs", "fake", "source.json"), '{"uiMaterial":"systemMaterialEffect","agentId":"fake"}')
const inspection = await inspectProject(root)
assert.ok(inspection.scan.skippedDirectories.includes("os-feature-integration"))
assert.ok(!JSON.stringify(inspection).includes("logs/fake/source.json"))
process.stdout.write(`${JSON.stringify({ status: "passed", suite: "logging" })}\n`)

#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { samePath, validateBuildDiagnosis } from "./lib/build-diagnosis.mjs"
import { validateDevelopmentReport } from "./validate-development-report.mjs"
import { renderDevelopmentReport } from "./render-development-report.mjs"

export async function recordBuildDiagnosis(reportPath, diagnosis) {
  if (basename(reportPath) !== "development-verification-report.json") throw new Error("请指定现有 development-verification-report.json")
  const original = await readFile(reportPath, "utf8")
  const collection = JSON.parse(original)
  const reports = collection.collectionVersion ? collection.reports : [collection]
  const matches = reports.filter((report) => report.checks?.build?.status === "failed" && (report.evidence ?? []).some((e) => e.type === "build_log" && samePath(e.path, diagnosis?.buildLog?.path) && e.sha256 === diagnosis?.buildLog?.sha256))
  if (matches.length !== 1) throw new Error("失败日志未唯一匹配报告条目")
  const report = structuredClone(matches[0])
  // Legacy failed reports may contain stale device observations; do not certify those as this attempt.
  for (const level of ["install", "runtime", "visual"]) report.checks[level] = { ...report.checks[level], status: "not_run", summary: "本轮构建失败，未执行有效设备验证。", evidenceRefs: [] }
  report.verdict = { ...report.verdict, status: "failed", matchedCriteriaRefs: [], summary: diagnosis.summary }
  report.buildDiagnosis = structuredClone(diagnosis)
  const errors = validateBuildDiagnosis(report)
  if (errors.length) throw new Error(errors.join("; "))
  for (const ref of [diagnosis.buildLog, ...diagnosis.evidence]) {
    const bytes = await readFile(ref.path)
    if (createHash("sha256").update(bytes).digest("hex") !== ref.sha256) throw new Error(`归因证据文件哈希不匹配: ${ref.path}`)
    if (ref.lineEnd !== undefined && ref.lineEnd > bytes.toString("utf8").split(/\r?\n/).length) throw new Error(`归因证据行范围超出文件: ${ref.path}`)
  }
  const validation = validateDevelopmentReport(report)
  if (!validation.valid) throw new Error(validation.errors.join("; "))
  if (await readFile(reportPath, "utf8") !== original) throw new Error("报告已变化，请针对最新失败重新记录归因")
  return await renderDevelopmentReport(report, dirname(resolve(reportPath)))
}

async function main() {
  const args = {}
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i], value = process.argv[i + 1]
    if (!["--report", "--diagnosis"].includes(key) || !value || value.startsWith("--")) throw new Error("用法：--report <现有报告> --diagnosis <归因JSON>")
    args[key.slice(2)] = value
  }
  const result = await recordBuildDiagnosis(args.report, JSON.parse(await readFile(args.diagnosis, "utf8")))
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2 })

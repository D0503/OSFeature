import { isAbsolute, resolve } from "node:path"

const text = (s) => typeof s === "string" && Boolean(s.trim())
const hash = (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s)
export const samePath = (a, b) => typeof a === "string" && typeof b === "string" && (process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b))
export const diagnosisDecisions = { unknown: "investigate_only", implementation_error: "repair_according_to_official", environment_issue: "resolve_prerequisites", official_documentation: "stop_repair" }

export function validateBuildDiagnosis(report, diagnosis = report?.buildDiagnosis) {
  const errors = []
  if (!diagnosis || typeof diagnosis !== "object") return ["缺少构建归因记录"]
  if (!Object.hasOwn(diagnosisDecisions, diagnosis.category) || diagnosis.decision !== diagnosisDecisions[diagnosis.category]) errors.push("归因分类与处理决定不匹配")
  if (!text(diagnosis.summary)) errors.push("归因结论不能为空")
  if (report?.checks?.build?.status !== "failed" || report?.verdict?.status !== "failed") errors.push("构建归因只能关联失败报告并保持 failed")
  const log = diagnosis.buildLog
  const matches = (report?.evidence ?? []).filter((e) => e.type === "build_log" && report.checks.build.evidenceRefs.includes(e.id) && e.exitCode !== 0 && samePath(e.path, log?.path) && e.sha256 === log?.sha256)
  if (!isAbsolute(log?.path ?? "") || !hash(log?.sha256) || matches.length !== 1) errors.push("失败日志路径与哈希未唯一匹配本轮构建")
  if (!Array.isArray(diagnosis.evidence)) return [...errors, "归因 evidence 必须是数组"]
  const candidates = [...(report.buildInputs ?? []), ...(report.evidence ?? []).filter((e) => e.type === "sdk_declaration")]
  for (const ref of diagnosis.evidence) {
    if (!["code", "official_source", "sdk_declaration"].includes(ref?.type) || !isAbsolute(ref?.path ?? "") || !hash(ref?.sha256)) { errors.push("归因证据类型、路径或哈希无效"); continue }
    if (!candidates.some((e) => e.type === ref.type && samePath(e.path, ref.path) && e.sha256 === ref.sha256)) errors.push("归因证据不属于本轮构建输入或 SDK 检查")
    if (!Number.isInteger(ref.lineStart) || ref.lineStart < 1 || !Number.isInteger(ref.lineEnd) || ref.lineEnd < ref.lineStart) errors.push("归因证据行范围无效")
  }
  if (diagnosis.category === "official_documentation") {
    for (const type of ["official_source", "code"]) if (!diagnosis.evidence.some((e) => e.type === type)) errors.push(`确认官网问题缺少 ${type} 证据`)
    if (typeof diagnosis.sdkComparisonRequired !== "boolean") errors.push("必须说明是否涉及接口或版本差异")
    if (diagnosis.sdkComparisonRequired && !diagnosis.evidence.some((e) => e.type === "sdk_declaration")) errors.push("接口或版本差异缺少对应 SDK 声明")
    for (const key of ["codeMatchesOfficial", "versionSatisfied", "configurationSatisfied"]) if (diagnosis.premises?.[key] !== true) errors.push(`官网问题确认前提未满足：${key}`)
    if (!text(diagnosis.premises?.basis)) errors.push("缺少官网前提核对说明")
  }
  for (const level of ["install", "runtime", "visual"]) if (report.checks?.[level]?.status !== "not_run") errors.push("本轮构建失败后的设备层必须保持 not_run")
  return errors
}

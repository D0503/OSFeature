export const WINDOW_PRIVACY_FEATURES = ["float-view-ball", "dlp-anti-peep"]

export function windowPrivacyScenarios(feature, route, inspection) {
  if (feature === "float-view-ball") {
    const scenarios = ["window-started", "content-updated", "window-stopped", "fallback-preserved", "device-support-confirmed"]
    if (route === "binding" || inspection.floatViewBall?.usages?.some((u) => u.operation === "bind")) scenarios.push("view-to-ball", "ball-to-view", "pair-stopped")
    return scenarios
  }
  if (feature === "dlp-anti-peep") {
    const scenarios = ["switch-checked", "hide-observed", "pass-observed", "fallback-preserved", "subscription-cleaned"]
    const operations = new Set(inspection.dlpAntiPeep?.usages?.map((usage) => usage.operation))
    if (operations.has("requestAntiPeepOptions")) scenarios.push("options-result-checked", "options-failure-handled")
    if (operations.has("publishAntiPeepInformation")) scenarios.push("information-published", "information-failure-handled")
    if (operations.has("passDlpAntiPeepInfo")) scenarios.push("explicit-pass-confirmed", "pass-duration-checked")
    if (route === "system-mask") {
      scenarios.push("mask-applied", "mask-failure-handled", "window-invalidated")
      if (inspection.floatViewBall?.usages?.some((u) => u.route === "float-view")) scenarios.push("float-view-protected", "target-window-invalidated")
    }
    return scenarios
  }
  return []
}

export function validateWindowPrivacyJudgment(run, level, item, evidence) {
  if (!WINDOW_PRIVACY_FEATURES.includes(run.feature) || item.status !== "passed") return
  if (level === "visual" && new Set(evidence.filter((e) => e.type === "screenshot").map((e) => e.sha256)).size < 2) throw new Error("窗球/防窥视觉通过需要前后状态至少两张不同截图")
  if (level !== "runtime") return
  if (!run.requiredRuntimeScenarios?.length) throw new Error("缺少窗球/防窥运行场景记录，请重新执行本轮验证")
  for (const scenario of run.requiredRuntimeScenarios) {
    const observation = item.observations?.find((v) => v.scenario === scenario)
    if (typeof observation?.note !== "string" || !observation.note.trim() || !observation.evidence?.length) throw new Error(`${scenario} 缺少运行观察说明或证据`)
    for (const ref of observation.evidence) if (!evidence.some((e) => e.id === ref.id && e.sha256 === ref.sha256 && ["runtime_log", "component_tree"].includes(e.type))) throw new Error(`${scenario} 必须引用本轮 runtime.evidence 中的日志或交互组件树`)
  }
}

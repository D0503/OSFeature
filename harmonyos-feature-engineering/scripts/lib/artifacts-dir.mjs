import { isAbsolute, join, resolve } from "node:path"

// 全部开发链路过程产物统一落在目标工程下的单一目录，避免散落在技能目录或工程根目录。
export const ARTIFACTS_DIR_NAME = "ohos-feature-engineering"

export function resolveArtifactsRoot(projectPath) {
  if (typeof projectPath !== "string" || !projectPath.trim()) {
    throw new Error("project 必须是非空路径")
  }
  const root = resolve(projectPath)
  if (!isAbsolute(root)) throw new Error("project 必须是绝对路径")
  return join(root, ARTIFACTS_DIR_NAME)
}

export function scenarioArtifactsDirectory(projectPath, scenarioId) {
  if (typeof scenarioId !== "string" || !/^[A-Za-z0-9_-]+$/.test(scenarioId)) {
    throw new Error("scenarioId 必须是合法目录名")
  }
  return join(resolveArtifactsRoot(projectPath), scenarioId)
}

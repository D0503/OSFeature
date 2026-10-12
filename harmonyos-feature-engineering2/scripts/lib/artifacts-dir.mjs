import { isAbsolute, join, resolve } from "node:path"

// 未显式指定路径时使用的兼容默认目录；skill 流程将过程产物写入本轮临时目录。
export const ARTIFACTS_DIR_NAME = "ohos-feature-engineering"

export function resolveArtifactsRoot(projectPath) {
  if (typeof projectPath !== "string" || !projectPath.trim()) {
    throw new Error("project 必须是非空路径")
  }
  const root = resolve(projectPath)
  if (!isAbsolute(root)) throw new Error("project 必须是绝对路径")
  return join(root, ARTIFACTS_DIR_NAME)
}

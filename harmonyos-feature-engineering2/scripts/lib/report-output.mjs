import { resolve } from "node:path"

export function resolveReportOutputDirectory(requested, openedWorkspaceDirectory = process.cwd()) {
  const workspace = resolve(openedWorkspaceDirectory)
  if (requested === undefined || requested === null) return workspace
  if (typeof requested !== "string" || !requested.trim()) throw new Error("输出目录必须是非空路径")
  return resolve(workspace, requested)
}

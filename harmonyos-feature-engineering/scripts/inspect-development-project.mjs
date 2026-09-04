#!/usr/bin/env node

import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadCapability, resolveScenario } from "./lib/capability-tools.mjs"
import { inspectDevelopmentProject } from "./lib/development-project.mjs"

function parseArgs(argv) {
  const allowed = new Set(["project", "feature", "goal", "module", "component", "target-files", "product", "build-mode", "sdk", "skill-root"])
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--") || !allowed.has(token.slice(2))) throw new Error(`未知参数: ${token}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${token} 缺少值`)
    values[token.slice(2)] = value
    index += 1
  }
  return values
}

export async function inspectRequest(skillRoot, request) {
  const capability = await loadCapability(skillRoot, request.feature ?? "immersive-light")
  const resolution = resolveScenario(capability, request.goal, request.component)
  if (resolution.status !== "resolved") return { mode: "code-development-validation", resolution, inspection: null }
  const inspection = await inspectDevelopmentProject(request.project, capability, {
    scenario: resolution.selected,
    module: request.module,
    component: request.component,
    targetFiles: request.targetFiles ?? [],
    product: request.product,
    buildMode: request["build-mode"] ?? request.buildMode,
    sdkPath: request.sdk,
  })
  return {
    mode: "code-development-validation",
    capabilityPackage: { featureId: capability.feature.id, packageVersion: capability.feature.packageVersion, packageDigest: capability.lock.packageDigest, scenarioId: resolution.selected.id, route: resolution.selected.route },
    resolution,
    inspection,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.project || !args.goal) throw new Error("用法: node inspect-development-project.mjs --project <绝对路径> --goal <开发目标> [--feature immersive-light] [--sdk <路径>]")
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const result = await inspectRequest(args["skill-root"] ?? scriptRoot, {
    ...args,
    targetFiles: args["target-files"] ? args["target-files"].split(";").filter(Boolean) : [],
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.inspection || result.inspection.compatibility.status !== "supported") process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

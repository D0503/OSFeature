#!/usr/bin/env node

import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadCapability, resolveScenario } from "./lib/capability-tools.mjs"

function args(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (!["--feature", "--goal", "--target", "--skill-root"].includes(key)) throw new Error(`未知参数: ${key}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${key} 缺少值`)
    result[key.slice(2)] = value
    index += 1
  }
  return result
}

export async function resolveCapabilityRequest(skillRoot, request) {
  const capability = await loadCapability(skillRoot, request.feature ?? "immersive-light")
  const resolution = resolveScenario(capability, request.goal, request.target)
  return {
    feature: { id: capability.feature.id, displayName: capability.feature.displayName, packageVersion: capability.feature.packageVersion },
    packageDigest: capability.lock.packageDigest,
    resolution,
  }
}

async function main() {
  const options = args(process.argv.slice(2))
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const result = await resolveCapabilityRequest(options["skill-root"] ?? scriptRoot, {
    feature: options.feature,
    goal: options.goal,
    target: options.target,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.resolution.status !== "resolved") process.exitCode = 3
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
    process.exitCode = 2
  })
}

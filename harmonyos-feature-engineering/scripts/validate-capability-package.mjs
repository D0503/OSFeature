#!/usr/bin/env node

import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadCapability } from "./lib/capability-tools.mjs"

export async function validateCapabilityPackage(skillRoot, feature = "immersive-light") {
  try {
    const capability = await loadCapability(skillRoot, feature)
    return {
      valid: true,
      errors: [],
      featureId: capability.feature.id,
      packageVersion: capability.feature.packageVersion,
      packageDigest: capability.lock.packageDigest,
      facts: capability.factsData.facts.length,
      scenarios: capability.scenariosData.scenarios.length,
    }
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)] }
  }
}

async function main() {
  const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const [root = scriptRoot, feature = "immersive-light"] = process.argv.slice(2)
  const result = await validateCapabilityPackage(root, feature)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.valid) process.exitCode = 2
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error instanceof Error ? error.message : String(error)] }, null, 2)}\n`)
    process.exitCode = 2
  })
}

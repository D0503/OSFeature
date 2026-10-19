#!/usr/bin/env node
import { cliLog, logResult } from "./lib/skill-log.mjs"

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { evaluateCompatibility, inspectProject, loadFeature, parseCliArgs } from "./lib/project-tools.mjs"

try {
  cliLog("compatibility")
  const args = parseCliArgs(process.argv.slice(2), ["project", "feature", "sdk", "log-session"])
  if (!args.project) throw new Error("Required option: --project <path>")
  if (!args.feature) throw new Error("Required option: --feature <id>")
  const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const { profile } = await loadFeature(skillRoot, args.feature)
  const inspection = await inspectProject(args.project, { sdkPath: args.sdk })
  const result = evaluateCompatibility(inspection, profile)
  process.stdout.write(`${JSON.stringify(logResult("compatibility", { ...result, project: inspection.projectRoot }, result.counts?.fail ? "failed" : result.status ?? "completed"), null, 2)}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify(logResult("compatibility", { status: "error", error: error instanceof Error ? error.message : String(error) }, "failed"), null, 2)}\n`)
  process.exit(2)
}

#!/usr/bin/env node

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { evaluateCompatibility, inspectProject, loadFeature, parseCliArgs } from "./lib/project-tools.mjs"

try {
  const args = parseCliArgs(process.argv.slice(2), ["project", "feature"])
  if (!args.project) throw new Error("Required option: --project <path>")
  if (!args.feature) throw new Error("Required option: --feature <id>")
  const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const { profile } = await loadFeature(skillRoot, args.feature)
  const inspection = await inspectProject(args.project)
  const result = evaluateCompatibility(inspection, profile)
  process.stdout.write(`${JSON.stringify({ ...result, project: inspection.projectRoot }, null, 2)}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
  process.exit(2)
}

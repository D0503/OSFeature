#!/usr/bin/env node
import { cliLog, logResult } from "./lib/skill-log.mjs"

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { evaluateCompatibility, inspectProject, loadFeature, parseCliArgs, verifyInspection } from "./lib/project-tools.mjs"

try {
  cliLog("static")
  const args = parseCliArgs(process.argv.slice(2), ["project", "feature", "route", "sdk", "log-session"])
  if (!args.project) throw new Error("Required option: --project <path>")
  if (!args.feature) throw new Error("Required option: --feature <id>")
  const route = args.route ?? "auto"
  const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const { profile } = await loadFeature(skillRoot, args.feature)
  if (route !== "auto" && !profile.routes.some((r) => r.id === route)) throw new Error(`--route must be auto or one of ${profile.routes.map((r) => r.id).join(", ")}`)
  const inspection = await inspectProject(args.project, { sdkPath: args.sdk })
  const compatibility = evaluateCompatibility(inspection, profile)
  const result = verifyInspection(inspection, compatibility, route)
  process.stdout.write(`${JSON.stringify(logResult("static", { ...result, project: inspection.projectRoot }, result.counts?.fail ? "failed" : result.status ?? "completed"), null, 2)}\n`)
  if (result.counts.fail > 0) process.exit(1)
} catch (error) {
  process.stdout.write(`${JSON.stringify(logResult("static", { status: "error", error: error instanceof Error ? error.message : String(error) }, "failed"), null, 2)}\n`)
  process.exit(2)
}

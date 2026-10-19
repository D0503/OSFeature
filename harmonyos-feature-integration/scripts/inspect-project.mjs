#!/usr/bin/env node
import { cliLog, logResult } from "./lib/skill-log.mjs"

import { inspectProject, parseCliArgs } from "./lib/project-tools.mjs"

try {
  cliLog("inspection")
  const args = parseCliArgs(process.argv.slice(2), ["project", "sdk", "log-session"])
  if (!args.project) throw new Error("Required option: --project <path>")
  const result = await inspectProject(args.project, { sdkPath: args.sdk })
  process.stdout.write(`${JSON.stringify(logResult("inspection", result), null, 2)}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify(logResult("inspection", { status: "error", error: error instanceof Error ? error.message : String(error) }, "failed"), null, 2)}\n`)
  process.exit(2)
}

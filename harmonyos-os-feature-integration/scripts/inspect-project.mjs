#!/usr/bin/env node

import { inspectProject, parseCliArgs } from "./lib/project-tools.mjs"

try {
  const args = parseCliArgs(process.argv.slice(2), ["project", "sdk"])
  if (!args.project) throw new Error("Required option: --project <path>")
  const result = await inspectProject(args.project, { sdkPath: args.sdk })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
  process.exit(2)
}

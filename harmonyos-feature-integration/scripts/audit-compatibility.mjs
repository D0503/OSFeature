#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile } from './lib/json-file.mjs'
import { parseCliArgs } from './lib/project-tools.mjs'
import { auditProject, renderAuditReport } from './lib/compatibility-audit.mjs'

try {
  const args = parseCliArgs(process.argv.slice(2), ['project', 'feature', 'sdk', 'product', 'format', 'review'])
  if (!args.project) throw new Error('Required option: --project <path>')
  if (args.format && !['json', 'markdown'].includes(args.format)) throw new Error('--format must be json or markdown')
  if (args.review && args.format !== 'markdown') throw new Error('--review requires --format markdown')
  const result = await auditProject(resolve(dirname(fileURLToPath(import.meta.url)), '..'), args)
  const review = args.review ? await readJsonFile(args.review) : {}
  process.stdout.write(args.format === 'markdown' ? renderAuditReport(result, review) : `${JSON.stringify(result, null, 2)}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ status: 'error', error: error.message })}\n`)
  process.exitCode = 2
}

#!/usr/bin/env node

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseHtml, parseMarkdown } from "../scripts/lib/document-parser.mjs"

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures")
const markdown = await readFile(join(fixtureDir, "guide-with-internal-conflicts.md"), "utf8")
const parsedMarkdown = parseMarkdown(markdown)
assert.equal(parsedMarkdown.title, "测试用位置能力接入指南")
assert.equal(parsedMarkdown.codeBlocks.length, 1)
assert.match(parsedMarkdown.contentText, /TEST_LOCATION_A/)
assert.match(parsedMarkdown.contentText, /TEST_LOCATION_B/)
assert.equal(parsedMarkdown.sections.length, 5)

const html = await readFile(join(fixtureDir, "parser-sample.html"), "utf8")
const parsedHtml = parseHtml(html)
assert.equal(parsedHtml.title, "解析器测试页面")
assert.equal(parsedHtml.codeBlocks.length, 1)
assert.match(parsedHtml.codeBlocks[0].content, /value < 2/)
assert.equal(parsedHtml.links.length, 1)
assert.equal(parsedHtml.links[0].official, true)
assert.match(parsedHtml.contentMarkdown, /```ts/)

process.stdout.write(`${JSON.stringify({ status: "passed", assertions: 10 })}\n`)


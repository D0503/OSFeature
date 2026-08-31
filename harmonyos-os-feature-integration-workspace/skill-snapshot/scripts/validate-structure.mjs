#!/usr/bin/env node

import { access, readFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const EXPECTED_SKILL_NAME = "harmonyos-os-feature-integration"
const REGISTRY_VERSION = "1.0"
const ROOT_FIELDS = ["features", "registryVersion"]
const FEATURE_FIELDS = ["aliases", "displayName", "entry", "id", "status"]

function add(errors, condition, path, message) {
  if (!condition) errors.push({ path, message })
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

function sameFields(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((field, index) => field === expected[index])
}

function normalizedRouteKey(value) {
  return value.trim().toLocaleLowerCase("en-US")
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function validateRegistry(registry, skillRoot) {
  const errors = []
  add(errors, registry && typeof registry === "object" && !Array.isArray(registry), "$", "注册表必须是 JSON 对象")
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) return errors

  add(errors, sameFields(registry, ROOT_FIELDS), "$", `顶层字段必须且只能是 ${ROOT_FIELDS.join(", ")}`)
  add(errors, registry.registryVersion === REGISTRY_VERSION, "$.registryVersion", `当前只支持 ${REGISTRY_VERSION}`)
  add(errors, Array.isArray(registry.features), "$.features", "features 必须是数组")
  if (!Array.isArray(registry.features)) return errors

  const ids = new Set()
  const routeKeys = new Map()

  for (const [index, feature] of registry.features.entries()) {
    const base = `$.features[${index}]`
    add(errors, sameFields(feature, FEATURE_FIELDS), base, `特性字段必须且只能是 ${FEATURE_FIELDS.join(", ")}`)
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) continue

    add(errors, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(feature.id ?? ""), `${base}.id`, "id 必须使用小写 kebab-case")
    add(errors, !ids.has(feature.id), `${base}.id`, "id 必须唯一")
    ids.add(feature.id)
    add(errors, nonEmpty(feature.displayName), `${base}.displayName`, "displayName 不能为空")
    add(errors, Array.isArray(feature.aliases), `${base}.aliases`, "aliases 必须是数组")
    add(errors, feature.status === "ready", `${base}.status`, "已注册能力的 status 必须是 ready")
    add(errors, nonEmpty(feature.entry), `${base}.entry`, "entry 不能为空")

    const aliases = Array.isArray(feature.aliases) ? feature.aliases : []
    const localAliases = new Set()
    for (const [aliasIndex, alias] of aliases.entries()) {
      add(errors, nonEmpty(alias), `${base}.aliases[${aliasIndex}]`, "别名不能为空")
      if (!nonEmpty(alias)) continue
      const key = normalizedRouteKey(alias)
      add(errors, !localAliases.has(key), `${base}.aliases[${aliasIndex}]`, "同一特性内的别名不能重复")
      localAliases.add(key)
    }

    const keys = [feature.id, feature.displayName, ...aliases].filter(nonEmpty)
    for (const keyValue of keys) {
      const key = normalizedRouteKey(keyValue)
      const owner = routeKeys.get(key)
      add(errors, !owner || owner === feature.id, base, `路由键“${keyValue}”与 ${owner} 冲突`)
      if (!owner) routeKeys.set(key, feature.id)
    }

    if (nonEmpty(feature.entry)) {
      const entryPath = resolve(skillRoot, feature.entry)
      const rel = relative(skillRoot, entryPath)
      const insideRoot = rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel)
      add(errors, insideRoot, `${base}.entry`, "entry 必须是 Skill 根目录内的相对路径")
      add(errors, feature.entry.replaceAll("\\", "/").startsWith("references/features/"), `${base}.entry`, "entry 必须位于 references/features/ 下")
      if (insideRoot) add(errors, await pathExists(entryPath), `${base}.entry`, "entry 指向的文件不存在")
    }
  }

  return errors
}

function parseFrontmatterName(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatter) return null
  const name = frontmatter[1].match(/^name:\s*([^\r\n]+)$/m)
  return name ? name[1].trim().replace(/^['"]|['"]$/g, "") : null
}

export async function validateSkillStructure(skillRoot) {
  const errors = []
  const skillPath = resolve(skillRoot, "SKILL.md")
  const registryPath = resolve(skillRoot, "references", "feature-registry.json")
  let skillContent = ""
  let registry = null

  try {
    skillContent = await readFile(skillPath, "utf8")
    add(errors, parseFrontmatterName(skillContent) === EXPECTED_SKILL_NAME, "SKILL.md:name", `name 必须是 ${EXPECTED_SKILL_NAME}`)
    add(errors, skillContent.split(/\r?\n/).length <= 500, "SKILL.md", "正文必须控制在 500 行以内")
  } catch (error) {
    errors.push({ path: "SKILL.md", message: error instanceof Error ? error.message : String(error) })
  }

  try {
    registry = JSON.parse(await readFile(registryPath, "utf8"))
    errors.push(...await validateRegistry(registry, skillRoot))
  } catch (error) {
    errors.push({ path: "references/feature-registry.json", message: error instanceof Error ? error.message : String(error) })
  }

  const features = Array.isArray(registry?.features) ? registry.features : []
  return {
    errors,
    counts: {
      features: features.length,
      ready: features.filter((feature) => feature?.status === "ready").length
    }
  }
}

async function main() {
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const skillRoot = process.argv[2] ? resolve(process.argv[2]) : defaultRoot
  const result = await validateSkillStructure(skillRoot)
  const output = {
    status: result.errors.length ? "invalid" : "valid",
    ...result.counts,
    errors: result.errors
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  process.exit(result.errors.length ? 1 : 0)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ""
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "invalid", errors: [{ path: "$", message: error instanceof Error ? error.stack ?? error.message : String(error) }] }, null, 2)}\n`)
    process.exit(2)
  })
}

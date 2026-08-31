#!/usr/bin/env node

import { access, readFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseCliArgs } from "./lib/project-tools.mjs"
import { validateSkillStructure } from "./validate-structure.mjs"

function issue(errors, condition, path, message) {
  if (!condition) errors.push({ path, message })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function localLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().split("#")[0])
    .filter((target) => target && !/^(?:https?:|mailto:)/i.test(target))
}

try {
  const args = parseCliArgs(process.argv.slice(2), ["feature"])
  if (!args.feature) throw new Error("Required option: --feature <id>")
  const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const errors = []
  const structure = await validateSkillStructure(skillRoot)
  errors.push(...structure.errors)

  const registryPath = resolve(skillRoot, "references", "feature-registry.json")
  const registry = JSON.parse(await readFile(registryPath, "utf8"))
  const feature = registry.features.find((item) => item.id === args.feature)
  issue(errors, Boolean(feature), "registry", `未注册能力: ${args.feature}`)

  if (feature) {
    const entryPath = resolve(skillRoot, feature.entry)
    const profilePath = resolve(skillRoot, feature.profile)
    const packageDir = dirname(profilePath)
    let profile = null
    let entry = ""
    try {
      profile = JSON.parse(await readFile(profilePath, "utf8"))
    } catch (error) {
      errors.push({ path: feature.profile, message: error instanceof Error ? error.message : String(error) })
    }
    try {
      entry = await readFile(entryPath, "utf8")
    } catch (error) {
      errors.push({ path: feature.entry, message: error instanceof Error ? error.message : String(error) })
    }

    if (profile) {
      issue(errors, profile.schemaVersion === "1.0", "profile.schemaVersion", "schemaVersion 必须是 1.0")
      issue(errors, profile.featureId === feature.id, "profile.featureId", "featureId 必须与注册表 id 一致")
      issue(errors, Array.isArray(profile.routes) && profile.routes.length > 0, "profile.routes", "routes 必须是非空数组")
      const routeIds = new Set()
      for (const [index, route] of (profile.routes ?? []).entries()) {
        issue(errors, typeof route.id === "string" && route.id.length > 0, `profile.routes[${index}].id`, "route id 不能为空")
        issue(errors, !routeIds.has(route.id), `profile.routes[${index}].id`, "route id 必须唯一")
        routeIds.add(route.id)
        issue(errors, Number.isInteger(route.minApi) && route.minApi > 0, `profile.routes[${index}].minApi`, "minApi 必须是正整数")
        issue(errors, route.requiresStage === true, `profile.routes[${index}].requiresStage`, "当前能力路线必须要求 Stage 模型")
        issue(errors, Array.isArray(route.components) && route.components.length > 0, `profile.routes[${index}].components`, "components 必须是非空数组")
      }
      const hds = profile.routes?.find((route) => route.id === "hds")
      const arkui = profile.routes?.find((route) => route.id === "arkui")
      issue(errors, hds?.minApi === 23, "profile.routes.hds", "HDS 路线必须从 API 23 开始")
      issue(errors, arkui?.minApi === 26, "profile.routes.arkui", "ArkUI 路线必须从 API 26 开始")
      issue(errors, arkui?.applicationLevel?.minTargetApi === 26, "profile.routes.arkui.applicationLevel", "应用级开关必须要求 target API 26")
      issue(errors, arkui?.applicationLevel?.moduleTypes?.includes("entry"), "profile.routes.arkui.applicationLevel", "应用级开关必须限定 entry module")
      issue(errors, profile.evidence?.policy === "snapshot-first-verify-on-change-or-conflict", "profile.evidence.policy", "证据策略不符合契约")

      const requiredDocuments = ["entry", "compatibility", "implementation", "validation"]
      for (const key of requiredDocuments) {
        const document = profile.documents?.[key]
        issue(errors, typeof document === "string" && document.length > 0, `profile.documents.${key}`, "缺少必需文档")
        if (typeof document !== "string" || !document) continue
        const absolute = resolve(packageDir, document)
        const rel = relative(packageDir, absolute)
        issue(errors, rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel), `profile.documents.${key}`, "文档必须位于能力包目录内")
        issue(errors, await exists(absolute), `profile.documents.${key}`, "文档不存在")
      }
    }

    if (entry) {
      for (const expected of ["compatibility.md", "implementation.md", "performance-validation.md", "profile.json"]) {
        issue(errors, entry.includes(expected), feature.entry, `入口未路由到 ${expected}`)
      }
      for (const target of localLinks(entry)) {
        issue(errors, await exists(resolve(dirname(entryPath), target)), `${feature.entry} -> ${target}`, "相对链接目标不存在")
      }
    }
  }

  const contractPath = resolve(skillRoot, "references", "feature-package-contract.md")
  const contract = await readFile(contractPath, "utf8")
  for (const required of ["profile.json", "兼容", "权限", "设备", "降级", "验证", "故障排查", "证据"]) {
    issue(errors, contract.includes(required), "references/feature-package-contract.md", `能力包契约缺少栏目: ${required}`)
  }

  process.stdout.write(`${JSON.stringify({ status: errors.length ? "invalid" : "valid", feature: args.feature, errors }, null, 2)}\n`)
  process.exit(errors.length ? 1 : 0)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ status: "error", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`)
  process.exit(2)
}

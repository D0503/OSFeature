import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"

const inside = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) }
const prose = (text) => text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")

export function markdownLinks(text) {
  return [...prose(text).matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)]
    .map((m) => m[1].replace(/^<|>$/g, ""))
    .filter((target) => !/^(?:[a-z][\w+.-]*:|\/\/)/i.test(target))
}

export function headingAnchors(text) {
  const anchors = new Set()
  for (const match of prose(text).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1].replace(/[`*]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\p{M}_ -]/gu, "").replace(/ /g, "-")
    let anchor = base
    for (let index = 1; anchors.has(anchor); index++) anchor = `${base}-${index}`
    anchors.add(anchor)
  }
  for (const match of prose(text).matchAll(/\bid=["']([^"']+)["']/g)) anchors.add(match[1])
  return anchors
}

// Follow entry links, not profile mappings: a declared role alone is not an Agent reading path.
export async function validateDocumentLinks(skillRoot, entries = []) {
  const root = resolve(skillRoot)
  const errors = [], texts = new Map(), graph = new Map()
  const label = (path) => relative(root, path).replaceAll("\\", "/")
  async function scan(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue
      const path = resolve(directory, item.name)
      if (item.isDirectory()) await scan(path)
      else if (item.name.endsWith(".md")) texts.set(path, await readFile(path, "utf8"))
    }
  }
  try { await scan(resolve(root, "references")) }
  catch (error) { return [{ path: "references", message: `无法读取文档：${error.message}` }] }
  const start = resolve(root, "SKILL.md")
  try { texts.set(start, await readFile(start, "utf8")) }
  catch (error) { return [{ path: "SKILL.md", message: error.message }] }
  for (const [path, text] of texts) {
    const targets = new Set()
    for (const link of markdownLinks(text)) {
      try {
        const [name, ...parts] = link.split("#")
        const target = name ? resolve(dirname(path), decodeURIComponent(name)) : path
        if (!inside(root, target)) throw new Error("文档链接超出 Skill 目录")
        const info = await stat(target)
        if (!info.isFile()) throw new Error("文档链接必须指向文件")
        if (parts.length && target.endsWith(".md")) {
          const content = texts.get(target) ?? await readFile(target, "utf8")
          if (!headingAnchors(content).has(decodeURIComponent(parts.join("#")))) throw new Error("章节锚点不存在")
        }
        targets.add(target)
      } catch (error) { errors.push({ path: `${label(path)} -> ${link}`, message: error.code === "ENOENT" ? "链接目标不存在" : error.message }) }
    }
    graph.set(path, targets)
  }
  const registry = resolve(root, "references/feature-registry.json")
  graph.set(registry, new Set(entries.map((entry) => resolve(root, entry))))
  function reachable(origin, boundary = root) {
    const seen = new Set(), queue = [origin]
    while (queue.length) {
      const path = queue.pop()
      if (seen.has(path) || !inside(boundary, path)) continue
      seen.add(path)
      for (const target of graph.get(path) ?? []) queue.push(target)
    }
    return seen
  }
  const seen = reachable(start)
  for (const path of texts.keys()) if (!seen.has(path)) errors.push({ path: label(path), message: "无法从 SKILL.md 的读取入口到达" })
  for (const entry of entries) {
    const path = resolve(root, entry), packageRoot = dirname(path)
    const packageSeen = reachable(path, packageRoot)
    for (const document of texts.keys()) if (inside(packageRoot, document) && !packageSeen.has(document)) errors.push({ path: label(document), message: `无法从能力入口 ${entry} 到达` })
  }
  return errors
}

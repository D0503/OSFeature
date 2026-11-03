import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { readManifest } from "./easygo-tools.mjs"

const skipped = new Set([".git", ".idea", ".hvigor", "build", "node_modules", "oh_modules"])
const rootInputs = new Set(["build-profile.json5", "oh-package.json5", "oh-package-lock.json5", "package.json", "package-lock.json", "local.properties"])
const digest = (data) => createHash("sha256").update(data).digest("hex")
const within = (root, path) => { const rel = relative(root, path); return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) }

export async function projectInputHash(project, output) {
  const root = resolve(project), excluded = resolve(output)
  let config
  try { config = readManifest(await readFile(join(root, "build-profile.json5"), "utf8")) }
  catch (error) { if (error.code !== "ENOENT") throw error }
  const modules = (config?.modules ?? []).map((m) => {
    const directory = resolve(root, m.srcPath)
    if (!within(root, directory) || directory === root) throw new Error(`无法核验工程模块路径：${m.srcPath}`)
    return directory
  })
  const excludeDirectory = excluded !== root && within(root, excluded)
  const inputDirectories = [...modules, join(root, "src"), join(root, "AppScope"), join(root, "hvigor")]
  if (excludeDirectory && inputDirectories.some((dir) => within(dir, excluded) || within(excluded, dir))) throw new Error("报告输出目录不得覆盖工程源码或模块目录")
  const files = []
  async function visit(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name), rel = relative(root, path).replaceAll("\\", "/")
      if (excludeDirectory && within(excluded, path)) continue
      if (item.isDirectory() && (skipped.has(item.name) || (excluded === root && item.name === "evidence"))) continue
      if (item.isSymbolicLink()) throw new Error(`工程输入包含符号链接，无法冻结：${rel}`)
      if (item.isDirectory()) { await visit(path); continue }
      const input = modules.some((m) => within(m, path)) || /(?:^|\/)(?:src|AppScope|hvigor)\//.test(rel) || /\.(?:ets|ts|js|mjs|cjs|json5|properties)$/.test(rel) || rootInputs.has(rel)
      if (item.isFile() && input) files.push([rel, digest(await readFile(path))])
    }
  }
  await visit(root)
  files.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  return digest(JSON.stringify(files))
}

export async function assertVerificationInputs(run, output) {
  if (!run.inputHash) throw new Error("运行缺少工程输入快照，请重新执行验证后补录")
  if (await projectInputHash(run.project, output) !== run.inputHash) throw new Error("工程源码或配置已变化，请重新执行验证，不可沿用本轮证据补录")
  for (const item of run.artifacts ?? []) {
    let current
    try { current = digest(await readFile(item.path)) } catch {}
    if (current !== item.sha256) throw new Error(`本轮构建产物已变化或丢失，请重新构建验证：${item.path}`)
  }
}

export async function moduleArtifactHashes(project, run, modules) {
  const selected = modules.find((m) => m.name === run.module)
  if (!selected?.path) return []
  const directory = resolve(project, dirname(dirname(dirname(selected.path))), "build", run.product, "outputs")
  const artifacts = []
  async function visit(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const child = join(path, item.name)
      if (item.isSymbolicLink()) throw new Error(`构建产物包含符号链接：${child}`)
      if (item.isDirectory()) await visit(child)
      else if (item.isFile() && /\.(?:hap|hsp|har)$/.test(item.name)) artifacts.push({ path: child, sha256: digest(await readFile(child)) })
    }
  }
  await visit(directory)
  if (!artifacts.length) throw new Error("模块构建未找到可冻结的 HAP/HSP/HAR 产物")
  return artifacts
}

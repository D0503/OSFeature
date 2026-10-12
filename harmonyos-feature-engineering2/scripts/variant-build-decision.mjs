import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// 对工程全部输入做保守比较；仅忽略已知生成目录。
export async function buildFingerprint(project, toolchainIdentity) {
  if (!toolchainIdentity) throw new Error('必须提供 SDK、工具链、构建选项及外部依赖/签名内容哈希组成的 toolchainIdentity')
  const hash = createHash('sha256').update(toolchainIdentity)
  const ignored = new Set(['.git', '.hvigor', 'build', 'ohos-feature-engineering'])
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && ignored.has(entry.name)) continue
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`符号链接输入需先解析后再判断复用: ${path}`)
      if (entry.isDirectory()) await walk(path)
      else hash.update(JSON.stringify([relative(project, path), createHash('sha256').update(await readFile(path)).digest('hex')]))
    }
  }
  await walk(project)
  return hash.digest('hex')
}

export function decideBuild(current, previous, runtimeOnly) {
  return { rebuild: !(runtimeOnly && previous?.buildPassed === true && previous.fingerprint === current), fingerprint: current }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [project, identity, previousPath, changeKind] = process.argv.slice(2)
  const fingerprint = await buildFingerprint(resolve(project), identity)
  const previous = previousPath && previousPath !== '-' ? JSON.parse(await readFile(previousPath, 'utf8')) : null
  console.log(JSON.stringify(decideBuild(fingerprint, previous, changeKind === 'runtime'), null, 2))
}

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

export async function readJsonFile(path) {
  const absolute = resolve(path)
  try {
    return JSON.parse((await readFile(absolute, "utf8")).replace(/^\uFEFF/, ""))
  } catch (error) {
    throw new Error(`无法读取 JSON 文件 ${absolute}：${error.message}`)
  }
}

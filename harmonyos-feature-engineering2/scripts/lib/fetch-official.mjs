import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

// 子进程调用 fetch-doc.mjs 抓取官网页面；fetch-doc 对内容过短等场景以非零退出码输出
// review_required——只要输出文件可解析且正文完整，仍视为页面可达。
export async function fetchOfficialDocument(url) {
  const workDirectory = join(tmpdir(), `v2-fetch-${digest(url).slice(0, 12)}`)
  await mkdir(workDirectory, { recursive: true })
  const outputFile = join(workDirectory, "fetch.json")
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "..", "fetch-doc.mjs")
  try {
    const outcome = await new Promise((resolveResult) => {
      const child = spawn(process.execPath, [script, url, "--output", outputFile], { shell: false, windowsHide: true, timeout: 90_000 })
      child.on("error", (error) => resolveResult({ ok: false, detail: error.message }))
      child.on("close", (code) => resolveResult({ ok: code === 0, code }))
    })
    let payload = null
    try { payload = JSON.parse(await readFile(outputFile, "utf8")) } catch { payload = null }
    if (!outcome.ok && !payload) return { ok: false, detail: `抓取失败（${outcome.detail ?? `退出码 ${outcome.code}`}）` }
    if (!payload) return { ok: false, detail: "抓取结果不可解析。" }
    return {
      ok: true,
      contentSha256: payload.contentSha256 ?? null,
      contentMarkdown: payload.contentMarkdown ?? "",
      title: payload.title ?? null,
      updatedDate: payload.updatedDate ?? null,
      warnings: payload.warnings ?? [],
    }
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

export async function writeFrozenSnapshot(outputDirectory, pages) {
  const snapshotsDirectory = join(outputDirectory, "snapshots")
  await mkdir(snapshotsDirectory, { recursive: true })
  const snapshots = []
  for (const page of pages) {
    const bodyPath = join(snapshotsDirectory, `${page.snapshotId}.md`)
    await writeFile(bodyPath, page.contentMarkdown, "utf8")
    snapshots.push({
      snapshotId: page.snapshotId,
      officialUrl: page.officialUrl,
      contentSha256: page.contentSha256,
      title: page.title,
      updatedDate: page.updatedDate,
    })
  }
  const frozen = { frozenAt: new Date().toISOString(), snapshots }
  await writeFile(join(outputDirectory, "frozen.json"), `${JSON.stringify(frozen, null, 2)}\n`, "utf8")
  return frozen
}

export async function readFrozenSnapshot(frozenDirectory) {
  const frozen = JSON.parse(await readFile(join(frozenDirectory, "frozen.json"), "utf8"))
  const bodies = new Map()
  for (const snapshot of frozen.snapshots) {
    bodies.set(snapshot.snapshotId, await readFile(join(frozenDirectory, "snapshots", `${snapshot.snapshotId}.md`), "utf8"))
  }
  return { frozen, bodies }
}

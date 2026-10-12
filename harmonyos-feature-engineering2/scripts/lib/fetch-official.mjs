import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

// 子进程调用 fetch-doc.mjs 抓取官网页面；fetch-doc 对内容过短等场景以非零退出码输出
// review_required——只要输出文件可解析且正文完整，仍视为页面可达。
export async function fetchOfficialDocument(url) {
  const workDirectory = await mkdtemp(join(tmpdir(), 'cap-fetch-'))
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

// workDirectory 必须是本轮专用临时目录；失败不缓存，缓存损坏重新抓取。
export async function fetchOfficialBatch(entries, { concurrency = 4, workDirectory, fetcher = fetchOfficialDocument } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('concurrency 必须为 1 到 8')
  const urls = [...new Set(entries.map(e => e.officialUrl))]
  const results = new Map()
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++]
      const cache = workDirectory ? join(workDirectory, 'pages', `${digest(url)}.json`) : null
      let result
      if (cache) {
        try {
          const saved = JSON.parse(await readFile(cache, 'utf8'))
          if (saved.url === url && saved.ok && typeof saved.contentMarkdown === 'string' && digest(saved.contentMarkdown) === saved.contentSha256) result = saved
        } catch { /* cache miss */ }
      }
      if (!result) {
        try { result = await fetcher(url) } catch (error) { result = { ok: false, detail: error.message } }
        if (result.ok && typeof result.contentMarkdown === 'string' && digest(result.contentMarkdown) === result.contentSha256) {
          result = { ...result, url, fetchedAt: new Date().toISOString() }
          if (cache) { await mkdir(dirname(cache), { recursive: true }); await writeFile(cache, JSON.stringify(result)) }
        } else result = { ok: false, detail: result.detail ?? '正文或哈希无效' }
      }
      results.set(url, result)
    }
  }))
  return entries.map(entry => ({ ...entry, ...results.get(entry.officialUrl) }))
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
      fetchedAt: page.fetchedAt ?? null,
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

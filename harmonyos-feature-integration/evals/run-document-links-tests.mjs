import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { headingAnchors, markdownLinks, validateDocumentLinks } from "../scripts/lib/document-links.mjs"

const directory = await mkdtemp(join(tmpdir(), "feature-document-links-"))
const entry = "references/features/example/README.md"
const put = async (path, content) => { const target = join(directory, path); await mkdir(join(target, ".."), { recursive: true }); await writeFile(target, content) }
const validate = () => validateDocumentLinks(directory, [entry])
try {
  await put("SKILL.md", "# Skill\n[registry](references/feature-registry.json)\n[workflow](references/workflows/design.md)")
  await put("references/feature-registry.json", "{}")
  await put("references/workflows/design.md", "# Design\n[entry](../features/example/README.md)")
  await put(entry, "# Entry\n[implementation](implementation.md#接入与回退)\n[profile](profile.json)")
  await put("references/features/example/profile.json", JSON.stringify({ documents: { implementation: "implementation.md", validation: "implementation.md" } }))
  await put("references/features/example/implementation.md", "# Implementation\n## 接入与回退\n[entry](README.md)\n[asset](assets/Helper.ets)")
  await put("references/features/example/assets/Helper.ets", "export const value = 1")
  assert.deepEqual(await validate(), [], "循环索引有可达正文、多个角色共用文件和资产链接合法")

  await put(entry, "# Entry\n[implementation](implementation.md#不存在)")
  assert.ok((await validate()).some((e) => e.message === "章节锚点不存在"))
  await put(entry, "# Entry\n[implementation](implementation.md)\n[missing](missing.md)")
  assert.ok((await validate()).some((e) => e.message === "链接目标不存在"))

  await put(entry, "# Entry\n[profile](profile.json)")
  assert.ok((await validate()).some((e) => e.path.endsWith("implementation.md") && e.message.includes("无法从能力入口")), "仅 profile 声明角色不等于 README 可达")
  await put(entry, "# Entry\n[implementation](implementation.md)")
  await put("references/shared/security.md", "# Security")
  assert.ok((await validate()).some((e) => e.path === "references/shared/security.md" && e.message.includes("SKILL.md")))
  await put("references/workflows/design.md", "# Design\n[security](../shared/security.md)\n[implementation](../features/example/implementation.md)")
  await put(entry, "# Entry\n[profile](profile.json)")
  const externalOnly = await validate()
  assert.ok(!externalOnly.some((e) => e.path.endsWith("implementation.md") && e.message.includes("SKILL.md")))
  assert.ok(externalOnly.some((e) => e.path.endsWith("implementation.md") && e.message.includes("能力入口")), "其他工作流可达不能掩盖能力入口漏链")

  await put(entry, "# Entry\n[implementation](implementation.md)")
  await put("references/features/example/loop.md", "# Loop\n[self](loop.md)")
  assert.ok((await validate()).some((e) => e.path.endsWith("loop.md") && e.message.includes("无法从能力入口")))
  await put(entry, "# Entry\n[implementation](implementation.md)\n[loop](loop.md)")
  assert.deepEqual(await validate(), [], "可达相互引用不会无限遍历")

  assert.deepEqual(markdownLinks('```text\n[example](missing.md)\n```\n[real](real.md)\n[web](https://example.com)\n[local](#section)'), ["real.md", "#section"])
  assert.ok(headingAnchors("# 标题 API\n# 标题 API\n```\n# fake\n```\n").has("标题-api-1"))
  assert.ok(!headingAnchors("```\n# fake\n```\n").has("fake"))
  console.log("Document link tests passed")
} finally {
  await rm(directory, { recursive: true, force: true })
}

# 知识库查询

使用调用入口指定的完整标题查询 `innovative-feature` 知识库。每个所需标题分别查询。以下命令在包含 `SKILL.md` 的 Skill 根目录执行。

1. 将命令中的标题替换为当前所需标题，搜索候选文档。

   ```text
   node scripts/harmonyos-search-documents.mjs "<完整标题>" --scene-name "innovative-feature"
   ```

2. 从 `resultList` 的前 10 条中提取非空的 `parent`，去重后作为文档 ID 一次传给全文脚本。按实际 ID 数量传参，单次最多 10 个。

   ```text
   node scripts/harmonyos-get-documents.mjs "<文档 ID 1>" "<文档 ID 2>"
   ```

3. 在全文返回的 `resultList` 中核对 `title`。当且仅当一篇文档的标题完全一致，且其 `content` 去掉首尾空白后非空时，读取其正文，再按调用入口处理当前任务。

请求失败、无候选 ID、无同名文档、有多篇同名文档或匹配文档的正文为空时，说明标题和失败原因，将该资料标记为待核验，并暂停依赖该正文的步骤。

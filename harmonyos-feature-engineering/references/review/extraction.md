# 输入抽取

本地文件和目录的统一入口：

```text
node <skill>/scripts/prepare-review.mjs "<file|directory>" [--output "<temporary-json>"] [--max-evidence-pages 12]
```

## 单个本地文件

支持 `.md`、`.markdown`、`.html`、`.htm`、`.txt`。记录绝对路径、字节数、SHA-256 和本地修改时间；本地修改时间只用于文件完整性，不得写入官网抓取时间。

解析标题、章节、段落、代码围栏、链接、媒体、版本声明和来源元数据。文件内容超过脚本限制时停止并报告，不做静默截断。

## 目录

普通目录按文件名排序读取第一层的 `.md`、`.markdown`、`.html`、`.htm` 和 `.txt`，不因为缺少资料清单而降级或产生警告，且不做无界递归。

如果目录来自 `snapshot-url.mjs`，脚本会自动读取其中的内部快照索引，按快照顺序读取文档并检查：

- `localPath` 是否仍位于资料集根目录内。
- 文件是否存在。
- 实际 SHA-256 是否与清单一致。
- 来源 URL、规范 URL、更新时间、抓取时间和抓取方式是否明确。
- 引用页面是否已快照，媒体是否可用。

内部索引路径不得逃逸到快照目录之外。哈希不一致属于源完整性错误，报告不能声称审查的是索引所描述的快照。`source-manifest.json` 不作为用户输入；直接传入时要求改为提供其所在目录。

## 官网 URL

按照 [URL 快照](url-snapshot.md) 先运行 `snapshot-url.mjs`，再将快照目录交给 `prepare-review.mjs`。不要在 Skill 主流程中直接审查瞬时抓取结果。

只允许 HTTPS `developer.huawei.com`，禁止凭据、非标准端口、私网跳转和跨域重定向。快照记录：

- 请求 URL 和最终规范 URL。
- 抓取时间 `retrievedAt`。
- 页面声明的更新时间；没有则为 `null`。
- 正文 SHA-256。
- 抓取方式和内容类型。

仅当用户明确指定输出目录时，才把 URL 快照写入该目录的 `evidence/source-snapshot/`；否则使用系统临时目录并在审查结束后安全清理。

## 结构化预检

`prepare-review.mjs` 输出 `reviewPreparationVersion`、`input`、`sourceIntegrity`、`documents`、`preflightCandidates` 和 `evidenceBudget`。

候选项用于提醒模型复核，常见类型包括空导航页、无语言代码围栏、相对链接失效、媒体缺失、import/上下文缺失线索、快照哈希异常、未快照官方引用、范围冲突和属性约束/示例冲突。

预检候选项不是 finding：必须回到原文位置判断语义、影响、证据和置信度。

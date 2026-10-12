# URL 转 Markdown 快照

URL 输入必须先转换为标准资料目录，再进入 `document-review`。转换产物是派生快照，不改变官网的事实来源身份，也不代表内容已通过正确性审查。

## 命令

默认创建独立临时快照目录，返回 `outputDirectory` 和 `temporary=true`：

```text
node <skill>/scripts/snapshot-url.mjs "<developer.huawei.com URL>" --max-pages 12
```

需要共用本轮临时工作目录时：

```text
node <skill>/scripts/snapshot-url.mjs "<developer.huawei.com URL>" --output-dir "<本轮临时目录>/source-snapshot" --max-pages 12
```

如果用户明确只审查入口页面，增加 `--single-page`。

## 抓取范围

默认从入口页面开始，并仅扩展满足全部条件的链接：

- HTTPS `developer.huawei.com` 页面。
- 与入口相同语言和文档目录。
- 文档 ID 等于入口 ID，或以 `入口ID-` 开头。
- 全部页面合计不超过 `--max-pages`，默认 12。

不要扩展 API 参考、设计规范、第三方页面或其他特性页面；这些链接保留在清单中，供后续定向取证。关联页抓取失败时记录在 `fetchFailures`，不得静默丢失。

## 输出结构

```text
source-snapshot/
├─ README.md
├─ source-manifest.json        # 工具内部完整性索引，不作为用户输入
├─ <document-id>.md
└─ evidence/
   └─ fetch/
      └─ <document-id>.json
```

- Markdown 中已成功快照的同特性链接改写为本地相对链接。
- 内部快照索引记录请求 URL、规范 URL、抓取时间、官网更新时间、抓取方式、Markdown 哈希、抓取证据哈希、未快照官方引用和未解析媒体；用户只需提供 URL 或生成后的目录。
- `evidence/fetch/` 保存抓取脚本的结构化结果，供审查结论反向追溯。
- 输出目录不存在时自动创建。重复运行时仅刷新上一份内部索引登记的快照和抓取证据；目录中未登记的用户文件保持不变。目录没有有效内部索引时拒绝刷新，避免覆盖未知资料。

## 进入审查

转换完成后，将返回的 `outputDirectory` 作为 `prepare-review.mjs` 的输入。审查依据是本次快照，最终报告以官网 URL 标识 `input` 与证据来源，`sourceIntegrity` 保存实际核验的正文哈希、抓取元数据和完整性结论，不链接临时快照或清单。必要原文摘录直接写入报告；完成或受阻后按 [保留规则](../development/delivery-policy.md) 清理本次临时快照。显式输出目录只清理本次登记的生成文件，不删除未知或用户已有文件。

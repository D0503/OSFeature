# URL 转 Markdown 快照

URL 输入必须先转换为标准资料目录，再进入 `document-review`。转换产物是派生快照，不改变官网的事实来源身份，也不代表内容已通过正确性审查。

## 命令

用户明确指定报告输出目录时：

```text
node <skill>/scripts/snapshot-url.mjs "<developer.huawei.com URL>" --output-dir "<报告输出目录>/evidence/source-snapshot" --max-pages 12
```

未指定输出目录时：

```text
node <skill>/scripts/snapshot-url.mjs "<developer.huawei.com URL>" --max-pages 12
```

第二种形式在系统临时目录创建快照，并在 stdout 返回 `temporary: true` 和确切目录。完成审查后，只能在确认该标志且目标仍位于系统临时目录时清理该目录。

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
- 输出目录必须不存在或为空；脚本拒绝覆盖已有资料。

## 进入审查

转换完成后，将返回的 `outputDirectory` 作为 `prepare-review.mjs` 的输入。报告中的 `input` 和 `sourceIntegrity` 应引用该快照及其清单，不再直接把实时 URL 当作已稳定的审查对象。

# 文档获取与解析

目标是获得可定位、可复查的正文，而不只是网页空壳。华为开发者页面常由 JavaScript 渲染；标准 `/consumer/<language>/doc/<catalog>/<document-id>` 页面优先调用官方正文接口。

## 1. 定位 Skill 目录

宿主加载 Skill 时会提供其路径。下文用 `<skill>` 表示包含 `SKILL.md` 的绝对目录。不要假设当前工作目录就是 Skill 目录。

## 2. 官网 URL

运行：

```text
node "<skill>/scripts/fetch-doc.mjs" "<https://developer.huawei.com/...>"
```

正文很长或需要后续脚本处理时，可写到临时位置：

```text
node "<skill>/scripts/fetch-doc.mjs" "<URL>" --output "<临时目录>/document.json"
```

脚本只接受 `https://developer.huawei.com`，拒绝凭据、非标准端口和跳转到非官方域名。标准文档优先使用 `getDocumentById`，其他官方页面使用静态 HTML。

输出中的关键字段：

| 字段 | 含义 |
|---|---|
| `status` | `fetched` 或 `review_required` |
| `pageUrl` | 规范化后的目标 URL |
| `retrievalMethod` | 正文接口或静态 HTML |
| `title`、`updatedDate` | 页面元数据，能取得时提供 |
| `contentMarkdown` | 保留标题和代码围栏的结构化正文 |
| `contentText` | 便于全文搜索的纯文本 |
| `sections` | 标题层级、行号范围和章节内容 |
| `codeBlocks` | 语言、内容和顺序 |
| `links` | 页面内链接及是否属于官方域名 |
| `warnings` | 正文过短、未发布、疑似 JS 空壳等 |

退出码：`0` 表示可用；`1` 表示取得正文但需人工复核；`2` 表示失败。退出码 1 不能简单当成无内容，应读取 JSON 和 warnings。

失败时依次回退：

1. 使用宿主网页读取能力打开原 URL；
2. 若本机已有 `devecocli`，先按 [DevEco CLI 文档核验基线](deveco-cli-baseline.md) 探测实际支持的 `docs`/`doc` 子命令，再使用其 `search` 与 `read`；
3. 请用户提供正文、导出的 HTML/Markdown 或截图；
4. 仍无法取得正文时，只报告获取限制，不判断文档技术质量。

## 3. 本地文件

对 `.html`、`.htm`、`.md`、`.markdown`、`.txt` 运行：

```text
node "<skill>/scripts/parse-doc.mjs" "<文件路径>"
```

也支持 `--output <临时 JSON 路径>`。本地文件解析不证明内容来自官网；来源真实性必须根据用户说明、保存元数据或原始 URL 单独记录。

## 4. 粘贴正文

内容较短时直接在上下文中按标题、段落和代码块拆分。内容很长时先请用户提供文件，避免工具输出截断导致“只检查了前半篇”。

## 5. 结构化结果自检

- 标题与用户给出的页面一致；
- 正文长度合理，不是登录提示、导航菜单或 JS 空壳；
- 代码块没有混入普通正文，`<`、`>` 等字符没有被错误吞掉；
- 章节顺序完整，未只读取前几个 section；
- 关联 API、权限、版本说明链接已经收集；
- 对静态页面中的导航噪声保持警惕，不把站点菜单当成文档正文。

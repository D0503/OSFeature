# DevEco CLI 文档核验基线

`devecocli` 的本地 HarmonyOS 文档搜索可用于定位目标文档的关键 API、权限、配置键和错误码。它是可选核验通道：未安装、命令不可用或索引无结果时，不得阻断整份文档审查，也不得自动安装或更新 CLI。

## 1. 先探测，不假设已安装

Windows：

```text
Get-Command devecocli -ErrorAction SilentlyContinue
```

macOS / Linux：

```text
command -v devecocli
```

找到命令后记录：

```text
devecocli --version
devecocli --help
```

不同版本可能暴露 `devecocli docs` 或 `devecocli doc`。以本机 `--help` 的实际结果为准，把可用前缀记为 `<doc-command>`；不要只根据 Skill 记忆写死命令名。

## 2. 已安装时的核验步骤

从待审文档提取 2–5 个高辨识度关键点：

- 完整 API、类或方法名；
- `ohos.permission.*` 权限名；
- `module.json5` / `app.json5` 配置键；
- 精确错误码；
- Kit 名与页面标题关键词。

优先用 JSON 搜索，限制结果数：

```text
<doc-command> search "<精确关键词>" --format json --limit 10
```

当同名结果过多时使用 `--catalog <name>` 缩小范围。选择与目标 Kit、文档类型和关键词最匹配的 `documentId`，再读取全文：

```text
<doc-command> read "<documentId>"
```

不要只依据搜索摘要判错；摘要用于定位，正式证据来自读取后的完整内容。

## 3. 作为证据时必须记录

- `devecocli --version`；
- 实际使用的是 `docs` 还是 `doc`；
- 搜索关键词、catalog 和 documentId；
- 文档标题、正文定位与读取日期；
- 文档是否显示 API Level、版本或更新时间；
- 与目标官网文档、SDK 版本是否对齐。

若本地文档没有可识别版本，只能把它作为官方线索或辅助证据，不能单独支撑 `confirmed` 的版本冲突。官网和 CLI 命中同一 documentId 时视为同一个来源的两个访问通道，而非两条独立证据。

## 4. 未安装或不可用时

按以下策略继续：

1. 使用 `scripts/fetch-doc.mjs` 和官网关联页核验；
2. 使用本机目标 SDK 的 `.d.ts` / `.d.ets` 核对签名；
3. 使用宿主网页能力或请用户提供正文快照；
4. 在报告限制中注明“未使用 DevEco CLI 本地文档索引”。

不要为了完成一次审查自动执行 `npm install`、`devecocli update` 或其他安装/升级操作。只有用户明确要求安装，或者官网不可达且本地文档索引对任务确属必要时，才说明安装的价值和影响并征求用户决定。

## 5. 异常处理

- 命令存在但没有 `docs`/`doc`：标记当前版本不支持本地文档命令，直接回退。
- 搜索无结果：更换一个精确 API/权限关键词再试一次；仍无结果就记录“本地索引未命中”，不能推断官方没有该内容。
- `read` 失败：保留 documentId 和错误信息，改用官网抓取；不要反复重试。
- 输出提示有新版本：只记录，不自动执行 `devecocli update`。
- 本地文档与官网不一致：记录 CLI 版本、documentId、官网更新时间和目标 API Level，优先按版本差异处理。


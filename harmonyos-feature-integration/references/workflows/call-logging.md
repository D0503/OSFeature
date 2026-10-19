# 调用过程日志

本文件是所有能力包共用的日志规则。每次调用从特性识别开始建立会话，检查、实施、修复、验证及交付沿用同一会话；新的用户接入任务创建新会话。不自动清理历史日志。

## 建立与传递会话

```powershell
node <skill>/scripts/skill-log.mjs start --project <工程目录>
```

返回 JSON 的 `logging.directory` 是后续 `--log-session` 使用的会话目录。未知工程时省略 `--project`，日志先写系统临时目录；确定工程后执行 `start --log-session <原会话目录> --project <工程目录>`，迁入工程并使用返回的新路径。旧入口保留重定向，已启动的写入者仍能追踪同一会话。

默认目录为 `<工程>/os-feature-integration/logs/<sessionId>/`：

| 文件 | 用途 |
|---|---|
| `session.log` | 按时间阅读动作、结果、阻断原因及文件引用 |
| `events.jsonl` | 每行独立事件，包含时间、来源、阶段、状态、会话及事件编号 |
| `commands/*.stdout.log`、`*.stderr.log` | 每条命令的脱敏输出，开始立即建文件，输出到达后按完整行实时写入 |
| `evidence/` | 检查结果、验证状态、手动证据及截图的持久诊断副本 |
| `session.json` | 会话身份与工程关联信息 |

各检查入口 `inspect-project.mjs`、`check-compatibility.mjs`、`verify-integration.mjs`、`verify-development.mjs`、`validate-structure.mjs`、`validate-feature-package.mjs` 均传 `--log-session <会话目录>`。单独运行且未指定会话时自动创建；结构与能力包校验可用 `--project` 指定日志归属工程。检查脚本的 stdout 保持 JSON，增加 `logging` 字段，执行进度不混入 stdout。

`verify-development.mjs --resume` 默认使用原运行的会话。旧记录没有会话时新建并关联原 `runId`，不补造早期过程。修复后重新构建须继续传原 `--log-session`；日志通过 `runId`、`previousRunId` 关联各轮，报告只保留当前结果。不要把 `--resume` 当成重新构建。

## AI 主导动作

脚本自动记录自身实际执行。AI 阅读资料、识别特性、选择路线及编辑文件后，使用事件接口追加可核实事实；不能自动截获宿主的所有工具调用，也不记录内部思考。长阶段开始时先记 `started`，结束后记录实际状态。

```powershell
node <skill>/scripts/skill-log.mjs event --log-session <会话目录> --file <事件JSON文件>
```

事件文件至少包含非空 `stage`、`status`、`summary`，示例：

```json
{
  "stage": "repair",
  "status": "completed",
  "summary": "根据构建错误与本机 SDK schema 修正 targetSdkVersion 字段格式",
  "files": ["build-profile.json5"],
  "resources": ["实际读取的 SDK schema 路径"],
  "runId": "失败运行编号",
  "retryOf": "失败事件编号"
}
```

按实际发生记录以下阶段，不为未发生动作补成功事件：

| 阶段 | 必需事实 |
|---|---|
| `recognition` | 命中特性或未命中、不支持原因 |
| `resources` | 实际读取的能力包、规范、参考文件路径 |
| `sdk` | SDK 与配置版本依据、检查结果、阻断原因 |
| `route` | 候选路线、所选路线、已有用户确认或唯一可用路线依据 |
| `implementation` / `repair` | 修改文件、改动摘要、关联错误、修复及重试关系 |
| `manual-evidence` / `judgment` | 手动取证与复核事实；导入、校验及生成报告由脚本另行记录 |
| `delivery` | 已读取最终报告，逐项核对总结与报告结论的一致性及剩余限制 |

事件的时间、会话编号、事件编号、进程编号由记录器生成；AI 事件来源固定为 `ai`。可增加 `durationMs`、`runId`、`retryOf`、`files`、`resources` 等关联字段。

## 手动命令与结束

额外执行的诊断、构建或 hdc 命令使用包装入口：

```powershell
node <skill>/scripts/skill-log.mjs exec --log-session <会话目录> --cwd <工作目录> --timeout 600000 -- <可执行文件> <参数...>
```

使用可执行文件及分开的参数，不拼接 shell 命令；Windows 的 `.cmd` 工具优先使用其 Node 入口。包装器透传命令 stdout/stderr 和正常退出码，日志元数据写 stderr。超时返回 124，可处理的 SIGINT/SIGTERM 返回 130/143，启动失败返回 2。构建与设备执行器已自动接入，无需重复包装。

交付核对后结束会话：

```powershell
node <skill>/scripts/skill-log.mjs finish --log-session <会话目录> --status inconclusive --summary "已构建；目标页视觉和回退场景尚未验证"
```

状态仅支持 `passed`（必需验证均通过）、`inconclusive`（有未确认项）、`blocked`（无法自行解决的具体阻断）。结束命令记录给定结论，不替代证据判定；总结不得高于最终报告结果。补录或继续工作可追加同一会话，结束时再次记录实际状态。

## 查看与异常

报告各目标的“本次诊断日志”链接指向 `session.log`。也可实时查看：

```powershell
Get-Content -LiteralPath '<会话目录>/session.log' -Tail 40 -Wait
Get-Content -LiteralPath '<会话目录>/commands/<commandId>.stderr.log' -Tail 80 -Wait
```

查看最后的 `started` 及对应结束事件；没有结束事件代表未完成或进程被强制终止，不能解释为成功。命令的 `commandId` 关联输出，`runId` 关联验证，失败后的修复及重验追加记录。SDK/静态门禁失败的具体检查结果在事件和 `evidence/` 中，未构建也可排查。

多进程共享会话通过追加和写入锁协调。写入或迁移失败会在 stderr 明确提示，尝试临时目录，始终以返回的 `logging` 实际位置为准。读取旧证据、执行业务或参数解析发生的错误仍保留原退出码与原因。

事件、命令参数、文本输出和诊断副本统一脱敏密码、令牌、私钥等可识别敏感字段；不采集完整环境变量。分片输出等待完整行后脱敏，跨行私钥整体隐藏，未换行的尾部在命令结束时写入。不要主动传入无关凭据或完整环境；无标签的任意敏感文本不能保证被自动识别。截图保留用于判图的原图，采集前避免出现无关敏感页面。脱敏副本记录原始及副本哈希，不能把副本哈希冒充原验证证据哈希。

诊断副本可独立于临时缓存阅读；原始证据哈希和补录规则仍由验证执行器校验。临时合并缓存丢失后不能直接补录旧运行，须按[验证闭环](verification.md#结果与存储)重新验证。

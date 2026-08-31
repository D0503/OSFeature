# 可行性门禁工作流

1. 完整读取命中特性的 `profile.json` 与兼容性文档。
2. 运行 `node scripts/check-compatibility.mjs --project <path> --feature <id>`。
3. 将结果解释为：
   - `supported`：至少一条路线的必要条件已满足；
   - `conditional`：存在可用路线，但目标能力还缺 module、target API、运行时能力或外部条件；
   - `unsupported`：工程 API 或模型排除了所有路线；
   - `insufficient_context`：关键工程事实无法可靠读取。
4. 输出路线、阻断条件、可降级项和证据位置。`unsupported` 是业务结论，不是脚本故障。
5. 只有 `supported` 或用户接受明确条件后的 `conditional` 才进入实施。

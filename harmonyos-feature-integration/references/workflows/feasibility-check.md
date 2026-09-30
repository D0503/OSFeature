# 可行性门禁工作流

1. 完整读取命中特性的 `profile.json` 与兼容性文档。
2. 运行 `node scripts/check-compatibility.mjs --project <path> --feature <id> [--sdk <path>]`。先读取输出中的 `sdk`：每条候选路线必须同时满足 SDK 根清单 API、工程有效 compile API 和 `profile.json` 的 `minApi` 门槛；声明 `minTargetApi` 的路线还必须单独满足 target API 门槛。
3. 将结果解释为：
   - `supported`：至少一条路线的必要条件已满足；
   - `conditional`：存在可用路线，但目标能力还缺 module、target API、运行时能力或外部条件；
   - `upgrade_available`：工程 API 或本机 SDK 低于所有路线门槛，可通过安装/切换 SDK 以及升级 `targetSdkVersion`/`compileSdkVersion` 接入，`compatibleSdkVersion` 保持不变；低版本路径需运行时版本保护并保留接入前的源程序状态；
   - `unsupported`：工程模型等事实排除了所有路线，且升级无法补救；
   - `insufficient_context`：关键工程事实、本机 SDK 位置或根清单无法可靠读取。
4. 输出 SDK 根目录与清单、本机 API、路线、升级选项、阻断条件、`fallbackPolicy`、需要保留的源程序状态维度和证据位置。`unsupported` 是业务结论，不是脚本故障；`upgrade_available` 不是终止结论。
5. 存在多条可用路线或任何升级选项（`decisionRequired` 为 true）时，把可选接入方式、建议路线和理由列给用户，由用户决定路线；仅一条路线且无需升级时，说明建议路线和理由后继续。
6. 只有 `supported`，或用户接受明确条件并确认路线后的 `conditional`/`upgrade_available` 才进入实施。

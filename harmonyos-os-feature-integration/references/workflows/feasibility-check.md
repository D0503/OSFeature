# 可行性门禁工作流

1. 完整读取命中特性的 `profile.json` 与兼容性文档。
2. 运行 `node scripts/check-compatibility.mjs --project <path> --feature <id>`。
3. 将结果解释为：
   - `supported`：至少一条路线的必要条件已满足；
   - `conditional`：存在可用路线，但目标能力还缺 module、target API、运行时能力或外部条件；
   - `upgrade_available`：工程 API 低于所有路线门槛，但可通过升级 `targetSdkVersion`/`compileSdkVersion` 接入，`compatibleSdkVersion` 保持不变，低版本设备需运行时版本保护和普通样式降级；
   - `unsupported`：工程模型等事实排除了所有路线，且升级无法补救；
   - `insufficient_context`：关键工程事实无法可靠读取。
4. 输出路线、升级选项、阻断条件、可降级项和证据位置。`unsupported` 是业务结论，不是脚本故障；`upgrade_available` 不是终止结论。
5. 存在多条可用路线或任何升级选项（`decisionRequired` 为 true）时，把可选接入方式、建议路线和理由列给用户，由用户决定路线；仅一条路线且无需升级时，说明建议路线和理由后继续。
6. 只有 `supported`，或用户接受明确条件并确认路线后的 `conditional`/`upgrade_available` 才进入实施。

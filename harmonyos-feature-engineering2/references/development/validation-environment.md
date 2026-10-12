# 验证环境选择

每次开发在验证计划中记录 `validationEnvironment`：`kind` 为 `emulator` 或 `real-device`，并记录选择理由、设备 ID、系统镜像/系统版本、SDK、目标能力检测结果和未覆盖项。用户指定环境时优先使用；未指定时，依据本次冻结文档和可用设备选择能覆盖目标判据的环境。

- 模拟器：适合已确认支持的布局、导航、普通交互、配置与业务逻辑验证。能力可用且实际运行证据覆盖全部目标判据时，可结束验证，无需例行追加真机验证。
- 真机：目标涉及实际材质呈现、传感器、硬件能力、功耗/热状态，或模拟器缺少目标系统服务时优先使用。最终是否必须真机由目标判据和实际能力检查决定，不按特性名称一概判定。
- 混合验证：模拟器验证功能，真机验证硬件或视觉效果；分别记录设备及证据，逐验证点说明覆盖范围。

模拟器是完整运行验证环境：允许构建、安装、启动、导航、截图、组件树和判图。不得把“模拟器”自动降级为“仅构建”。无设备时才保留 build-only 结果。模拟器不支持的验证点记为 blocked 或 inconclusive，并说明需要什么真机能力；不能据此判实现失败或宣称真机效果通过。

用户选择模拟器后，必须先执行 `node scripts/list-installed-emulators.mjs` 读取 `devecocli emulator list --format json`。这里“可使用的模拟器”指本机**已安装**的模拟器实例，包含 `running` 和 `stopped` 状态，不以是否已启动、是否已出现在设备列表作为候选过滤条件。向用户展示脚本返回的全部候选（名称、设备类型、系统版本、当前状态）；必须等待用户明确选择，多个候选不得代选，只有一个候选也不得自动确认。

用户选择后按名称处理：若候选已停止，执行 `devecocli emulator start "<所选 name>"`；若已运行则不重复启动。随后重新读取 `devecocli emulator list --format json` 和 `devecocli device list --format json`，以所选模拟器最新返回的非空 `serial` 与设备列表交叉确认唯一设备 ID。启动失败、序列号仍为空、设备未连接或名称不再存在时停止，不得改用另一模拟器。不得自动创建、删除或下载模拟器。

完成确认后使用 `verify-development.mjs --device-type emulator --device <确认后的 serial> --execute-build --execute-run`，真机使用 `--device-type real-device`；原有实现、判据、基线参数照常提供。签名要求按目标安装环境检查；不对模拟器强制套用真机签名流程，安装器要求签名时按实际错误处理。

Demo 结果填写 `environment.deviceType`（`emulator|real-device`）、设备型号/模拟器镜像名称和版本，`limitations` 写明未覆盖效果。旧结果缺少类型时显示“未标注”，不得默认当成真机。累计报告文件名 `demo-real-device-validation-report.md` 为兼容保留，正文使用中性“设备验证”标题。两种环境共用同一个 Demo 工程与编号；报告按 `demoId + deviceType + scenarioId` 分别保留结果，同环境同场景复测才替换，不生成带环境后缀的报告副本。证据分别存入该 Demo 的 `evidence/emulator/` 与 `evidence/real-device/`，多场景截图以场景 ID 区分，不复制工程。

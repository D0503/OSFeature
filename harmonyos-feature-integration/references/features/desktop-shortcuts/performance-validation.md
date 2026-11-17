# 验证与证据

## 静态与构建

检查目标 entry/UIAbility 的 metadata 指向真实 profile，ID、资源、Want 目标和参数约束正确，已有配置被保留。动态预置资源核对请求与配置一致；自定义资源核对文件可读性、png/webp、≤100KB、背景为空。按实际使用的运行接口核验 SDK/compile/target 及版本守卫，低版本分支不调用新接口；visible 作为声明式字段直接配置，由系统处理低版本兼容。

按[图标资源规范](assets-catalog.md#图标资源规范)检查实际编码与资源尺寸：预置 SVG 的透明背景、24×24vp 和解析复杂度，PNG 的1024×1024px正方形原图，分层资源的前景与背景文件。运行时分别检查长按菜单和桌面图标的显示，确认系统圆角遮罩裁切后图形完整；自定义图标在校验和加桌时仍须可读且满足接口文件限制。

运行 `verify-integration.mjs --feature desktop-shortcuts --route static-shortcut` 或 `--route dynamic-shortcut`；auto 只根据现有源码候选选择，不能代替用户路线决定。组合路线分别运行 `verify-development.mjs`，沿用稳定改造标识和统一报告。正常静态检查会保留需人工核验的警告，不能仅凭无 fail 宣告运行通过。

具备实际工程、SDK和签名时按[公共验证闭环](../../workflows/verification.md)构建并完整部署。示例调用片段的模拟 Kit 测试只证明本地控制逻辑；不证明 SDK 声明、ArkTS 编译、桌面或 AppGallery 服务可用。

## 运行场景

| 路线 | 必验场景 |
|---|---|
| static-shortcut | 长按入口名称与图标、点击目标 UIAbility、拖动加桌与桌面点击、冷暖启动、重复点击同一入口、普通启动路径、未知参数与失效内容 |
| dynamic-shortcut | 预校验完成、用户点击与系统确认、同意后真实桌面图标及点击目标、冷暖启动、拒绝、过期、重复ID、数量上限、服务异常、页面退出及目标变化 |
| 按需管理 | 区分配置列表与已加桌列表；显示隐藏、取消删除、确认删除、低版本与设备不支持分支 |

静态快捷方式的目标为 Tab，且详情页可能覆盖该 Tab 时，补验暖启动场景。保留详情页并再次点击指向当前主 Tab 下目标子 Tab 的同一快捷方式，确认详情页退出、目标 Tab 正确且路由栈没有重复出栈。

动态路线验证系统返回上限时的入口反馈，以及从桌面移除一个快捷方式后，返回页面重新预校验并按结果更新入口状态。若已选择应用内删除，再验收对应入口及删除结果。[加桌入口与上限处理](routes/dynamic-shortcut.md#加桌入口与上限处理)

静态路线按目标设备验证桌面入口、拖动加桌与点击启动。动态路线只接受 Phone/Tablet/PC/2in1 真机；未知类型和模拟器不能判通过。

## 判定补录

使用现有自动采集或手动导入证据，每条路线分别运行，不新增独立报告格式。手动证据同样绑定本轮构建、产物、设备、runId 与 goal。系统桌面与弹框难以自动导航时按公共手动流程采集，不用应用内首页替代。

运行 `passed` 必须在 `runtime.observations` 引用当前 `runtime.evidence` 中的日志或交互树证据，填写场景、观察说明与 `{id, sha256}`：

- 静态：`static-menu`、`desktop-icon`、`cold-start`、`warm-start`。
- 动态：`pin-confirmation`、`desktop-icon`、`cold-start`、`warm-start`；确认场景记录实际用户动作与系统结果，不能只记录调用发出。

视觉 `passed` 需在 `visual.observations` 引用当前截图证据：静态为 `static-menu`、`desktop-icon`、`target-page`；动态为 `pin-confirmation`、`desktop-icon`、`target-page`。三个场景应来自不同截图，执行代理必须实际读取并核对名称、图标和目标内容。动态证据须来自已确认支持的真机。此约束防止用同一张应用首页冒充桌面全流程；截图本身不能证明冷暖启动，需配套运行记录。

旧版本或失败回退证据按公共 `fallback` 判定提交，不能作为目标特性的视觉通过证据。缺少任一必要观察时保持 inconclusive/not_run，不声明运行成功。

仅管理已有快捷方式、没有对应创建配置或调用的运行，执行器记录 `shortcutManagementOperations`。此时运行观察使用实际管理方法名（如 `getPinShortcutInfos`、`removePinShortcut`），引用返回结果或实际状态变更证据；视觉判定若适用则使用 `management-result` 并引用现有界面的结果截图，不要求新增加桌入口或管理页面。没有可见界面时保持视觉未确认，不能用其他页面冒充管理结果。

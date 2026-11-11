# 独立闪控球（floating-ball）

通过 `@kit.ArkUI` 的 `floatingBall` 创建系统闪控球，在用户切换应用时持续展示已确认的业务信息。本路线用于独立闪控球；用户明确需要窗球切换时另读[绑定流程](binding.md)，不能把独立球的启动、点击恢复逻辑直接套入绑定场景。

先确定球展示的业务内容、使用模板、数据更新来源、点击后恢复的 Ability／页面，以及何时结束展示。复用工程已有入口、状态和导航；缺少影响实现的选择时补问，已明确的选择不重复确认。四种模板是可选项，不要求同时接入四套演示按钮。

## 读取知识库正文

`MCPXX` 是待配置的知识库 MCP 服务。接入后，通过 `searchDocuments` 查询「独立闪控球开发步骤（API 20 起）」，选择标题匹配的条目，再用返回的 `identifier` 调用 `getDocumentsById` 读取全文。结合目标工程确认模板、图标、实际宿主的 `UIAbilityContext`、点击恢复目标和结束展示的时机。服务未配置或未取得正文时，标记接入依据待核验，暂停依赖这些资料的工程改动。

## 读取本地资产并接入

按[闪控球资产索引](../assets-catalog.md#闪控球)打开 [FloatingBallController.ets](../assets/FloatingBallController.ets)，复制到工程控制器目录，以实际源码核对参数、回调和清理行为。

采用资产时，保留知识库示例中的页面、参数和状态判断，将控制器操作映射到资产方法。每个控制器只由资产创建一次，资产统一持有控制器并管理内部监听，业务通过资产回调接入。知识库中的 `floatingBall.create()` 和内部监听注册由 `FloatingBallController.createFloatingBall(...)` 承接。需要点击恢复时传入目标 `Want`，由资产发起恢复。按需接入高版本能力。

将以下片段合入现有的串行开启入口。`context` 使用实际宿主的 `UIAbilityContext`，`startParams` 按知识库正文构造，`want` 按需传入。现有实例检查只能拦截已创建的控制器，入口还须防止创建请求并发。

```typescript
if (FloatingBallController.canUseFloatingBall() &&
    !FloatingBallController.floatingBallController) {
  await FloatingBallController.createFloatingBall({ context }, undefined, undefined, want);
  // 复核开启请求仍有效且应用仍在前台。取消时按资产索引清理本次实例并退出。
  await FloatingBallController.startFloatingBall(startParams);
}
```

收到 `STARTED` 通知后确认启动成功。

工程侧负责[兼容性与权限核对](../compatibility.md)、前台检查、入口防重和业务参数准备。首次改动前和交付时，按[权限提醒要求](../compatibility.md#权限声明acl-与用户授权)说明本次路线的权限条件和申请入口。窗球切换使用[绑定路线](binding.md)的组合资产，本条目在该场景仅用于核对球端参数。
版本升级遵循[通用兼容性规则](../../../shared/compatibility-model.md#升级接入对所有特性通用)，按实际使用的接口判断版本要求。

## 按状态验收

收到 `STARTED` 后才更新支持更新的模板，收到 `STOPPED` 后确认停止。资产清理内部监听与控制器引用，业务清理自己的订阅、定时器和图像。按[性能与验证](../performance-validation.md)及知识库正文核对实际接入结果。出现错误时读取[闪控球排障](../troubleshooting.md#闪控球错误码)，条件不满足时按[回退策略](../fallback.md)保留原业务。

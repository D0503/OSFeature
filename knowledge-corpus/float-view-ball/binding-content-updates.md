---
title: "闪控窗／球绑定后的内容更新"
summary: "说明绑定窗球如何共享业务数据、切换窗模板、更新球内容及轮换条目，并处理并发更新与实例替换。"
createdAt: "2026-11-11"
updatedAt: "2026-11-11"
tags: ["HarmonyOS", "闪控窗", "闪控球", "窗球绑定", "内容更新", "轮换"]
---

# 闪控窗／球绑定后的内容更新

以下步骤使用当前已绑定的一组系统控制器。`viewController` 由 `floatView.create` 返回，`ballController` 由 `floatingBall.create` 返回。业务状态通过两端各自的状态监听更新。首次接入和整组替换按[闪控窗／球绑定与解绑](binding.md)处理。

## 共享业务数据与选择更新方式

主页面、窗页面和球从同一份业务数据取值。窗通过已有 `AppStorage`、`LocalStorage` 或其他状态机制刷新页面，球通过 `updateFloatingBall` 更新当前条目的系统模板参数。列表用稳定业务 ID 标识条目。普通字段变化、列表增删和轮换沿用当前页面、控制器及绑定关系。

| 业务变化 | 处理方式 |
| --- | --- |
| 当前条目字段变化、条目增删 | 更新共享数据。窗通过页面状态刷新，球在允许更新时提交当前条目的最新参数。 |
| 窗从展开态切换到紧凑态，或反向切换 | 对当前窗调用 `switchTemplate`，成功后同步页面布局。 |
| 条目数量、显示区域或系统尺寸约束变化 | 按当前窗模板重算尺寸，调用 `setWindowSize`。 |
| 球轮换到下一条业务内容 | 沿用绑定时的球模板，调用 `updateFloatingBall`，不重建控制器。 |
| 业务明确要求替换整组窗球，或更换不能在线更新的球模板 | 停止旧组、确认双端终态、释放后重新准备和绑定 |

## 窗模板、页面布局与尺寸同步

用户通过系统交互在窗与球之间切换。展开／收起按钮只调整窗的 `ROUNDED_RECTANGLE` 或 `HORIZONTAL_BAR` 模板，继续使用当前绑定和球控制器。

切换前查询目标模板的限制。下例以紧凑横条的最大尺寸演示，实际 `targetSize` 由业务按 `limits.minSize`、`limits.maxSize` 和 `limits.ratioLimits` 选定。宽高单位为 px。片段在现有的异步错误处理入口中执行。

```typescript
const templateType = floatView.FloatViewTemplateType.HORIZONTAL_BAR;
const limits = floatView.getFloatViewLimits(templateType);
const targetSize: window.Size = { width: limits.maxSize.width, height: limits.maxSize.height };
const property: floatView.TemplateProperty = {
  templateType: templateType,
  size: targetSize
};
await viewController.switchTemplate(property);
// 成功后再同步窗页面的紧凑布局状态。
```

系统模板切换完成后，页面通过自己的展开／紧凑状态更新内容布局。接口失败时保留原布局，切回展开态时重新查询展开模板的限制。过渡动画可按业务需求实现，以接口结果确认模板切换成功。完整组件与避让示例见[闪控窗模板切换与页面避让](float-view-template-and-avoidance.md)。

**仅调整窗尺寸**：模板保持不变时，用 `await viewController.setWindowSize(size)` 调整尺寸。条目数量、可用区域、`onLimitsChange` 和已有断点状态变化时，按当前模板重算。设计值由实际 `UIContext.vp2px()` 转为 px，再核对宽高和比例。折叠、旋转或分屏时需要跟随已有断点的场景，参照[闪控窗屏幕尺寸与断点响应](float-view-breakpoint-resize.md)。

`onLimitsChange` 表示限制变化。系统可能调整请求尺寸，实际矩形以 `onRectChange` 为准。紧凑态内容行按内容自适应高度，通过根容器垂直居中。内容超出窗口上限时，在页面内滚动或截断。属性查询失败时保留当前布局。

常规态顶部预留 32vp，紧凑态顶部预留 4vp，并随页面状态同步。紧凑态左右分别读取当前窗 `getWindowProperties().avoidArea` 的 `leftRect.width` 与 `rightRect.width`，通过 `px2vp()` 换算后各加 6vp 页面留白。左右避让同时覆盖摘要和展开按钮。模板切换或实际矩形变化后重新读取避让，页面退出时退订自身注册的监听。

## 球内容更新与条目轮换

球收到 `STARTED` 且当前实例仍有效时，构造新的 `floatingBall.FloatingBallParams`，保持绑定时的模板。`STATIC` 模板不支持内容更新。下例适用于以 `NORMAL` 模板绑定的球，`title` 与 `content` 取自同一当前业务条目。标题必填且非空，两者各不超过 64 UTF-8 字节。

```typescript
const updateParams: floatingBall.FloatingBallParams = {
  template: ballParams.template,
  title: title,
  content: content
};
await ballController.updateFloatingBall(updateParams);
```

业务有多条内容需要轮换时，在业务模型中保存当前展示条目的稳定 ID 和下一条 ID，不把轮换逻辑放入通用控制器：

- 数据事件到达时，按当前条目的稳定 ID 读取最新数据并刷新它。轮换任务到期时才从最新列表中选择下一条。
- 当前条目被删除时，优先展示仍存在的下一条，否则回到首条。列表为空时停止轮换。窗球仅为该列表服务时，可按业务策略结束整组展示。
- 球未进入 `STARTED` 或正在停止时，只保留最新数据。每个实例串行提交更新，高频事件合并为最新值。等待当前更新请求结束后，再复核实例、状态和最新业务数据，决定是否提交下一次。
- 更新失败时记录具体接口和平台错误，保留当前组供后续处理。停止或替换时清理轮换定时器和数据订阅，晚到结果仅归属于旧实例。页面切换布局时，由组件清理自身动画和监听，整组业务订阅由其所有者管理。

列表清空后的关闭策略由业务决定；若该窗球仅服务于列表内容，可停止整组并释放。窗组件切换布局时清理自己的动画和显示监听，整组业务订阅由组合流程的所有者清理，避免切换布局后重复订阅。

窗的防窥蒙层覆盖所指定的闪控窗。球中敏感数据的保护策略需按球的实际显示行为单独处理。

## 验证要点

- 同一条目更新后，分别切到窗和球，核对两端均使用最新数据。验证删除、重排、空列表和高频更新时的轮换及状态处理。
- 验证窗模板往返切换后的实际矩形、顶部预留、左右避让与按钮可交互区域。失败时保留原布局，并核对控制器和绑定仍为当前组。 [华为闪控窗 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview) · [华为闪控球 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatingball)

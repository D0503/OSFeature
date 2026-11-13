---
title: "智感握姿握持手感知与订阅"
summary: "握持手版本与权限、页面状态、事件枚举、订阅生命周期及代码示例。"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS", "智感握姿"]
---

# 智感握姿握持手感知与订阅

在承载目标组件的页面中接入：监听握持手事件，更新页面的位置状态，由原组件布局和转场动画呈现变化。只改用户指定的高频、难触达操作，保留业务事件、数据、控制器和响应式布局。

握持手可以驱动原组件位移，也可以驱动新增的同步入口。新增模式只调整新增组件的位置，原组件不动；两组共享页面已有业务状态和操作方法，由页面统一订阅握持手事件。

## 1. 权限与版本

在所属 HAP 的 `module.json5` 声明 `ohos.permission.DETECT_GESTURE`，填写 `reason` 与 `usedScene`；此权限不需要运行时请求授权。

SDK/compile 至少 API 20。通过 `@kit.MultimodalAwarenessKit` 导入 `motion`；运行时 API 20+ 和 `canIUse('SystemCapability.MultimodalAwareness.Motion')` 都满足后才进入新接口路径。compatible 低于 20 时保护整个新调用路径；SysCap 不能代替版本检查，也不能保证具体硬件支持。

## 2. 页面状态与事件回调

沿用页面现有状态管理方式：V1 页面使用 `@State`，V2 页面使用 `@Local`，不为接入特性迁移整个页面。状态按职责区分：

| 状态 | 用途 |
|---|---|
| 原位置 | 接入前布局在当前断点、方向和窗口尺寸下的位置，关闭时据此恢复 |
| 当前侧 | 跟手目标实际呈现的左右位置；原组件位移时初值取原布局，新增模式收到首个有效方向前不展示新增入口 |
| 订阅成功标志 | 避免重复监听，判断是否需要退订 |
| 页面可见与功能启用状态 | 决定是否接受事件；隐藏或关闭后忽略迟到回调 |
| 交互状态与待应用方向 | 按压、长按、拖动期间暂缓移动，结束后再应用有效方向 |

在页面定义稳定的 `handleHoldingHandChange: Callback<motion.HoldingHandStatus>` 回调，用同一函数实例订阅和退订。回调先检查页面是否可见、功能是否启用，再处理状态：

| HoldingHandStatus | 处理 |
|---|---|
| `LEFT_HAND_HELD = 1` | 目标方向为左；与当前侧相同则不重复动画 |
| `RIGHT_HAND_HELD = 2` | 目标方向为右；与当前侧相同则不重复动画 |
| `NOT_HELD = 0`、`BOTH_HANDS_HELD = 3`、`UNKNOWN_STATUS = 16` | 保持当前侧；首次无有效方向时原组件保持初始位置，新增入口保持未展示 |

此枚举的未知值是 16，不是操作手枚举中的 0。暂时无回调也保持当前侧，不能通过超时归位或推断系统关闭。首次订阅可返回当前握持状态，不添加不存在的 `getRecentHoldingHandStatus()`。

目标正在操作时不立即移动，暂存最后一个有效方向；交互结束后仅在页面可见、功能仍启用时应用。关闭或错误时清空待应用方向。回调只更新必要状态，不重建业务数据。

## 3. 订阅与页面生命周期

1. 页面出现且满足启用条件时，在 `try/catch` 内调用 `motion.on('holdingHandChanged', this.handleHoldingHandChange)`；仅调用成功后设置订阅标志。已有有效订阅时不重复调用。
2. 页面消失时清理 `holdingHandChanged` 订阅；此路线的 off 门槛为 API 20+。
3. `aboutToAppear` / `aboutToDisappear` 适用于组件出现和消失；缓存页面、Tab 切换、前后台场景须结合工程实际可见性处理，不能假设切换页面一定触发组件销毁。
4. 页面隐藏或进入后台时停止感知、忽略迟到回调，不更新隐藏页面。缓存页面保留位置状态，重新可见且功能启用后恢复监听；新建页面以原布局初始化。

以下片段合并到已有页面。`canUseHoldingHand()` 由工程实现，同时检查运行 API 20+ 与 `canIUse('SystemCapability.MultimodalAwareness.Motion')`；`holdingSubscribed` 仅在 on/off 成功后改变。页面出现时先设为可见再调用 `startHoldingHand()`，`aboutToDisappear` 先设为不可见再调用 `stopHoldingHand()`：

```arkts
import { motion } from '@kit.MultimodalAwarenessKit'

handleHoldingHandChange: Callback<motion.HoldingHandStatus> = (status) => {
  if (!this.canUseHoldingHand()) return
  if (status === motion.HoldingHandStatus.LEFT_HAND_HELD) {
    this.applyHoldingSide(false)
  } else if (status === motion.HoldingHandStatus.RIGHT_HAND_HELD) {
    this.applyHoldingSide(true)
  }
}

private startHoldingHand(): void {
  if (this.holdingSubscribed || !this.canUseHoldingHand()) return
  try {
    motion.on('holdingHandChanged', this.handleHoldingHandChange)
    this.holdingSubscribed = true
  } catch (error) {
    // 记录 201、801 或服务错误，恢复接入前布局与功能。
  }
}

private stopHoldingHand(): void {
  if (!this.holdingSubscribed || !this.canUseHoldingHand()) return
  try {
    motion.off('holdingHandChanged', this.handleHoldingHandChange)
    this.holdingSubscribed = false
  } catch (error) {
    // 记录退订错误并保留订阅标志，避免下一次重复 on。
  }
}
```

`applyHoldingSide` 仅对新的有效方向移位，正在操作目标时先缓存方向；未知、双手、未握持状态不进入该方法。功能关闭时同样调用受守卫保护的 `stopHoldingHand()`，并恢复原位置；退订失败的后续处理见智感握姿 Skill 的「自定义路径的共同约束」。

## 4. 组合

自定义按钮由 `holdingHandChanged` 控制；如同时接入 HdsTabs，其位置交给 `adaptToHandedness`，不得用两种信号争抢同一组件。单独接入握持手感知不要求引入 HdsTabs、沉浸材质、新闻页面、引导弹窗或持久化逻辑。
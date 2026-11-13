---
title: "智感握姿握持手布局与转场"
summary: "左右布局、初始坐标、屏外换侧、拖拽及 ArkTS 示例。"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS", "智感握姿"]
---

# 智感握姿握持手布局与转场

侧边悬浮按钮在现有容器中设置左右对齐；容器适合时，可采用 `RelativeContainer` 内的左右条件分支，分别设置 `HorizontalAlign.Start/End`，底部对齐保持一致。

侧边切换使用 `TransitionEffect.move(TransitionEdge.START/END)` 从对应屏外进出，避免按钮横穿内容区域。首次出场位移使用 `curves.interpolatingSpring(0, 1, 200, 17)`，屏外移入和移出使用 `curves.interpolatingSpring(0, 1, 170, 17)`。首次出场标志放在页面状态中，不因条件分支重建而重复触发首次动画。

若窗口尺寸异步取得，先计算接入前初始位置并写入初始分支，再打开渲染门禁；不能让坐标仍为 `0` 的占位分支先出现，否则首次会从错误侧滑入。换侧前分别设置入场分支的目标坐标和 `START/END`，退场分支保留自己的坐标和边直到离场结束。Builder 内的位置属性直接读取该分支的响应式位置状态，不依赖一次性传入的普通数值参数；原按钮可手动拖动时，拖动只更新当前分支，未收到新有效方向时保持用户放置的位置，同侧重复结果不把它吸回预置侧。

以下片段并入现有 V2 页面；V1 页面将 `@Local` 换成原有状态管理方式。先用当前窗口布局算出 `initialX`、`top` 和原按钮所在侧，再调用 `initButtonPosition()`；计算失败时仍须用接入前位置显示原按钮。`targetX` 由当前容器宽度、按钮宽度和原有边距计算，不写死示例坐标。按钮内容、点击和触摸事件沿用原组件：

```arkts
import { curves } from '@kit.ArkUI'

@Local positionReady: boolean = false
@Local showingA: boolean = false
@Local branchAX: number = 0
@Local branchBX: number = 0
@Local branchAEdge: TransitionEdge = TransitionEdge.START
@Local branchBEdge: TransitionEdge = TransitionEdge.END
@Local buttonTop: number = 0
@Local hasAppeared: boolean = false
private currentRight: boolean = true

private initButtonPosition(initialX: number, top: number, right: boolean): void {
  this.branchBX = initialX
  this.branchBEdge = right ? TransitionEdge.END : TransitionEdge.START
  this.buttonTop = top
  this.currentRight = right
  this.positionReady = true
}

private moveToSide(right: boolean, targetX: number): void {
  if (right === this.currentRight) return
  if (this.showingA) {
    this.branchBX = targetX
    this.branchBEdge = right ? TransitionEdge.END : TransitionEdge.START
  } else {
    this.branchAX = targetX
    this.branchAEdge = right ? TransitionEdge.END : TransitionEdge.START
  }
  this.currentRight = right
  this.showingA = !this.showingA
}

build() {
  if (this.positionReady) {
    if (this.showingA) {
      this.buttonBranch(true)
    } else {
      this.buttonBranch(false)
    }
  }
}

@Builder
private buttonBranch(a: boolean) {
  Column() {
    // 放入原按钮内容，保留原业务事件。
  }
  .position({ x: a ? this.branchAX : this.branchBX, y: this.buttonTop })
  .transition(TransitionEffect.move(a ? this.branchAEdge : this.branchBEdge)
  .animation({
    curve: this.hasAppeared ? curves.interpolatingSpring(0, 1, 170, 17) : curves.interpolatingSpring(0, 1, 200, 17)
  }))
  .onAppear(() => { this.hasAppeared = true })
}
```

通过 `if/else` 切换左右分支时，退出分支中的组件沿当前侧滑出，进入分支中的组件从对侧滑入。分别为分支配置 `TransitionEffect.move(...).animation({ curve: ... })`，两个过渡由框架同步执行，无需手动编排先后时序。转场须挂在实际按钮节点上，核对定位坐标系和父容器宽度，确保 `START/END` 对应可视区域的屏外，而非只离开局部容器。不要用定时器串联“隐藏、等待、再显示”，也不要在两段动画之间插入空白状态。这里的退出/进入组件是同一跟手目标的左右呈现，不是新增模式中持续保留的原入口；原入口不参加这次换侧动画。

沿用原按钮尺寸、安全区、垂直高度及断点边距，左右边距保持一致，不直接复制固定底部间距。条件分支共享原业务状态和事件，避免切换时重置输入、选中态或控制器。底部成组组件则整体平移，保持组内顺序和间距。

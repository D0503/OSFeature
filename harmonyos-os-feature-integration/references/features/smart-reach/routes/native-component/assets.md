# 原生适配资产

以下为当前 API 23+ HdsTabs 属性片段，合并到已有组件的链式属性中；`this.followOperatingHand` 取自项目已有增强状态。已有 `barFloatingStyle` 的其他字段须原样保留，不能以此片段覆盖完整对象。

```ts
.barOverlap(true)
.vertical(false)
.barPosition(BarPosition.End)
.barFloatingStyle({
  adaptToHandedness: this.followOperatingHand
})
```

此片段不构成完整页面。组件引入为 `@kit.UIDesignKit` 的 HdsTabs，SDK/compile API 23+；新属性调用链受运行版本保护，低版本调用原 Builder。只设置布尔值而在低版本仍调用 barFloatingStyle 不是充分保护。

当前路线资产仅适用于 HdsTabs，不推断其他组件。

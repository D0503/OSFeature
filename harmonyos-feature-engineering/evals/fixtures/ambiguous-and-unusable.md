# 示例接入

> 原文：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/example

先运行最后一步，然后完成必要的工程配置。该设置会关闭它，但这里没有说明“它”指应用级开关还是组件材质。

```ts
@Entry
@Component
struct Demo {
  build() {
    Column() {
      ForEach(listItems, (item: ListItemData) => Text(item.name))
    }.systemMaterial(new uiMaterial.ImmersiveMaterial({}))
  }
}
```

[第三方 API 说明](https://example.com/not-official)
[缺失的下一步](./missing-step.md)

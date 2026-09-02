# ArkUI 通用材质

本文件适用于明确支持 `systemMaterial` 或组件专属材质字段的目标。先完成[开启策略](activation.md)，再根据目标组件加载分类文档。

## 基础写法

```typescript
import { uiMaterial } from '@kit.ArkUI';

Column() {
  Text('内容')
}
.backgroundColor(Color.Transparent)
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
  interactive: true,
  lightEffect: { color: undefined }
}))
```

| 参数 | 作用 | 注意 |
|---|---|---|
| `style` | 材质厚度 | `ULTRA_THIN`、`THIN`、`REGULAR`、`THICK`、`ULTRA_THICK` |
| `materialColor` | 材质赋色 | 应带透明度；完全不透明颜色会遮挡滤镜效果 |
| `colorInvert` | 子树前景自动反色 | 文字、图标须使用支持反色的系统颜色资源，硬编码颜色不会自动反色 |
| `applyShadow` | 材质阴影 | 默认开启；需要自定义阴影时关闭材质阴影 |
| `interactive` | 按压弹性形变 | 部分预设组件不直接采用传入参数 |
| `lightEffect` | 触摸流光 | 可能替代组件原有点击态和悬浮态；低算力设备会降级 |

## 属性覆盖

- 除阴影外，材质与受影响通用属性冲突时，后设置者生效；
- 普通样式前置、`systemMaterial` 后置时，不支持设备保留普通样式，支持设备由材质覆盖；
- `systemMaterial` 后再设置不透明 `backgroundColor` 或背景模糊，会遮挡材质；
- `applyShadow: true` 时材质阴影优先于通用阴影；
- 需要跨算力档位保持同一颜色时，用带透明度的 `materialColor`，不要再叠加背景色；
- Select、Navigation、Tabs、ChipGroup、SegmentButton 等存在专属材质入口，先使用组件文档指定的入口。

## 视觉区域

材质作用于组件布局区域，不一定等于文字、图标或自绘内容的可视轮廓。出现矩形背板、TextArea 内容层遮挡或薄材质边缘折射时，先检查 `width`、`height`、`borderRadius`、内容层背景和材质厚度，不用叠加更多模糊掩盖问题。

## 资产使用

- 能力与版本门禁使用 [ImmersiveMaterialGuard.ets](../../assets/ImmersiveMaterialGuard.ets)；
- 通用组件降级模式使用 [ArkuiMaterialFallbackEntry.ets](../../assets/ArkuiMaterialFallbackEntry.ets)；
- 原生标题栏与悬浮页签使用 [ArkuiNavigationTabsEntry.ets](../../assets/ArkuiNavigationTabsEntry.ets)。

资产是可复制骨架，不替代目标工程真实构建与真机验证。

## 来源

- [沉浸式系统材质视效](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-common-capability)
- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)


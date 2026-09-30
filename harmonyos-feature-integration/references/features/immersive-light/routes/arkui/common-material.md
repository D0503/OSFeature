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
| `style` | 材质厚度 | 默认 `REGULAR`；只影响高、中算力设备，低算力设备不区分五种样式 |
| `materialColor` | 材质赋色 | 应带透明度；完全不透明颜色会遮挡滤镜效果；低算力设备将其作为背景色 |
| `colorInvert` | 子树前景自动反色 | 只在高、中算力设备生效，薄材质和较强系统档位更容易触发；颜色须使用支持反色的系统资源 |
| `applyShadow` | 材质阴影 | 默认开启；需要自定义阴影时关闭材质阴影 |
| `interactive` | 按压弹性形变 | 对所有支持材质的算力档位生效；部分预设组件不直接采用传入参数 |
| `lightEffect` | 触摸点光源反馈 | `{}` 开启默认白色流光，`null` 显式关闭，`undefined` 保留组件默认；只在高、中算力设备生效 |

## 属性覆盖

- 除阴影外，材质与受影响通用属性冲突时，后设置者生效；
- 普通样式前置、`systemMaterial` 后置时，不支持设备保留普通样式，支持设备由材质覆盖；
- `systemMaterial` 后再设置不透明 `backgroundColor` 或背景模糊，会遮挡材质；
- `applyShadow: true` 时材质阴影优先于通用阴影；
- 需要跨算力档位保持同一颜色时，用带透明度的 `materialColor`，不要再叠加背景色；
- Select、Navigation、Tabs、ChipGroup、SegmentButton 等存在专属材质入口，先使用组件文档指定的入口。

## 生效区域门禁

接口可调用不等于当前位置会生效。弹窗、菜单及官方明确支持全页面的 Select、Toggle、Slider 等可以在页面内使用；其他普通容器和交互组件只在 Navigation/NavDestination 标题栏或有效的底部横向悬浮 TabBar 内生效。生成代码前先查询[组件矩阵](component-profile.json)的 `effectScopes`。

出现 `Material inactive: out of scope. Use component in navigation title bar or Tabbar.` 时，先调整组件位置或保留普通样式，不要继续叠加背景模糊或重复材质。

## 视觉区域

材质作用于组件布局区域，不一定等于文字、图标或自绘内容的可视轮廓。出现矩形背板、TextArea 内容层遮挡或薄材质边缘折射时，先检查 `width`、`height`、`borderRadius`、内容层背景和材质厚度，不用叠加更多模糊掩盖问题。

## 资产使用

- 能力与版本门禁使用 [ImmersiveMaterialGuard.ets](../../assets/ImmersiveMaterialGuard.ets)；
- 通用组件的调用保护与回退方式见[共享回退策略](../../shared/fallback.md)；
- 原生标题栏与悬浮页签的配置组合见[导航类组件](components/navigation.md)。

资产是可复制骨架，不替代目标工程真实构建与真机验证。

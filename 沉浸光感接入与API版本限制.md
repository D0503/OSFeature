# HarmonyOS 沉浸光感接入与 API 版本限制

> 整理日期：2026-08-31  
> 文档范围：HarmonyOS UI Design Kit（HDS）与 ArkUI 沉浸光感能力

## 1. 总体结论

“沉浸光感”不是窗口沉浸式或状态栏安全区避让，而是一套由“系统材质 + 空间动效”组成的视觉能力。

目前存在两代接入路径：

| 接入路径 | 起始版本 | 适用范围 |
|---|---:|---|
| UI Design Kit / HDS | HarmonyOS 6.1.0，API 23 | HDS 标题栏、底部页签，接入简单 |
| ArkUI `uiMaterial` | API 26 | 普通 ArkUI 组件、弹窗、菜单和自定义布局，控制能力更完整 |

API 23～25 主要使用 HDS 组件；API 26 开始才提供通用的 `ImmersiveMaterial`、`systemMaterial`、应用级开关、自动反色、交互形变和光感反馈。

参考文档：

- [UI Design Kit 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material)
- [ArkUI 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense)
- [沉浸光感最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-spatiality-immersive)

### 1.1 三类文档的定位关系

| 文档 | 主要作用 | 所属能力 |
|---|---|---|
| 最佳实践《空间化-沉浸光感》 | 提供从整体框架、标题栏、底部导航到内容区的端到端适配策略 | 跨 ArkUI 与 UI Design Kit |
| 开发指导《ArkTS 沉浸光感》 | 说明 `uiMaterial.ImmersiveMaterial`、`systemMaterial`、应用级开关及通用组件接入 | ArkUI（`@kit.ArkUI`） |
| 开发指导《HDS 组件材质》 | 说明 `HdsNavigation`、`HdsTabs` 的 `systemMaterialEffect` 接入 | UI Design Kit（`@kit.UIDesignKit`） |

### 1.2 典型应用场景

- **应用首眼沉浸**：标题栏、底部导航和首屏内容使用统一的材质语言。
- **自适应悬浮导航**：使用悬浮 HDS 页签、MiniBar 和多设备布局，提升操作区域的层次感。
- **智感握姿交互**：在支持的设备上让底部悬浮导航根据用户握持状态调整位置。

选型时应先判断系统版本和组件体系：API 23～25 优先使用 HDS 路线；API 26+ 可以继续使用 HDS 承担导航框架，并使用 ArkUI `uiMaterial` 扩展普通组件、菜单和弹窗。

## 2. 可接入组件

### 2.1 API 23：HDS 组件

| 组件 | 接口 | 效果 |
|---|---|---|
| `HdsNavigation` / `HdsNavDestination` | `TitleBarStyleOptions.systemMaterialEffect` | 标题栏返回按钮、菜单按钮的沉浸光感 |
| `HdsTabs` | `HdsTabsFloatingStyle.systemMaterialEffect` | 悬浮胶囊式底部页签 |
| HDS 标题栏 | `scrollEffectOpts` | `GRADIENT_BLUR` 或 `IMMERSIVE_GRADIENT_BLUR` 滚动渐变模糊 |
| HDS 底部页签 | `barFloatingStyle.miniBar` | 可折叠 MiniBar，可与沉浸光感组合 |

HDS 材质接口支持 Phone、Tablet、PC/2in1，从 6.1.0(23) 开始，且只能在 Stage 模型下使用。

参考：[hdsMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial)

推荐配置：

```typescript
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

如果不使用自适应模式，应先查询设备能力：

```typescript
const types = hdsMaterial.getSystemMaterialTypes();
```

- 支持 `IMMERSIVE`：可以使用 `EXQUISITE` 或 `GENTLE`。
- 不支持 `IMMERSIVE`：建议降级为 `SMOOTH`，避免发热和卡顿。
- 一般业务优先使用 `ADAPTIVE + ADAPTIVE`。

### 2.2 API 26：普通 ArkUI 组件

所有支持通用属性的组件，都可以显式调用 `systemMaterial`，包括 `Button`、`Column`、`Row`、卡片容器和自定义布局等：

```typescript
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
  interactive: true,
  lightEffect: { color: undefined }
}))
```

弹出类能力可以通过各自的 Options 设置：

| 场景 | 接口 |
|---|---|
| Toast | `ShowToastOptions.systemMaterial` |
| Popup | `PopupOptions.systemMaterial` |
| Tips | `TipsOptions.systemMaterial` |
| Sheet | `SheetOptions.systemMaterial`，该属性从 API 26.0.0 新增 |
| Menu | `MenuOptions.systemMaterial`，适用于 `bindMenu` 和 `openMenu` |
| Dialog | Dialog 对应 Options 的 `systemMaterial` |
| Select | 按钮使用 `systemMaterial`，下拉菜单使用 `menuSystemMaterial` |

`showToast` 未主动指定 `systemMaterial` 时，默认采用 `THICK` 材质；实际是否默认生效还受到应用 `MaterialState` 和其他冲突样式影响。

参考：

- [systemMaterial 通用属性](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)
- [uiMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial)

## 3. API 26 应用级开关

在 entry 模块的 `module.json5` 中配置：

```json5
{
  "module": {
    "type": "entry",
    "metadata": [{
      "name": "ohos.arkui.UIMaterial.state",
      "value": "enable"
    }]
  }
}
```

使用限制：

- `targetAPIVersion` 必须不低于 `26.0.0`。
- 只有 entry 类型 module 中的配置生效。

### 3.1 MaterialState

| JSON5 配置值 | ArkTS 枚举 | 行为 |
|---|---|---|
| `default` | `MaterialState.DEFAULT` | Dialog、Toast、AlphabetIndexer，以及 Text 长按/双击文本菜单，在未自定义背景、模糊、阴影时默认开启 |
| `enable` | `MaterialState.ENABLE` | 额外默认开启 Chip、ChipGroup、Select、菜单控制、Toggle、Slider、SegmentButton、SegmentButtonV2、SelectionMenu 等 |
| `disable` | `MaterialState.DISABLE` | 全局禁止；即使显式调用 `systemMaterial` 也不生效 |

可以通过 `uiMaterial.getMaterialInfo()` 在运行时读取当前应用的材质配置状态。该信息来自 entry 模块 `module.json5` 中的 metadata，适合用于诊断组件为什么自动开启或没有开启材质：

```typescript
import { uiMaterial } from '@kit.ArkUI';

const materialInfo: uiMaterial.MaterialInfo = uiMaterial.getMaterialInfo();

if (materialInfo.state === uiMaterial.MaterialState.ENABLE) {
  console.info('Application-level immersive material is enabled.');
}
```

### 3.2 默认材质样式

| 组件 | 默认样式 |
|---|---|
| Dialog | `ULTRA_THICK` |
| Toast | `THICK` |
| AlphabetIndexer | `THICK` |
| Chip / ChipGroup | `ULTRA_THIN` |
| Select 按钮 | `ULTRA_THIN` |
| Select 下拉菜单 | `THICK` |
| 菜单控制 | `THICK` |
| SegmentButton / SegmentButtonV2 | `THIN` |
| Text 文本菜单 | `THICK` |
| Toggle / Slider | 不直接对应某个材质厚度样式 |

### 3.3 单组件关闭

单组件显式关闭应使用：

```typescript
.systemMaterial(uiMaterial.Material.empty)
```

需要特别注意：

- `uiMaterial.Material.empty`：显式关闭组件材质。
- `undefined`：恢复系统默认状态。
- 在 `ENABLE` 模式下，设置为 `undefined` 可能重新启用默认材质，并不等价于明确关闭。

最佳实践页面里的“.systemMaterial(undefined) 关闭”描述不够严谨，应以最新指南和 API 参考中的 `Material.empty` 语义为准。

## 4. API 26 材质参数

### 4.1 ImmersiveStyle

`ImmersiveStyle` 提供五档厚度：

| 样式 | 说明 | 推荐场景 |
|---|---|---|
| `ULTRA_THIN` | 超薄、透明度最高 | 浮动工具栏、悬浮按钮 |
| `THIN` | 较薄、透明度较高 | 搜索框、轻量提示 |
| `REGULAR` | 常规厚度 | 卡片、通用内容区域 |
| `THICK` | 较厚、模糊较强 | 菜单 |
| `ULTRA_THICK` | 最厚、模糊最强 | 弹窗、需要明显遮挡背景的区域 |

### 4.2 ImmersiveOptions

| 参数 | 作用 | 默认值/限制 |
|---|---|---|
| `style` | 材质厚度和视觉样式 | 默认 `REGULAR`；完整差异主要在高/中算力设备生效 |
| `materialColor` | 为材质层赋色 | 默认 `undefined`；完全不透明颜色会遮挡滤镜 |
| `colorInvert` | 子树前景色自动反色 | 默认 `false`；仅薄材质及指定颜色资源生效 |
| `applyShadow` | 使用材质自带阴影 | 默认 `true`；优先于通用 `shadow` |
| `interactive` | 按压弹性形变 | 默认 `false` |
| `lightEffect` | 触摸流光反馈 | 默认 `undefined`；低算力设备不支持完整效果 |

## 5. 设备算力与系统设置限制

### 5.1 算力分档

| 能力 | 高/中算力 | 低算力 |
|---|---|---|
| 材质滤镜、模糊、高光 | 支持 | 降级为背景色、边框和阴影 |
| `style` 的完整差异 | 支持 | 不完整 |
| `colorInvert` | 支持，且受材质厚度限制 | 不支持 |
| `lightEffect` | 支持 | 不支持 |
| `interactive` | 支持 | 支持降级效果 |
| Dialog/Menu 自动空间动效 | 有条件支持 | 不支持 |

### 5.2 空间动效自动生效条件

- 高算力设备：系统沉浸光感配置为“强”或“均衡”时生效。
- 中算力设备：仅配置为“强”时生效。
- 低算力设备：不支持空间动效。
- 当前主要自动应用于 Dialog 和菜单的弹出过程。
- 沉浸式系统材质会自动适配系统深色和浅色模式，无需分别创建两套 `ImmersiveMaterial` 参数。

## 6. 两套 MaterialLevel 不要混用

UI Design Kit 和 ArkUI 中都存在 `MaterialLevel`，但语义不同：

| API | `MaterialLevel` 含义 |
|---|---|
| `hdsMaterial.MaterialLevel`，API 23 | 开发者选择的视觉强度：`EXQUISITE`、`GENTLE`、`SMOOTH`、`ADAPTIVE` |
| `uiMaterial.MaterialLevel`，API 26 | 设备算力档位：高、中、低；通过 `getGlobalMaterialLevel()` 获取，不可修改 |

HDS 的档位可按以下方式理解：

| 效果档位 | HDS 枚举 | 说明 |
|---|---|---|
| 强 | `EXQUISITE` | 完整效果，适合支持沉浸式材质的高性能设备 |
| 均衡 | `GENTLE` | 在视觉效果与性能之间取得平衡 |
| 弱 | `SMOOTH` | 轻量效果，适合不支持完整沉浸式材质的设备 |
| 系统自适应 | `ADAPTIVE` | 系统根据设备能力决定实际档位，推荐默认使用 |

API 26 判断设备能力应使用：

```typescript
const supported: boolean = uiMaterial.isImmersiveMaterialSupported();
const level: uiMaterial.MaterialLevel = uiMaterial.getGlobalMaterialLevel();
```

在不支持沉浸式材质的设备上，设置 `ImmersiveMaterial` 不会报错，但不会产生材质效果。因此仍应提供普通 `backgroundColor`、边框等降级样式。

## 7. 推荐开发流程

### 7.1 确定兼容范围

- API 23～25：只接入 HDS Navigation/HdsTabs 沉浸光感。
- API 26+：HDS 用于导航框架，`uiMaterial` 用于普通组件和弹窗。
- 同时兼容旧系统时，使用 `deviceInfo.apiAvailable('26.0.0')` 保护 API 26 代码。

示例：

```typescript
if (deviceInfo.apiAvailable('26.0.0') &&
  uiMaterial.isImmersiveMaterialSupported()) {
  // 使用 API 26 沉浸式系统材质
} else {
  // 使用普通背景色、边框等降级样式
}
```

#### 跨版本兼容适配器

如果 Menu、Popup、Sheet 等多个入口都需要处理版本兼容，可以把判断和材质构造集中到工具类中，避免各页面重复编写条件分支。下面以 `MenuOptions` 为例；其他 Options 应使用各自的明确类型实现对应方法，不使用动态类型或不安全的泛型断言。

```typescript
import { uiMaterial } from '@kit.ArkUI';
import { deviceInfo } from '@kit.BasicServicesKit';

export class MaterialAdapter {
  public static withMenuMaterial(options: MenuOptions): MenuOptions {
    if (!deviceInfo.apiAvailable('26.0.0') ||
      !uiMaterial.isImmersiveMaterialSupported()) {
      return options;
    }

    options.systemMaterial = new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.THICK,
      interactive: true,
      lightEffect: { color: undefined }
    });
    return options;
  }
}
```

在不支持 API 26 或沉浸式材质的设备上，适配器原样返回 Options，并保留组件原有的普通背景、边框和模糊降级样式。

### 7.2 框架先行

- `Navigation` 替换为 `HdsNavigation/HdsNavDestination`。
- `Tabs` 替换为 `HdsTabs`。
- 开启 `barOverlap(true)`，配置 `barFloatingStyle`。
- 标题栏通过 `titleBar.style.systemMaterialEffect` 设置材质。
- 通过 `scrollEffectOpts` 设置滚动渐变模糊，并使用 `bindToScrollable` 绑定内容滚动组件。
- 需要随滚动隐藏标题栏或状态栏时，配置 `dynamicHideTitleBar`。

这几个接口各自负责不同层次：`systemMaterialEffect` 负责材质，`scrollEffectOpts` 负责滚动模糊，`dynamicHideTitleBar` 负责标题栏和状态栏显隐，`bindToScrollable` 负责把效果与内容滚动同步。

```typescript
HdsNavigation() {
  // 页面内容
}
.titleBar({
  content: {
    title: {
      mainTitle: 'Title'
    }
  },
  style: {
    scrollEffectOpts: {
      enableScrollEffect: true,
      scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR
    },
    systemMaterialEffect: {
      materialType: hdsMaterial.MaterialType.ADAPTIVE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
    }
  }
})
.dynamicHideTitleBar({
  hideTitleArea: true,
  hideStatusBar: true,
  mode: HideMode.SCROLL_UP_TO
})
.bindToScrollable([this.scroller])
```

- `IMMERSIVE_GRADIENT_BLUR`：标题栏从完全透明渐变到模糊，过渡范围更大，沉浸感更强。
- `GRADIENT_BLUR`：从半透明渐变到模糊，表现相对克制。

### 7.3 优先使用系统自适应材质

- HDS：推荐 `ADAPTIVE + ADAPTIVE`。
- ArkUI：使用 `ImmersiveMaterial`，由系统根据设备算力和用户设置自动降级。

### 7.4 局部增加交互

- 可点击容器设置 `interactive: true`。
- 重点操作设置 `lightEffect`。
- 薄材质上的文字使用系统颜色资源，并根据需要启用 `colorInvert`。

### 7.5 测试矩阵

至少覆盖：

- API 23 和 API 26。
- 高、中、低算力设备。
- 系统沉浸光感“强、均衡、弱”三档。
- 深色模式和浅色模式。
- Web 同层渲染场景。
- 动态背景、滚动列表和弹窗性能。

## 8. 约束与性能注意事项

### 8.1 API 与渲染限制

- API 23 及以前的 SDK 中，Web 同层渲染场景里，内嵌 ArkUI 控件开启光感可能变透明。
- 出现上述问题时，应关闭对应控件的沉浸光感，或者关闭同层渲染。
- ArkUI `uiMaterial` 接口只能在 Stage 模型下使用。
- API 26 应用级配置只对 entry 模块生效。

### 8.2 控制材质面积和层数

- 不要给整页或超大面积背景设置材质。
- 不要在父子节点上重复嵌套材质。
- 不要给大量 ListItem 分别设置材质。
- Dialog 和 Menu 开启空间动效时应控制尺寸，避免接近全屏导致逐帧形变与流光绘制开销显著增加。
- 优先把材质限定在卡片、工具栏、悬浮按钮等局部区域。

### 8.3 避免重复视觉计算

- 不要同时叠加 `backgroundBlurStyle`、`backgroundEffect`。
- 不要把材质覆盖在视频、动图等持续变化的内容上。
- 避免持续修改材质区域的尺寸、位置、透明度和材质参数。
- 避免在材质区域内频繁增加或删除子节点。
- 避免对材质区域执行无限循环动画。

### 8.4 阴影与属性优先级

- `applyShadow: true` 时，材质阴影优先于通用 `shadow`。
- 需要自定义阴影时，应先设置 `applyShadow: false`。
- 通用属性方式建议把 `systemMaterial` 写在背景色、边框和阴影等样式之后。
- 不建议同时设置材质与背景色、背景模糊、阴影和边框；应明确所需的最终优先级。

示例：

```typescript
Column() {
  Text('内容')
}
.backgroundColor(Color.Transparent)
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
  applyShadow: false
}))
.shadow({ radius: 20, color: Color.Black })
```

### 8.5 自动反色限制

- 自动反色主要在 `THIN`、`ULTRA_THIN` 材质上生效。
- 是否实际反色还受到系统沉浸光感强度影响。
- 自动反色只对文档列出的系统颜色资源及指定组件属性生效。
- 任意十六进制颜色并不保证支持自动反色。
- 不要对包含大量文本、图标的整棵子树开启反色。

## 9. 推荐工程方案

最稳妥的工程方案是：

1. API 23 起使用 HDS 承担标题栏和底部导航。
2. API 26 起使用 `uiMaterial` 扩展到卡片、按钮、菜单和弹窗。
3. HDS 默认使用 `ADAPTIVE` 材质类型和等级。
4. API 26 使用 `isImmersiveMaterialSupported()` 做能力判断。
5. 所有沉浸光感组件保留普通背景色、边框等降级样式。
6. 把沉浸式材质作为局部、稀缺视觉资源使用，避免整页铺设。

## 10. 官方资料

- [沉浸光感最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-spatiality-immersive)
- [ArkUI 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense)
- [UI Design Kit 沉浸光感指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material)
- [hdsMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial)
- [uiMaterial API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial)
- [systemMaterial 通用属性](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)
- [HdsNavigation API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation)
- [HdsTabs API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdstabs)
- [Spatialization 官方示例工程](https://gitcode.com/HarmonyOS_Samples/Spatialization)
- [沉浸光感常见问题](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq)

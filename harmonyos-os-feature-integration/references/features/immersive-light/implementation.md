# 沉浸光感接入实现

先按 [兼容性与选型](compatibility.md) 确定路线。示例用于说明接口组合；修改真实工程时应复用项目现有组件、类型、主题资源和状态管理方式。

悬浮导航Tab（底部悬浮胶囊页签）的完整页面模式、运行时门禁工具和"原生 Tabs / 自研悬浮导航栏 → HDS 悬浮页签"的迁移对照，优先复用 [代码资产目录](assets-catalog.md) 中已蒸馏的资产，不重复手写。

## HDS 沉浸光感材质路线：API 23+

`HdsNavigation`/`HdsNavDestination` 从 API 18 起可用，`HdsTabs` 从 API 20 起可用；下面使用的 `hdsMaterial`、`systemMaterialEffect` 和悬浮页签 `barFloatingStyle` 则从 API 23 起可用。已有旧版 HDS 组件不等于已经具备沉浸光感能力，不能把组件的 since 版本当作本路线门槛。

标题栏或底部导航优先使用系统自适应材质：

```typescript
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

如果业务必须自定义档位，先查询设备支持类型：

```typescript
  // 获取系统支持的材质类型，用于根据设备能力选择合适的材质等级
  let materialTypes: Array<hdsMaterial.MaterialType> = hdsMaterial.getSystemMaterialTypes();
  if (materialTypes.indexOf(hdsMaterial.MaterialType.IMMERSIVE) < 0) {
    // 当前设备不支持IMMERSIVE材质类型，则使用SMOOTH效果以优化性能，降低卡顿和发热风险
    this.customMaterialLevel = hdsMaterial.MaterialLevel.SMOOTH;
  }
```

- 支持 `IMMERSIVE` 时可选择 `EXQUISITE` 或 `GENTLE`；
- 不支持时降级为 `SMOOTH`；
- 普通业务继续优先选择 `ADAPTIVE + ADAPTIVE`。

导航框架中的职责要分开：

- `systemMaterialEffect` 设置材质；
- `scrollEffectOpts` 设置滚动渐变模糊；
- `dynamicHideTitleBar` 控制标题栏和状态栏随滚动显隐；
- `bindToScrollable` 把效果与内容滚动组件关联。

标题栏包含菜单按钮时，菜单对象必须使用 HDS 的明确类型 `HdsNavigationMenuContentOptions`，并传给 `titleBar.content.menu`。不要把它声明成无类型对象、`object` 或动态类型；没有菜单时无需创建空对象。导入和声明示例：

```typescript
import {
  HdsNavigation,
  HdsNavigationMenuContentOptions,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial
} from '@kit.UIDesignKit';

private menus: HdsNavigationMenuContentOptions = {
  value: [
    {
      content: {
        label: '编辑',
        icon: $r('sys.symbol.square_and_pencil')
      }
    },
    {
      content: {
        label: '更多',
        icon: $r('sys.symbol.more')
      }
    }
  ]
};
```

改造真实工程时，继续使用源程序原有菜单项、顺序、图标、文案、点击行为和可访问性信息，只把容器声明对齐到 `HdsNavigationMenuContentOptions`；不要用示例菜单替换业务菜单。

```typescript
HdsNavigation() {
  // 页面内容
}
.titleBar({
  content: {
    title: {
      mainTitle: 'Title'
    },
    menu: this.menus
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

`IMMERSIVE_GRADIENT_BLUR` 从透明渐变到模糊，范围更大；`GRADIENT_BLUR` 从半透明渐变到模糊，表现更克制。根据页面背景和滚动内容选择，不要把滚动模糊当作材质本身。

## HDS 底部悬浮 Tab 迁移

能力包内置的三组迁移对照快照显示，接入后版本都把手机、平板大断点和横屏主导航统一成底部悬浮 `HdsTabs`。共同核心如下；完整页面、低版本整树降级和自包含差异摘要见 [代码资产与迁移证据](assets-catalog.md)。原始对照工程不随 Skill 分发，也不是执行依赖。

```typescript
HdsTabs({
  barPosition: BarPosition.End,
  index: this.currentIndex,
  controller: this.controller
}) {
  // 复用原 TabContent 与 tabBar builder
}
.scrollable(false)
.barHeight(56)
.barOverlap(true)
.barFloatingStyle({
  adaptToHandedness: true,
  systemMaterialEffect: {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  }
})
.onChange((index: number) => {
  this.currentIndex = index;
})
```

迁移时按下面的证据层级处理：

- `BarPosition.End`、`scrollable(false)`、`barOverlap(true)`、`barFloatingStyle` 和 `ADAPTIVE + ADAPTIVE` 是三组迁移对照的共同模式。
- 56vp 是显示态栏高基线；需要随滚动隐藏时可在 56 和 0 之间切换。
- 不默认设置栏宽。三组迁移对照都移除了原生 `Tabs.barWidth`；如确需控制悬浮胶囊宽度，使用 `barFloatingStyle.barWidth` 的 small/medium/large 范围并做多窗口验证。
- `barBottomMargin: 28` 是两对工程采用的常见值，不是固定规范；底部手势区或导航指示区变化时应动态计算或使用资源值。
- `animationDuration(0)`、透明 `gradientMask`、`TabContent.expandSafeArea(BOTTOM)` 和透明背景均不是三组迁移对照的统一必需项，只在对应交互或布局确有需要时保留。
- `HdsTabsController` 继承 `TabsController`，既有 `changeIndex` 通常可继续使用；仍需扫描所有类型声明、控制器注入、双击、隐藏和刷新回调。
- API 23/24 模板将 `HdsTabs` 从 `@hms.hds.hdsBaseComponent` 导入，当前 SDK 也可见 `@kit.UIDesignKit` 聚合入口。生成代码时沿用目标 SDK 与工程已验证的导入方式，最终以真实构建为准。

大断点处理必须作为显式设计决策：如果目标是迁移快照所示的统一悬浮导航，可删除旧的 `vertical`、动态 `barPosition`、侧栏 `barWidth` 和 `divider`，在大断点继续显示底部悬浮 Tab；如果产品仍要求平板/PC 侧边导航，则保留断点分支，只在小中断点使用底部 HDS 悬浮栏。不要仅因对照快照采用底部方案就静默破坏既有大屏信息架构。

### 低版本分支必须保留源程序体验

当 `compatibleSdkVersion < 23` 时，HDS 与普通 `Tabs` 是两棵运行时条件组件树。HDS 分支可以按产品确认后的新方案统一为底部悬浮，但普通 `Tabs` 分支不是简化示例或全新降级设计，必须保留接入前源程序的行为：

- 继续使用原有断点、横竖屏和窗口模式条件，保持对应的底部横向栏或侧边纵向栏；
- 原样迁移这些条件控制的 `vertical`、`barPosition`、`barMode`、`barWidth`、`barHeight`、`divider` 和背景属性；
- 保留原控制器、当前索引、页签顺序、自定义 TabBar、双击、隐藏、刷新和页面切换回调；
- 只把公共 `TabContent` 抽成 Builder 复用，不要为了减少重复而丢失两个分支不同的导航外观和交互；
- 在 API 23 以下设备分别覆盖原工程支持的手机、平板/大窗口、横屏、分屏与自由窗口矩阵。

因此不能把能力包示例中的某个固定栏宽、栏高或 `BarPosition.End` 直接复制到所有普通 `Tabs` 降级分支。实施前先保存接入前 Tabs 属性与行为清单，实施后逐项对照。

## ArkUI 组件级路线：API 26+

能力判断、场景化材质参数和"支持/不支持设备同树复用"的降级写法，优先复用 [代码资产目录](assets-catalog.md) 中的 `ImmersiveMaterialGuard.ets` 与 `ArkuiMaterialFallbackEntry.ets`，不重复手写。

支持通用属性的组件可以直接设置材质：

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

常用参数：

| 参数 | 作用 | 默认或限制 |
|---|---|---|
| `style` | 材质厚度 | 默认 `REGULAR`；完整差异依赖设备算力 |
| `materialColor` | 材质赋色 | 高/中算力为滤镜叠色，低算力作为背景色生效；完全不透明颜色会遮挡滤镜效果 |
| `colorInvert` | 子树前景自动反色 | 主要用于 `THIN`、`ULTRA_THIN` 及受支持的系统颜色资源 |
| `applyShadow` | 材质自带阴影 | 默认 `true`，优先于通用 `shadow` |
| `interactive` | 按压弹性形变 | 默认 `false` |
| `lightEffect` | 触摸流光 | 低算力设备不支持完整效果 |

材质厚度从薄到厚为 `ULTRA_THIN`、`THIN`、`REGULAR`、`THICK`、`ULTRA_THICK`。浮动工具栏优先薄材质，菜单优先 `THICK`，弹窗可使用 `ULTRA_THICK`；最终仍需结合背景和设备验证。

## ArkUI 应用级路线：API 26+

只有目标 API 满足要求且配置位于 `entry` module 时，才在 `module.json5` 中设置：

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

运行时使用 `getMaterialInfo()` 诊断配置状态：

```typescript
import { uiMaterial } from '@kit.ArkUI';

const materialInfo: uiMaterial.MaterialInfo = uiMaterial.getMaterialInfo();
if (materialInfo.state === uiMaterial.MaterialState.ENABLE) {
  console.info('Application-level immersive material is enabled.');
}
```

单组件明确关闭：

```typescript
.systemMaterial(uiMaterial.Material.empty)
```

不要用 `undefined` 表示强制关闭；它会恢复系统默认行为，在 `ENABLE` 模式下可能再次启用材质。

## 跨版本兼容

同时支持旧版本时，对 API 26 接口做版本和能力双重判断：

```typescript
if (deviceInfo.apiAvailable('26.0.0') &&
  uiMaterial.isImmersiveMaterialSupported()) {
  // 使用 API 26 沉浸式系统材质
} else {
  // 继续使用接入前的组件属性、状态、事件和业务路径，包括原背景色与边框
}
```

多个 Menu、Popup、Sheet 入口需要相同判断时，按明确的 Options 类型分别封装，不使用动态类型或不安全的泛型断言：

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

## 属性顺序、覆盖与视觉层级

### 覆盖规则

通用属性方式建议把 `systemMaterial` 写在背景色、边框和阴影之后。官方参考定义了精确的冲突裁决规则：

- 总原则：材质影响的通用属性发生冲突时，**除阴影外，后设置的生效**；阴影冲突由 `applyShadow` 参数裁决。
- 先设置 `backgroundColor` 后设置 `systemMaterial`：背景色被覆盖。高/中算力设备上背景色被恢复为透明色；低算力设备上由材质自带的背景色效果覆盖。
- 先设置 `systemMaterial` 后设置 `backgroundColor`：材质影响的背景效果被覆盖，最终显示后设置的背景色。
- `systemMaterial` 生效后（高/中算力设备），已设置的 `borderWidth` 会被恢复为无边框效果。
- 需要在所有算力档位都呈现同一颜色时，官方推荐用 `materialColor` 承载颜色，不再设置 `backgroundColor`：高/中算力设备为滤镜叠色，低算力设备作为背景色生效。
- 在不支持沉浸式材质的设备上，设置 `ImmersiveMaterial` 不报错也不产生效果，且**不会覆盖任何通用属性**，组件样式仍由已设置的背景色、边框等通用属性决定。这正是"背景色前置 + `systemMaterial` 后置"单树降级写法的依据，见 [代码资产目录](assets-catalog.md)。

不建议同时叠加材质、背景模糊、背景效果、边框和多重阴影；`applyShadow: true` 时材质阴影优先，需要自定义阴影时先设置 `applyShadow: false`。Select 的按钮和下拉菜单是两个独立入口，需要分别处理 `systemMaterial` 与 `menuSystemMaterial`。

### 材质视觉层级与遮挡

- 材质渲染在组件的**背板层**，视觉层级位于 `backgroundColor`、`backgroundBlurStyle` 等属性之下。设置了材质却看不到效果时，第一排查项是不透明背景色或背景模糊把材质层盖住：将背景色设为透明（`Color.Transparent`）或移除背景模糊。
- 自绘制组件（如 `TextArea`）的 `backgroundColor` 作用于**内容层**，材质作用于背板层，内容层在背板层之上会遮盖材质。官方不建议对这类组件同时使用沉浸式系统材质和背景色，也不要期待材质绘制在内容层之上。

### 材质渲染区域

材质渲染区域由组件**布局区域**决定，可能与可视区域不一致：

- `Checkbox` 可视区域是 40×40 圆形，材质渲染区域是 40×40 矩形；
- `Text` 的可视区域是文本内容，材质作用于整个布局区域，无法只给文本内容设置材质。

需要对齐时，用 `width`、`height`、`borderRadius` 让布局区域与预期可视区域一致，再设置材质。

### 薄材质折射

`ULTRA_THIN`、`THIN` 等薄材质具有折射特性，会把组件周围的内容折射到边框区域，表现为"边框呈现周围背景的颜色"。这是正常光学表现，不是样式冲突；确需缓解时改用 `REGULAR`、`THICK`、`ULTRA_THICK` 等较厚样式，或用带透明度的 `materialColor` 降低折射可见度。

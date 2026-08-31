# 沉浸光感接入实现

先按 [兼容性与选型](compatibility.md) 确定路线。示例用于说明接口组合；修改真实工程时应复用项目现有组件、类型、主题资源和状态管理方式。

## HDS 路线：API 23+

标题栏或底部导航优先使用系统自适应材质：

```typescript
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

如果业务必须自定义档位，先查询设备支持类型：

```typescript
const types = hdsMaterial.getSystemMaterialTypes();
```

- 支持 `IMMERSIVE` 时可选择 `EXQUISITE` 或 `GENTLE`；
- 不支持时降级为 `SMOOTH`；
- 普通业务继续优先选择 `ADAPTIVE + ADAPTIVE`。

导航框架中的职责要分开：

- `systemMaterialEffect` 设置材质；
- `scrollEffectOpts` 设置滚动渐变模糊；
- `dynamicHideTitleBar` 控制标题栏和状态栏随滚动显隐；
- `bindToScrollable` 把效果与内容滚动组件关联。

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

`IMMERSIVE_GRADIENT_BLUR` 从透明渐变到模糊，范围更大；`GRADIENT_BLUR` 从半透明渐变到模糊，表现更克制。根据页面背景和滚动内容选择，不要把滚动模糊当作材质本身。

## ArkUI 组件级路线：API 26+

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
| `materialColor` | 材质赋色 | 完全不透明颜色会遮挡滤镜 |
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
  // 保留普通背景色、边框等降级样式
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

## 属性顺序和冲突

- 通用属性方式建议把 `systemMaterial` 写在背景色、边框和阴影之后，使最终材质优先级明确。
- 不建议同时叠加材质、背景模糊、背景效果、边框和多重阴影。
- `applyShadow: true` 时材质阴影优先；需要自定义阴影时先设置 `applyShadow: false`。
- Select 的按钮和下拉菜单是两个独立入口，需要分别处理 `systemMaterial` 与 `menuSystemMaterial`。

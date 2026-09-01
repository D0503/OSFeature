# ArkUI 沉浸光感接入实现

先按[兼容性与选型](../../compatibility.md)确认 ArkUI 路线达到 API 26，并读取[共享回退策略](../../shared/fallback.md)。能力判断、场景化材质参数和降级写法优先复用[ArkUI 资产](assets.md)。本路线不负责 HDS 导航、悬浮 `HdsTabs` 或 MiniBar；组合工程应同时加载 HDS 路线。

## 组件级路线：API 26+

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

## 应用级路线：API 26+

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

单组件明确关闭使用：

```typescript
.systemMaterial(uiMaterial.Material.empty)
```

不要用 `undefined` 表示强制关闭；它会恢复系统默认行为，在 `ENABLE` 模式下可能再次启用材质。

## 版本与设备能力双重保护

```typescript
if (deviceInfo.apiAvailable('26.0.0') &&
  uiMaterial.isImmersiveMaterialSupported()) {
  // 使用 API 26 沉浸式系统材质
} else {
  // 继续使用接入前的组件属性、状态、事件和业务路径
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

- 总原则：材质影响的通用属性发生冲突时，除阴影外，后设置的生效；阴影冲突由 `applyShadow` 参数裁决。
- 先设置 `backgroundColor` 后设置 `systemMaterial`：背景色被覆盖。高/中算力设备上背景色恢复为透明，低算力设备由材质背景色覆盖。
- 先设置 `systemMaterial` 后设置 `backgroundColor`：材质背景被后设置的背景色覆盖。
- `systemMaterial` 生效后，高/中算力设备上已设置的 `borderWidth` 会恢复为无边框效果。
- 所有算力档位需要同一颜色时，用 `materialColor` 承载颜色，不再设置 `backgroundColor`。
- 不支持沉浸式材质时，`ImmersiveMaterial` 不产生效果且不覆盖通用属性；这正是“普通样式前置、`systemMaterial` 后置”单树降级模式的依据。

不建议叠加材质、背景模糊、背景效果、边框和多重阴影。`applyShadow: true` 时材质阴影优先；需要自定义阴影时设置 `applyShadow: false`。Select 的按钮和下拉菜单是两个独立入口，需要分别处理 `systemMaterial` 与 `menuSystemMaterial`。

### 材质视觉层级与遮挡

- 材质位于背板层，在 `backgroundColor`、`backgroundBlurStyle` 等属性之下。看不到效果时先检查不透明背景或背景模糊；按设计改为透明或移除冲突模糊。
- 自绘制组件（如 `TextArea`）的背景作用于内容层，会遮盖背板材质；不要期待材质绘制在内容层之上。

### 材质渲染区域

材质渲染区域由组件布局区域决定，可能与可视区域不一致。例如 Checkbox 的圆形可视区可能对应矩形材质区，Text 也不能只给文字轮廓设置材质。需要对齐时，用 `width`、`height`、`borderRadius` 调整布局区域后再设置材质。

### 薄材质折射

`ULTRA_THIN`、`THIN` 会折射组件周围内容，边框呈现周围颜色属于正常光学表现。确需缓解时改用较厚样式，或用带透明度的 `materialColor` 降低折射可见度。

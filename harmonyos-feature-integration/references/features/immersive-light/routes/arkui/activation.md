# ArkUI 开启策略

本文件只处理路线门禁、应用级状态和组件级覆盖关系。具体视觉参数见[通用材质](common-material.md)，组件限制按目标读取 `components/` 下的分类文档。

## 路线级条件

ArkUI 沉浸光感的构建门禁是：

- 本机 SDK 根目录 `sdk-pkg.json` 的 API 达到 26；
- `compileSdkVersion >= 26`；
- `targetSdkVersion >= 26`；
- Stage 模型。

上述 API 26 指版本等级；写入 `build-profile.json5` 的 `targetSdkVersion` 和显式 `compileSdkVersion` 时使用 `"26.0.0"`，无括号后缀。`compatibleSdkVersion` 按已确认的最低兼容要求保留，只有设为 API 26 时才同样写 `"26.0.0"`。

`targetSdkVersion >= 26` 适用于 ArkUI 整条路线，不只适用于应用级 metadata。`compatibleSdkVersion < 26` 时，用低版本可用的 `deviceInfo.sdkApiVersion` 保护新增接口调用和配置；仅材质变化时复用原组件，涉及组件、布局或导航结构变化时才使用组件树分支。`compatibleSdkVersion >= 26` 时无需增加 API 26 版本分支。具体写法见[共享回退策略](../../shared/fallback.md)。不要把 API 26 才存在的 `deviceInfo.apiAvailable` 当作 API 26 以下设备的最外层保护。

应用启动完成、退出启动加载页且满足 API 26 运行版本条件后，再调用：

```typescript
uiMaterial.isImmersiveMaterialSupported()
```

能力不支持时，继续使用接入前组件树、状态、事件和普通样式。

### 能力查询时机

`uiMaterial.isImmersiveMaterialSupported()` 必须由工程现有的启动完成、业务页面就绪流程触发。不得在模块顶层、静态或成员字段初始化、启动加载页中调用，也不得通过这些位置间接调用 `ImmersiveMaterialGuard.isMaterialSupported()`。生命周期回调名称本身不能证明启动已完成；检查它与加载页退出的实际先后关系，不以固定延时替代就绪条件。

启动尚未完成时，保持接入前样式，能力状态保留为“未查询”；不要把此时的默认值永久缓存为“不支持”。就绪后查询一次并复用结果，通过工程现有状态机制更新目标组件。API 版本保护仍须在查询之前执行。

## 应用级 MaterialState

应用级配置只在 `entry` module 生效：

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

| 配置 | 行为 |
|---|---|
| 未配置或 `default` | 进入 `MaterialState.DEFAULT`；应用升级到 target API 26+ 后，受支持组件可能采用系统默认材质，不能视为“完全无变化” |
| `enable` | 进入 `MaterialState.ENABLE`；只对官方声明为默认开启的组件生效 |
| `disable` | 进入 `MaterialState.DISABLE`；全局关闭，显式组件材质也不生效 |

使用 `uiMaterial.getMaterialInfo()` 读取实际状态，不根据 metadata 文件单独推测最终运行状态。

原生底部 Tabs 必须由工程显式配置 `barFloatingStyle`，并同时满足 `barOverlap(true)`、`vertical(false)` 和 `BarPosition.End`；悬浮样式生效后系统默认使用 `THIN` 材质，不强制显式设置 `FloatingTabBarStyle.systemMaterial`。接入分支默认显式设置 `maskColor: Color.Transparent`，仅在设计明确需要渐变遮罩时改用非透明值。应用级 `DISABLE` 仍会统一禁止材质。

## 组件级优先关系

| 应用状态与组件值 | 结果 |
|---|---|
| `DISABLE` | 始终关闭 |
| `DEFAULT`/`ENABLE` + 显式 `ImmersiveMaterial` | 组件参数覆盖该组件默认效果 |
| `DEFAULT`/`ENABLE` + `uiMaterial.Material.empty` | 明确关闭该组件 |
| `undefined` | 恢复该组件在当前 MaterialState 下的默认行为 |

因此，通用组件需要“明确关闭”时使用 `uiMaterial.Material.empty`，不要把 `undefined` 当成统一的关闭值。组件专属行为以[组件矩阵](component-profile.json)为准，例如 Slider 明确规定 `undefined` 恢复原 Slider 样式，Navigation 标题栏的 `undefined` 则继续受应用状态影响。

Select 的按钮和下拉菜单是两个独立入口，必须分别决定 `systemMaterial` 与 `menuSystemMaterial`，不能用一个值代替两个开关。

每个组件在 `DEFAULT`、`ENABLE` 下的默认行为、附加条件和生效区域以[组件矩阵](component-profile.json)为准。应用状态允许默认开启不等于组件可以在任意区域生效；普通组件仍须位于官方允许的标题栏或底部悬浮 TabBar 区域。

## 应用升级检查

将 target API 从 26 以下升级到 26+ 时，即使没有新增 metadata，也要审查：

- 哪些组件在 `DEFAULT` 或 `ENABLE` 下会自动获得材质；
- 已有背景色、背景模糊和阴影是否遮挡材质；
- 原按压态、悬浮态是否会被 `lightEffect` 替代；
- 是否有业务上必须保持普通样式的组件，需要显式设置 `Material.empty`；
- API 26 以下设备是否仍保持接入前状态。

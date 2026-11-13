---
title: "ArkUI 沉浸光感开启策略"
summary: "说明 ArkUI 沉浸光感的构建和运行条件、启动就绪后的能力查询、应用级 MaterialState、组件级优先关系和 target API 升级影响。"
createdAt: "2026-11-12"
updatedAt: "2026-11-12"
tags: ["HarmonyOS","沉浸光感","ArkUI","MaterialState","API 26","能力查询"]
---

# ArkUI 沉浸光感开启策略

## 路线级条件

ArkUI 沉浸光感接入需满足以下构建条件。

- 本机 SDK 根目录 `sdk-pkg.json` 的 API 达到 26。
- `compileSdkVersion >= 26`。
- `targetSdkVersion >= 26`。
- Stage 模型。

沿用工程现有的编译版本配置，并确认实际编译 API 达到 26。`compileSdkVersion` 用于描述生效的编译 API，无需为此新增字段。修改 `build-profile.json5` 前核实目标 SDK 与配套构建工具的配置规范。`"26.0.0"` 是 API 26 的格式示例，字段类型和值按对应版本规范填写。`compatibleSdkVersion` 按已确认的最低兼容要求保留。

`targetSdkVersion >= 26` 适用于整个 ArkUI 沉浸光感接入，包括组件级配置和应用级 metadata。`compatibleSdkVersion < 26` 时，在 SDK 26.0.0+ 编译环境中用 `deviceInfo.apiAvailable` 保护新增接口调用和配置。仅材质变化时复用原组件，涉及组件、布局或导航结构变化时使用组件树分支。`compatibleSdkVersion >= 26` 时可省略 API 26 版本分支。`apiAvailable` 的 SDK 26.0.0 门槛是编译要求，可用于检查低版本运行设备。

应用启动完成、退出启动加载页且满足 API 26 运行版本条件后，再查询材质能力。

```typescript
uiMaterial.isImmersiveMaterialSupported()
```

能力不支持时，继续使用接入前组件树、状态、事件和普通样式。

### 能力查询时机

`uiMaterial.isImmersiveMaterialSupported()` 由工程现有的启动完成、业务页面就绪流程触发。模块顶层、静态或成员字段初始化以及启动加载页均须避开这项查询，包括通过封装方法间接查询。生命周期回调须结合实际启动流程与加载页退出的先后关系判断，固定延时不能替代就绪条件。

启动尚未完成时保持接入前样式，能力状态为「未查询」。就绪且通过 API 版本保护后查询一次并复用结果，再通过工程现有状态机制更新目标组件。

## 应用级 MaterialState

应用级 metadata 只在 `entry` 模块生效。

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
| 未配置或 `default` | 进入 `MaterialState.DEFAULT`。应用升级到 target API 26+ 后，受支持组件可能采用系统默认材质，不能视为“完全无变化” |
| `enable` | 进入 `MaterialState.ENABLE`。只对官方声明为默认开启的组件生效 |
| `disable` | 进入 `MaterialState.DISABLE`。全局关闭，显式组件材质也不生效 |

使用 `uiMaterial.getMaterialInfo()` 读取实际状态，不根据 metadata 文件单独推测最终运行状态。

原生底部 Tabs 必须由工程显式配置 `barFloatingStyle`，并同时满足 `barOverlap(true)`、`vertical(false)` 和 `BarPosition.End`；悬浮样式生效后系统默认使用 `THIN` 材质，不强制显式设置 `FloatingTabBarStyle.systemMaterial`。接入分支默认显式设置 `maskColor: Color.Transparent`，仅在设计明确需要渐变遮罩时改用非透明值。应用级 `DISABLE` 仍会统一禁止材质。

## 组件级优先关系

| 应用状态与组件值 | 结果 |
|---|---|
| `DISABLE` | 始终关闭 |
| `DEFAULT`/`ENABLE` + 显式 `ImmersiveMaterial` | 组件参数覆盖该组件默认效果 |
| `DEFAULT`/`ENABLE` + `uiMaterial.Material.empty` | 明确关闭该组件 |
| `undefined` | 恢复该组件在当前 MaterialState 下的默认行为 |

通用组件需要明确关闭时使用 `uiMaterial.Material.empty`。`undefined` 按组件自身规则处理，例如 Slider 明确规定会恢复原 Slider 样式，Navigation 标题栏会恢复当前应用状态下的标题栏默认行为。

Select 的按钮和下拉菜单是两个独立入口，必须分别决定 `systemMaterial` 与 `menuSystemMaterial`，不能用一个值代替两个开关。

各组件在 `DEFAULT`、`ENABLE` 下的默认行为、附加条件及生效区域按对应组件入口核对。普通组件仍须位于允许的标题栏或底部悬浮 TabBar 区域。

## 应用升级检查

将 target API 从 26 以下升级到 26 及以上时，应同时核对以下行为。未配置 metadata 的工程也适用。

- 哪些组件在 `DEFAULT` 或 `ENABLE` 下会自动获得材质。
- 已有背景色、背景模糊和阴影是否遮挡材质。
- 原按压态、悬浮态是否会被 `lightEffect` 替代。
- 是否有业务上必须保持普通样式的组件，需要显式设置 `Material.empty`。
- API 26 以下设备是否仍保持接入前状态。

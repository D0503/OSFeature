# ArkUI 沉浸光感接入入口

ArkUI 路线覆盖 API 26+ 的原生 ArkUI `Navigation`、`Tabs`、弹窗和交互组件，不覆盖 `HdsNavigation`、`HdsTabs` 或 MiniBar。工程同时使用 HDS 与 ArkUI 时保留 `selectedRoutes: ["hds", "arkui"]`，分别加载两条路线。

## 前置门禁

- 本机 SDK 根清单 API、工程 `compileSdkVersion` 和 `targetSdkVersion` 都必须达到 26；
- Stage 模型是必需条件；应用级 metadata 还必须位于 `entry` module；
- `compatibleSdkVersion < 26` 时，在 API 26 调用之外先使用低版本可用的 `deviceInfo.sdkApiVersion >= 26` 做整树保护；
- 运行到 API 26 分支后继续检查 `uiMaterial.isImmersiveMaterialSupported()`；
- 所有不满足条件的路径保留[接入前源程序状态](../../shared/fallback.md)。

完整规则见[开启策略](activation.md)。

## 按目标加载

| 目标 | 必读资料 |
|---|---|
| `systemMaterial` 参数、颜色、反色、阴影、覆盖关系 | [通用材质](common-material.md) |
| 原生 Navigation 标题栏、原生悬浮 Tabs、AlphabetIndexer | [导航类组件](components/navigation.md) |
| Toast、Popup、Tips、Menu、Dialog、Sheet | [弹窗类组件](components/overlays.md) |
| Button、Select、Toggle、Slider、ChipGroup、SegmentButton | [按钮与选择类组件](components/controls.md) |
| 复制门禁、降级或原生导航页签代码 | [ArkUI 资产](assets.md) |
| 静态检查、真机构成和故障排查 | [ArkUI 验证](validation.md) |

只加载与目标组件有关的分类文档；不要因为工程中存在普通 Button、Tabs 等组件就自动改造所有组件。

## 实施顺序

1. 读取[组件矩阵](component-profile.json)，识别应用级默认行为、组件入口、明确关闭方式和限制。
2. 记录目标组件的接入前代码、交互态、响应式布局和普通样式。
3. 选择应用级开启、组件级开启或两者组合；先解决 `DEFAULT`/`ENABLE`/`DISABLE` 行为，再设置具体材质。
4. 对 API 26 以下、不支持设备、系统关闭和业务关闭路径保留接入前状态。
5. 按目标分类实施；组件专属接口优先于把通用 `systemMaterial` 生搬到所有组件。
6. 运行静态验证和真实工程构建，再在目标设备上检查系统材质档位、深浅色和交互反馈。

## 来源

- [开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)
- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)

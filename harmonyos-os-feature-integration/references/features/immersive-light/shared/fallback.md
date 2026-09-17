# 沉浸光感共享回退策略

HDS、ArkUI 及其组合路线共用 `profile.json` 的 `fallbackPolicy`。所有回退条件都以 `pre-integration-source-state` 为基线，不是重新设计一套简化页面。

悬浮 Tab 的布局按[栏宽与断点规则](validation.md#悬浮-tab-栏宽与断点)处理：仅低版本兼容分支恢复原有侧边/底部布局与栏宽。满足组件版本时，设备不支持材质或材质关闭仅回退材质，底部横向布局保持不变。

除上述悬浮 Tab 布局规则外，必须保留：

- 接入前组件树或既有代码路径；
- 响应式断点、横竖屏与窗口模式；
- 状态、数据、控制器、事件和生命周期；
- 既有异常、拒绝和不可用行为；
- 普通背景、边框、阴影等视觉样式。

HDS 与 ArkUI 的悬浮 Tabs 增强分支所需的底部间距和滚动页尾部空间，不得无条件进入低版本普通非悬浮 `Tabs` 的源程序路径。低版本分支保留源程序滚动范围；设备不支持或业务关闭材质时仍保持底部布局，使用 `barOverlap(true)` 的普通样式悬浮栏仍要防止滚动末项被遮挡。ArkUI 的 `systemMaterial`、应用级开关和 API 26 Options 属性按各自版本与设备能力规则保护。

组合路线分别执行各自门禁：HDS 不可用时只回退 HDS 目标组件，ArkUI 不可用时只回退 ArkUI 目标组件；一个路线失败不自动撤销另一条已经满足条件的路线。实施前保存源程序状态基线，实施后按目标文件和交互逐项对照。

## ArkUI 版本保护粒度

| 工程条件与改动 | 处理方式 |
|---|---|
| `compatibleSdkVersion >= 26` | 无需增加 API 26 版本分支，仍按组件规则处理设备能力和关闭状态 |
| `compatibleSdkVersion < 26`，仅增加材质属性 | 复用原组件，保护材质对象构造、新枚举取值、能力查询和属性调用；低版本继续使用原属性 |
| `compatibleSdkVersion < 26`，涉及组件、布局或导航结构变化 | 在受影响的组件范围建立分支，低版本保留原组件、布局、状态与事件 |

最小调用保护示例（用于应用启动完成、退出启动加载页后触发的 ArkTS 方法体；不得用于模块或字段初始化，具体见[能力查询时机](../routes/arkui/activation.md#能力查询时机)。组件配置入口按实际工程接入）：

```typescript
import { deviceInfo } from '@kit.BasicServicesKit';
import { uiMaterial } from '@kit.ArkUI';

if (deviceInfo.sdkApiVersion >= 26) {
  if (uiMaterial.isImmersiveMaterialSupported() &&
    uiMaterial.getMaterialInfo().state !== uiMaterial.MaterialState.DISABLE) {
    const material = new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.REGULAR
    });
    // 在此保护范围内通过目标组件支持的配置入口应用 material。
  }
}
```

仅保护材质值不足以保护链式属性调用本身；不能在低版本路径上无条件调用 `.systemMaterial(undefined)` 或访问 `uiMaterial.Material.empty`。如果现有声明式写法无法单独保护新增属性调用，就在最小受影响组件范围使用条件分支，公共内容与业务状态继续复用。不支持设备、应用或业务关闭时保留原属性和原交互；具体材质厚度与生效区域按目标组件选择。

静态扫描只能发现版本判断候选，不能证明每个新增调用都被覆盖。API 26 保护检查在需要兼容低版本时标为 `warn`：无论是否匹配到字面量，都须核对常量值、等价比较、Guard 封装、求值顺序及实际调用链。使用值为 26 的常量与直接比较 26 均可，不得仅为匹配静态正则改写等价业务代码或加入审计注释。实施时确认新增调用受保护，并通过目标工程构建与最低兼容版本运行验证；人工核对若确认缺少保护，应报告实际缺陷。

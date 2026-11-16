# Navigation 路线

前置：[公共流程](../../implementation.md)、[配置规则](../../configuration.md)。用于现有 Navigation 路由，不把原生分栏改造成平行视界。

- 确认负责全局导航的 Navigation，建议为它设置稳定通用 id 并写入 homeNavigationId；已有 id 优先复用，不能把子组件的 id 当导航容器证据。
- 应用包含多个 UIAbility 窗口或 Navigation 时，按下方 [多窗口配置](#多窗口配置) 明确目标容器。
- Navigation 首页为 homePage="navBar"；以 NavDestination 为主页时填实际 name。不要把页面 struct 名称、展示标题或 Router 路径直接视为目的页 name。
- 将显示模式设为 navigationSplit，配置 navigationSplitOptions；保留原 NavPathStack、路由映射、参数和返回行为。示例使用 Stack，是否需调整现有模式必须结合原页面分析，避免叠加原生分栏。
- 关联页需无动态参数也能正常进入；全屏媒体页填 fullScreenPages；API 26 购物模式下按需求将编辑页填 transPages，DIALOG 目的页默认作为过渡页。
- 页面宽度问题优先读取实际容器尺寸；API 23 navDestinationUpdate 信息可含尺寸，onNavDestinationSizeChange 可监听变化。常量或动态 name 无法静态还原时检查映射和运行栈，不能猜测名称。

仅在需要明确全局容器时添加 id；最小模板不强加业务命名。配置及验收见 [资产](implementation.md#资产与接入)、[验证](implementation.md#路线验收)。

## 资产与接入

读取 [资产目录](../../assets-catalog.md)，按 API 和模式选择 Navigation 配置。navBar 仅表示 Navigation 首页；目的页使用真实 name，homeNavigationId 使用全局路由容器的 id。

## 多窗口配置

例如主窗口需要平行视界，比价窗口保持原布局：

1. 从两个 UIAbility 的 loadContent 入口找到各自的 Navigation，确定主窗口负责全局路由的容器。复用其已有 `.id()`；没有时添加稳定 id，以下以 `MainNav` 为例。
2. 在 entry.module.easyGo 实际引用的 JSON 中，将 `homeNavigationId` 加入目标设备配置的 `navigationSplitOptions`，保留已确认的其他字段：

```json
{
  "homeNavigationId": "MainNav"
}
```

以上是 navigationSplitOptions 内的字段片段，不是完整 easy_go.json。若配置了 phone/tablet 覆盖，需在本次启用的覆盖配置中同步核对该字段，因为它们不继承 common。

3. 在主窗口现有 Navigation 属性链上设置相同 id，保留原路由栈、目的页映射和模式：

```typescript
// 主窗口：现有 Navigation 片段
Navigation(this.navPathStack) {
  // 原首页内容
}
.id('MainNav')
.navDestination(this.pageMap)
```

4. 比价窗口保留自身 Navigation 与路由栈，不将其 id 改为 `MainNav`，也不把这套分栏绑定复制过去。已有独立 id 保持原值，例如：

```typescript
// 比价窗口：现有 Navigation 片段
Navigation(this.comparePathStack) {
  // 原比价页面内容
}
.id('CompareNav')
.navDestination(this.comparePageMap)
```

示例变量及 id 按工程实际替换，不额外创建窗口或路由栈。homeNavigationId 填容器 id；homePage 仍按主页分析填写 navBar 或实际目的页 name，不能填 MainNav。

5. 分别打开主窗口和比价窗口，在支持的窗口模式与尺寸下检查主窗口分栏、比价窗口保持原布局，并检查返回与窗口重开。entry 配置应用级生效，不能仅凭两个 id 不同就判定隔离成功；若仍有意外分栏，先核对实际容器、重复 id 和设备覆盖，并记录运行结果。窗口分屏是否启用仍按 enableInSplitScreen 的业务选择处理。

## 路线验收

执行 [公共验证](../../performance-validation.md)。额外核对 homeNavigationId 的真实容器归属、navBar 与 NavDestination name 的区分、NavPathStack 中页面顺序和参数、DIALOG 过渡页行为。多个 Navigation 或动态路由时以运行栈和组件树补足静态证据。

依据：[官方平行视界文档](https://developer.huawei.com/consumer/cn/doc/doccenter-multi-device/bpta-easygo-parallel.md)，2026-11-05 核实应用级生效及 homeNavigationId 规则；跨窗口隔离效果仍需运行验证。

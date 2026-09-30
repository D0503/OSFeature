# Navigation 路线

前置：[公共流程](../../implementation.md)、[配置规则](../../configuration.md)。用于现有 Navigation 路由，不把原生分栏改造成平行视界。

- 确认负责全局导航的 Navigation，建议为它设置稳定通用 id 并写入 homeNavigationId；已有 id 优先复用，不能把子组件的 id 当导航容器证据。
- Navigation 首页为 homePage="navBar"；以 NavDestination 为主页时填实际 name。不要把页面 struct 名称、展示标题或 Router 路径直接视为目的页 name。
- 将显示模式设为 navigationSplit，配置 navigationSplitOptions；保留原 NavPathStack、路由映射、参数和返回行为。示例使用 Stack，是否需调整现有模式必须结合原页面分析，避免叠加原生分栏。
- 关联页需无动态参数也能正常进入；全屏媒体页填 fullScreenPages；API 26 购物模式下按需求将编辑页填 transPages，DIALOG 目的页默认作为过渡页。
- 页面宽度问题优先读取实际容器尺寸；API 23 navDestinationUpdate 信息可含尺寸，onNavDestinationSizeChange 可监听变化。常量或动态 name 无法静态还原时检查映射和运行栈，不能猜测名称。

仅在需要明确全局容器时添加 id；最小模板不强加业务命名。配置及验收见 [资产](assets.md)、[验证](validation.md)。

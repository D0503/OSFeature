# 配置规则

## Skill 接入默认值

开发者未特别要求时，本次接入的 wideWindowMode 和 squareWindowMode 必须均显式启用分栏：Router 路线使用 `routerSplit`，Navigation 路线使用 `navigationSplit`。仅在开发者明确要求关闭对应窗口的平行视界时使用 `original`，不将其作为默认值；范围外的设备配置保持不变。

两个字段的官方缺省值均为 false；本 Skill 新接入默认显式设置 enableReducedContainerSize=true，API 26 同时设置 drawableRectHook=true。API 23～25 优先提出升级选项，用户选择保持版本时省略 drawableRectHook。合法的 false 仍受支持，已有显式 false 或用户明确选择不静默覆盖。写入前完成 [配置确认](configuration-confirmation.md)，特别是全屏页和购物模式过渡页，不把官方空数组默认值当作用户已确认无需这些页面。

## 结构与资源

在 entry 的 `src/main/resources/base/profile/` 放标准 JSON，通过 module.json5 的 **module 顶层** `"easyGo": "$profile:easy_go"` 引用。资源名可以自定，必须读取实际引用而非只查名为 easy_go.json 的文件。

结构为 `{ "common": { "displayModeOptions": { ... } }, "phone": { ... }, "tablet": { ... } }`。common 必填；设备覆盖配置独立完整，不和 common 深合并。

displayModeOptions 的 wideWindowMode 必填，官方结构中 squareWindowMode 可选，但本 Skill 默认显式配置两项分栏。值为 `original`、`routerSplit`、`navigationSplit`。后两者必须有对应的 routerSplitOptions 或 navigationSplitOptions 对象；两种 Options 不可共存。开发者明确选择的 original 仍为合法配置，静态校验不能因接入默认值而判错。

## 配置示例

以 entry 模块位于 `products/entry` 的工程为例。在 `products/entry/src/main/module.json5` 的 `module` 对象中添加 easyGo，与 routerMap、pages 同级，不放在 abilities 内。以下为相关片段，工程原有权限、abilities 等配置保持原样：

```json5
{
  "module": {
    "name": "entry",
    "type": "entry",
    "mainElement": "EntryAbility",
    "deviceTypes": ["phone", "tablet"],
    "routerMap": "$profile:route_map",
    "easyGo": "$profile:easy_go",
    "pages": "$profile:main_pages"
    // 其余模块配置保持原样
  }
}
```

## Options 字段

| 字段 | 规则、默认值和适用性 |
|---|---|
| homePage | 可选。不配置由系统识别；Router 使用 pages 列表中的路径如 pages/Index，Navigation 首页用 navBar，目的页用 NavDestination 的名称 |
| relatedPage | 可选，必须同时有 homePage；不支持传递参数，选择可独立初始化的静态页面 |
| fullScreenPages | 字符串数组，官方默认空；进入后退出分栏；不能与主页/关联页重复。Skill 必须自动纳入已核实为独立路由页面的开屏广告页、启动页、隐私协议页，无需逐页询问，其他页面按需求确认；非路由弹窗和冲突处理见 [配置确认](configuration-confirmation.md) |
| enableReducedContainerSize | 布尔值，官方默认 false，Skill 新接入默认 true；true 时分栏期间应用内 lpx、横向断点和窗口/屏幕宽按右页尺寸换算，退出分栏失效；窗口分屏场景的屏幕宽保持原始尺寸 |
| supportLandscapeFullscreen | 默认 true；应用主动请求横屏时退出分栏；false 保持平行视界 |
| dialogSupportSplit | 默认 true，弹窗在右半屏；false 居中 |
| homeNavigationId | 仅 Navigation；全局路由 Navigation 的通用 id，未配置使用最外层 Navigation；不能填任意子组件 id |
| disablePlaceholder / disableDivider | 仅 Navigation，布尔值，默认 false |

## API 26 增强字段

| 字段 | 规则 |
|---|---|
| mode | 整数 0=购物，1=导航，默认 1。导航固定左侧主页，购物右侧栈顶、左侧次栈顶；不向 API 23 配置写 mode |
| pagePairs | 导航模式生效；数组项为成对的非空 from/to，页面格式同 homePage；to 可为 `*`，from 不扩展为通配规则 |
| transPages | 购物模式生效；字符串数组，默认空，页面固定右侧不右推左；不能与 homePage/relatedPage/fullScreenPages 重复。DIALOG 类型的 NavDestination 默认是过渡页 |
| wideSplit / squareSplit | 对应窗口比例与拖拽对象；ratio 格式为 `"1 | 1"`，正整数比，范围 1:2～2:1，越界系统使用边界值；isDraggable 默认 false，true 时 ratio 失效，采用 1:2、1:1、2:1 三档吸附 |
| splitDividerColor | 对象，light/dark 可选，颜色为 #AARRGGBB；默认适配深浅色；应用不适配深色时两色设为一致 |
| drawableRectHook | 官方默认 false，Skill 在 API 26 新接入默认 true；true 时 drawableRect 开启页面级容器能力，按右页尺寸换算 |
| enableInSplitScreen | 默认 false；true 时允许窗口分屏中尺寸满足条件时进入平行视界 |
| disableSplitByDefault | API 26.0.1 起支持，可选布尔值，默认 false：开关初始开启；true：初始关闭。用户手动调整过开关后，以手动状态为准 |

不从示例继承不需要的增强字段。改变模式、关联页或全屏页会影响产品交互，应依据任务与既有导航关系确定。

来源：[华为平行视界官方文档](https://developer.huawei.com/consumer/cn/doc/doccenter-multi-device/bpta-easygo-parallel)，2026-10-20 核实其 [Markdown 正文](https://developer.huawei.com/consumer/cn/doc/doccenter-multi-device/bpta-easygo-parallel.md)。

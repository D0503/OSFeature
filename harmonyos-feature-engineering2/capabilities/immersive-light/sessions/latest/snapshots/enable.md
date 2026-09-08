# 开启沉浸光感

沉浸光感提供应用级开启和组件级开启两种方式，可按需选择。沉浸光感开启后，需要大量GPU资源，具体的适配指导请参考[沉浸光感功耗优化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints)，其余开启后的常见问题请参考[沉浸光感常见问题](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq)。

- 开启沉浸光感，要确保应用的[targetSDKVersion](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/app-compatibility-influence-factor)不低于26.0.0。如果应用需要开启沉浸光感，同时还需要兼容在低于26.0.0的老版本的运行，请参考[ArkTS API兼容性保护](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/arkts-api-compatibility-warning-elim)。

-
沉浸光感开启后，弹窗类组件（AlertDialog、ActionSheet、CustomDialog、CalendarPickerDialog、DatePickerDialog、TimePickerDialog、TextPickerDialog、SelectionMenu、AlphabetIndexer弹窗、Text设置copyOption后长按或双击触发的文本菜单）和弹窗类接口（PromptAction、ArkUI_NativeDialog、@ohos.promptAction (弹窗)、Popup控制、Tips控制、菜单控制、半模态转场）以及按钮与选择类组件（Slider、Toggle、Select）可在页面内全部区域生效。

其他组件仅在Navigation/NavDestination标题栏或横向Tab中barPosition为BarPosition.End的底部TabBar中生效。在其他区域中设置沉浸光感效果不生效。

- 沉浸式系统材质反色、材质赋色、交互形变与点光源、阴影开关等个性化配置，具体请参见[沉浸式系统材质视效](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-common-capability)。

#### 沉浸光感开启方式对比

不同开启方式对比如下：

|
开启方式
| |
支持的组件
| |
说明
|

|
应用级开启
| |
组件清单详见[MaterialState](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)。
| |
支持通过如下两种方式开启：

1. 通过[module.json5](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)统一配置，为支持沉浸光感的组件，批量开启或全局禁用沉浸光感，具体开启方法请参考表格下方内容。

2. module.json5未配置该字段时即为default模式，开发者的应用从API版本26.0.0之前升级至API版本26.0.0及以上，在未主动设置沉浸光感的情况下，组件默认开启沉浸光感，无需任何配置。
|

|
组件级开启
| |
支持设置沉浸式系统材质的组件
| |
支持通过如下三种方式开启：

1. 通过通用属性[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)设置。

2. 弹窗类组件通过options参数中的systemMaterial字段设置，例如Toast的[ShowToastOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-promptaction#showtoastoptions)、自定义弹窗的[CustomDialogControllerOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#customdialogcontrolleroptions%E5%AF%B9%E8%B1%A1%E8%AF%B4%E6%98%8E)等。

3. 组件专属接口设置，例如Select下拉菜单的[menuSystemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#menusystemmaterial)、Navigation标题栏的[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)等。

各组件详细适配方法请参考[组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)。
|

应用级开启通过配置文件统一设置应用的沉浸光感开关。在[module.json5](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)中，将[metadata](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file#metadata%E6%A0%87%E7%AD%BE)参数的name字段配置为"ohos.arkui.UIMaterial.state"，value字段为default或enable时开启，字段为disable时关闭。该配置仅在entry类型的module中生效。

以下示例展示如何在[module.json5](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)中配置enable模式：

```
{
  "module": {
    "name": "entry",
    "type": "entry",
    // ...
    "metadata": [{
      "name": "ohos.arkui.UIMaterial.state",
      "value": "enable"
    }],
    // ...
  }
}
```

开发者可以通过[uiMaterial.getMaterialInfo()](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#uimaterialgetmaterialinfo)获取当前应用的沉浸式系统材质配置状态[MaterialState](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)，MaterialState中的[DEFAULT](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)、[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)和[DISABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)，分别对应module.json5配置文件中default、enable和disable三个value值。

- 应用级开关设置为disable时，会全局禁用沉浸光感，应用级或组件级开启的设置均不生效。

- 组件级开启的优先级高于应用级开启，开发者通过组件的沉浸式系统材质接口可以直接覆盖应用级开关开启的组件效果，反之则不会覆盖。

#### 关闭沉浸光感

关闭沉浸光感有以下几种方式：

-
组件级关闭：组件级设置[uiMaterial.Material.empty](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#empty)。应用级开启和组件级开启两种接入方式均可通过该操作关闭。

-
应用级关闭：应用级开关设置为disable，只针对应用级开启的组件。

此外，部分组件的沉浸式系统材质由多个独立接口控制。以Select为例，其下拉按钮的沉浸式系统材质通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)设置，下拉菜单的沉浸式系统材质通过独立的[menuSystemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#menusystemmaterial)接口设置，两者相互独立、可分别开启或关闭。

[uiMaterial.Material.empty](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#empty)与将systemMaterial属性设置为undefined含义不同：undefined表示恢复为组件默认的沉浸光感效果；uiMaterial.Material.empty是关闭沉浸光感效果。因此，要关闭一个默认开启沉浸光感的组件，应使用uiMaterial.Material.empty。
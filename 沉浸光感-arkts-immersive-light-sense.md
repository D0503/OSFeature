# 沉浸光感

> 来源：https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense
>
> 本文档原样抓取自华为开发者联盟文档中心「沉浸光感」章节（API 26.0.0 起），包含：简介、开发指导（开启沉浸光感 / 组件适配沉浸光感 / 沉浸式系统材质视效）、功耗优化、兼容性适配、常见问题、典型场景。
>
> 注意：文中的 `![](https://media:xxx)` 为文档站内部媒体引用，站外无法直接访问。

**章节目录**

* [沉浸光感简介](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-overview)  
* [沉浸光感开发指导](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-development)  
  * [开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)  
  * [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)  
  * [沉浸式系统材质视效](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-common-capability)  
* [沉浸光感功耗优化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints)  
* [沉浸光感兼容性适配](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-compatibility)  
* [沉浸光感常见问题](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq)  
* [沉浸光感典型场景](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sample)  

---

# 沉浸光感简介

从API版本26.0.0开始，ArkUI新增沉浸光感。

沉浸光感是ArkUI提供的一套从"视觉层"到"感知层"的体验，将光影材质与交互动效表现相结合，帮助应用建立清晰的视觉层次，并在不同设备上保持和谐一致的观感。例如：用户展开菜单时，伴随着形变弹出打破生硬的规整边界，边缘流光勾勒着面板轮廓，将菜单的弹出操作转化为富有沉浸感的体验。

沉浸光感包含两部分能力：

* 沉浸式系统材质：为组件赋予轻盈通透的质感，让内容透过系统材质层自然渗透，配合折射、高光、阴影等多层效果，使弹窗、菜单、工具栏等浮层元素在内容之上建立清晰的视觉层次。系统提供从超薄到超厚的五种材质样式，覆盖从浮动工具栏到弹窗的不同透光需求。
* 沉浸式空间动效：为弹窗和菜单的弹出过程增添形变、流光等动态表现，让每一次弹出都灵动自然。

沉浸光感会根据设备算力和用户在系统中设置的沉浸光感效果，自适应地调整沉浸式系统材质和沉浸式空间动效的表现程度，其中算力档位由设备定义且固定，可通过获取材质等级接口（[uiMaterial.getGlobalMaterialLevel](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#uimaterialgetglobalmateriallevel)）查询；用户在系统中不同设置下的沉浸光感效果请参考[用户体验与个性定义](https://developer.huawei.com/consumer/cn/doc/design-guides/immersivelight-0000002612101053#section11153104616255)。沉浸式系统材质还会随系统深浅色模式自动切换效果，确保应用在不同使用环境下都能呈现最佳效果。

![](https://media:201788198946002731)  

## 关键技术

## 沉浸式系统材质

沉浸式系统材质为组件赋予轻盈通透的质感：材质滤镜、折射、高光、阴影等多层效果叠加，让底层内容透过材质层自然渗透，带来远超纯色背景的高端视觉表现。开发者只需[开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)，组件的背景、边框、阴影等视觉效果即由沉浸式系统材质统一接管，随深浅色模式与设备算力自动适配。

沉浸式系统材质提供从超薄到超厚的五种样式，不同样式的对比效果请参考[设计与开发](https://developer.huawei.com/consumer/cn/doc/design-guides/immersivelight-0000002612101053#section91711926192713)。开启沉浸光感后不同组件的默认样式存在差异，具体请参考[组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)。  

|样式|说明|适用场景|
|:----------|:-----------------|:--------------|
|ULTRA_THIN|超薄样式，材质层具有很强的透明效果。|高度透明的背景，如浮动工具栏。|
|THIN|薄样式，材质层具有较强的透明效果。|较强透明度的场景，如搜索框。|
|REGULAR|常规样式，材质层厚度常规。|通用场景。|
|THICK|厚样式，模糊效果强。|较强模糊背景的场景，如菜单。|
|ULTRA_THICK|超厚样式，模糊效果很强。|完全模糊背景的场景，如弹窗。|

此外，沉浸式系统材质还支持材质赋色、自动反色、阴影开关、交互形变与点光源等个性化配置，具体使用方法请参见[沉浸式系统材质视效](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-common-capability)。  

## 沉浸式空间动效

沉浸式空间动效，将光的行为凝练为三种相互呼应的动效类型，具体请参考下表。沉浸式空间动效会根据设备算力与用户在系统中设置的沉浸光感效果自适应调整，开发者无需额外适配。  

|动效类型|说明|支持的组件|
|:-----------|:-----------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|非线性形变 <br />|实现光影形体的动态蜕变，打破规整边界带来柔和自然的空间过渡。|AlertDialog，具体示例请参考[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-alert-dialog-box#示例9设置弹窗的沉浸光感效果) CustomDialog，具体示例请参考[示例14（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#示例14设置弹窗的沉浸光感效果) ActionSheet，具体示例请参考[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-action-sheet#示例9设置弹窗的沉浸光感效果) 菜单控制，具体示例请参考[示例24（设置菜单的沉浸光感）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-menu#示例24设置菜单的沉浸光感)|
|边缘流光|流光塑造视觉焦点与层级秩序，依靠光流走向引导用户的视线流转。|AlertDialog，具体示例请参考[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-alert-dialog-box#示例9设置弹窗的沉浸光感效果) CustomDialog，具体示例请参考[示例14（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#示例14设置弹窗的沉浸光感效果) ActionSheet，具体示例请参考[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-action-sheet#示例9设置弹窗的沉浸光感效果) 菜单控制，具体示例请参考[示例24（设置菜单的沉浸光感）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-menu#示例24设置菜单的沉浸光感)|
|粒子动画|粒子承载信息具象表达，以粒子光点传递信息变化。|Slider参考[示例10（设置滑动条的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#示例10设置滑动条的沉浸光感效果)|

## 约束与限制

沉浸光感生效范围请参考[开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)。

沉浸光感开启后，除了弹窗类组件或方法、Slider、Toggle，其他组件仅在以下区域中生效：Navigation/NavDestination标题栏，或横向Tabs中barPosition为BarPosition.End的底部TabBar中。

弹窗类组件或方法包括：Popup、Tips、Menu、BindSheet、showActionMenu、AlertDialog、CustomDialog、ActionSheet、CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog、Toast、Select、AlphabetIndexer气泡弹窗、Text设置copyOption后长按或双击触发的文本菜单、SelectionMenu（结合bindSelectionMenu一起使用）。  

## 与相关Kit的关系

[UI Design Kit](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-introduction)同样提供了沉浸光感能力，但其适用范围与ArkUI存在差异：

* UI Design Kit：支持HDS导航和HDS底部页签两个组件的沉浸光感能力，开发者可以通过[TitleBarStyleOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation#titlebarstyleoptions)或[HdsTabsFloatingStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdstabs#hdstabsfloatingstyle)的systemMaterialEffect设置沉浸光感视效，具体请参考[UI Design Kit](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-introduction)下的[沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material)。

* ArkUI：沉浸光感生效范围请参考[开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)。

开发者可以根据实际需求选择，如果应用使用HDS导航和底部页签组件，可以直接通过UI Design Kit快速开启沉浸光感；如果需要为更多组件或弹窗类组件添加沉浸光感效果，则使用本文介绍的ArkUI沉浸光感能力。  

---

# 沉浸光感开发指导

# 开启沉浸光感

沉浸光感提供应用级开启和组件级开启两种方式，可按需选择。沉浸光感开启后，需要大量GPU资源，具体的使用指导请参考[沉浸光感功耗优化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints)，其余开启后的常见问题请参考[沉浸光感常见问题](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq)。  

## 沉浸光感开启方式对比

![](https://media:201788199032451191)  
* 开启沉浸光感，要确保应用的[targetAPIVersion](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/app-configuration-file)不低于26.0.0。如果低版本适配，适配指导请参考[沉浸光感兼容性适配](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-compatibility)。
* 沉浸光感开启后，除了弹窗类组件或方法、Slider、Toggle，其他组件仅在以下区域中生效：Navigation/NavDestination标题栏，或横向Tabs中barPosition为BarPosition.End的底部TabBar中。 弹窗类组件或方法包括：Popup、Tips、Menu、BindSheet、showActionMenu、AlertDialog、CustomDialog、ActionSheet、CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog、Toast、Select、AlphabetIndexer气泡弹窗、Text设置copyOption后长按或双击触发的文本菜单、SelectionMenu（结合bindSelectionMenu一起使用）。

  开启后，不同组件的效果详见[组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)。

不同开启方式对比如下：  

|开启方式|支持的组件|说明|
|:----|:----------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|应用级开启|组件清单详见[MaterialState](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)。|支持通过如下两种方式开启： 1. 通过[module.json5](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)统一配置，为支持沉浸光感的组件，批量开启或全局禁用沉浸光感，具体开启方法请参考表格下方内容。 2. module.json5未配置该字段时即为default模式，开发者的应用从API版本26.0.0之前升级至API版本26.0.0及以上，在未主动设置沉浸光感的情况下，组件默认开启沉浸光感，无需任何配置。|
|组件级开启|支持设置沉浸式系统材质的组件|支持通过如下三种方式开启： 1. 通过通用属性[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)设置。 2. 弹窗类组件通过options参数中的systemMaterial字段设置。 3. 组件专属接口设置，当前支持设置的组件包括：Select下拉菜单的[menuSystemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#menusystemmaterial)、Navigation标题栏的[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)。|

应用级开启通过配置文件统一设置应用的沉浸光感开关。在[module.json5](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)中，将[metadata](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file#metadata标签)参数的name字段配置为"ohos.arkui.UIMaterial.state"，value字段为default或enable时开启，字段为disable时关闭。该配置仅在entry类型的module中生效。

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
![](https://media:201788199032485192)  
* 应用级开关设置为disable时，会全局禁用沉浸光感，应用级或组件级开启的设置均不生效。
* 组件级开启的优先级高于应用级开启，开发者通过组件的沉浸式系统材质接口可以直接覆盖应用级开关开启的组件效果，反之不会。  

## 关闭沉浸光感

关闭沉浸光感有以下几种方式：

1. 组件级关闭：组件级设置[uiMaterial.Material.empty](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#empty)。应用级开启和组件级开启两种接入方式均可通过该操作关闭。

2. 应用级关闭：应用级开关设置为disable，只针对应用级开启的组件。

此外，部分组件的沉浸式系统材质由多个独立接口控制。以Select为例，其下拉按钮的沉浸式系统材质通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)设置，下拉菜单的沉浸式系统材质通过独立的[menuSystemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#menusystemmaterial)接口设置，两者相互独立、可分别开启或关闭。  
![](https://media:201788199032508193)  
[uiMaterial.Material.empty](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#empty)与将systemMaterial属性设置为undefined含义不同：undefined表示恢复为组件默认的沉浸光感接口效果；uiMaterial.Material.empty是关闭沉浸光感效果。因此，要关闭一个默认开启沉浸光感的组件，应使用uiMaterial.Material.empty。  

---

# 组件适配沉浸光感

本文按导航类、弹窗类、按钮与选择类三大组件分类，系统介绍各组件如何通过应用级开关与组件级配置开启沉浸光感，涵盖沉浸光感的视觉效果、设置方法及适配要点，帮助开发者快速完成沉浸光感的组件适配。  

## 导航类组件

导航类组件包括Navigation标题栏、底部页签、索引条，是页面导航与内容定位的辅助元素，通常固定在页面顶部或底部。沉浸光感为导航类组件赋予了通透的悬浮质感，让导航栏在滚动内容之上呈现轻盈的分层效果，内容透过材质层自然渗透，建立导航区域与内容之间的视觉层次。导航类组件通常使用较薄的材质样式（ULTRA_THIN或THIN），在保持背景通透的同时避免过度遮挡内容。  

## Navigation标题栏

Navigation标题栏支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，Navigation标题栏默认开启沉浸光感，沉浸式系统材质样式默认取值为ULTRA_THIN；在非ENABLE模式下，沉浸光感不生效。

组件级开启：Navigation标题栏支持通过[NavigationTitleOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)中的systemMaterial字段设置沉浸光感效果。

* 推荐将沉浸光感限定在顶部标题栏等需要凸显的局部区域，控制使用面积与层数，详见[沉浸光感功耗优化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints)。
* 沉浸光感针对标题栏生效的范围是：返回键、非自定义Menu。
* systemMaterial为undefined时，[MaterialState](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)开关配置为DEFAULT时标题栏无材质效果；配置为ENABLE时标题栏生效系统默认的沉浸式材质效果。
* 建议设置沉浸光感时，使用[barStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)为STACK样式，以便Navigation内容区延伸至标题栏区域，获得沉浸光感的最佳体验。

组件开启沉浸光感的效果请参见[示例20（设置systemMaterial开启标题栏材质效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#示例20设置systemmaterial开启标题栏材质效果)。  

## 底部页签（Tabs）

底部页签支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，底部页签不会默认开启沉浸光感。

组件级开启：底部页签支持通过[barFloatingStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barfloatingstyle)属性中[FloatingTabBarStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#floatingtabbarstyle)的systemMaterial字段，设置TabBar背板的沉浸光感效果。

* 悬浮样式仅在[barOverlap](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#baroverlap10)为true、[vertical](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#vertical)为false、[barPosition](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barposition9)为BarPosition.End时生效，三个条件需同时满足，否则systemMaterial设置不生效。
* 设置悬浮材质后，不建议再通过[barBackgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barbackgroundcolor10)、[barBackgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barbackgroundblurstyle11)为TabBar设置背景色或背景模糊，避免遮挡材质效果。
* TabContent不支持设置沉浸光感。

组件开启沉浸光感的效果请参见[示例24（TabBar悬浮样式）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#示例24tabbar悬浮样式)。  

## 索引条（AlphabetIndexer）

索引条支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，索引条默认开启沉浸光感，沉浸式系统材质样式默认取值为THICK。

组件级开启：索引条参数[popupBackground](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer#popupbackground)和[popupBackgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer#popupbackgroundblurstyle12)均未主动设置（或参数value传入undefined）时，提示弹窗默认开启沉浸光感，默认材质样式为THICK；也可通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性主动设置沉浸光感效果。

* 高算力、中算力设备默认显示为沉浸光感THICK样式，低算力设备不显示沉浸光感效果，显示为白色背景。
* popupBackground、popupBackgroundBlurStyle属性和沉浸光感能力互斥。主动设置popupBackground或popupBackgroundBlurStyle后无沉浸光感效果。

组件开启沉浸光感的效果请参见[示例3（设置提示弹窗背景模糊材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer#示例3设置提示弹窗背景模糊材质)。  

## 弹窗类组件

弹窗类组件包括Toast、Popup、Tips、Menu和Dialog（包含AlertDialog、CustomDialog、bindSheet及各类PickerDialog），是浮层元素，在内容之上建立视觉层次。沉浸光感为弹窗类组件赋予了核心价值：沉浸式系统材质让弹窗背景呈现轻盈通透的质感，底层内容透过材质层自然渗透，配合折射、高光、阴影等多层效果，使弹窗在内容之上建立清晰的视觉层次；沉浸式空间动效为弹窗和菜单的弹出过程增添形变、流光等动态表现，使弹出过程灵动自然。弹窗类组件通常使用较厚的材质样式（THICK或ULTRA_THICK），以获得更强的背景模糊效果，确保弹窗内容与背景内容之间有清晰的视觉分离。  

## 即时反馈（Toast）

Toast支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，Toast默认开启沉浸光感，沉浸式系统材质样式默认取值为THICK。

组件级开启：Toast支持通过[ShowToastOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-promptaction#showtoastoptions)中的systemMaterial字段设置沉浸光感效果。

沉浸光感开启后，如果已主动设置[ShowToastOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-promptaction#showtoastoptions)中的backgroundBlurStyle或backgroundColor，则不呈现沉浸光感效果，否则沉浸式系统材质样式ImmersiveStyle默认取值为ImmersiveStyle.THICK。具体请参考[Dialog或Toast组件默认没有材质效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq#dialog或toast组件默认没有材质效果)。

组件开启沉浸光感的效果请参见[showToast](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uicontext-promptaction#showtoast)。  

## 气泡提示（Popup和Tips）

Popup和Tips支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，气泡提示不会默认开启沉浸光感。

组件级开启：气泡支持通过[PopupOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-popup#popupoptions类型说明)中的systemMaterial字段设置沉浸光感效果；悬浮提示通过[TipsOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-tips#tipsoptions类型说明)中的systemMaterial字段设置。

组件开启沉浸光感的效果请参见[示例9（设置Popup的沉浸光感视觉效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-popup#示例9设置popup的沉浸光感视觉效果)和[示例3（设置悬浮气泡的沉浸光感视效）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-tips#示例3设置悬浮气泡的沉浸光感视效)。  

## 菜单（Menu）

菜单支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，菜单默认开启沉浸光感，沉浸式系统材质样式默认取值为THICK。

组件级开启：菜单支持通过[ContextMenuOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-menu#contextmenuoptions10)中的systemMaterial字段设置沉浸光感效果。

组件开启沉浸光感的效果请参见[示例24（设置菜单的沉浸光感）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-menu#示例24设置菜单的沉浸光感)。  

## 弹出框（Dialog）

弹出框支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，弹出框默认开启沉浸光感，沉浸式系统材质样式默认取值为ULTRA_THICK。

组件级开启：弹出框支持通过弹出框options参数中的systemMaterial字段设置沉浸光感效果，如[CustomDialogControllerOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#customdialogcontrolleroptions对象说明)、[AlertDialogParam](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-alert-dialog-box#alertdialogparam对象说明)、[ActionSheetOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-action-sheet#actionsheetoptions对象说明)、[SheetOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-sheet-transition#sheetoptions)等。

* 沉浸光感开启后，如果已主动设置背景色、背景模糊等自定义样式属性，则不呈现沉浸光感效果，否则沉浸式系统材质样式ImmersiveStyle默认取值为ImmersiveStyle.ULTRA_THICK。具体请参考[Dialog或Toast组件默认没有材质效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq#dialog或toast组件默认没有材质效果)。
* 大面积的弹出框开启沉浸光感效果，会带来更多的动效绘制开销，不建议开启。详见[控制弹窗尺寸](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints#控制弹窗尺寸)中的尺寸建议。
* [CalendarPicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-calendarpicker)组件拉起的弹出框目前暂不支持开启沉浸光感效果，通过通用属性设置的沉浸光感效果会体现在CalendarPicker组件本身。
* [DatePicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-datepicker)、[TextPicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-textpicker)、[TimePicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-timepicker)组件沉浸光感效果同CustomDialog相同。

组件开启沉浸光感的效果请参见[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-alert-dialog-box#示例9设置弹窗的沉浸光感效果)、[示例14（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#示例14设置弹窗的沉浸光感效果)、[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-action-sheet#示例9设置弹窗的沉浸光感效果)和[示例10（半模态设置系统材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-sheet-transition#示例10半模态设置系统材质)。  

## 按钮与选择类组件

按钮与选择类组件包括Button、Select、Toggle、Slider、ChipGroup和SegmentButton，是内嵌于内容流中的交互元素，用户通过它们进行选择和操作。沉浸光感为选择类组件提供了细腻的交互反馈与通透的视觉质感：沉浸式系统材质通常使用较薄的材质样式（ULTRA_THIN或THIN），在保持组件背景通透的同时，通过[ImmersiveOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)中的交互形变（interactive）和点光源（lightEffect）为按压、触摸等操作提供灵动的视觉反馈，替代组件默认的按压态和悬浮态效果。  

## 按钮（Button）

按钮支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，按钮不会默认开启沉浸光感。

组件级开启：按钮支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性为[Button](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button)组件设置沉浸光感效果。

* 材质样式为THIN或ULTRA_THIN时，[fontColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#fontcolor)使用系统预定义的可反色颜色资源，可随材质自动反色。
* 当沉浸光感启用了光感交互反馈效果（[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）时，按钮默认的点击态和悬浮态视觉反馈不再展示，由材质的光感交互反馈效果替代。
* 配置沉浸光感但未设置[buttonStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#buttonstyle11)、[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)等颜色相关属性且未设置材质颜色时，默认生效Button主题色的材质样式。

组件开启沉浸光感的效果请参见[示例9（设置按钮的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#示例9设置按钮的沉浸光感效果)。  

## 下拉按钮（Select）

下拉按钮支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，下拉按钮与下拉菜单默认开启沉浸光感。下拉按钮沉浸式系统材质样式默认取值为ULTRA_THIN，并默认开启交互形变（[interactive](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）与光感交互反馈（[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）；下拉菜单沉浸式系统材质样式默认取值为THICK。

组件级开启：下拉按钮支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性设置沉浸光感效果；下拉菜单通过独立的[menuSystemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#menusystemmaterial)接口设置沉浸光感效果。

* 下拉按钮与下拉菜单的沉浸光感相互独立，可分别开启或关闭；如需单独关闭沉浸光感，应设置[uiMaterial.Material.empty](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#empty)，而非将systemMaterial设置为undefined。
* 当下拉按钮的沉浸光感启用了光感交互反馈效果（[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）时，下拉按钮默认的按压态和悬浮态视觉反馈不再展示，由材质的光感交互反馈效果替代。

组件开启沉浸光感的效果请参见[示例11（设置Select和下拉菜单沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#示例11设置select和下拉菜单沉浸光感效果)。  

## 开关（Toggle）

开关支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，Toggle默认开启沉浸光感。

组件级开启：开关支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性设置沉浸光感效果。

* 不同[ToggleType](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-toggle#toggletype枚举说明)下沉浸光感效果存在差异：
  * ToggleType.Checkbox：当前未适配沉浸光感效果，设置后无沉浸光感效果。
  * ToggleType.Switch：传入的材质参数仅作为开启沉浸光感的开关标记，不影响实际视觉效果，实际使用组件内部预设的视觉参数，主要影响滑块大小、滑块样式、阴影等；材质效果随设备算力档位变化。
  * ToggleType.Button：效果与[Button](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button)组件设置沉浸光感相同，主要影响背景颜色、边框、阴影等视觉属性。

组件开启沉浸光感的效果请参见[示例4（Toggle沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-toggle#示例4toggle沉浸光感效果)。  

## 滑动条（Slider）

滑动条支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，滑动条默认开启沉浸光感。

组件级开启：滑动条支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性设置沉浸光感效果。

* 传入的材质参数仅作为开启沉浸光感的开关标记，不影响实际视觉效果，实际使用组件内部预设的视觉参数，主要影响滑块大小、滑块样式、阴影等；传入undefined时沉浸光感不生效，恢复为原先的Slider样式。
* 沉浸光感的交互反馈效果仅在滑块形状为[SliderBlockType](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#sliderblocktype10枚举说明).DEFAULT且[SliderStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#sliderstyle枚举说明)不为NONE时生效。

组件开启沉浸光感的效果请参见[示例10（设置滑动条的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#示例10设置滑动条的沉浸光感效果)。  

## 子页签（ChipGroup）

子页签支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，子页签默认开启沉浸光感，沉浸式系统材质样式默认取值为ULTRA_THIN。

组件级开启：子页签支持通过[ChipGroup](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-chipgroup)的backgroundSystemMaterial、selectedBackgroundSystemMaterial（选中状态）和iconBackgroundSystemMaterial（图标）字段设置沉浸光感效果。

需要文字、图标颜色随材质自动反色时，颜色应使用系统预定义的可反色颜色资源（如$r('sys.color.font_primary')），硬编码颜色值不会触发自动反色，详见[设置沉浸式系统材质反色](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-common-capability#设置沉浸式系统材质反色)。

组件开启沉浸光感的效果请参见[示例6（设置系统材质样式）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-chipgroup#示例6设置系统材质样式)和[示例7（设置组件选中状态的系统材质样式）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-chipgroup#示例7设置组件选中状态的系统材质样式)。  

## 操作块（SegmentButton）

操作块支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，操作块默认开启沉浸光感，沉浸式系统材质样式默认取值为THIN。

组件级开启：[SegmentButton](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton)支持通过SegmentButtonOptions中的backgroundSystemMaterial字段设置沉浸光感效果；[SegmentButtonV2](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbuttonv2)通过各类分段按钮options参数中的backgroundSystemMaterial字段设置。

* SegmentButton的胶囊类多选分段按钮（[SegmentButtonOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton#segmentbuttonoptions)的type为"capsule"且[SegmentButtonOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton#segmentbuttonoptions)的multiply为true）不支持backgroundSystemMaterial，设置后不生效。
* SegmentButtonV2开启沉浸光感后，支持选中项背景跟随手指拖拽，否则不支持跟随手指拖拽。
* 设置自动反色时，即colorInvert为true，如果SegmentButton中的fontColor、selectedFontColor，或SegmentButtonV2中的itemFontColor、itemSelectedFontColor、itemIconFillColor、itemSelectedIconFillColor等使用支持反色的系统资源，颜色自动适配到材质背景色的反色。

组件开启沉浸光感的效果请参见[示例8（设置背景板材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton#示例8设置背景板材质)和[示例6（设置背景板材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbuttonv2#示例6设置背景板材质)。  

---

# 沉浸式系统材质视效

本文介绍如何按场景定制沉浸式系统材质的视效，包括设置沉浸式系统材质反色、为沉浸式系统材质赋色、设置沉浸式系统材质交互效果以及设置沉浸式系统材质阴影效果。  

## 设置沉浸式系统材质反色

当组件设置为透明度较高的沉浸式系统材质（如ULTRA_THIN或THIN）时，例如组件内的文字可能与背景色对比度不足，导致阅读体验不佳。开启[ImmersiveOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)中的colorInvert自动反色功能后，组件子节点中的文字颜色会自动调整为沉浸式系统材质下方背景色的反色，确保文字始终可读。具体的使用限制请参见[colorInvert](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数说明。

如开启自动反色后文字颜色没有变化，排查步骤请参见[开启自动反色后文字颜色没有变化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq#开启自动反色后文字颜色没有变化)。

以下示例为自动反色的效果：材质下方的背景在黑白之间滚动变化，为TabBar组件设置colorInvert为true的ULTRA_THIN材质后，TabBar内的文字和图标颜色随背景自动反色，使文字与图标清晰可读。

```
import { uiMaterial } from '@kit.ArkUI';

@Component
struct ContentOne {
  build() {
    Scroll() {
      Column() {
        // $r('app.media.greyBackground')需要替换为开发者所需的图像资源文件
        Image($r('app.media.greyBackground'))
          .width('100%')
          .height('150%')
          .objectFit(ImageFit.Fill)
        // $r('app.media.greyBackground')需要替换为开发者所需的图像资源文件
        Image($r('app.media.greyBackground'))
          .width('100%')
          .height('150%')
          .objectFit(ImageFit.Fill)
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
  }
}

@Entry
@Component
struct PageMaterialReverse {
  build() {
    Column() {
      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          ContentOne()
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), 'tab1')
        // BottomTabBarStyle样式支持反色，且设置支持反色的系统颜色资源
          .labelStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
          .iconStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
        )

        TabContent() {
          Column().width('100%').height('100%').backgroundColor(Color.Green)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), 'tab2')
          .labelStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
          .iconStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
        )
      }
      .barFloatingStyle({
        adaptToHandedness: true,
        systemMaterial: new uiMaterial.ImmersiveMaterial(
          {
            style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
            // 设置tabBar的材质为允许反色，且需配合ULTRA_THIN或THIN的style才能反色
            colorInvert: true,
          }
        )
      })
      .barOverlap(true)
      .height('100%')
    }
    .width('100%')
    .height('100%')
  }
}
```

![](https://media:201788199055052601)  

## 为沉浸式系统材质赋色

通过[ImmersiveOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)中的[materialColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数，可为材质滤镜再混合一层纯色效果，用于色调表达或降低折射的可见程度。该颜色需要带有一定的透明度，传入纯不透明颜色（如Color.Red或'#FFFF0000'）会遮挡材质滤镜效果。  
![](https://media:201788199055087602)  
materialColor参数对所有档位的算力设备均生效。在高算力和中算力设备上，该参数为材质滤镜再混合一层纯色效果；在低算力设备上，该参数作为背景色[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)属性值。

以下示例为材质赋色的效果：为ULTRA_THIN材质组件设置半透明的materialColor后，材质在透出背景内容的同时呈现对应的色调。

```
import { uiMaterial } from '@kit.ArkUI';

@Entry
@Component
struct MaterialColorExample {
  build() {
    Column() {
      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          // $r('app.media.invert')需要替换为开发者所需的图像资源文件
          Image($r('app.media.invert'))
            .width('100%')
            .height('100%')
            .objectFit(ImageFit.Cover)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), 'tab1')
          .labelStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
          .iconStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
        )

        TabContent() {
          Column().width('100%').height('100%').backgroundColor(Color.Green)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), 'tab2')
          .labelStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
          .iconStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
        )
      }
      .barFloatingStyle({
        adaptToHandedness: true,
        maskHeight: 0,
        systemMaterial: new uiMaterial.ImmersiveMaterial(
          {
            style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
            // 设置材质赋色颜色
            materialColor: 'rgba(255, 0, 0, 0.2)',
          }
        )
      })
      .barOverlap(true)
      .height('100%')
    }
    .width('100%')
    .height('100%')
  }
}
```

![](https://media:201788199055124603)  

## 设置沉浸式系统材质交互效果

沉浸式系统材质支持设置交互形变和点光源效果：

* 交互形变：通过[interactive](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)开启交互形变，组件在按压时产生弹性形变，松手后自动恢复，增强交互的视觉反馈。
* 点光源：通过[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)开启点光源，用户手指触摸组件时会产生流光跟随效果。lightEffect传入有效对象即启用，传入null或undefined则不启用；对象中的color字段自定义流光颜色，默认值为Color.White。

以下示例为交互形变与点光源的效果：设置interactive为true并传入lightEffect对象后，按压组件时产生弹性形变，手指触摸时产生流光跟随效果。

```
import { uiMaterial } from '@kit.ArkUI';

@Entry
@Component
struct MaterialColorExample {
  build() {
    Column() {
      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          // $r('app.media.invert')需要替换为开发者所需的图像资源文件
          Image($r('app.media.invert'))
            .width('100%')
            .height('100%')
            .objectFit(ImageFit.Cover)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), 'tab1')
          .labelStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
          .iconStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
        )

        TabContent() {
          Column().width('100%').height('100%').backgroundColor(Color.Green)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), 'tab2')
          .labelStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
          .iconStyle({ selectedColor: $r('sys.color.brand'), unselectedColor: $r('sys.color.font_primary') })
        )
      }
      .barFloatingStyle({
        adaptToHandedness: true,
        maskHeight: 0,
        systemMaterial: new uiMaterial.ImmersiveMaterial({
          style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
          // 开启可交互形变
          interactive: true,
          // 设置交互点光源效果为默认颜色
          lightEffect: {},
        }),
      })
      .barOverlap(true)
      .height('100%')
    }
    .width('100%')
    .height('100%')
  }
}
```

![](https://media:201788199055261604)  

## 设置沉浸式系统材质阴影效果

沉浸式系统材质默认自带阴影效果（[applyShadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)为true），优先于[shadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#shadow)通用属性，此时自定义的shadow设置不会生效。如需使用自定义阴影，将applyShadow置为false后再设置shadow，沉浸式系统材质的阴影效果即不生效。

将applyShadow置为false后设置自定义shadow（如粉色阴影）的效果，示例如下：

```
import { uiMaterial } from '@kit.ArkUI';

@Entry
@Component
struct CustomShadowExample {
  @Builder
  NavigationTitle() {
    Row() {
      Text('Title')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)

      Column()
        .width(50)
        .height(50)
        .borderRadius(25)
        .justifyContent(FlexAlign.Center)
        .systemMaterial(new uiMaterial.ImmersiveMaterial({
          style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
          applyShadow: false,
          interactive: true,
        }))
        .shadow({ radius: 100, color: Color.Pink })
    }
    .width('100%')
    .justifyContent(FlexAlign.SpaceBetween)
    .padding({ left: 50, right: 50, top: 20 })
  }

  build() {
    Column() {
      Navigation() {
        // 页面内容
        Image($r('app.media.invert'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      }
      .title({ builder: this.NavigationTitle, height: '100%' })
      // $r('app.media.greyBackground')需要替换为开发者所需的图像资源文件
      .backgroundImage($r('app.media.greyBackground'))
      .backgroundImageSize({ width: '100%', height: '100%' })
    }.width('100%').height('100%')
  }
}
```

![](https://media:201788199055353605)  

---

# 沉浸光感功耗优化

沉浸光感效果由材质滤镜、折射、高光、阴影等多层效果叠加而成，渲染时需要消耗GPU资源，不合理使用会显著增加功耗。

总体优化原则：沉浸光感效果作为一种"稀缺"视觉资源使用，需控制面积与层数、不应固定显示在视频动图动画等变化的内容之上。建议遵循以下功耗优化，获得沉浸光感体验的同时降低性能与功耗的影响。  

## 控制材质使用面积

沉浸式系统材质影响的区域越大，需要处理的像素越多，功耗越高。应避免在单个超大尺寸区域上使用沉浸式系统材质，也应避免在大量小区域上重复使用沉浸式系统材质；约束在Navigation/NavDestination标题栏和横向Tabs中barPosition为BarPosition.End的底部TabBar中使用，优先将沉浸式系统材质限定在需要凸显的局部区域中。  
![](https://media:201788198978838409)  
沉浸光感开启后，除了弹窗类组件或方法、Slider、Toggle，其他组件仅在以下区域中生效：Navigation/NavDestination标题栏，或横向Tabs中barPosition为BarPosition.End的底部TabBar中。

弹窗类组件或方法包括：Popup、Tips、Menu、BindSheet、showActionMenu、AlertDialog、CustomDialog、ActionSheet、CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog、Toast、Select、AlphabetIndexer气泡弹窗、Text设置copyOption后长按或双击触发的文本菜单、SelectionMenu（结合bindSelectionMenu一起使用）。

```
import { uiMaterial } from '@kit.ArkUI';

// 正例：在Navigation标题栏子树中为局部容器设置沉浸式系统材质，材质生效且面积可控
@Entry
@Component
struct MaterialAreaExample {
  @Builder
  NavigationTitle() {
    Column() {
      Text('卡片')
    }
    .width(328)
    .height(120)
    .borderRadius(24)
    .systemMaterial(new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.REGULAR,
    }))
  }

  build() {
    Column() {
      Navigation() {
        // 页面内容
      }
      .title({ builder: this.NavigationTitle, height: '100%' })
    }.width('100%').height('100%')
  }
}

// 反例：在标题栏生效范围外为整页背景设置沉浸式系统材质，区域过大且材质不生效
Column() {
  // ...整页内容
}
.width('100%')
.height('100%')
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
}))
```

## 避免材质嵌套

材质嵌套使用会导致效果被重复计算，既增加功耗，视觉上又相互干扰。同一子树中只需在最外层设置一次沉浸式系统材质，内层节点不应再设置。

```
// 正例：仅在最外层设置一次沉浸式系统材质
Column() {
  Column() {
    Text('内容')
  }
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
}))

// 反例：外层和内层都设置了沉浸式系统材质，相互嵌套
Column() {
  Column() {
    Text('内容')
  }
  .systemMaterial(new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.THIN,
  }))
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
}))
```

## 避免与模糊效果叠加

沉浸式系统材质自带的材质滤镜（materialFilter）已包含背景模糊效果，再叠加backgroundBlurStyle、backgroundEffect等模糊属性属于重复处理，会增加额外的功耗开销。

```
// 正例：仅使用沉浸式系统材质，由其提供模糊效果
Column() {
  Text('内容')
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THICK,
}))

// 反例：同时设置沉浸式系统材质与背景模糊，重复处理
Column() {
  Text('内容')
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THICK,
}))
.backgroundBlurStyle(BlurStyle.COMPONENT_THICK)
```

## 控制弹窗尺寸

高算力设备上，沉浸光感强度设置为强或均衡，Dialog、Menu组件默认附带形变、流光等沉浸式空间动效（参见[沉浸式空间动效](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-overview#沉浸式空间动效)相关说明）。弹窗面积越大，动效的绘制开销越高，应避免接近全屏的超大面积Dialog或Menu，保持弹窗尺寸在合理范围。

```
// 正例：弹窗内容区域保持合理尺寸
@CustomDialog
struct NormalSizeDialog {
  controller: CustomDialogController = new CustomDialogController({ builder: NormalSizeDialog({}) })

  build() {
    Column() {
      Text('弹窗内容')
    }
    .width(328)
    .height(216)
  }
}

// 反例：弹窗内容区域接近全屏，动效绘制开销高
@CustomDialog
struct FullSizeDialog {
  controller: CustomDialogController = new CustomDialogController({ builder: FullSizeDialog({}) })

  build() {
    Column() {
      Text('弹窗内容')
    }
    .width('100%')
    .height('100%')
  }
}
```

## 避免在动态内容上方使用沉浸式系统材质

沉浸式系统材质的折射、模糊效果需要实时采样其背后的内容。当背景是视频、动画图片等持续变化的内容时，材质层需要重新采样与计算，功耗显著上升。应避免在视频、动图等动态内容上方叠加沉浸式系统材质。

```
// 反例：在视频上方叠加沉浸式系统材质，视频在播放时沉浸式系统材质会重新绘制
Stack() {
  Column() {
    // 视频
  }
    .width('100%')
    .height('100%')
  Column() {
    Text('浮层')
  }
  .systemMaterial(new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.THIN,
  }))
}
```

## 控制自动反色的作用范围

自动反色（[colorInvert](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）会对材质子树中通过资源接口设置的颜色逐个计算反色。子树越大、参与反色的组件越多，计算量越高。应控制反色的作用范围，避免在包含大量文本、图标的大范围内整体开启反色。

```
// 正例：缩小反色范围，仅对需要保证可读性的局部区域开启
Column() {
  // ...多数内容不开启反色
  Column() {
    Text('标题').fontColor($r('app.color.text'))
  }
  .systemMaterial(new uiMaterial.ImmersiveMaterial({
    style: uiMaterial.ImmersiveStyle.THIN,
    colorInvert: true,
  }))
}

// 反例：在包含大量子项的列表外层开启反色，所有子项颜色都参与计算
Column() {
  ForEach(this.largeList, (item: string) => {
    Text(item).fontColor($r('app.color.text'))
  })
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THIN,
  colorInvert: true,
}))
```

## 保持材质参数与材质区域稳定

频繁修改style、materialColor等材质参数，或在材质区域内频繁增删子节点，都会触发材质效果重新计算。建议一次性确定材质参数并保持稳定，材质区域内部的子树结构也应尽量稳定。

```
// 正例：材质参数一次性设置并保持稳定
new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THIN,
  materialColor: '#80FF0000',
})

// 反例：在定时器中频繁修改材质颜色，反复触发材质重算
setInterval(() => {
  this.materialColor = this.nextColor()
}, 100)
```

## 避免重复叠加阴影

沉浸式系统材质默认已通过[applyShadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)提供阴影，再额外设置通用[shadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#shadow)属性既与材质效果冲突，又造成重复绘制开销。如需自定义阴影，应将applyShadow置为false后再使用shadow，避免两套效果同时生效。

```
// 正例：如需自定义阴影，先关闭沉浸式系统材质自带阴影（applyShadow:false）
Column() {
  Text('内容')
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
  applyShadow: false,
}))
.shadow({ radius: 20, color: Color.Black })

// 反例：沉浸式系统材质（默认applyShadow为true）与自定义阴影同时存在，重复且冲突
Column() {
  Text('内容')
}
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
}))
.shadow({ radius: 20, color: Color.Black })
```

---

# 沉浸光感兼容性适配

沉浸光感从API版本26.0.0开始支持。应用在接入沉浸光感时，如果需要兼容低版本，需要处理好两方面问题。一是应用级开启时，避免沉浸式系统材质属性冲突。二是组件级开启时，沉浸式系统材质接口在低版本上不可用，需要进行版本判断，在低版本上将材质设置为undefined，保持组件原有样式。

本文从应用级开启和组件级开启两个维度，提供沉浸式系统材质向低版本兼容的适配方案。  

## 应用级开启的兼容性适配方案

应用级开关配置为default或enable模式时，支持应用级开启的组件会默认开启沉浸式系统材质。而组件在接入沉浸式系统材质前，通常已设置了背景色、背景模糊、阴影或边框等样式，这些属性与材质效果存在冲突（详见[ImmersiveMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersivematerial)），例如不透明的背景色会遮挡材质效果，导致材质无法正常呈现。

兼容性适配方案：

通过[uiMaterial.getMaterialInfo()](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#uimaterialgetmaterialinfo)获取应用的材质配置信息[MaterialInfo](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialinfo)，根据其中的[MaterialState](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)判断应用级沉浸式系统材质是否开启。如果组件支持应用级开启且沉浸式系统材质已开启，则将与材质冲突的属性清空，使其恢复默认值，确保材质效果正常呈现。

示例：

以下示例以支持应用级开启的Select组件为例，该组件在ENABLE模式下默认开启沉浸式系统材质。通过uiMaterial.getMaterialInfo()获取材质配置信息后，当状态为ENABLE（即沉浸式系统材质已开启）时，将backgroundColor置为undefined，避免白色背景遮挡材质效果；否则保持Color.White白色背景，保证材质未开启时的显示效果。

```
import { uiMaterial } from '@kit.ArkUI';

@Entry
@Component
struct AppLevelCompatibility {
  private info: uiMaterial.MaterialInfo = uiMaterial.getMaterialInfo();

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {}
        .width('100%')
        .height('100%')
        // $r('app.media.invert')需要替换为开发者所需的图像资源文件
        .backgroundImage($r('app.media.invert'))

      Column() {
        Select([{ value: '选项1' }, { value: '选项2' }])
          .value('选择')
          // 应用级沉浸式系统材质开启时，将backgroundColor置为undefined，避免遮挡材质效果
          .backgroundColor(this.info.state === uiMaterial.MaterialState.ENABLE ? undefined :  Color.White)
      }
      .width(100)
      .height(100)
      .justifyContent(FlexAlign.Center)
    }
  }
}
```

应用级ENABLE模式下，Select呈现沉浸式系统材质样式：

![](https://media:201788198990520578)

应用级在非ENABLE模式下，Select按钮背景为白色，呈现默认样式：

![](https://media:201788198990779579)  

## 组件级开启的兼容性适配方案

组件级开启通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性为单个组件设置沉浸式系统材质，该属性及[ImmersiveMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersivematerial)类均从API版本26.0.0开始支持，在低版本上不可用。

兼容性适配方案：

通过[@ohos.deviceInfo (设备信息)](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-device-info)提供的deviceInfo.sdkApiVersion判断系统软件API版本是否不低于API版本26.0.0。不低于26.0.0时，通过systemMaterial为组件设置ImmersiveMaterial材质；低于26.0.0时，将systemMaterial设置为undefined，使组件保持原有的背景色等样式设置，保证低版本上的显示效果。

示例：

以下以Select组件为例，通过deviceInfo.sdkApiVersion判断系统软件API版本：不低于26.0.0时，为组件设置材质样式为THIN的ImmersiveMaterial；低于26.0.0时，将systemMaterial设置为undefined，组件恢复原有样式。

```
import { uiMaterial } from '@kit.ArkUI';
import { deviceInfo } from '@kit.BasicServicesKit';

@Entry
@Component
struct ComponentLevelCompatibility {
  build() {
    Stack({ alignContent: Alignment.Top }) {
      // $r('app.media.invert')需要替换为开发者所需的图像资源文件
      Column() {}
        .width('100%')
        .height('100%')
        .backgroundImage($r('app.media.invert'))

      Column() {
        Select([{ value: '选项1' }, { value: '选项2' }])
          .value('选择')
          // API版本不低于26.0.0时，设置沉浸式系统材质；低于26.0.0时，设置为undefined组件恢复原有样式。
          .systemMaterial(deviceInfo.sdkApiVersion >= 26 ?
            new uiMaterial.ImmersiveMaterial({ style: uiMaterial.ImmersiveStyle.THIN }) : undefined)
      }
      .width(100)
      .height(100)
      .justifyContent(FlexAlign.Center)
    }
  }
}
```

系统软件API版本低于26.0.0时，组件保持原有样式：

![](https://media:201788198991082580)

系统软件API版本26.0.0及以上时，组件呈现沉浸式系统材质效果：

![](https://media:201788198991320581)  

---

# 沉浸光感常见问题

本文提供沉浸光感开发过程中的常见问题及解决措施。沉浸光感的完整能力介绍及开发指导，请参见[沉浸光感简介](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-overview)。  

## uiMaterial与hdsMaterial的材质等级和材质样式差异对比

[uiMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial)与[hdsMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial)均提供沉浸式系统材质能力，但提供的材质等级和材质样式存在差异。

1. 沉浸式材质等级差异

   为了在不同算力设备上都能流畅地使用沉浸光感，uiMaterial和hdsMaterial均通过MaterialLevel定义了不同的材质等级，两者在使用上存在差异。
   * uiMaterial.[MaterialLevel](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materiallevel)：包含EXQUISITE、GENTLE、SMOOTH三个枚举，分别对应高、中、低算力设备的材质等级。材质等级由设备决定，即自适应材质等级，仅支持通过[uiMaterial.getGlobalMaterialLevel](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#uimaterialgetglobalmateriallevel)获取，不支持设置。
   * hdsMaterial.[MaterialLevel](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsmaterial#materiallevel)：包含EXQUISITE、GENTLE、SMOOTH、ADAPTIVE四个档位，分别对应精美、轻柔、流畅、自适应材质效果。该枚举支持开发者在组件中主动设置，例如在[HdsNavigation](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation)组件中，通过[SystemMaterialParams](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation#systemmaterialparams)中的materialLevel设置。MaterialLevel中ADAPTIVE表示由系统根据设备性能自适应材质等级，如果在低算力设备上使用EXQUISITE或GENTLE材质等级可能造成卡顿和发热。因此使用hdsMaterial设置沉浸式系统材质等级时，推荐将等级设置为ADAPTIVE，实现和uiMaterial相同的材质等级自适应效果。
2. 沉浸式材质样式差异

   * uiMaterial：提供[ImmersiveStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersivestyle)设置沉浸式材质样式。不同的材质样式对应不同的材质厚薄程度，主要包括材质的模糊程度、高光效果等。在高、中算力设备上，开发者可在同一材质等级下通过ImmersiveStyle进一步调整材质厚薄程度等效果；在低算力设备上，仅支持一种材质样式，ImmersiveStyle枚举不生效，具体材质样式效果可以参考[示例1（设置沉浸式系统材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#示例1设置沉浸式系统材质)。
* hdsMaterial：不提供与uiMaterial.ImmersiveStyle对等的材质厚薄程度样式配置。组件的最终材质效果由[SystemMaterialParams](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation#systemmaterialparams)中的materialType、materialLevel及组件的差异化实现共同决定。以[HdsNavigation](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ui-design-hdsnavigation)组件为例，具体材质样式效果可以参考[使用自定义沉浸光感效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ui-design-hds-component-material#使用自定义沉浸光感效果)的示例图。  

## 为组件设置了沉浸式系统材质但看不到材质效果

## 组件不在沉浸光感生效范围

问题现象

* 开启沉浸光感后，组件没有呈现沉浸光感效果。
* 日志中存在打印：Material inactive: out of scope. Use component in navigation title bar or Tabbar.

可能原因

沉浸光感开启后，除了弹窗类组件或方法、Slider、Toggle，其他组件仅在以下区域中生效：Navigation/NavDestination标题栏，或横向Tabs中barPosition为BarPosition.End的底部TabBar中。

弹窗类组件或方法包括：Popup、Tips、Menu、BindSheet、showActionMenu、AlertDialog、CustomDialog、ActionSheet、CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog、Toast、Select、AlphabetIndexer气泡弹窗、Text设置copyOption后长按或双击触发的文本菜单、SelectionMenu（结合bindSelectionMenu一起使用）。

解决措施

将需要沉浸光感效果的组件置于Navigation/NavDestination标题栏，或横向Tabs中barPosition为BarPosition.End的底部TabBar中。

若无法满足生效范围要求，可改用[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)等通用属性替代材质效果。

示例

以下示例展示了分别在Navigation标题栏中和Navigation内容区，开启沉浸光感的显示效果。位于Navigation标题栏中的Column开启沉浸光感正常生效；位于Navigation内容区中的Column组件，因其不处于Navigation标题栏或底部TabBar中，不生效沉浸光感效果。

```
import { CircleShape, TitleBarType, uiMaterial } from '@kit.ArkUI';
 
@Entry
@Component
struct MaterialScopeAdaptExample {
  private arr: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
 
  @Builder
  NavigationTitle() {
    Row() {
      Text('标题栏')
        .fontColor('#182431')
        .fontSize(30)
        .lineHeight(41)
        .fontWeight(700)
      Blank()
      Column() {
        SymbolGlyph($r('sys.symbol.a_3d_square_fill'))
      }
      .width(50)
      .height(50)
      .clipShape(new CircleShape({
        width: 50,
        height: 50
      }))
      .justifyContent(FlexAlign.Center)
      .backgroundColor(Color.Transparent)
      // 在Navigation标题栏中开启沉浸光感，处于生效范围内，沉浸光感效果生效
      .systemMaterial(new uiMaterial.ImmersiveMaterial({
        style: uiMaterial.ImmersiveStyle.THIN,
      }))
    }
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .padding(16)
  }
 
  build() {
    Column() {
      Navigation() {
        Column() {
          Row() {
            Text('内容区')
 
            Blank()
 
            Column() {
              SymbolGlyph($r('sys.symbol.a_3d_square_fill'))
            }
            .width(50)
            .height(50)
            .clipShape(new CircleShape({
              width: 50,
              height: 50
            }))
            .justifyContent(FlexAlign.Center)
            .backgroundColor(Color.Transparent)
            // 在Navigation内容中开启沉浸光感，处于生效范围外，不生效沉浸光感效果
            .systemMaterial(new uiMaterial.ImmersiveMaterial({
              style: uiMaterial.ImmersiveStyle.THIN,
            }))
          }
          .width('100%')
          .padding(16)
          .borderRadius(16)
        }
        .width('100%')
        .height('100%')
        .padding(16)
        .backgroundColor('#FFFFFF')
        .linearGradient({
          angle: 0,
          colors: [
            ['#004AAF', 0.0],
            ['#2787D9', 0.5],
            ['#F0FAFF', 1.0]
          ]
        })
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
      }
      .title(this.NavigationTitle, { barStyle: BarStyle.STACK })
    }.width('100%').height('100%').backgroundColor('#F1F3F5')
  }
}
 
```

![](https://media:201788199006145751)  

## 背景色或背景模糊遮挡材质效果

问题现象

为组件调用了[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)接口开启沉浸光感后，组件的视觉效果没有发生变化，仍然呈现纯色背景或无任何材质表现。

可能原因

沉浸光感的视觉层级位于组件的[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)、[backgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundblurstyle9)等属性之下。如果同时设置了不透明的背景色或背景模糊样式，这些属性会覆盖在材质层之上，导致材质效果被遮挡不可见。

解决措施

* 将组件的背景色设置为透明（Color.Transparent）或移除背景色设置。
* 移除[backgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundblurstyle9)等背景模糊样式，避免模糊效果覆盖材质层。

代码示例

```
// 错误写法：不透明背景色会覆盖在材质层之上，导致材质效果不可见
Column() {
  Text('沉浸光感')
}
.width(328)
.height(56)
.borderRadius(28)
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THIN,
}))
.backgroundColor(Color.White)
// 推荐写法：将背景色设为透明，确保材质效果可见
Column() {
  Text('沉浸光感')
}
.width(328)
.height(56)
.borderRadius(28)
.backgroundColor(Color.Transparent)
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THIN,
}))
```

## 设置沉浸式系统材质后组件边框呈现出周围背景的颜色

问题现象

为组件设置沉浸式系统材质后，组件的边框区域呈现出周围背景图片或背景色的颜色，而非预期的边框效果。

可能原因

这是沉浸式系统材质的正常光学表现。沉浸光感视效具有折射特性，能够将组件周围的内容透过材质层折射到组件的边框区域。这种折射效果是材质通透感和层次感的重要组成部分，尤其在ULTRA_THIN和THIN等薄材质样式下表现更为明显。

解决措施

* 使用较厚的材质样式（如REGULAR、THICK或ULTRA_THICK），降低材质透明度以减少折射效果。
* 为材质层添加[materialColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)赋色，通过叠加一层半透明颜色降低折射的可见程度。  

## materialColor传入不透明颜色后材质效果消失

问题现象

为沉浸式系统材质的[materialColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数传入颜色后，组件的材质效果完全消失，仅显示纯色背景。

可能原因

[materialColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数的作用是为材质滤镜[materialFilter](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-filter-effect#materialfilter23)再混合一层纯色效果。该颜色需要带有一定的透明度值，如果传入纯不透明颜色（如Color.Red或'#FFFF0000'），会遮挡材质滤镜效果。

解决措施

为[materialColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)传入带有透明度的颜色值。  
![](https://media:201788199006242752)  
[materialColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数对所有档位的算力设备均生效。在高算力和中算力设备上，该参数为材质滤镜再混合一层纯色效果；在低算力设备上，该参数作为背景色[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)属性值。

代码示例

```
// 错误写法：纯不透明颜色遮挡了材质效果
new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THIN,
  materialColor: Color.Red, // 不透明，材质滤镜效果被完全遮挡
})

// 推荐写法：使用带透明度的颜色
new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.THIN,
  materialColor: '#80FF0000', // 带有50%透明度的红色
})
```

## 低算力设备上沉浸光感效果与高算力设备差异较大

问题现象

在低算力设备上运行应用时，沉浸式系统材质的视觉效果与高算力设备相比差异较大，部分材质参数设置后没有生效。

可能原因

沉浸式系统材质的效果会根据设备算力档位自动适配。在高算力和中算力设备上，影响材质滤镜[materialFilter](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-filter-effect#materialfilter23)效果和阴影效果；在低算力设备上，仅影响背景色、边框颜色、边框宽度和阴影效果。此外，材质样式[style](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)和自动反色[colorInvert](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数仅在高算力和中算力设备上生效，在低算力设备上设置这两个参数不会产生视觉效果差异。

解决措施

这是系统级的自适应行为，开发者无需为不同档位设备编写差异化代码，沉浸光感会自动确保在各档位设备上的流畅运行。  

## 开启自动反色后文字颜色没有变化

问题现象

为沉浸式系统材质开启了[colorInvert](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)自动反色功能，但组件内文字的颜色并未随背景色自动适配。

可能原因

自动反色功能的生效需要同时满足以下条件。

* 设备算力档位需为高算力或中算力，低算力设备上自动反色不产生视觉效果差异。
* 材质样式需要为THIN或ULTRA_THIN，在REGULAR、THICK、ULTRA_THICK样式下不生效。
* 系统沉浸光感的强弱配置影响反色触发阈值，沉浸式系统材质越薄、系统沉浸光感设置越强，越容易触发自动反色。
* 自动反色仅对通过资源接口设置的颜色值生效，包括[Text](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-text)组件的[fontColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-text#fontcolor)、[Button](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button)组件的[fontColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#fontcolor)、[SymbolGlyph](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-symbolglyph)组件的[fontColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-symbolglyph#fontcolor)、[Image](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-image)组件的[fillColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-image#fillcolor)、TextInput、TextArea、Chip、ChipGroup、SegmentButton、Swiper等组件的颜色属性，完整生效属性清单请参见[colorInvert](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数说明。使用代码中硬编码的颜色值（如Color.White、'#FFFFFFFF'）不会触发自动反色。

解决措施

1. 确认材质样式为THIN或ULTRA_THIN。
2. 确认文字颜色通过资源接口（如$r('app.color.xxx')）设置，而非硬编码颜色值。
3. 将系统沉浸光感配置调高后再观察效果。  

## 同时设置shadow属性和沉浸式系统材质后阴影效果不符合预期

问题现象

为组件同时设置了通用属性[shadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#shadow)和沉浸式系统材质后，阴影效果呈现为沉浸式系统材质自带的阴影样式，开发者自定义的shadow参数不生效。

可能原因

当沉浸式系统材质的[applyShadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)参数为true（默认值）时，材质中的阴影效果固定生效，优先于[shadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#shadow)通用属性，此时自定义的shadow设置不会生效；当该参数为false时，[shadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#shadow)通用属性生效，材质的阴影效果不生效。

解决措施

* 如需使用沉浸式系统材质自带的阴影效果，无需额外设置shadow属性。
* 如需使用自定义的shadow通用属性，将[applyShadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)设置为false。

代码示例

```
// 关闭材质阴影，使用自定义shadow
new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
  applyShadow: false,
})
```

## 通过通用属性systemMaterial设置沉浸式系统材质后组件样式显示异常

问题现象

通过通用属性[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)设置沉浸式系统材质后，组件的背景色、边框等样式显示不符合预期。

可能原因

通过通用属性设置沉浸式系统材质时，如果[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)放在其他样式属性之前，可能导致材质效果优先级与预期不符。

解决措施

将[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)放在其他样式属性（如背景色、边框、阴影等）之后设置。通过组件options参数（如Toast的[ShowToastOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-promptaction#showtoastoptions)、Popup的[PopupOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-popup#popupoptions类型说明)等）设置沉浸式系统材质时则无需关注设置顺序。

代码示例

```
// 推荐写法：先设置其他属性，再设置systemMaterial
Column() {
  Text('推荐')
}
.width(328)
.height(56)
.borderRadius(28)
.justifyContent(FlexAlign.Center)
.systemMaterial(new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,
}))
```

## Dialog或Toast组件默认没有材质效果

问题现象

在[DEFAULT](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，[Dialog](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-base-dialog-overview)、[Toast](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-create-toast)等组件未呈现沉浸式系统材质的视觉效果。

可能原因

[DEFAULT](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)是沉浸式系统材质的默认开启模式，在该模式下，[Dialog](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-base-dialog-overview)、[Toast](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-create-toast)、[AlphabetIndexer](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer)等组件仅在未设置背景色、模糊参数和阴影参数时才会默认开启沉浸式系统材质。如果开发者主动为这些组件设置了[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)、[backgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundblurstyle9)或[shadow](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#shadow)等属性，沉浸式系统材质不会默认开启。

解决措施

* 移除与沉浸式系统材质冲突的属性设置（如backgroundColor、backgroundBlurStyle、shadow），让材质效果默认开启。
* 在ENABLE模式下，沉浸式系统材质样式的优先级高于组件本身设置的背景色、模糊、阴影和边框样式，且更多组件会默认开启沉浸式系统材质。
* 如需在保留现有属性的同时使用沉浸式系统材质，通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性主动设置。  

## 材质渲染区域与组件可视区域不一致

问题现象

给组件设置沉浸式系统材质后，材质渲染区域与组件可视区域不一致。

* Checkbox可视区域为40\*40的圆形，材质渲染区域为40\*40的矩形。

  ![](https://media:201788199006295753)
* Text组件可视区域为文本内容，材质渲染区域为100\*40的矩形。

  ![](https://media:201788199006333754)

可能原因

材质渲染区域由组件布局区域决定，而组件可视区域为实际呈现内容的区域，可能不等于布局区域，导致两者不一致。

解决措施

通过[width](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-size#width)、[height](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-size#height)、[borderRadius](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-border#borderradius)接口控制组件可视区域与材质渲染区域一致。  
![](https://media:201788199006362755)  
Text组件无法给文本内容设置沉浸式系统材质。

代码示例

```
// 材质渲染区域与组件可视区域不一致示例
Row() {
  Text('Checkbox组件：')
    .fontColor(Color.Black)
  Checkbox()
    .width(40)
    .height(40)
    .borderWidth(1)
    .borderColor(Color.Blue)
    .systemMaterial(new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
      interactive: true
    }))
}
Row() {
  Text('Text组件：')
    .fontColor(Color.Black)
  Text("hello")
    .width(100)
    .height(40)
    .systemMaterial(new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
      interactive: true
    }))
}
```

## 材质效果的显示层级问题

问题现象

同时给组件设置沉浸式系统材质和背景色，材质效果被遮盖。例如TextArea组件设置背景色后，会遮盖材质效果。

![](https://media:201788199006401756)

可能原因

自绘制组件的背景色作用于内容层，材质效果作用于背板层，而内容层位于背板层之上，因此材质效果被内容层遮盖。

解决措施

不建议同时使用沉浸式系统材质和背景色[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)接口。  
![](https://media:201788199006426757)  
沉浸式系统材质无法绘制在内容层。

代码示例

```
// 材质效果的显示层级问题示例
Row() {
  Text('TextArea组件：')
    .fontColor(Color.Black)
  TextArea()
    .width(100)
    .height(40)
    .backgroundColor('#cc999999') // 不建议同时使用沉浸式系统材质和背景色接口
    .systemMaterial(new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
      interactive: true,
    }))
}
```

---

# 沉浸光感典型场景

本文档提供沉浸光感两个典型场景的开发指导，包括搜索框标题栏效果和内容区标题栏开启沉浸光感。  

## 搜索框标题栏效果

在信息浏览类应用（如新闻、贴吧、小说阅读等应用）的场景中，用户上滑首页内容区后，标题栏显示范围可随之缩小，同时通过沉浸光感提升标题栏的交互体验。

1. 设置底部Tabs悬浮并为Tabs组件开启沉浸光感，同时使用[ExpandSafeArea](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-expand-safe-area#expandsafearea)将显示内容延伸至状态栏区域，使应用整体体验更加一致。

   ```
   @Entry
   @ComponentV2
   struct BestPractise {
     @Local currentTab: number = 0
     exploreStack: NavPathStack = new NavPathStack()
     gameStack: NavPathStack = new NavPathStack()

     @Builder
     BottomTabBarItem(title: string, icon: Resource, index: number) {
       Column() {
         SymbolGlyph(icon)
           .fontSize(22)
           .fontColor(this.currentTab === index ? ['#007dff'] : ['#999999'])
         Text(title)
           .fontSize(10)
           .fontColor(this.currentTab === index ? '#007dff' : '#999999')
          .margin({ top: 2 })
       }.justifyContent(FlexAlign.Center)
       .width('100%')
       .height('100%')
     }

     @Builder
     tabExploreContent() {
       // 通过系统路由表的方式配置对应的页面跳转
       Navigation(this.exploreStack, {name: 'explore'})
         .hideTitleBar(true)
         .expandSafeArea([SafeAreaType.SYSTEM])
     }

     @Builder
     tabGameContent() {
       // 通过系统路由表的方式配置对应的页面跳转
       Navigation(this.gameStack, {name: 'game'})
         .hideTitleBar(true)
         .expandSafeArea([SafeAreaType.SYSTEM])
     }

     build() {
       Tabs({ index: this.currentTab }) {
         TabContent() {
           this.tabExploreContent()
         }.tabBar(this.BottomTabBarItem('探索', $r('sys.symbol.compass'), 0))
         // 内容区延伸到状态栏区域，形成整体的交互体验
         .expandSafeArea([SafeAreaType.SYSTEM])

         TabContent() {
           this.tabGameContent()
         }.tabBar(this.BottomTabBarItem('游戏', $r('sys.symbol.gamecontroller'), 1))
         .expandSafeArea([SafeAreaType.SYSTEM])

         TabContent() {
         }.tabBar(this.BottomTabBarItem('应用', $r('sys.symbol.grid'), 2))

         TabContent() {
         }.tabBar(this.BottomTabBarItem('元服务', $r('sys.symbol.gearshape'), 3))
       }
       .barPosition(BarPosition.End)
       .barMode(BarMode.Fixed)
       .barOverlap(true)
       .barHeight(56)
       .barFloatingStyle({ barBottomMargin: 8, systemMaterial: new uiMaterial.ImmersiveMaterial({}) })
       .scrollable(true)
       .expandSafeArea([SafeAreaType.SYSTEM])
       .onChange((index: number) => {
         this.currentTab = index
       })
     }
   }
   ```

2. 针对跳转的目标页面，通过[NavigationTitleOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)为对应的页签页面标题栏区域开启沉浸光感。建议将Navigation组件的BarStyle设置为STACK模式，使内容区显示在标题栏下方，从而实现透底的效果。下面代码实现以下效果：

* 标题栏以及标题栏子组件开启沉浸光感。

* 上滑时搜索框隐藏，分类列表保留并突出显示。分类列表项开启沉浸光感，提升用户交互体验和内容曝光率。

  ```
  @ComponentV2
  struct ExploreHomePage {
    @Local currentIndex: number = 0
    @Local searchOpacity: number = 1
    @Local classifyType: Array<string> = [
       '策略', '动作', '竞技', '射击', '卡牌', '体育', '休闲', '音乐'
     ]
    titleHeight:number = 150
    @Local scrollOffset: number = 0
    @Local titleOffset: number = 0
    @Builder
    exploreTitleBar() {
      Column() {
        Row() {
          Text('探索').fontSize(28).fontWeight(FontWeight.Bold).fontColor('#1A1A1A')
          Blank()
          Search({ placeholder: '探索探索' })
            .searchButton('搜索')
            .height(40)
            .width(220)
            .systemMaterial(new uiMaterial.ImmersiveMaterial({}))
        }.expandSafeArea([SafeAreaType.SYSTEM])
        .width('100%')
        .opacity(this.searchOpacity)
        .height(50)

        List({space: 12}) {
          ForEach(this.classifyType, (item: string, index: number) => {
            ListItem() {
              Row() {
                SymbolGlyph($r('sys.symbol.star_fill'))
                  .fontSize(20)
                  .fontColor(['#d3d3d3'])
                  .margin({left: 16})
                Text(item)
                  .fontSize(16)
                  .fontColor(this.currentIndex === index ? Color.White : '#666666')
                  .padding({ left: 4, right: 12, top: 6, bottom: 6})
              }.borderRadius(16)
              .systemMaterial(new uiMaterial.ImmersiveMaterial({
                materialColor: this.currentIndex === index ? '#333333' : undefined,
                lightEffect: {color: Color.White}
              }))
            }
          })
        }.listDirection(Axis.Horizontal)
        .width('100%')
        .scrollBar(BarState.Off)
        .margin(5)
      }.expandSafeArea([SafeAreaType.SYSTEM])
      .width('100%')
      .height(this.titleHeight)
      .padding({ left: 20, right: 20})
      .position({x: 0, y: -this.titleOffset})
      // 设置Column组件开启沉浸光感
      .systemMaterial(new uiMaterial.ImmersiveMaterial({}))
    }

    build() {
      NavDestination() {
        Scroll() {
          // 滑动区域的具体内容
          Column() {
            Image($r('app.media.startIcon')).width('100%').height(180)
              .borderRadius(12)
              .backgroundColor('#e0e0e0')
              .objectFit(ImageFit.Cover)

            List() {
              // 开发者需要自定义参数listItems, 示例中的数据结构为 interface ListItemData { name: string; image: Resource; id: string}
              ForEach(listItems, (item: ListItemData) => {
                ListItem() {
                  Row() {
                    SymbolGlyph(item.image).fontSize(36)
                      .fontColor(['#007dff'])
                      .margin({ right: 16})
                    Text(item.name).fontSize(16)
                      .fontColor('#333333')
                  }.width('100%')
                  .padding({ left: 20, right: 20, top: 14, bottom: 14 })
                }
              }, (item: ListItemData) => item.id)
            }
          }
        }
        // 避让标题栏显示区域
        .contentStartOffset(this.titleHeight)
        .scrollable(ScrollDirection.Vertical)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
        .width('100%')
        .height('100%')
        .onDidScroll((xOffset: number, yOffset: number, state: ScrollState) => {
          this.scrollOffset += yOffset
          // 搜索框大小范围内
          if (this.scrollOffset <= 50) {
            this.titleOffset = this.scrollOffset;
            this.searchOpacity = 1 - this.titleOffset / 50
          }
        })
      }.title(
        { builder: this.exploreTitleBar, height: this.titleHeight },
        { barStyle: BarStyle.STACK,
          systemMaterial: new uiMaterial.ImmersiveMaterial({})
       }
     ).hideBackButton(true)
      .expandSafeArea([SafeAreaType.SYSTEM])
    }
  }
  ```

![](https://media:201788199011294837)  

## 内容区标题栏开启沉浸光感

当前沉浸光感存在生效约束，具体约束参考[沉浸光感功耗优化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints)。针对内容区滑动且内容区存在多层标题的场景，当内容区的标题滑动到标题栏区域时，可将对应的内容嵌入标题栏中显示，实现内容区标题在NavDestination标题栏区域的展示，从而提升用户交互体验。

1. 提取内容区中小标题为独立组件。

   ```
   @ComponentV2
   export struct ClassifyComponent {
     classifyType: Array<string> = [
       '策略', '动作', '竞技', '射击', '卡牌', '体育', '休闲', '音乐'
     ]

     @Local currentIndex: number = 0

     build() {
       List({space: 12}) {
         ForEach(this.classifyType, (item: string, index) => {
           ListItem() {
             Row() {
               SymbolGlyph($r('sys.symbol.star_fill'))
                 .fontSize(20)
                 .fontColor(['#d3d3d3'])
                 .margin({ left: 16})
               Text(item)
                 .fontColor(this.currentIndex === index ? Color.White : '#666666')
                 .fontSize(16)
                 .padding({ left: 4, right: 12, top: 6, bottom: 6})
             }.borderRadius(16)
             .systemMaterial(new uiMaterial.ImmersiveMaterial({
               materialColor: this.currentIndex === index ? '#333333' : undefined,
               lightEffect: { color: Color.White }
             }))
             .onClick(() => {
               this.currentIndex = index
             })
           }
         })
       }.listDirection(Axis.Horizontal)
       .width('100%')
       .scrollBar(BarState.Off)
       .expandSafeArea([SafeAreaType.SYSTEM])
       .margin(5)
       .alignListItem(ListItemAlign.Center)
     }
   }
   ```

2. 滑动内容区，当内容区标题滑动到标题栏区域时，将其切换到标题栏中显示。

   ```
   // 添加系统路由表入口
   @ComponentV2
   struct GamePage {
     @Local titleHeight: number = 100
     @Local scrollOffset: number = 0
     @Local showTitle: boolean = false
     @Local titleOpacity: number = 1
     @Local contentOffset: number = 0
     totalOffset: number = 0
     @Local textOffset: number = 0
     titleEnd: number = 0
     titleStart: number = 0
     @Local listVisible: Visibility = Visibility.Visible

     @Builder
     gameTitleBar() {
       Row() {
         if (this.showTitle) {
           ClassifyComponent()
         } else {
           Text('游戏')
             .fontSize(28)
             .fontWeight(FontWeight.Bold)
             .fontColor('#1A1A1A')
             .opacity(this.titleOpacity)
             .id('text')
           Blank()
         }
         Button() {
           SymbolGlyph($r('sys.symbol.AI_search')).fontSize(20)
         }.borderRadius(180).width(40).height(40)
           .systemMaterial(new uiMaterial.ImmersiveMaterial({
             lightEffect: { color: Color.White },
             materialColor: '#d3d3d3'
         }))
         .backgroundColor(Color.Transparent)
       }.expandSafeArea([SafeAreaType.SYSTEM])
       .width('100%')
       .height('100%')
       .padding({ left: 20, right: 20 })
       .systemMaterial(new uiMaterial.ImmersiveMaterial({}))
       .alignItems(VerticalAlign.Center)
     }

     build() {
       NavDestination() {
         Scroll() {
           Column() {
             // 请开发者替换为实际的资源文件
             Image($r('app.media.background'))
               .width('100%')
               .height(180)
               .borderRadius(12)
               .backgroundColor('#fff3e0')
               .objectFit(ImageFit.Cover)
             ClassifyComponent().id('content').visibility(this.showTitle ? Visibility.Hidden : Visibility.Visible)
             List() {
               // 开发者需要自定义参数listItems, 示例中的数据结构为 interface ListItemData { name: string; image: Resource; id: string}
               ForEach(listItems, (item: ListItemData) => {
                 ListItem() {
                   Row() {
                     SymbolGlyph(item.image).fontSize(36).fontColor(['#ff6d00']).margin({ right: 16 })
                     Text(item.name).fontSize(16).fontColor('#333333')
                   }.width('100%')
                   .padding({ left: 20, right: 20, top: 14, bottom: 14 })
                 }
               }, (item: ListItemData) => item.id)
             }.width('100%')
             .margin({top: 8})
             .nestedScroll({scrollForward: NestedScrollMode.PARENT_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST})
             .divider({strokeWidth: 5, color: '#e0e0e0', startMargin: 72, endMargin: 20})
           }.padding({left: 16, right: 16, top: 8, bottom: 16})
         }
         .contentStartOffset(this.titleHeight)
         .scrollable(ScrollDirection.Vertical)
         .scrollBar(BarState.Off)
         .edgeEffect(EdgeEffect.Spring)
         .width('100%')
         .height('100%')
         .onDidScroll((xOffset: number, yOffset: number) => {
           this.totalOffset += yOffset
           let curOffset = this.contentOffset - this.totalOffset
           if (curOffset > this.titleEnd) {
             this.showTitle = false;
             this.listVisible = Visibility.Hidden
             return
           }
           if (curOffset < this.titleEnd) {
             this.showTitle = true;
             this.listVisible = Visibility.Visible
             return
           }
           this.titleHeight = (curOffset - this.titleEnd) / (this.titleHeight - this.titleEnd)
         })
       }.onShown(() => {
         let titleInfo = this.getUIContext().getComponentUtils().getRectangleById('text');
         this.titleStart = this.getUIContext().px2vp(titleInfo.windowOffset.y)
         this.titleEnd = this.getUIContext().px2vp(titleInfo.size.height)
         this.contentOffset = this.getUIContext().px2vp(this.getUIContext().getComponentUtils().getRectangleById('content').windowOffset.y)
       })
       .expandSafeArea([SafeAreaType.SYSTEM])
       .hideBackButton(true)
       .title({ builder: this.gameTitleBar, height: this.titleHeight }, {
         barStyle: BarStyle.STACK,
         systemMaterial: new uiMaterial.ImmersiveMaterial({})
       })
     }
   }
   ```

![](https://media:201788199011541838)  

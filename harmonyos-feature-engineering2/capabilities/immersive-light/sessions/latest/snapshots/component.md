# 组件适配沉浸光感

本文按导航类、弹窗类、按钮与选择类、其余组件四大场景分类，系统介绍各组件如何通过应用级开关与组件级配置开启沉浸光感，涵盖沉浸光感的视觉效果、设置方法及适配要点，帮助开发者快速完成沉浸光感的组件适配。

#### 导航类组件

导航类组件包括Navigation标题栏、底部页签、索引条，是页面导航与内容定位的辅助元素，通常固定在页面顶部或底部。沉浸光感为导航类组件赋予了通透的悬浮质感，让导航栏在滚动内容之上呈现轻盈的分层效果，内容透过材质层自然渗透，建立导航区域与内容之间的视觉层次。导航类组件通常使用较薄的材质样式（ULTRA_THIN或THIN），在保持背景通透的同时避免过度遮挡内容。

#### [h2]Navigation标题栏

Navigation标题栏支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，Navigation标题栏默认开启沉浸光感，沉浸式系统材质样式默认取值为ULTRA_THIN；在非ENABLE模式下，沉浸光感不生效。

组件级开启：Navigation标题栏支持通过[NavigationTitleOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)中的systemMaterial字段设置沉浸光感效果。

- 推荐将沉浸光感限定在顶部标题栏等需要凸显的局部区域，控制使用面积与层数，详见[沉浸光感功耗优化](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints)。

- 沉浸光感针对标题栏生效的范围是：返回键、非自定义Menu。

- systemMaterial为undefined时，[MaterialState](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)开关配置为DEFAULT时标题栏无材质效果；配置为ENABLE时标题栏生效系统默认的沉浸式材质效果。

- 建议设置沉浸光感时，使用[barStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#navigationtitleoptions11)为STACK样式，以便Navigation内容区延伸至标题栏区域，获得沉浸光感的最佳体验。

组件开启沉浸光感的效果请参见[示例20（设置systemMaterial开启标题栏材质效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-navigation#%E7%A4%BA%E4%BE%8B20%E8%AE%BE%E7%BD%AEsystemmaterial%E5%BC%80%E5%90%AF%E6%A0%87%E9%A2%98%E6%A0%8F%E6%9D%90%E8%B4%A8%E6%95%88%E6%9E%9C)。

#### [h2]底部页签（Tabs）

底部页签支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，底部页签不会默认开启沉浸光感；设置[barFloatingStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barfloatingstyle)属性并生效底部页签的悬浮样式时，底部页签默认开启沉浸光感，沉浸式系统材质样式默认取值为THIN。

组件级开启：底部页签支持通过[barFloatingStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barfloatingstyle)属性中[FloatingTabBarStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#floatingtabbarstyle)的systemMaterial字段，设置TabBar背板的沉浸光感效果。

- 悬浮样式仅在[barOverlap](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#baroverlap10)为true、[vertical](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#vertical)为false、[barPosition](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barposition9)为BarPosition.End时生效，三个条件需同时满足，否则systemMaterial设置不生效。

- 设置悬浮材质后，不建议再通过[barBackgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barbackgroundcolor10)、[barBackgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#barbackgroundblurstyle11)为TabBar设置背景色或背景模糊，避免遮挡材质效果。

- TabContent不支持设置沉浸光感。

组件开启沉浸光感的效果请参见[示例24（TabBar悬浮样式）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-tabs#%E7%A4%BA%E4%BE%8B24tabbar%E6%82%AC%E6%B5%AE%E6%A0%B7%E5%BC%8F)。

#### [h2]索引条（AlphabetIndexer）

索引条支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，索引条默认开启沉浸光感，沉浸式系统材质样式默认取值为THICK。

组件级开启：索引条参数[popupBackground](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer#popupbackground)和[popupBackgroundBlurStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer#popupbackgroundblurstyle12)均未主动设置（或参数value传入undefined）时，提示弹窗默认开启沉浸光感，默认材质样式为THICK；也可通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性主动设置沉浸光感效果。

- 高算力、中算力设备默认显示为沉浸光感THICK样式，低算力设备不显示沉浸光感效果，显示为白色背景。

- popupBackground、popupBackgroundBlurStyle属性和沉浸光感能力互斥。主动设置popupBackground或popupBackgroundBlurStyle后无沉浸光感效果。

组件开启沉浸光感的效果请参见[示例3（设置提示弹窗背景模糊材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-alphabet-indexer#%E7%A4%BA%E4%BE%8B3%E8%AE%BE%E7%BD%AE%E6%8F%90%E7%A4%BA%E5%BC%B9%E7%AA%97%E8%83%8C%E6%99%AF%E6%A8%A1%E7%B3%8A%E6%9D%90%E8%B4%A8)。

#### 弹窗类组件

弹窗类组件包括Toast、Popup、Tips、Menu和Dialog（包含AlertDialog、CustomDialog、bindSheet及各类PickerDialog），是浮层元素，在内容之上建立视觉层次。沉浸光感为弹窗类组件赋予了核心价值：沉浸式系统材质让弹窗背景呈现轻盈通透的质感，底层内容透过材质层自然渗透，配合折射、高光、阴影等多层效果，使弹窗在内容之上建立清晰的视觉层次；沉浸式空间动效为弹窗和菜单的弹出过程增添形变、流光等动态表现，使弹出过程灵动自然。弹窗类组件通常使用较厚的材质样式（THICK或ULTRA_THICK），以获得更强的背景模糊效果，确保弹窗内容与背景内容之间有清晰的视觉分离。

#### [h2]即时反馈（Toast）

Toast支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，Toast默认开启沉浸光感，沉浸式系统材质样式默认取值为THICK。

组件级开启：Toast支持通过[ShowToastOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-promptaction#showtoastoptions)中的systemMaterial字段设置沉浸光感效果。

沉浸光感开启后，如果已主动设置[ShowToastOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-promptaction#showtoastoptions)中的backgroundBlurStyle或backgroundColor，则不呈现沉浸光感效果，否则沉浸式系统材质样式ImmersiveStyle默认取值为ImmersiveStyle.THICK。具体请参考[Dialog或Toast组件默认没有材质效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq#dialog%E6%88%96toast%E7%BB%84%E4%BB%B6%E9%BB%98%E8%AE%A4%E6%B2%A1%E6%9C%89%E6%9D%90%E8%B4%A8%E6%95%88%E6%9E%9C)。

组件开启沉浸光感的效果请参见[showToast](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uicontext-promptaction#showtoast)。

#### [h2]气泡提示（Popup和Tips）

Popup和Tips支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，气泡提示不会默认开启沉浸光感。

组件级开启：气泡支持通过[PopupOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-popup#popupoptions%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E)中的systemMaterial字段设置沉浸光感效果；悬浮提示通过[TipsOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-tips#tipsoptions%E7%B1%BB%E5%9E%8B%E8%AF%B4%E6%98%8E)中的systemMaterial字段设置。

组件开启沉浸光感的效果请参见[示例9（设置Popup的沉浸光感视觉效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-popup#%E7%A4%BA%E4%BE%8B9%E8%AE%BE%E7%BD%AEpopup%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E8%A7%86%E8%A7%89%E6%95%88%E6%9E%9C)和[示例3（设置悬浮气泡的沉浸光感视效）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-tips#%E7%A4%BA%E4%BE%8B3%E8%AE%BE%E7%BD%AE%E6%82%AC%E6%B5%AE%E6%B0%94%E6%B3%A1%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E8%A7%86%E6%95%88)。

#### [h2]菜单（Menu）

菜单支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，菜单默认开启沉浸光感，沉浸式系统材质样式默认取值为THICK。

组件级开启：菜单支持通过[ContextMenuOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-menu#contextmenuoptions10)中的systemMaterial字段设置沉浸光感效果。

组件开启沉浸光感的效果请参见[示例24（设置菜单的沉浸光感）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-menu#%E7%A4%BA%E4%BE%8B24%E8%AE%BE%E7%BD%AE%E8%8F%9C%E5%8D%95%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F)。

#### [h2]弹出框（Dialog）

弹出框支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，弹出框默认开启沉浸光感，沉浸式系统材质样式默认取值为ULTRA_THICK。

组件级开启：弹出框支持通过弹出框options参数中的systemMaterial字段设置沉浸光感效果，如[CustomDialogControllerOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#customdialogcontrolleroptions%E5%AF%B9%E8%B1%A1%E8%AF%B4%E6%98%8E)、[AlertDialogParam](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-alert-dialog-box#alertdialogparam%E5%AF%B9%E8%B1%A1%E8%AF%B4%E6%98%8E)、[ActionSheetOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-action-sheet#actionsheetoptions%E5%AF%B9%E8%B1%A1%E8%AF%B4%E6%98%8E)、[SheetOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-sheet-transition#sheetoptions)等。

- 沉浸光感开启后，如果已主动设置背景色、背景模糊等自定义样式属性，则不呈现沉浸光感效果，否则沉浸式系统材质样式ImmersiveStyle默认取值为ImmersiveStyle.ULTRA_THICK。具体请参考[Dialog或Toast组件默认没有材质效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq#dialog%E6%88%96toast%E7%BB%84%E4%BB%B6%E9%BB%98%E8%AE%A4%E6%B2%A1%E6%9C%89%E6%9D%90%E8%B4%A8%E6%95%88%E6%9E%9C)。

- 大面积的弹出框开启沉浸光感效果，会带来更多的动效绘制开销，不建议开启。详见[控制弹窗尺寸](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-constraints#%E6%8E%A7%E5%88%B6%E5%BC%B9%E7%AA%97%E5%B0%BA%E5%AF%B8)中的尺寸建议。

- [CalendarPicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-calendarpicker)组件拉起的弹出框目前暂不支持开启沉浸光感效果，通过通用属性设置的沉浸光感效果会体现在CalendarPicker组件本身。

- [DatePicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-datepicker)、[TextPicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-textpicker)、[TimePicker](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-timepicker)组件沉浸光感效果同CustomDialog相同。

组件开启沉浸光感的效果请参见[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-alert-dialog-box#%E7%A4%BA%E4%BE%8B9%E8%AE%BE%E7%BD%AE%E5%BC%B9%E7%AA%97%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)、[示例14（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-custom-dialog-box#%E7%A4%BA%E4%BE%8B14%E8%AE%BE%E7%BD%AE%E5%BC%B9%E7%AA%97%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)、[示例9（设置弹窗的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-methods-action-sheet#%E7%A4%BA%E4%BE%8B9%E8%AE%BE%E7%BD%AE%E5%BC%B9%E7%AA%97%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)和[示例10（半模态设置系统材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-sheet-transition#%E7%A4%BA%E4%BE%8B10%E5%8D%8A%E6%A8%A1%E6%80%81%E8%AE%BE%E7%BD%AE%E7%B3%BB%E7%BB%9F%E6%9D%90%E8%B4%A8)。

#### 按钮与选择类组件

按钮与选择类组件包括Button、Select、Toggle、Slider、ChipGroup和SegmentButton，是内嵌于内容流中的交互元素，用户通过它们进行选择和操作。沉浸光感为选择类组件提供了细腻的交互反馈与通透的视觉质感：沉浸式系统材质通常使用较薄的材质样式（ULTRA_THIN或THIN），在保持组件背景通透的同时，通过[ImmersiveOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)中的交互形变（interactive）和点光源（lightEffect）为按压、触摸等操作提供灵动的视觉反馈，替代组件默认的按压态和悬浮态效果。

#### [h2]按钮（Button）

按钮支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，按钮不会默认开启沉浸光感。

组件级开启：按钮支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性为[Button](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button)组件设置沉浸光感效果。

- 材质样式为THIN或ULTRA_THIN时，[fontColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#fontcolor)使用系统预定义的可反色颜色资源，可随材质自动反色。

- 当沉浸光感启用了光感交互反馈效果（[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）时，按钮默认的点击态和悬浮态视觉反馈不再展示，由材质的光感交互反馈效果替代。

- 配置沉浸光感但未设置[buttonStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#buttonstyle11)、[backgroundColor](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-background#backgroundcolor)等颜色相关属性且未设置材质颜色时，默认生效Button主题色的材质样式。

组件开启沉浸光感的效果请参见[示例9（设置按钮的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button#%E7%A4%BA%E4%BE%8B9%E8%AE%BE%E7%BD%AE%E6%8C%89%E9%92%AE%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)。

#### [h2]下拉按钮（Select）

下拉按钮支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，下拉按钮与下拉菜单默认开启沉浸光感。下拉按钮沉浸式系统材质样式默认取值为ULTRA_THIN，并默认开启交互形变（[interactive](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）与光感交互反馈（[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）；下拉菜单沉浸式系统材质样式默认取值为THICK。

组件级开启：下拉按钮支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性设置沉浸光感效果；下拉菜单通过独立的[menuSystemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#menusystemmaterial)接口设置沉浸光感效果。

- 下拉按钮与下拉菜单的沉浸光感相互独立，可分别开启或关闭；如需单独关闭沉浸光感，应设置[uiMaterial.Material.empty](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#empty)，而非将systemMaterial设置为undefined。

- 当下拉按钮的沉浸光感启用了光感交互反馈效果（[lightEffect](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#immersiveoptions)）时，下拉按钮默认的按压态和悬浮态视觉反馈不再展示，由材质的光感交互反馈效果替代。

组件开启沉浸光感的效果请参见[示例11（设置Select和下拉菜单沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-select#%E7%A4%BA%E4%BE%8B11%E8%AE%BE%E7%BD%AEselect%E5%92%8C%E4%B8%8B%E6%8B%89%E8%8F%9C%E5%8D%95%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)。

#### [h2]开关（Toggle）

开关支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，Toggle默认开启沉浸光感。

组件级开启：开关支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性设置沉浸光感效果。

- 不同[ToggleType](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-toggle#toggletype%E6%9E%9A%E4%B8%BE%E8%AF%B4%E6%98%8E)下沉浸光感效果存在差异：

- ToggleType.Checkbox：当前未适配沉浸光感效果，设置后无沉浸光感效果。

- ToggleType.Switch：传入的材质参数仅作为开启沉浸光感的开关标记，不影响实际视觉效果，实际使用组件内部预设的视觉参数，主要影响滑块大小、滑块样式、阴影等；材质效果随设备算力档位变化。

- ToggleType.Button：效果与[Button](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-button)组件设置沉浸光感相同，主要影响背景颜色、边框、阴影等视觉属性。

组件开启沉浸光感的效果请参见[示例4（Toggle沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-toggle#%E7%A4%BA%E4%BE%8B4toggle%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)。

#### [h2]滑动条（Slider）

滑动条支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，滑动条默认开启沉浸光感。

组件级开启：滑动条支持通过[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)属性设置沉浸光感效果。

- 传入的材质参数仅作为开启沉浸光感的开关标记，不影响实际视觉效果，实际使用组件内部预设的视觉参数，主要影响滑块大小、滑块样式、阴影等；传入undefined时沉浸光感不生效，恢复为原先的Slider样式。

- 沉浸光感的交互反馈效果仅在滑块形状为[SliderBlockType](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#sliderblocktype10%E6%9E%9A%E4%B8%BE%E8%AF%B4%E6%98%8E).DEFAULT且[SliderStyle](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#sliderstyle%E6%9E%9A%E4%B8%BE%E8%AF%B4%E6%98%8E)不为NONE时生效。

组件开启沉浸光感的效果请参见[示例10（设置滑动条的沉浸光感效果）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider#%E7%A4%BA%E4%BE%8B10%E8%AE%BE%E7%BD%AE%E6%BB%91%E5%8A%A8%E6%9D%A1%E7%9A%84%E6%B2%89%E6%B5%B8%E5%85%89%E6%84%9F%E6%95%88%E6%9E%9C)。

#### [h2]子页签（ChipGroup）

子页签支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，子页签默认开启沉浸光感，沉浸式系统材质样式默认取值为ULTRA_THIN。

组件级开启：子页签支持通过[ChipGroup](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-chipgroup)的backgroundSystemMaterial、selectedBackgroundSystemMaterial（选中状态）和iconBackgroundSystemMaterial（图标）字段设置沉浸光感效果。

需要文字、图标颜色随材质自动反色时，颜色应使用系统预定义的可反色颜色资源（如$r('sys.color.font_primary')），硬编码颜色值不会触发自动反色，详见[设置沉浸式系统材质反色](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-common-capability#%E8%AE%BE%E7%BD%AE%E6%B2%89%E6%B5%B8%E5%BC%8F%E7%B3%BB%E7%BB%9F%E6%9D%90%E8%B4%A8%E5%8F%8D%E8%89%B2)。

组件开启沉浸光感的效果请参见[示例6（设置系统材质样式）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-chipgroup#%E7%A4%BA%E4%BE%8B6%E8%AE%BE%E7%BD%AE%E7%B3%BB%E7%BB%9F%E6%9D%90%E8%B4%A8%E6%A0%B7%E5%BC%8F)和[示例7（设置组件选中状态的系统材质样式）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-chipgroup#%E7%A4%BA%E4%BE%8B7%E8%AE%BE%E7%BD%AE%E7%BB%84%E4%BB%B6%E9%80%89%E4%B8%AD%E7%8A%B6%E6%80%81%E7%9A%84%E7%B3%BB%E7%BB%9F%E6%9D%90%E8%B4%A8%E6%A0%B7%E5%BC%8F)。

#### [h2]操作块（SegmentButton）

操作块支持通过应用级开启、组件级开启方式开启沉浸光感。

应用级开启：应用级开关处于[ENABLE](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uimaterial#materialstate)模式下，操作块默认开启沉浸光感，沉浸式系统材质样式默认取值为THIN。

组件级开启：[SegmentButton](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton)支持通过SegmentButtonOptions中的backgroundSystemMaterial字段设置沉浸光感效果；[SegmentButtonV2](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbuttonv2)通过各类分段按钮options参数中的backgroundSystemMaterial字段设置。

- SegmentButton的胶囊类多选分段按钮（[SegmentButtonOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton#segmentbuttonoptions)的type为“capsule”且[SegmentButtonOptions](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton#segmentbuttonoptions)的multiply为true）不支持backgroundSystemMaterial，设置后不生效。

- SegmentButtonV2开启沉浸光感后，支持选中项背景跟随手指拖拽，否则不支持跟随手指拖拽。

- 设置自动反色时，即colorInvert为true，如果SegmentButton中的fontColor、selectedFontColor，或SegmentButtonV2中的itemFontColor、itemSelectedFontColor、itemIconFillColor、itemSelectedIconFillColor等使用支持反色的系统资源，颜色自动适配到材质背景色的反色。

组件开启沉浸光感的效果请参见[示例8（设置背景板材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbutton#%E7%A4%BA%E4%BE%8B8%E8%AE%BE%E7%BD%AE%E8%83%8C%E6%99%AF%E6%9D%BF%E6%9D%90%E8%B4%A8)和[示例6（设置背景板材质）](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-segmentbuttonv2#%E7%A4%BA%E4%BE%8B6%E8%AE%BE%E7%BD%AE%E8%83%8C%E6%99%AF%E6%9D%BF%E6%9D%90%E8%B4%A8)。

#### 其余组件

其余组件均支持通用属性[systemMaterial](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-image-effect#systemmaterial)设置沉浸式系统材质，跟随通用属性的生效规则呈现效果，例如[布局容器](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-layout-development-overview)、[滚动容器](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-list-grid-development-overview)。生效区域为Navigation/NavDestination标题栏，或横向Tab中barPosition为BarPosition.End的底部TabBar。开启后的常见问题请参考[沉浸光感常见问题](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-faq)。
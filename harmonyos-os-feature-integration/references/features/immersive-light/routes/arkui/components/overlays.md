# ArkUI 弹窗类组件

弹窗类入口必须使用各自明确的 Options 类型，不能用动态类型或一个泛化 `MenuOptions` 覆盖所有入口。

| 场景 | 应用级 `ENABLE` 默认 | 组件级入口 | 关键限制 |
|---|---|---|---|
| Toast | 开启，默认 `THICK` | `ShowToastOptions.systemMaterial` | 主动设置背景色或背景模糊后不呈现材质 |
| Popup | 不开启 | `PopupOptions.systemMaterial` | 必须显式设置 |
| Tips | 不开启 | `TipsOptions.systemMaterial` | 必须显式设置 |
| Menu | 开启，默认 `THICK` | `ContextMenuOptions.systemMaterial` 等实际入口 Options | 按调用入口确认类型，不复用 HDS 的 `HdsNavigationMenuContentOptions` |
| Dialog/Sheet | 开启，默认 `ULTRA_THICK` | `CustomDialogControllerOptions`、`AlertDialogParam`、`ActionSheetOptions`、`SheetOptions` 等 | 背景色或背景模糊会遮挡；避免大面积材质 |

DatePicker、TextPicker、TimePicker 的弹出效果按 CustomDialog 类验证。CalendarPicker 拉起的弹出框当前不支持沉浸光感；对 CalendarPicker 组件使用通用属性时，效果作用于组件本身，不是其弹出框。

## 实施规则

1. 先确定真实调用入口和对应 Options 类型；同名 `systemMaterial` 不代表 Options 可互换。
2. 应用级默认已经满足目标时，不重复强制写入同样材质；需要自定义或明确关闭时再使用组件级入口。
3. 明确关闭使用 `uiMaterial.Material.empty`，除非该组件官方说明了不同语义。
4. 弹窗已有背景色、背景模糊、自定义阴影或大尺寸时，先决定保留原视觉还是采用材质，不叠加碰运气。
5. 大面积 Dialog/Sheet 的 GPU 和动效开销单独评估；关键内容不能依赖透明背景才能辨识。

## 来源

- [组件适配沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)
- [开启沉浸光感](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-enable)


---
title: "ArkUI 沉浸光感弹窗与菜单组件适配"
summary: "按 Toast、Popup、Tips、Menu、Dialog、PickerDialog、Sheet 和选择菜单区分默认行为和 Options，提供五类显式配置示例。"
createdAt: "2026-11-11"
updatedAt: "2026-11-11"
tags: ["HarmonyOS","沉浸光感","ArkUI","Toast","Popup","Tips","Menu","Dialog","Sheet","SelectionMenu"]
---

# ArkUI 沉浸光感弹窗与菜单组件适配

适用于 Stage 模型的原生 ArkUI。编译 SDK、target 和启用材质的运行系统须达到 API 26。兼容更低版本时先保护新增接口调用。应用启动完成并退出加载页后，在版本保护内查询 `uiMaterial.isImmersiveMaterialSupported()`。应用级 `DISABLE` 会关闭材质，材质不可用时沿用普通视觉样式。

## 选择组件入口

弹窗类入口必须使用各自明确的 Options 类型，不能用动态类型或一个泛化 `MenuOptions` 覆盖所有入口。

| 场景 | 应用级 `ENABLE` 默认 | 组件级入口 | 关键限制 |
|---|---|---|---|
| Toast | 开启，默认 `THICK` | `ShowToastOptions.systemMaterial` | 主动设置背景色或背景模糊后不呈现材质 |
| Popup | 不开启 | `PopupOptions.systemMaterial` | 必须显式设置 |
| Tips | 不开启 | `TipsOptions.systemMaterial` | 必须显式设置 |
| Menu | 开启，默认 `THICK` | `ContextMenuOptions.systemMaterial` 等实际入口 Options | 按调用入口确认类型，不复用 HDS 的 `HdsNavigationMenuContentOptions` |
| Dialog | 开启，默认 `ULTRA_THICK` | `CustomDialogControllerOptions`、`AlertDialogParam`、`ActionSheetOptions` 等 | 背景色或背景模糊会遮挡；避免大面积材质 |
| Sheet（bindSheet） | 不开启，须显式配置材质 | `SheetOptions.systemMaterial` | 显式传入材质对象，`style` 按需求选择；避免大面积材质 |

`DEFAULT` 与 `ENABLE` 不能合并理解：Dialog、Toast、AlphabetIndexer 和启用 `copyOption` 的文本选择菜单在 `DEFAULT` 下存在系统默认材质，但可能受背景色、模糊和阴影配置影响；普通 Menu 与 SelectionMenu 需要 `ENABLE` 才默认开启。Popup、Tips 在 `DEFAULT`、`ENABLE` 下都不会自动开启，需要使用各自 Options 显式设置。

CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog 按对应选择器 Options 核对材质效果。CalendarPicker 自己拉起的弹出框当前不支持沉浸光感。为 CalendarPicker 设置通用材质只影响组件本身。

背景色、背景模糊和阴影可能影响系统默认材质。先确认真实调用的 Options 类型。系统默认效果满足要求时沿用默认，需要定制或关闭时通过组件级入口配置。明确关闭通常用 `uiMaterial.Material.empty`。Dialog 或 Sheet 使用大面积材质时，结合实际动效核对性能与可读性。

## 显式定制材质示例

以下片段展示在实际弹窗入口中显式定制材质。系统默认效果满足需求的 Toast、Dialog 等不必重复添加配置；示例中的 `ULTRA_THIN`、`THIN` 和半透明赋色均为定制值，不是统一接入要求。默认行为依据[官方组件适配说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-immersive-light-sense-component-adaptation)。

| 入口 | 系统默认值与开启条件 | 下方示例的定制值 |
|---|---|---|
| Toast | 满足默认开启条件时为 `THICK` | `ULTRA_THIN` |
| AlertDialog / CustomDialog / ActionSheet | 满足默认开启条件时为 `ULTRA_THICK` | `ULTRA_THIN`；ActionSheet 另加半透明赋色 |
| bindSheet | `SheetOptions.systemMaterial` 默认 `undefined`，接入须显式配置；官方示例选用 `ULTRA_THICK` | `THIN` |

`ULTRA_THICK` 是 Dialog 的系统默认样式，也是[官方半模态示例 10](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/ts-universal-attributes-sheet-transition#示例10半模态设置系统材质)选用的样式。`bindSheet` 可显式选择其他受支持样式。组件的默认样式与材质构造参数的默认值须区分：`ImmersiveOptions.style` 省略时为 `REGULAR`，所以下方示例显式写出定制值。

把方法放入原组件，在满足版本、启动就绪、设备能力及应用状态条件后配置材质。`bindSheet` 声明放在实际接入分支。低版本或材质不可用时保留原配置、内容、状态和业务回调。示例中的日志位置用于衔接原回调。

```typescript
import { uiMaterial } from '@kit.ArkUI';
```

### Toast：在调用 Options 中定制

```typescript
showMaterialToast(): void {
  this.getUIContext().getPromptAction().showToast({
    message: '操作完成',
    duration: 2500,
    systemMaterial: new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.ULTRA_THIN
    })
  });
}
```

保留原有异常处理；这里使用的是 `ShowToastOptions.systemMaterial`。

### AlertDialog：保留确认与取消回调

```typescript
showMaterialAlert(): void {
  AlertDialog.show({
    title: '确认操作',
    message: '是否继续？',
    primaryButton: {
      value: '取消',
      action: () => { console.info('cancel'); }
    },
    secondaryButton: {
      value: '确定',
      action: () => { console.info('confirm'); }
    },
    systemMaterial: new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.ULTRA_THIN
    })
  });
}
```

材质属于 `AlertDialogParam`，不改变按钮回调的业务职责。

### ActionSheet：定制厚度与可选赋色

```typescript
showMaterialActionSheet(): void {
  ActionSheet.show({
    title: '选择操作',
    sheets: [
      { title: '选项一', action: () => { console.info('option 1'); } },
      { title: '选项二', action: () => { console.info('option 2'); } }
    ],
    systemMaterial: new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
      materialColor: 'rgba(64, 128, 255, 0.2)'
    })
  });
}
```

材质属于 `ActionSheetOptions`；仅需改变厚度时省略 `materialColor`。

### CustomDialog：创建控制器时配置，调用 open 时显示

弹窗内容组件放在页面组件外，保留原有内容和关闭入口：

```typescript
@CustomDialog
struct MaterialDialog {
  controller?: CustomDialogController;

  build() {
    Column({ space: 12 }) {
      Text('自定义弹窗')
      Button('关闭').onClick(() => {
        this.controller?.close();
      })
    }
    .padding(16)
  }
}
```

以下成员和方法放在持有弹窗的原页面组件内；从已有点击回调调用 `openMaterialDialog()`：

```typescript
private dialogController?: CustomDialogController;

openMaterialDialog(): void {
  if (!this.dialogController) {
    this.dialogController = new CustomDialogController({
      builder: MaterialDialog(),
      autoCancel: true,
      alignment: DialogAlignment.Center,
      cancel: () => { console.info('dialog cancel'); },
      systemMaterial: new uiMaterial.ImmersiveMaterial({
        style: uiMaterial.ImmersiveStyle.ULTRA_THIN
      })
    });
  }
  this.dialogController?.open();
}
```

材质属于 `CustomDialogControllerOptions`，在创建控制器时配置；`open()` 只负责显示。已有控制器时直接修改其创建配置，保留原有控制器管理与生命周期。

### bindSheet：显式配置材质，通过状态显示

以下状态、Builder 和 UI 片段放在原有页面组件对应位置：

```typescript
@State showSheet: boolean = false;

@Builder
sheetContent() {
  Column({ space: 12 }) {
    Text('半模态内容')
    Button('关闭').onClick(() => {
      this.showSheet = false;
    })
  }
  .padding(16)
}

// 原页面 build() 的接入分支内
Button('打开半模态')
  .onClick(() => { this.showSheet = true; })
  .bindSheet($$this.showSheet, this.sheetContent(), {
    height: 320,
    showClose: true,
    systemMaterial: new uiMaterial.ImmersiveMaterial({
      style: uiMaterial.ImmersiveStyle.THIN
    })
  })
```

`$$this.showSheet` 同步系统关闭与页面显示状态；已有工程采用回调同步时沿用原机制。`height: 320` 仅为示例尺寸，接入时保留原有尺寸配置。按 [SheetOptions](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/ts-universal-attributes-sheet-transition#sheetoptions)，`systemMaterial: undefined` 会清除由该接口设置的材质效果，不能将其作为显式接入完成的依据。

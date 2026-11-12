---
title: "闪控窗屏幕尺寸与断点响应"
summary: "说明复用应用已有断点或屏幕尺寸状态，在折叠、旋转和分屏时计算符合闪控窗模板约束的窗口尺寸。"
createdAt: "2026-11-10"
updatedAt: "2026-11-10"
tags: ["HarmonyOS", "闪控窗", "floatView", "断点", "窗口尺寸"]
---

# 闪控窗屏幕尺寸与断点响应

设备屏幕尺寸变化（折叠屏展开/折叠、旋转、分屏）时，闪控窗不会自动跟随：窗口停留在创建时的尺寸，可能与新屏幕不匹配。是否让闪控窗跟随更新，由原工程现状决定：

| 原工程现状 | 闪控窗的处理 |
|---|---|
| 已有断点或屏幕尺寸响应机制 | 借用该机制，断点变化时重算并更新窗口尺寸（见[接入现有尺寸状态](#接入现有尺寸状态)） |
| 没有该机制 | 不响应：保持创建时尺寸，仍受 onLimitsChange 约束更新，不为闪控窗专门新增屏幕尺寸监听或断点工具 |

「已有机制」指工程中已存在的屏幕尺寸感知设施，例如断点工具类（按屏幕宽度分档并更新状态）、`display.on('change')` 订阅、媒体查询、主窗口 `windowSizeChange` 监听或 GridRow 断点状态；适配过折叠屏或大屏的工程通常已有其中一种。

## 接入现有尺寸状态

1. 找到工程已有的状态来源，例如 AppStorage、`@Provide`／`@Consume`、状态库或事件总线。继续由其现有所有者维护订阅和退订。
2. 窗页面消费同一状态。模板切换与尺寸重算共享当前模板，使用业务所有者提供的 `viewController`，类型为 `floatView.FloatViewController`。该引用来自当前窗的 `floatView.create(config)`。
3. 状态变化后，查询当前模板的 `minSize`、`maxSize` 和 `ratioLimits`。将期望尺寸由 vp 转为 px，并检查宽、高及宽高比后调用 `setWindowSize`。

## 断点尺寸示例

`currentBreakpoint` 替换为项目已有的 AppStorage 键。示例宽度、基础高度、条目行高和条目数由业务提供。`compact` 来自当前窗模板的共享布局状态，组件消费已有断点变化。

```arkts
import { floatView, window } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Component
export struct FloatViewBreakpointSizer {
  // 断点状态源接入原工程既有机制：AppStorage 键、@Consume、状态库、事件总线等
  // 按实际机制选择，currentBreakpoint 为占位键名，窗页面不新建监听。
  viewController: floatView.FloatViewController | undefined = undefined;
  @StorageLink('currentBreakpoint') @Watch('onBreakpointChange') currentBreakpoint: number = 1;
  @Prop compact: boolean = false;
  @Prop itemCount: number = 3; // 业务条目数，接现有数据源。

  private async updateWindowSize(): Promise<void> {
    const controller = this.viewController;
    if (controller === undefined) {
      return;
    }

    const templateType = this.compact
      ? floatView.FloatViewTemplateType.HORIZONTAL_BAR
      : floatView.FloatViewTemplateType.ROUNDED_RECTANGLE;
    const limits = floatView.getFloatViewLimits(templateType);
    const uiContext = this.getUIContext();
    // 期望尺寸按业务内容计算：宽度取当前断点下的业务设计宽度，
    // 高度取基础高度 + 条目数×行高；数值为占位，统一收敛到模板 min/max 后转 px。
    const widthVp = Math.min(Math.max(355, uiContext.px2vp(limits.minSize.width)),
      uiContext.px2vp(limits.maxSize.width));
    const heightVp = Math.min(Math.max(78 + 32 * this.itemCount,
      uiContext.px2vp(limits.minSize.height)), uiContext.px2vp(limits.maxSize.height));
    const size: window.Size = {
      width: uiContext.vp2px(widthVp),
      height: uiContext.vp2px(heightVp)
    };

    const ratio = size.width / size.height;
    if (limits.ratioLimits.length > 0 &&
      !limits.ratioLimits.some((range) => ratio >= range.minRatio && ratio <= range.maxRatio)) {
      // 重新选取符合比例的业务尺寸前，沿用当前窗口大小。
      return;
    }
    await controller.setWindowSize(size);
  }

  private onBreakpointChange(): void {
    this.updateWindowSize().catch((error: BusinessError) => {
      hilog.error(0xF811, 'FloatViewBreakpointSizer', 'Resize by breakpoint failed: %{public}s',
        String(error.code));
    });
  }

  build() {
    Column() {
      // 复用已有业务内容。顶部预留常规态 32vp、mini 态 4vp。
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.compact ? 4 : 32 })
  }
}
```

宽和高分别收敛后，还需检查最终宽高比。示例发现比例不匹配时保留当前尺寸，实际可由业务重新选择符合比例的宽高组合。`@StorageLink('currentBreakpoint')` 对应第 1 步找到的状态源，原工程使用 @Consume、状态库或事件总线时替换为等价接入方式。切换模板时以**目标模板**的约束和当前断点重算。若页面已在同一根容器处理顶部避让，仅保留一处顶部预留。

窗口隐藏、进入侧栏或绑定切换为球期间，断点可能变化。恢复可见时按当前断点核对尺寸。尺寸更新本身不启动闪控窗。工程同时处理模板切换和断点变化时，让同一个尺寸所有者串行提交，以免旧尺寸覆盖新模板。最终以 `onRectChange` 返回的窗口矩形验收。 [闪控窗 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)

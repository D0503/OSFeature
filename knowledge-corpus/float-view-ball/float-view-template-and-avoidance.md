---
title: "闪控窗模板切换与页面避让"
summary: "保留闪控窗展开与收起组件示例，说明模板与页面布局同步、窗口尺寸约束、实际矩形和 avoidArea 避让。"
createdAt: "2026-11-10"
updatedAt: "2026-11-10"
tags: ["HarmonyOS", "闪控窗", "floatView", "模板切换", "避让"]
---

# 闪控窗模板切换与页面避让

内容更新使用已加载页面的正常状态管理。闪控窗的圆角矩形和紧凑横条使用同一个系统控制器。主页面与窗页面从同一份业务数据取值，通过已有 `AppStorage`、`LocalStorage` 或其他状态机制刷新内容。列表使用稳定业务 ID。字段变化和条目增删只更新页面状态，沿用当前控制器和已加载页面。`setUIContext`、`create` 和 `start` 留在页面加载与启动流程。

## 调整尺寸和切换模板

- **仅调整尺寸**时，调用 `floatView.getFloatViewLimits(templateType)` 读取当前模板的 `minSize`、`maxSize` 和 `ratioLimits`，再调用 `viewController.setWindowSize(size)`。宽高使用 px，且均须大于 0。业务布局使用 vp 时，先通过实际 `UIContext.vp2px()` 转换，再核对宽高和比例。
- **重新计算尺寸**的触发条件包括条目数量、显示区域、`onLimitsChange` 和已有断点状态的变化。`onLimitsChange` 用于更新业务保存的尺寸约束。窗口实际位置和大小以 `onRectChange` 为准。已有屏幕尺寸响应机制时，初始和后续尺寸均可复用其状态，具体见[闪控窗屏幕尺寸与断点响应](float-view-breakpoint-resize.md)。
- **切换形态**时，先查询目标模板的限制，再把目标模板和尺寸作为完整的 `TemplateProperty` 传给 `viewController.switchTemplate(property)`。系统 API 改变窗口模板和尺寸，页面由自己的展开／紧凑状态控制内容布局。接口成功后提交页面状态，失败时保留原布局。切回展开态时重新查询圆角矩形模板的限制。

下面单独演示切换到紧凑横条。`viewController` 使用当前窗的系统控制器。最大尺寸仅用于展示参数结构，实际值按业务内容、显示区域及目标模板约束选取。在现有异步错误处理入口中执行，控制器不可用或状态不适合切换时暂不发起请求。

```typescript
const templateType = floatView.FloatViewTemplateType.HORIZONTAL_BAR;
const limits = floatView.getFloatViewLimits(templateType);
const property: floatView.TemplateProperty = {
  templateType: templateType,
  size: { width: limits.maxSize.width, height: limits.maxSize.height }
};
await viewController.switchTemplate(property);
// 调用成功后再同步页面的紧凑布局状态。
```

## 展开与收起组件

上箭头把窗口收起为紧凑横条，下箭头把窗口展开为圆角矩形。两个形态都在当前窗内切换，共用同一页面和控制器。

组件由业务所有者传入当前窗的 `viewController`，类型为 `floatView.FloatViewController`，来源是本次 `floatView.create(config)`。可通过宿主已有的共享状态把该引用提供给窗页面。`started` 由窗口状态通知驱动，首次收到 `STARTED` 时触发避让读取。初始模板为 `ROUNDED_RECTANGLE` 时使用 `initialCompact: false`，初始模板为 `HORIZONTAL_BAR` 时传入 `true`。

下例保留展开、收起按钮和业务内容区，使用目标模板的最大尺寸演示。实际接入时按业务需要选取符合模板约束的大小，替换示例文本并沿用应用国际化。

```arkts
import { floatView } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Component
export struct FloatViewContent {
  viewController: floatView.FloatViewController | undefined = undefined;
  initialCompact: boolean = false;
  @Prop @Watch('updateAvoidArea') started: boolean = false;
  @State compact: boolean = false;
  @State switching: boolean = false;
  @State leftAvoidWidth: number = 0;
  @State rightAvoidWidth: number = 0;
  private pageActive: boolean = false;
  private rectController: floatView.FloatViewController | undefined = undefined;
  private rectChanged: (info: floatView.FloatViewRectChangeInfo) => void = () => {
    this.updateAvoidArea();
  };

  aboutToAppear(): void {
    this.pageActive = true;
    this.compact = this.initialCompact;
    const controller = this.viewController;
    if (controller !== undefined) {
      controller.onRectChange(this.rectChanged);
      this.rectController = controller;
    }
    this.updateAvoidArea();
  }

  aboutToDisappear(): void {
    this.pageActive = false;
    const controller = this.rectController;
    this.rectController = undefined;
    if (controller !== undefined) {
      try {
        controller.offRectChange(this.rectChanged);
      } catch (error) {
        const err = error as BusinessError;
        hilog.warn(0xF811, 'FloatViewContent', 'Remove rect listener failed: %{public}s',
          String(err.code));
      }
    }
  }

  updateAvoidArea(): void {
    const controller = this.viewController;
    if (!this.pageActive || !this.started || controller === undefined) {
      return;
    }
    try {
      const properties = controller.getWindowProperties();
      this.leftAvoidWidth = this.getUIContext().px2vp(properties.avoidArea.leftRect.width);
      this.rightAvoidWidth = this.getUIContext().px2vp(properties.avoidArea.rightRect.width);
    } catch (error) {
      const err = error as BusinessError;
      hilog.warn(0xF811, 'FloatViewContent', 'Read avoid area failed: %{public}s', String(err.code));
    }
  }

  private async changeLayout(compact: boolean): Promise<void> {
    const controller = this.viewController;
    if (!this.started || this.switching || controller === undefined) {
      return;
    }

    this.switching = true;
    try {
      const templateType = compact
        ? floatView.FloatViewTemplateType.HORIZONTAL_BAR
        : floatView.FloatViewTemplateType.ROUNDED_RECTANGLE;
      const limits = floatView.getFloatViewLimits(templateType);
      const size = { width: limits.maxSize.width, height: limits.maxSize.height };
      const ratio = size.width / size.height;
      if (limits.ratioLimits.length > 0 &&
        !limits.ratioLimits.some((range) => ratio >= range.minRatio && ratio <= range.maxRatio)) {
        return;
      }
      const property: floatView.TemplateProperty = { templateType: templateType, size: size };
      await controller.switchTemplate(property);
      if (this.pageActive && this.viewController === controller) {
        this.compact = compact;
        this.updateAvoidArea();
      }
    } catch (error) {
      const err = error as BusinessError;
      hilog.error(0xF811, 'FloatViewContent', 'Switch layout failed: %{public}s, %{public}s',
        String(err.code), err.message);
    } finally {
      this.switching = false;
    }
  }

  build() {
    Column() {
      if (this.compact) {
        Row() {
          Text('业务摘要').layoutWeight(1)
          SymbolGlyph($r('sys.symbol.chevron_down'))
            .accessibilityText('展开')
            .enabled(this.started && !this.switching)
            .onClick(() => { this.changeLayout(false); })
        }
        .width('100%')
        .padding({ left: this.leftAvoidWidth + 6, right: this.rightAvoidWidth + 6 })
        .onAreaChange(() => { this.updateAvoidArea(); })
      } else {
        Column() {
          Text('业务详细内容')
        }
        .layoutWeight(1)
        Row() {
          SymbolGlyph($r('sys.symbol.chevron_up'))
            .accessibilityText('收起')
            .enabled(this.started && !this.switching)
            .onClick(() => { this.changeLayout(true); })
        }
        .width('100%')
        .justifyContent(FlexAlign.Center)
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    // 顶部预留：常规态 32vp，mini 态 4vp。
    .padding({ top: this.compact ? 4 : 32 })
  }
}
```

上例由组件注册自己的矩形监听，并在退出时用同一个回调退订。窗口收到 `STOPPED` 时，由控制器所有者清理自己注册的监听。如果创建窗口时已统一注册并分发 `onRectChange`，由既有分发触发 `updateAvoidArea()`，组件无需额外注册和退订。展开和紧凑内容拆成子组件时，可用父组件的 `@Provide` 和子组件的 `@Consume` 共享布局状态。模板切换成功后更新共享状态，并继续使用当前控制器和页面。布局属性通过 `getWindowProperties()` 读取，返回 undefined 时保留当前布局；取得属性后根据 `properties.avoidArea` 避让，避免交互控件落入不响应区域，不固定为某款手机的尺寸。

## 实际尺寸与交互避让

- **顶部预留**随 `compact` 布局状态同步。常规态 `ROUNDED_RECTANGLE` 预留 32vp，紧凑态 `HORIZONTAL_BAR` 预留 4vp。保留顶部预留的同时，按实际 `avoidArea` 检查交互区域。
- **紧凑态左右避让**使用实际 `UIContext.px2vp()` 分别换算 `avoidArea.leftRect.width` 和 `avoidArea.rightRect.width`，每侧再加 6vp 页面留白。系统避让区域内的控件不响应手势。摘要与展开按钮放入同一内容容器，左右内边距同时覆盖文本和按钮，父子层级只计算一次。6vp 属于页面留白，系统避让宽度以窗口当前属性为准。
- **实际尺寸**以 `onRectChange` 为准。系统可能调整请求的宽高，例如紧凑横条的实际高度小于请求高度。内容行按内容自适应，通过根容器 `justifyContent(FlexAlign.Center)` 垂直居中，避免固定行高贴顶导致底部裁剪。确需固定行高时，从实际 `windowRect.height` 换算并收敛到可用高度。
- **刷新时机**包括首次收到 `STARTED`、页面内容区布局变化、模板切换成功和窗口矩形变化。页面加载期间属性尚不可用或 `getWindowProperties()` 失败时保留当前布局。左右内边距用于页面内部，窗口外部宽度仍按模板和内容单独计算。
- **内容驱动尺寸**按形态分别计算。展开态根据头部、业务条目和操作区计算高度，紧凑态根据摘要和操作区计算宽度，各自高度计入顶部预留。尺寸由 vp 转为 px 后，按当前模板的宽高和比例约束收敛。计算结果用于请求窗口尺寸，页面布局仍按系统返回的实际尺寸自适应。内容过长时使用内部滚动或截断。

## 可选过渡效果

需要淡入淡出时，可在页面 `Stack` 顶层放置覆盖层，通过 `opacity` 和 `animation` 控制过渡，并设置 `hitTestBehavior(HitTestMode.None)` 保持底层控件可交互。防窥保护另行处理。模板切换成功或失败后均收起覆盖层，以系统接口结果判断切换是否成功。页面退出时清理自身的过渡定时任务。

验收时检查模板来回切换后的实际矩形、上下留白、标题与按钮的可交互区域，以及失败时原布局是否保留。 [闪控窗 API 参考](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-floatview)

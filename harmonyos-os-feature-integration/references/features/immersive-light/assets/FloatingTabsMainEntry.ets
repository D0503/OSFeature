import { HdsTabs, HdsTabsController } from '@kit.UIDesignKit';
import { HdsMaterialGuard } from './HdsMaterialGuard';

/**
 * FloatingTabsMainEntry.ets —— 底部悬浮胶囊页签（沉浸光感）主框架模式
 *
 * 来源：能力包形成阶段核验的三组"未接入/接入悬浮Tab"工程差异快照（2026-09-01）。
 * 原始工程不随 Skill 分发，以下名称只保留为历史来源标识：
 * - ComprehensiveMall 1.0.7 → 1.0.8：原生 Tabs（含平板侧边导航属性组）→ HdsTabs 悬浮胶囊；
 * - ComprehensiveNews 1.0.5 → 1.0.6：原生 Tabs（含动态隐藏/自定义页签动画）→ HdsTabs
 *   悬浮胶囊，保留 CustomTabBar 与 translateY 隐藏动画，动态 barHeight(56/0) 仍可用；
 * - Recipes 1.0.7 → 1.0.8：自研 floating_navbar HAR 组件整体删除 → HdsTabs 悬浮胶囊。
 *
 * 三组迁移对照"接入后"共同出现的悬浮底部属性（本资产主体）：
 *   barPosition: End + scrollable(false) + barHeight(56) + barOverlap(true)
 *   + barFloatingStyle({ barBottomMargin?, adaptToHandedness: true,
 *   systemMaterialEffect: ADAPTIVE + ADAPTIVE })
 * 其中 56vp 是显示态基线（News 隐藏时为 0）；animationDuration(0) 仅 Mall/News 使用，
 * barBottomMargin: 28 仅 News/Recipes 使用，均不是三组统一必需值。
 *
 * 迁移时被移除的原生 Tabs 属性（悬浮胶囊为底部形态，这些不再适用）：
 *   vertical / barPosition 动态切换 / barMode / barWidth / divider /
 *   barBackgroundColor / barBackgroundBlurStyle / customContentTransition（HdsTabs 无此属性，
 *   自定义切换动画需舍弃或移入降级分支）。
 * 三组迁移对照都把大断点/横屏侧栏改为底部悬浮，但这只是已核验工程的迁移策略。依赖平板侧边
 * 导航的工程必须在方案阶段决定"所有断点统一底部"还是"大屏保留侧栏分支"。
 *
 * 使用边界：
 * - compatibleSdkVersion >= 23：删除 else 分支直接用 HdsTabs（三组迁移对照采用的做法）；
 * - compatibleSdkVersion < 23：保留 isHdsSupported() 整树降级分支（本示例含完整写法），
 *   不变的页签内容可用 @Builder 双分支共用，避免两套业务内容维护。普通 Tabs 分支必须保留源程序
 *   原有的断点、横竖屏、窗口模式、底部/侧边形态和交互，不能照抄 HDS 的统一底部配置；
 * - barOverlap(true) 让内容位于悬浮页签下方；是否再给 TabContent 配置 expandSafeArea
 *   和透明背景取决于页面已有安全区与背景。Mall/Recipes 使用 BOTTOM 扩展，News 未使用，
 *   因此不能把 expandSafeArea 视为材质生效的统一前提；
 *   深色内容页可按 News 对照在 onWillShow/onWillHide 用 application.setColorMode 联动。
 * - 本资产使用当前 SDK 的 @kit.UIDesignKit 导入；API 23/24 对照工程把 HdsTabs 从
 *   @hms.hds.hdsBaseComponent 导入。落地时沿用目标 SDK/工程能够构建的同版本导入方式。
 */
@ComponentV2
struct FloatingTabsMainEntry {
  @Local currentIndex: number = 0;
  /**
   * 必须接入源程序原有的断点/横竖屏状态，不能在接入时重新定义判断规则。
   * 例如源程序可能在 LG/XL 或特定横屏窗口使用侧边纵向 Tabs。
   */
  @Local sourceUsesSideTabs: boolean = false;
  /** HdsTabsController extends TabsController：既有 changeIndex 外部调用点零改动 */
  private hdsController: HdsTabsController = new HdsTabsController();
  /** 低版本降级分支使用的原生控制器 */
  private fallbackController: TabsController = new TabsController();

  build() {
    NavDestination() {
      if (HdsMaterialGuard.isHdsSupported()) {
        // HDS 沉浸光感：底部悬浮胶囊 + 系统自适应材质
        HdsTabs({
          barPosition: BarPosition.End,
          index: this.currentIndex,
          controller: this.hdsController
        }) {
          this.tabContents()
        }
        .scrollable(false)
        .barHeight(56)
        .barOverlap(true)
        // Mall/News 使用；若原工程需要内容切换动画，可删除该项（Recipes 未设置）
        .animationDuration(0)
        .barFloatingStyle({
          // 距屏幕底部边距：News/Recipes 用 28，Mall 未设置；按页面内容留白调整
          barBottomMargin: 28,
          // 智感握姿：悬浮页签随用户握持状态调整位置（三组迁移对照均开启）
          adaptToHandedness: true,
          // News 对照曾用 gradientMask: { maskColor: Color.Transparent } 去除默认渐变遮罩
          systemMaterialEffect: HdsMaterialGuard.getSystemMaterialParams()
        })
        .onChange((index: number) => {
          this.currentIndex = index;
        })
      } else {
        // compatibleSdkVersion < 23：保留源程序原有普通 Tabs 组件树和响应式行为。
        // 下列 96/56/'100%' 仅演示“继续使用源属性表达式”；落地时替换成源程序的原值、
        // 资源和条件，并同样保留 divider、barMode、背景、动画、控制器及全部事件。
        Tabs({
          barPosition: this.sourceUsesSideTabs ? BarPosition.Start : BarPosition.End,
          index: this.currentIndex,
          controller: this.fallbackController
        }) {
          this.tabContents()
        }
        .vertical(this.sourceUsesSideTabs)
        .scrollable(false)
        .barWidth(this.sourceUsesSideTabs ? 96 : '100%')
        .barHeight(this.sourceUsesSideTabs ? '100%' : 56)
        .onChange((index: number) => {
          this.currentIndex = index;
        })
      }
    }
    .hideTitleBar(true)
  }

  /**
   * 页签业务内容（HDS 与原生降级分支共用）。只放两个分支完全相同的属性；
   * HDS 专用的透明背景、安全区扩展或裁剪不能在这里无条件施加给低版本分支。
   */
  @Builder
  tabContents() {
    TabContent() {
      // 替换为真实页面组件，如 HomePage()
      Text('首页内容')
    }
    .tabBar(this.tabBarBuilder('首页', 0))

    TabContent() {
      Text('我的内容')
    }
    .tabBar(this.tabBarBuilder('我的', 1))
  }

  /** 自定义页签项：Mall/Recipes 采用 24vp Symbol + Caption_M；News 保留原 Image 自定义栏 */
  @Builder
  tabBarBuilder(label: string, index: number) {
    Column({ space: 2 }) {
      // 替换为工程图标资源，如 SymbolGlyph($r('app.symbol.house'))
      Text(label === '首页' ? '⌂' : '·')
        .fontSize(24)
        .fontColor(this.currentIndex === index ? '#0A59F7' : $r('sys.color.icon_primary'))
      Text(label)
        .fontSize($r('sys.float.Caption_M'))
        .fontWeight(FontWeight.Medium)
        .fontColor(this.currentIndex === index ? '#0A59F7' : $r('sys.color.font_primary'))
    }
    .justifyContent(FlexAlign.Center)
    .width('100%')
    .padding(4)
  }
}

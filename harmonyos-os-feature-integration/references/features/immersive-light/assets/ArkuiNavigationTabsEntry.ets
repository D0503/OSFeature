import { uiMaterial } from '@kit.ArkUI';
import { ImmersiveMaterialGuard } from './ImmersiveMaterialGuard';

/**
 * ArkuiNavigationTabsEntry.ets —— 原生 ArkUI Navigation 标题栏与悬浮 Tabs 接入骨架
 *
 * 来源：官方 Navigation 示例20、Tabs 示例24和《组件适配沉浸光感》；代码为能力包
 * 按关键约束重新整理的最小骨架，不是官方完整示例副本。
 *
 * - 只用于原生 Navigation/Tabs；HdsNavigation/HdsTabs 使用 HDS 资产。
 * - API 26 以下保留 sourceNavigation()；不要把增强分支的底部形态强加给源程序。
 * - 原生 Tabs 悬浮材质必须同时满足 barOverlap(true)、vertical(false)、BarPosition.End。
 * - 应用级 ENABLE 不会自动开启原生底部 Tabs，必须显式设置 FloatingTabBarStyle.systemMaterial。
 */
@ComponentV2
export struct ArkuiNavigationTabsEntry {
  private stack: NavPathStack = new NavPathStack();
  @Local private isRuntimeApiAvailable: boolean = ImmersiveMaterialGuard.isRuntimeApiAvailable();
  @Local private isMaterialSupported: boolean = ImmersiveMaterialGuard.isMaterialSupported();

  @Builder
  private tabContents() {
    TabContent() {
      Column() {
        Text('首页')
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
    }
    .tabBar('首页')

    TabContent() {
      Column() {
        Text('我的')
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
    }
    .tabBar('我的')
  }

  @Builder
  private sourceNavigation() {
    Navigation(this.stack) {
      Tabs({ barPosition: BarPosition.End }) {
        this.tabContents()
      }
      .width('100%')
      .height('100%')
      // 复制到真实工程时保留接入前 vertical、barPosition、尺寸和事件。
    }
    .width('100%')
    .height('100%')
    .title('首页')
  }

  @Builder
  private api26Navigation() {
    Navigation(this.stack) {
      Tabs({ barPosition: BarPosition.End }) {
        this.tabContents()
      }
      .width('100%')
      .height('100%')
      .vertical(false)
      .barOverlap(true)
      .barFloatingStyle({
        adaptToHandedness: true,
        systemMaterial: this.isMaterialSupported
          ? ImmersiveMaterialGuard.floatingMaterial(true, true)
          : uiMaterial.Material.empty
      })
    }
    .width('100%')
    .height('100%')
    .title('首页', {
      systemMaterial: this.isMaterialSupported
        ? ImmersiveMaterialGuard.floatingMaterial(true, true)
        : uiMaterial.Material.empty,
      barStyle: BarStyle.STACK
    })
  }

  build() {
    if (this.isRuntimeApiAvailable) {
      this.api26Navigation()
    } else {
      this.sourceNavigation()
    }
  }
}

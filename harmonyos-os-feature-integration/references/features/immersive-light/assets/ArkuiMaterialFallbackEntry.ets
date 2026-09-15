import { uiMaterial } from '@kit.ArkUI';
import { ImmersiveMaterialGuard } from './ImmersiveMaterialGuard';

/**
 * ArkuiMaterialFallbackEntry.ets —— ArkUI 标题栏组件的版本、能力与普通样式回退骨架
 *
 * 来源：官方《开启沉浸光感》《组件适配沉浸光感》和 uiMaterial 能力查询示例。
 * 索引见 ../routes/arkui/assets.md。
 *
 * 重要边界：
 * - targetSdkVersion/compileSdkVersion 必须达到 26；compatibleSdkVersion 可以更低。
 * - API 26 以下先走 sourceControl()，不会求值 systemMaterial 或 Material.empty。
 * - API 26 设备不支持材质时，使用 Material.empty 明确关闭并保留普通样式。
 * - undefined 表示恢复组件在当前 MaterialState 下的默认行为，不是通用关闭值。
 * - 普通容器的 systemMaterial 只在官方允许的 Navigation/NavDestination 标题栏或
 *   底部横向悬浮 TabBar 内生效；本例将目标放在 Navigation 标题栏。
 * - Slider、Toggle Switch 等预设组件不使用本通用容器模式，按组件专属规则接入。
 * - 替换示例时，sourceControl() 必须保留目标工程接入前的组件树、状态、事件和样式。
 */
@ComponentV2
export struct ArkuiMaterialFallbackEntry {
  @Local private isRuntimeApiAvailable: boolean = ImmersiveMaterialGuard.isRuntimeApiAvailable();
  @Local private isMaterialSupported: boolean = ImmersiveMaterialGuard.isMaterialSupported();

  @Builder
  private sourceControl() {
    Column() {
      Text('接入前普通卡片')
        .fontSize(16)
    }
    .width(328)
    .height(56)
    .borderRadius(28)
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#F2F1F3F5')
    .border({ width: 1, color: '#1A000000' })
  }

  @Builder
  private api26Control() {
    Column() {
      Text('API 26 标题栏组件材质')
        .fontSize(16)
    }
    .width(328)
    .height(56)
    .borderRadius(28)
    .justifyContent(FlexAlign.Center)
    // 普通样式前置：能力不支持或全局关闭时仍保留可辨识背景。
    .backgroundColor('#F2F1F3F5')
    .border({ width: 1, color: '#1A000000' })
    // Material.empty 是明确关闭；不要用 undefined 代替业务上的显式关闭。
    .systemMaterial(this.isMaterialSupported
      ? ImmersiveMaterialGuard.regularMaterialForAllowedScope()
      : uiMaterial.Material.empty)
  }

  @Builder
  private titleContent() {
    if (this.isRuntimeApiAvailable) {
      this.api26Control()
    } else {
      this.sourceControl()
    }
  }

  build() {
    Navigation() {
      Column() {
        Text('页面内容')
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height('100%')
    .title({ builder: this.titleContent, height: 72 }, { barStyle: BarStyle.STACK })
  }
}

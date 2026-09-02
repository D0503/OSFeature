import { uiMaterial } from '@kit.ArkUI';
import { ImmersiveMaterialGuard } from './ImmersiveMaterialGuard';

/**
 * ArkuiMaterialFallbackEntry.ets —— ArkUI 通用组件的版本、能力与普通样式回退骨架
 *
 * 来源：官方《开启沉浸光感》《组件适配沉浸光感》和 uiMaterial 能力查询示例。
 * 索引见 ../routes/arkui/assets.md。
 *
 * 重要边界：
 * - targetSdkVersion/compileSdkVersion 必须达到 26；compatibleSdkVersion 可以更低。
 * - API 26 以下先走 sourceCard()，不会求值 systemMaterial 或 Material.empty。
 * - API 26 设备不支持材质时，使用 Material.empty 明确关闭并保留普通样式。
 * - undefined 表示恢复组件在当前 MaterialState 下的默认行为，不是通用关闭值。
 * - Slider、Toggle Switch 等预设组件不使用本通用卡片模式，按组件专属规则接入。
 * - 替换示例时，sourceCard() 必须保留目标工程接入前的组件树、状态、事件和样式。
 */
@ComponentV2
export struct ArkuiMaterialFallbackEntry {
  @Local private isRuntimeApiAvailable: boolean = ImmersiveMaterialGuard.isRuntimeApiAvailable();
  @Local private isMaterialSupported: boolean = ImmersiveMaterialGuard.isMaterialSupported();

  @Builder
  private sourceCard() {
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
  private api26Card() {
    Column() {
      Text('API 26 通用组件材质')
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
      ? ImmersiveMaterialGuard.cardMaterial()
      : uiMaterial.Material.empty)
  }

  build() {
    Column({ space: 24 }) {
      Text('ArkUI 沉浸光感降级骨架')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)

      if (this.isRuntimeApiAvailable) {
        this.api26Card()
      } else {
        this.sourceCard()
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}

import { uiMaterial } from '@kit.ArkUI';
import { ImmersiveMaterialGuard } from './ImmersiveMaterialGuard';

/**
 * ArkuiMaterialFallbackEntry.ets —— ArkUI 沉浸式系统材质两种降级适配模式（页面级演示）
 *
 * 来源：官方《@ohos.arkui.uiMaterial》API 参考示例5（查询材质等级与是否支持沉浸式材质）
 * 蒸馏。该示例给出两种"支持与不支持设备复用同一棵组件树"的官方写法，本资产将其
 * 固化为可复制模式；配套门禁与场景材质工厂见 ImmersiveMaterialGuard.ets，
 * 索引见 ../assets-catalog.md。
 *
 * 模式1（条件双写）：
 *   .backgroundColor(isSupported ? Color.Transparent : '降级背景色')
 *   .systemMaterial(isSupported ? new ImmersiveMaterial({...}) : undefined)
 *   - 写法直观，分支可扩展到任意属性组合，适合需要按能力差异化更多样式的区域；
 *   - 背景色写在 systemMaterial 之前：支持材质的低算力设备上材质自带背景色最终生效。
 *
 * 模式2（单树后置覆盖，无条件分支）：
 *   .backgroundColor($r('sys.color.xxx'))   // 前置：不支持设备上的降级样式
 *   .systemMaterial(new ImmersiveMaterial({ style, materialColor }))  // 后置：支持设备覆盖
 *   - 依据官方覆盖规则：材质影响的通用属性冲突时"除阴影外后设置的生效"——
 *     高/中算力设备后置材质把背景色清为透明，低算力设备材质自带背景色（materialColor）覆盖背景色；
 *     不支持沉浸式材质的设备上材质不覆盖任何通用属性，前置背景色自然保留。
 *   - 适合 compatibleSdkVersion < 26 的工程做最小改动接入：不引入组件树分支，
 *     旧设备继续走接入前样式；颜色统一由 materialColor 承载，不再另设背景逻辑。
 *
 * 使用边界：
 * - 仅适用于 API 26 路线（uiMaterial @since 26）；本页面资产演示的是属性级降级，
 *   不承担 API 26 以下整树版本降级（那是 HdsMaterialGuard/HDS 资产的职责）。
 * - isSupported 由设备决定且运行期不变，在成员初始化时求值一次即可。
 * - materialColor 必须带透明度；纯不透明颜色会把材质滤镜完全遮挡。
 * - 应用级 MaterialState.DISABLE 时显式 systemMaterial 不生效，两种模式均回到降级样式。
 * - 替换真实业务时保留降级背景、边框等普通样式，不得以材质作为唯一视觉表达。
 */
@ComponentV2
export struct ArkuiMaterialFallbackEntry {
  /** 官方注明设备能力运行期不变：成员初始化时求值一次并复用 */
  @Local isSupported: boolean = ImmersiveMaterialGuard.isMaterialSupported();
  /** 模式1 使用的能力态材质；不支持设备传 undefined（恢复无材质效果） */
  @Local conditionalMaterial: uiMaterial.ImmersiveMaterial | undefined =
    ImmersiveMaterialGuard.isMaterialSupported() ?
      ImmersiveMaterialGuard.cardMaterial() : undefined;

  build() {
    Column({ space: 24 }) {
      Text('ArkUI 沉浸式系统材质降级模式')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)

      // ── 模式1：条件双写 ─────────────────────────────────────────────
      // 支持设备：透明背景 + 材质；不支持设备：降级背景色 + undefined（无材质）
      Column() {
        Text('模式1 条件双写（卡片 REGULAR）')
          .fontSize(16)
      }
      .width(328)
      .height(56)
      .borderRadius(28)
      .justifyContent(FlexAlign.Center)
      .backgroundColor(this.isSupported ? Color.Transparent : '#F2F1F3F5')
      .systemMaterial(this.conditionalMaterial)

      // ── 模式2：单树后置覆盖 ─────────────────────────────────────────
      // 前置背景色即降级样式；后置材质在支持设备上按官方覆盖规则接管显示。
      // materialColor 承载颜色：高/中算力为滤镜叠色，低算力作为背景色，
      // 不支持设备上前置背景色保留（材质不覆盖任何通用属性）。
      Column() {
        Text('模式2 单树后置覆盖（统一颜色）')
          .fontSize(16)
          .fontColor($r('sys.color.font_on_primary'))
      }
      .width(328)
      .height(56)
      .borderRadius(28)
      .justifyContent(FlexAlign.Center)
      .backgroundColor($r('sys.color.comp_background_emphasize'))
      .systemMaterial(new uiMaterial.ImmersiveMaterial({
        style: uiMaterial.ImmersiveStyle.REGULAR,
        materialColor: $r('sys.color.comp_background_emphasize')
      }))
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}

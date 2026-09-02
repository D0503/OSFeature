import { deviceInfo } from '@kit.BasicServicesKit';
import { uiMaterial } from '@kit.ArkUI';

/**
 * ImmersiveMaterialGuard.ets —— ArkUI 沉浸式系统材质运行时门禁与场景材质工厂
 *
 * 来源：官方《开启沉浸光感》《组件适配沉浸光感》与《@ohos.arkui.uiMaterial》
 * API 参考中的能力查询、组件参数与降级规则。
 * 与 HDS 路线的 HdsMaterialGuard.ets 对称，索引见 ../routes/arkui/assets.md。
 *
 * 职责边界：只回答"当前设备能不能用 ArkUI 沉浸式系统材质"和"常见场景的材质参数用什么"，
 * 不做页面布局、不做弹窗 Options 适配（弹窗入口在 ../routes/arkui/implementation.md 的适配器模式中
 * 按明确 Options 类型分别封装）。
 *
 * 关键版本与能力事实（官方开发指导与 API 参考）：
 * - uiMaterial 模块、ImmersiveMaterial、isImmersiveMaterialSupported：@since 26.0.0，
 *   @stagemodelonly。API 23～25 工程不得引用本资产，应走 HDS 路线。
 * - targetSdkVersion 与 compileSdkVersion 必须达到 26；compatibleSdkVersion 可以更低。
 * - API 26 以下的整树版本降级使用低版本可用的 deviceInfo.sdkApiVersion，
 *   不把 API 26 才存在的 apiAvailable 作为最外层保护。
 * - isImmersiveMaterialSupported() / getGlobalMaterialLevel() 官方注明"由设备决定、
 *   应用运行后不会改变"：可在页面字段初始化时求值一次并复用，不必逐帧调用。
 * - 不支持沉浸式材质的设备上设置 ImmersiveMaterial 不报错、无效果，且不覆盖任何
 *   通用属性——降级样式（背景色、边框）会自动保留。
 * - 应用级 MaterialState.DISABLE 时，显式 systemMaterial 也不生效。
 *
 * materialColor 使用注意：
 * - 必须带透明度；纯不透明颜色会把材质滤镜完全遮挡。
 * - 高/中算力设备为滤镜叠色；低算力设备上作为 backgroundColor 生效，
 *   是"所有算力档位统一颜色"的官方承载方式（此时不再另设 backgroundColor）。
 */
export class ImmersiveMaterialGuard {
  /** ArkUI 沉浸式系统材质路线（uiMaterial/systemMaterial）的最低 API */
  public static readonly ARKUI_MIN_API_VERSION: number = 26;

  /** 当前运行设备是否已达到 ArkUI 沉浸光感接口版本。 */
  public static isRuntimeApiAvailable(): boolean {
    return deviceInfo.sdkApiVersion >= ImmersiveMaterialGuard.ARKUI_MIN_API_VERSION;
  }

  /**
   * 当前设备是否可用 ArkUI 沉浸式系统材质。
   * 版本（sdkApiVersion）与设备能力（isImmersiveMaterialSupported）双重判断；
   * 结果运行期不变，可在页面成员初始化时调用一次。
   */
  public static isMaterialSupported(): boolean {
    return ImmersiveMaterialGuard.isRuntimeApiAvailable() &&
      uiMaterial.isImmersiveMaterialSupported();
  }

  /** 浮动工具栏、悬浮按钮：超薄高透明（官方推荐场景） */
  public static floatingMaterial(interactive: boolean, enableLightEffect: boolean): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.ULTRA_THIN, interactive, enableLightEffect);
  }

  /** 搜索框、轻量提示：薄、较高透明 */
  public static searchMaterial(interactive: boolean): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.THIN, interactive, false);
  }

  /** 卡片、通用内容区域：常规厚度 */
  public static cardMaterial(): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.REGULAR, false, false);
  }

  /** 菜单：较强模糊 */
  public static menuMaterial(): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.THICK, false, false);
  }

  /** 弹窗、需要明显遮挡背景的区域：最强模糊 */
  public static dialogMaterial(): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.ULTRA_THICK, false, false);
  }

  // ToggleType.Switch、Slider 等组件使用内部预设视觉参数时，不使用上述场景工厂
  // 推断最终 style/interactive/lightEffect；按组件文档只传入开启标记。

  /**
   * 所有算力档位统一颜色的材质：materialColor 承载颜色（低算力作背景色），
   * 不再设置 backgroundColor。color 必须带透明度。
   */
  public static tintedMaterial(style: uiMaterial.ImmersiveStyle, color: ResourceColor): uiMaterial.ImmersiveMaterial {
    return new uiMaterial.ImmersiveMaterial({
      style: style,
      materialColor: color
    });
  }
}

/** 内部构造器：interactive/lightEffect 缺省时保持系统默认（false/undefined） */
class ImmersiveMaterialGuardImpl {
  static create(style: uiMaterial.ImmersiveStyle, interactive: boolean,
    enableLightEffect: boolean): uiMaterial.ImmersiveMaterial {
    const options: uiMaterial.ImmersiveOptions = {
      style: style,
      interactive: interactive
    };
    if (enableLightEffect) {
      // { color: undefined } 表示启用流光反馈并使用默认白色（官方示例写法）
      options.lightEffect = { color: undefined };
    }
    return new uiMaterial.ImmersiveMaterial(options);
  }
}

import { deviceInfo } from '@kit.BasicServicesKit';
import { uiMaterial } from '@kit.ArkUI';

/**
 * ImmersiveMaterialGuard.ets —— ArkUI 沉浸式系统材质运行时门禁与场景材质工厂
 *
 * 使用索引见 ../routes/arkui/assets.md。
 *
 * 职责边界：只回答"当前设备能不能用 ArkUI 沉浸式系统材质"和"常见场景的材质参数用什么"，
 * 不做页面布局、不做弹窗 Options 适配（弹窗入口在 ../routes/arkui/implementation.md 的适配器模式中
 * 按明确 Options 类型分别封装）。
 *
 * 关键版本与能力约束：
 * - uiMaterial 模块、ImmersiveMaterial、isImmersiveMaterialSupported：@since 26.0.0，
 *   @stagemodelonly。API 23～25 工程不得引用本资产，应走 HDS 路线。
 * - targetSdkVersion 与 compileSdkVersion 必须达到 26；compatibleSdkVersion 可以更低。
 * - 兼容 API 26 以下时使用低版本可用的 deviceInfo.sdkApiVersion 保护新增调用，
 *   仅材质变化时复用原组件；组件、布局或导航结构变化时使用组件树分支，
 *   不把 API 26 才存在的 apiAvailable 作为最外层保护。
 * - isImmersiveMaterialSupported() / getGlobalMaterialLevel() 由设备决定，
 *   应用运行后不会改变：在应用启动完成、退出启动加载页后查询一次并复用，不必逐帧调用。
 *   不得在模块加载、静态/成员字段初始化或启动加载页中提前查询。
 * - 不支持沉浸式材质的设备上设置 ImmersiveMaterial 不报错、无效果，且不覆盖任何
 *   通用属性——降级样式（背景色、边框）会自动保留。
 * - 应用级 MaterialState.DISABLE 时，显式 systemMaterial 也不生效。
 *
 * materialColor 使用注意：
 * - 必须带透明度；纯不透明颜色会把材质滤镜完全遮挡。
 * - 高/中算力设备为滤镜叠色；低算力设备上作为 backgroundColor 生效，
 *   是"所有算力档位统一颜色"的承载方式（此时不再另设 backgroundColor）。
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
   * 调用方须确认应用已启动完成且已退出启动加载页；本方法只检查版本与能力，
   * 不检测启动就绪状态。就绪后调用一次并复用结果。
   */
  public static isMaterialSupported(): boolean {
    return ImmersiveMaterialGuard.isRuntimeApiAvailable() &&
      uiMaterial.isImmersiveMaterialSupported();
  }

  /** 顶部浮动工具栏、悬浮按钮：超薄高透明（底部悬浮 TabBar 的系统默认是 THIN） */
  public static floatingMaterial(interactive: boolean, enableLightEffect: boolean): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.ULTRA_THIN, interactive, enableLightEffect);
  }

  /** 搜索框、轻量提示：薄、较高透明 */
  public static searchMaterial(interactive: boolean): uiMaterial.ImmersiveMaterial {
    return ImmersiveMaterialGuardImpl.create(uiMaterial.ImmersiveStyle.THIN, interactive, false);
  }

  /** 合法生效区域中的常规厚度材质；调用前必须核对组件矩阵的 effectScopes */
  public static regularMaterialForAllowedScope(): uiMaterial.ImmersiveMaterial {
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
      // { color: undefined } 表示启用流光反馈并使用默认白色
      options.lightEffect = { color: undefined };
    }
    return new uiMaterial.ImmersiveMaterial(options);
  }
}

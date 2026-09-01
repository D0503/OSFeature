import { deviceInfo } from '@kit.BasicServicesKit';
import { hdsMaterial, SystemMaterialParams } from '@kit.UIDesignKit';

/**
 * HdsMaterialGuard.ets —— HDS 沉浸光感运行时门禁与材质参数工厂
 *
 * 来源：能力包形成阶段完成的运行时版本门禁验证与三组悬浮 Tab 迁移对照快照。
 * 原始工程不随 Skill 分发，本资产已经固化后续接入所需的版本判断模式。
 * 配套页面级资产见 FloatingTabsMainEntry.ets，索引见 ../routes/hds/assets.md。
 *
 * 职责边界：只回答"当前设备能不能用 HDS 材质"和"材质参数用什么"，
 * 不做页面布局、不做属性级屏蔽。整树降级分支由页面资产负责。
 *
 * 关键版本事实（SDK d.ts 证据，E:\DevEco Studio\sdk\default\openharmony\ets\api\@ohos.deviceInfo.d.ts）：
 * - deviceInfo.sdkApiVersion：@since 8。低版本设备始终可用，是降级开关的唯一安全选择。
 * - deviceInfo.apiAvailable：@since 26.0.0。在 API 23 以下设备上该函数不存在，用它做
 *   降级开关可能在恰好需要降级的设备上调用不存在的函数。禁止用于
 *   API 26 以下的版本判断；仅 API 26 路线（uiMaterial）的调用保护可使用
 *   deviceInfo.apiAvailable('26.0.0')。
 * - hdsMaterial / systemMaterialEffect / barFloatingStyle：API 23 起。
 *   HdsTabs 组件本身 since 20、HdsNavigation/HdsNavDestination since 18：
 *   组件可用不等于材质能力可用，不能用组件 since 代替本门禁。
 *
 * 使用边界：
 * - compatibleSdkVersion >= 23 的工程可省略 isHdsSupported() 分支
 *   （三组迁移对照均直接把 compatibleSdkVersion 抬到 23，不做降级分支）；
 * - compatibleSdkVersion < 23 且要覆盖低版本设备时，页面用 isHdsSupported()
 *   做整树 if/else 降级（HDS 分支 ↔ 原生 Tabs/NavDestination 分支）；
 * - 自定义材质档位前先调用 hdsMaterial.getSystemMaterialTypes() 查询设备能力，
 *   不支持 IMMERSIVE 的设备降级 SMOOTH；普通业务保持 ADAPTIVE + ADAPTIVE。
 */
export class HdsMaterialGuard {
  /** HDS 沉浸光感能力（hdsMaterial/systemMaterialEffect/barFloatingStyle）的最低 API */
  public static readonly HDS_MIN_API_VERSION: number = 23;

  /**
   * 当前设备是否支持 HDS 沉浸光感。
   * 注意：必须用 sdkApiVersion（@since 8），不得换成 apiAvailable（@since 26）。
   */
  public static isHdsSupported(): boolean {
    return deviceInfo.sdkApiVersion >= HdsMaterialGuard.HDS_MIN_API_VERSION;
  }

  /** 系统自适应材质参数：跟随系统策略与设备算力自动降级，普通业务默认值 */
  public static getSystemMaterialParams(): SystemMaterialParams {
    return {
      materialType: hdsMaterial.MaterialType.ADAPTIVE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
    };
  }
}

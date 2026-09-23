# 兼容性与前置条件

## 版本、模型和权限

| 路线 | SDK/compile | 运行时调用条件 | 权限 |
|---|---|---|---|
| 系统组件原生适配（如 HDS） | 当前 HdsTabs 实例 API 23+ | 当前组件的版本、SysCap 和硬件约束 | 原生属性文档未声明需应用手动订阅 motion；不能由混合示例清单推断原生路线必须申请感知权限 |
| 操作手 | API 15+ | API 15+，Motion SysCap；设备仍可能返回 801 | API 15–19: ACTIVITY_MOTION；API 20+: ACTIVITY_MOTION 或 DETECT_GESTURE |
| 握持手 | API 20+ | API 20+，Motion SysCap；设置中存在智感握姿开关，支持机型真机验证 | DETECT_GESTURE |

导入 motion 使用 `@kit.MultimodalAwarenessKit`。动作感知系统能力为 `SystemCapability.MultimodalAwareness.Motion`；HdsTabs 为 `SystemCapability.UIDesign.HDSComponent.Core`。同一个 Motion SysCap 从早期接口即存在，不能用它替代 API 20 的握持手版本判断。

本包支持 Stage 普通应用的 entry/feature HAP 接入；库代码定位到最终 HAP 配置权限。元服务、其他模型或未列出的设备支持待确认。

先验证本机 `sdk-pkg.json`，再检查 compile/compatible。三条路线没有已确认的独立 target 门槛，采用 `targetSdkPolicy: preserve-unless-declared`；示例 target/compatible 23 不是所有路线必须升级到 23 的要求。SDK/compile 过低时提供对应路线的升级选项，保留原 target/compatible。compatible 低于所选路线时，保护整个新调用路径。

ACTIVITY_MOTION 声明和用户授权必须均满足，复用应用现有授权流程，拒绝后保留原功能。DETECT_GESTURE 的目标发行版授权方式需在接入时核对，不无条件添加用户弹窗。权限资源名与 usedScene 的 Ability 必须取实际工程。API 15–19 不因声明 DETECT_GESTURE 就获得操作手权限；若仅使用该权限，增强分支需限定 API 20+，更低系统继续原路径。

## 设备与环境

握持手：部分机型支持；系统“设置—系统”中无智感握姿开关的设备可能返回 801。设备需亮屏解锁；保护壳不厚于 3mm，手指与掌心自然充分接触，手套会降低准确率；每根接触手指理想接触面积不低于 30mm²。竖屏摄像头朝上、屏幕朝握持人，不同时触碰桌面或其他身体部位。支持横屏正常握持，但应用方向与握持方向不一致的异常姿态不能保证识别。设备运动时未握持识别不能保证成功。

操作手：首次订阅或换手后需连续点击数次才上报；屏幕边缘 8mm 内、指关节、窗口旋转、多指同时操作不是有效验证方式。不能把“点击左侧”等同于“识别为左手”。

原生组件：HdsTabs 悬浮属性 API 23 起，TV 无效果；其他类型可调用不代表每台设备具备左右跟手硬件。示例列出的手机、折叠屏和平板只是验证候选，不是支持机型白名单。

无需由此功能增加后台运行权限、账号、联网依赖或特殊签名。设备实际能力、系统关闭后的通知方式及尚未确认的支持范围均需实测；不杜撰系统开关查询 API，也不把模拟器静态成功当作真机识别成功。

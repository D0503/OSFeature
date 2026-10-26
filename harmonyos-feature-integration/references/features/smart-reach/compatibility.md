# 兼容性与前置条件

## 版本、模型和权限

| 路线 | SDK/compile | 运行时调用条件 | 权限 |
|---|---|---|---|
| 系统组件原生适配（如 HDS） | 当前 HdsTabs 实例 API 23+ | 当前组件的版本、SysCap 和硬件约束 | 无需声明感知权限 |
| 操作手 | API 15+ | API 15+，Motion SysCap；设备仍可能返回 801 | API 15–19: ACTIVITY_MOTION；API 20+: ACTIVITY_MOTION 或 DETECT_GESTURE |
| 握持手 | API 20+ | API 20+，Motion SysCap；设置中存在智感握姿开关，支持机型真机验证 | DETECT_GESTURE |

导入 motion 使用 `@kit.MultimodalAwarenessKit`。动作感知系统能力为 `SystemCapability.MultimodalAwareness.Motion`；HdsTabs 为 `SystemCapability.UIDesign.HDSComponent.Core`。同一个 Motion SysCap 从早期接口即存在，不能用它替代 API 20 的握持手版本判断。

本包支持 Stage 普通应用的 entry/feature HAP 接入；库代码定位到最终 HAP 配置权限。元服务、其他模型或未列出的设备支持待确认。

先验证本机 sdk-pkg.json，再检查 compile/target/compatible。版本升级遵循[通用兼容性规则](../../shared/compatibility-model.md#升级接入对所有特性通用)。三条路线分别按实际使用要求判定，不统一套用示例的 API 23。compatible 低于所选路线时保护整个新调用路径。

操作手与握持手路线须在实际承载功能的 HAP 模块 `src/main/module.json5` 的 `module.requestPermissions` 中声明对应权限。API 15–19 不因声明 DETECT_GESTURE 就获得操作手权限；若仅使用该权限，增强分支需限定 API 20+，更低系统继续原路径。

`DETECT_GESTURE` 只需在所属 HAP 声明，无需运行时请求授权；声明中填写实际用途的 `reason` 和 `usedScene`。原生组件路线无需声明感知权限。握持手路线的声明示例，合并到模块现有配置：

```json5
requestPermissions: [
  {
    name: 'ohos.permission.DETECT_GESTURE',
    reason: '$string:gesture_reason',
    usedScene: {
      abilities: ['EntryAbility'],
      when: 'inuse'
    }
  }
]
```

`gesture_reason` 指向模块内的字符串资源，例如在 `src/main/resources/base/element/string.json` 的现有 `string` 数组中添加 `{ "name": "gesture_reason", "value": "用于感知握持手，使操作按钮随左右手调整位置" }`；`EntryAbility` 替换为实际 Ability。仅声明和配置用途字段，不为此权限调用 `requestPermissionsFromUser`。

操作手覆盖 API 15–19 时声明 `ohos.permission.ACTIVITY_MOTION`；API 20+ 若选择该权限也使用相同规则。它属于 `user_grant`：声明需配置 `reason` 和 `usedScene`，并在访问操作手接口前获得用户授权。`user_grant` 是权限类型，不写入 `requestPermissions` 对象：

```json5
requestPermissions: [
  {
    name: 'ohos.permission.ACTIVITY_MOTION',
    reason: '$string:activity_motion_reason',
    usedScene: {
      abilities: ['EntryAbility'],
      when: 'inuse'
    }
  }
]
```

`reason` 引用模块可解析的字符串资源，例如在 `src/main/resources/base/element/string.json` 的现有 `string` 数组中添加：

```json
{
  "name": "activity_motion_reason",
  "value": "用于感知操作手，使操作按钮随左右手调整位置"
}
```

`usedScene.abilities` 替换为实际使用感知能力的 Ability 名称，与当前模块声明一致；不能直接照搬示例名称。页面可见期感知使用 `when: 'inuse'`。权限用途文案按实际功能填写，并按工程现有多语言资源维护。

操作手路线如选择 `DETECT_GESTURE`（仅 API 20+），按上述格式声明该权限，不执行 `ACTIVITY_MOTION` 的授权流程。多路线组合合并所需权限并去重。

## 设备与环境

握持手：部分机型支持；系统“设置—系统”中无智感握姿开关的设备可能返回 801。设备需亮屏解锁；保护壳不厚于 3mm，手指与掌心自然充分接触，手套会降低准确率；每根接触手指理想接触面积不低于 30mm²。竖屏摄像头朝上、屏幕朝握持人，不同时触碰桌面或其他身体部位。支持横屏正常握持，但应用方向与握持方向不一致的异常姿态不能保证识别。设备运动时未握持识别不能保证成功。

操作手：首次订阅或换手后需连续点击数次才上报；屏幕边缘 8mm 内、指关节、窗口旋转、多指同时操作不是有效验证方式。不能把“点击左侧”等同于“识别为左手”。

原生组件：HdsTabs 悬浮属性 API 23 起，TV 无效果；其他类型可调用不代表每台设备具备左右跟手硬件。示例列出的手机、折叠屏和平板只是验证候选，不是支持机型白名单。

无需由此功能增加后台运行权限、账号、联网依赖或特殊签名。设备实际能力、系统关闭后的通知方式及尚未确认的支持范围均需实测；不杜撰系统开关查询 API，也不把模拟器静态成功当作真机识别成功。

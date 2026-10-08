# 操作手感知

SDK/compile API 15+，导入 `motion`，在调用前检查运行 API 与 `SystemCapability.MultimodalAwareness.Motion`，按 [兼容性](../../compatibility.md) 完成权限声明。API 15–19 使用 ACTIVITY_MOTION；API 20+ 可用两种权限之一。不能因为 compatible 低于 20 就只声明 DETECT_GESTURE 并继续在 15–19 调用。

选用 `ACTIVITY_MOTION` 时，在首次访问操作手接口前调用 `abilityAccessCtrl.createAtManager().requestPermissionsFromUser(...)`；只有 `authResults[0] === 0` 才订阅或查询操作手。页面不可见或功能已关闭时不再启动感知，授权中避免重复请求。拒绝、授权调用异常或页面离开时保留原布局与原功能，并记录诊断；不在失败后循环弹出授权框。示意代码中的页面状态与方法名按现有工程替换：

```arkts
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit'
import { BusinessError } from '@kit.BasicServicesKit'

private requestOperatingHandPermission(): void {
  if (this.permissionRequesting || this.permissionDenied || !this.pageVisible || !this.featureEnabled) {
    return
  }
  this.permissionRequesting = true
  try {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext
    const atManager = abilityAccessCtrl.createAtManager()
    const permissions: Array<Permissions> = ['ohos.permission.ACTIVITY_MOTION']
    atManager.requestPermissionsFromUser(context, permissions).then((result) => {
      this.permissionRequesting = false
      if (result.authResults.length > 0 && result.authResults[0] === 0) {
        if (this.pageVisible && this.featureEnabled) {
          this.subscribeOperatingHand()
        }
      } else {
        this.permissionDenied = true
        // 保留原布局与原功能，记录拒绝结果。
      }
    }).catch((err: BusinessError) => {
      this.permissionRequesting = false
      // 保留原布局与原功能，记录 err.code 和 err.message。
    })
  } catch (err) {
    this.permissionRequesting = false
    // 保留原布局与原功能，记录同步异常。
  }
}
```

在发起请求前先完成运行 API 与 Motion SysCap 检查；异步获准后，`subscribeOperatingHand()` 内仍需复核当前页面状态、版本与能力并用 `try/catch` 处理 201、801 和服务错误。仅查询最近操作手时，在获准后执行查询而非订阅。选用 `DETECT_GESTURE` 且运行 API 20+ 时只需声明，无需上述授权调用。

- `motion.on('operatingHandChanged', callback)`：订阅操作手变化。
- `motion.off('operatingHandChanged', callback)`：按[共同约束](../../implementation.md#自定义路径的共同约束)退订；仅使用 DETECT_GESTURE 的路径须守卫 API 20+，其他操作手路径守卫 API 15+。
- `motion.getRecentOperatingHandStatus()`：同步读取最近状态，不需要先订阅；需要相同权限、版本与错误处理。单次查询路线无需为了满足检查而添加 on/off。

`OperatingHandStatus`：UNKNOWN_STATUS=0、LEFT_HAND_OPERATED=1、RIGHT_HAND_OPERATED=2。只有后两者驱动左右位置，不把未知值当右手。需要首次状态时可在启用后使用最近状态，但它不是握持手状态，也不能保证是本次最新动作。

按 [共同生命周期规则](../../implementation.md) 连接页面实际可见期，在所属 HAP 声明对应权限，并处理调用异常。

初次或换手后的多次触控才可能上报；排除边缘 8mm、窗口旋转、多指、指关节。不可把这一路线作为握持手 API 20 的自动低版本替代。读 [资产](assets.md) 和 [验证](validation.md)。

# 防窥工具资产

## 复制与导入

将[AntiPeepUtils.ets](assets/AntiPeepUtils.ets)复制到实际工程的工具目录，按[开发步骤](implementation.md)在页面导入所需函数。文件使用 `hilog`，domain 为 `0x0000`、标签为 `AntiPeepUtils`，不依赖其他本地工具文件。

完整文件需要 API23 编译 SDK。API20/21 工程仅提取所需版本的函数和导入，移除较新方法与类型引用。实际调用前还需检查运行 API 和设备能力，完成[权限声明与 ACL](compatibility.md#权限声明与-acl)。

## 导出接口

| 接口 | 输入与返回 | 页面处理 |
|---|---|---|
| `AntiPeepCallback` | `onStatusChanged(status): Promise<void>` | 通知与初始状态共用同一处理方法 |
| `canUseAntiPeep()` | 返回是否支持 SysCap | 不支持时提示并结束初始化 |
| `isAntiPeepOn()` | `Promise<boolean>`；关闭、不支持或异常返回 false | 不继续订阅，具体原因查看日志 |
| `getAntiPeepInfo()` | 同步返回窥视状态枚举；不支持或异常返回 `undefined` | PASS 恢复内容，HIDE 隐藏内容，`undefined` 保留既有显示策略 |
| `listenOnAntiPeepStatus(antiPeepCB)` | 成功返回 true，失败或不支持返回 false | 用返回值更新订阅标志，避免重复注册 |
| `listenOffAntiPeepStatus()` | 无返回值，内部捕获异常并记录日志 | 退出时调用；取消该事件全部回调 |
| `showSystemMaskLayer(windowId)` | `Promise<boolean>`；输入为目标窗口的正整数 ID | API21 起，按返回值记录是否成功触发 |
| `requestAntiPeepOptions(context)` | 输入 `common.UIAbilityContext`，返回 `Promise<AntiPeepOptionsResult>` | API23 起，SUCCESS、ALREADY_ON 后重新初始化，FAIL 保留失败反馈 |

`listenOnAntiPeepStatus` 在内部创建转发回调。需要与其他订阅者共存时，应保存实际注册的回调并使用 API 的可选 callback 参数退订，不能将页面外层的 `AntiPeepCallback` 对象作为底层回调直接传入。

`showSystemMaskLayer` 的 Promise 拒绝分支先返回 false，后续 `then` 仍可能输出成功日志；应以返回值判断结果，不以成功日志认定蒙层生效。蒙层失败不恢复已隐藏的内容。

## API23 用户设置入口

从工具文件导入 `requestAntiPeepOptions`，在运行 API23 与 SysCap 检查通过后调用。完整页面导入、重复点击保护、结果处理和状态重查见[主动开启步骤](implementation.md#可选用户主动开启防窥)。只在接入该入口时定义 `isRequestingAntiPeep`。

封装正常返回时保留底层结果；底层异常会被捕获、记录到 `AntiPeepUtils` 日志并转换为 FAIL。页面不能通过 catch 再获取这些错误码。未设置人脸识别等原因从日志定位；结果枚举和错误处理见[设置与提示](settings-and-information.md)。

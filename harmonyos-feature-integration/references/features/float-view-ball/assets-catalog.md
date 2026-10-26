# 窗球代码资产

以下包含可复制的工具文件和合入现有所有者的方法片段，非完整业务工程。所有调用入口需完成[权限与设备门禁](compatibility.md)，并串行执行，复用真实 UIAbilityContext、页面、Want 与业务内容。运行版本/SysCap 检查在调用前执行；编译 SDK 也必须能解析导入符号。

## 闪控窗

使用 [FloatViewController.ets](assets/FloatViewController.ets)，按[闪控窗路线](routes/float-view.md)调用静态方法。类持有独立闪控窗控制器和状态，权限声明、ACL 申请及用户授权由调用方完成。

| 方法 | 用途 |
|---|---|
| `canUseFloatView()` | 分步检查 API26、SysCap、设备能力，异常返回 false |
| `createFloatView(config, onStateChange?, onLimitsChange?, onRectChange?)` | 原样传入 FloatViewConfiguration 创建控制器并注册监听，业务回调可选 |
| `setUIContent(page, storage?)` | 单独加载页面，可传 LocalStorage |
| `prepareFloatView(page, size, storage?)` | 仅加载页面、设置尺寸，不启动，返回 Promise<void> |
| `startFloatView(page?, size?, storage?)` | 同时传入页面和尺寸时先准备再启动；无参时直接启动已准备的窗 |
| `setWindowSize(size)` | 原样传入 window.Size 更新尺寸 |
| `switchTemplate(property)` | 原样传入 TemplateProperty 更新模板与尺寸 |
| `restoreMainWindow(wantParameters?)` | STARTED 时从用户点击恢复主窗口 |
| `getFloatViewLimits(template)` | 获取模板尺寸限制，失败记录日志并返回 null |
| `getFloatViewProperties()` | 获取有效窗口属性，失败记录日志并返回 undefined |
| `registerStateChangeCallback(state, callback)` / `unRegisterStateChangeCallback()` | 按指定状态注册业务回调；同状态覆盖，退订全部此类业务回调 |
| `registerLimitsChangeCallback(callback)` / `UnRegisterLimitsChangeCallback(callback?)` | 注册尺寸限制回调，按原回调或全部退订 |
| `onRectChangeCallback(callback)` / `offRectChangeCallback(callback?)` | 注册矩形变化回调，按原回调或全部退订 |
| `getWindowProperties()` | 同步读取有效窗口的属性；未启动、停止或异常状态抛错 |
| `stopFloatView()` | 发出停止请求，STOPPED 时退订并清空引用 |

创建、页面准备、启动、尺寸／模板设置、恢复和停止返回 Promise<void>，错误交给调用方处理；监听注册和退订为同步 void 方法，查询返回表中类型。启动和停止最终状态仍以 STARTED／STOPPED 为准。状态和尺寸限制监听始终注册，矩形监听按可选回调注册；STOPPED 清理完成后调用业务状态回调。业务可用独立方法补充监听；状态退订只清除 registerStateChangeCallback 注册的业务回调，保留内部生命周期监听及创建时传入的状态回调。STOPPED 时统一退订全部监听并清除状态业务回调。页面不需要另存控制器引用。

页面路径必须写入宿主 pages profile。参数不补业务默认值，尺寸由调用方根据当前模板限制选择。注册监听失败尝试退订；加载或启动失败保留控制器供重试，停止失败不清空引用。创建等操作需串行执行，具体权限、失败清理及前台条件见路线。

显示内容用原工程页面；独立小页可使用以下骨架，把 `content` 接到现有状态：

```arkts
@Entry
@ComponentV2
struct FloatContent {
  @Local content: string = '';
  build() {
    Column() { Text(this.content) }
    .width('100%')
    .height('100%')
  }
}
```

尺寸按 `getFloatViewLimits(templateType)`、`onLimitsChange`、`onRectChange` 的实际 px 与比例限制处理；不在通用资产中固定尺寸。跨包页面按 `setUIContextByName` 对接原工程命名路由。

## 闪控球

使用 [FloatingBallController.ets](assets/FloatingBallController.ets)，按[闪控球路线](routes/floating-ball.md)调用静态方法。类持有球控制器和状态，业务无需传入控制器。

| 方法 | 用途 |
|---|---|
| `canUseFloatingBall()` | 分步检查 API20、SysCap、设备能力，异常返回 false |
| `createFloatingBall(config, onClick?, onStateChange?, want?)` | 创建控制器并注册监听，业务回调和 Want 可选 |
| `startFloatingBall(startParams)` | 原样传入 FloatingBallParams 启动 |
| `updateFloatingBall(updateParams)` | 原样传入 FloatingBallParams 更新 |
| `stopFloatingBall()` | 发出停止请求，STOPPED 时退订并清空类中引用 |

异步操作返回 Promise<void>，错误交给调用方；实际启动和停止以状态通知为准。点击时有 Want 才恢复主窗口，可选点击回调不等待恢复完成。STOPPED 清理后执行业务状态回调。注册失败尝试退订；启动或停止失败保留引用用于重试。参数验证、权限、前台条件和防重复操作由业务处理。

图标解码使用[球路线中的独立资源片段](routes/floating-ball.md#5-加载图标)，与控制器生命周期分开管理。

## 绑定

使用 [FloatViewBallController.ets](assets/FloatViewBallController.ets)，复用同目录两个基础资产，按[绑定路线](routes/binding.md)分步调用：prepare → bind → start('view' 或 'ball') → stop → 双端 STOPPED → release。unbind 为可选的显式解绑操作，成功后自动释放。未绑定准备失败用 release 清理。所有操作返回 Promise<void>，使用 async/await 与 hilog。

prepare 的参数为窗配置、球配置、页面路径、window.Size、可选 LocalStorage、可选 FloatViewBallCallbacks；bind 直接接收 FloatingBallParams。组合层直接使用基础资产的控制器字段，已有独立实例时先清理原流程，由业务入口防止重复点击及并发操作；不在基础窗、球资产中增加绑定依赖。尚未启动的绑定可直接 unbind，成功后自动释放引用。

## 可选高版本接口

`setFloatingBallVisibilityInApp` 需API24守卫；`onDestroy/offDestroy`、颜色和动画需API26守卫。低版本编译样例不引用这些符号。`restoreMainWindow` 只从符合系统限制的用户点击触发，不自动后台拉起。

绑定接入由 prepare 在两个基础资产的创建方法末尾传入 `retainControllerOnStopped = true`：STOPPED 时清理监听，引用保留至双端停止后 release 或显式 unbind 成功后清空。该参数默认 false，独立窗、球的清理行为不变。

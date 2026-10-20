# 闪控球路线（API 20）

完成 [兼容性](../compatibility.md) 和 ACL 前提；版本、SysCap、isFloatingBallEnabled 与前台检查通过后调用 floatingBall.create({ context })。

1. 在启动前注册 on('click', callback)、on('stateChange', callback)。点击回调中按业务调用 restoreMainWindow(want)，使用真实 bundleName/abilityName；绑定状态由系统切换窗球，不叠加恢复主窗逻辑。
2. startFloatingBall(params) 选择 STATIC、NORMAL、EMPHATIC、SIMPLE。title 必填且非空，title/content 各不超过 64 UTF-8 字节；STATIC 必须有 icon。PixelMap 像素总字节数≤192KB，建议128×128px。不要用字符串字符数代替字节数。
3. STATIC 创建后不能更新；其他模板调用 updateFloatingBall，不得更改已启动球的 template 字段，遵循模板数据限制。标题、内容、图标变化以业务状态驱动，合并频繁更新，结束后释放自有 PixelMap。
4. stopFloatingBall 的 Promise 是停止请求；以 STOPPED 完成状态收敛，使用同一回调 off('click', callback)、off('stateChange', callback)。处理设备容量替换造成的停止。
5. API 24 的应用内可见性与 API 26 的销毁回调、文字颜色、动画各自保护。titleColor/contentColor 必须同时配置 backgroundColor。

## 资产

使用 [基础球控制器片段](../assets-catalog.md#闪控球)。只接入 API 20 时不携带 API 26 参数或销毁回调。

## 验证

覆盖创建、点击、非 STATIC 更新、关闭、重新进入、系统替换、ACL 不可用、后台启动；检查文本字节边界、STATIC 图标和深浅色。绑定追加 [绑定验收](../binding.md)。

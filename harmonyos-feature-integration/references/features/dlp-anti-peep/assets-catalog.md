# 防窥代码资产

[AntiPeepSession.ets](assets/AntiPeepSession.ets) 是单个目标窗口的会话。复制到实际工程公共逻辑目录后沿用原工程状态管理；回调只上报状态，不创建额外页面。回调由业务提供且不得抛异常。编译 SDK 至少 API21；只使用状态感知、compile API20 时移除 `systemMask` 分支及 `setAntiPeepMaskLayer` 引用，保留查询、订阅和 unknown 处理，不能仅靠运行分支让旧编译 SDK 解析新符号。

```typescript
private privacy = new AntiPeepSession(true, (observation: PrivacyObservation): void => {
  // 合入既有业务状态；maskApplied=false 不能展示为已保护。
  this.privacyObservation = observation;
});
```

窗口可见时传入实际 ID，再 `await privacy.start()`；窗口隐藏/销毁先 `privacy.setTargetWindow(undefined)`，业务终止 `privacy.stop()`。`start()` 会重建本实例订阅，读取最新开关和状态；窗口仍展示时由持续存在的业务所有者管理。退出时即便 stop 失败也已屏蔽回调，应保留会话引用重试退订。

样例不会请求受限权限、自动弹出设置或自动调用放通。先按[兼容性](compatibility.md)完成 ACL、声明与用户设置。

## API23 用户设置入口

只合入用户主动点击的现有入口，`context` 为实际 UIAbilityContext。设置后重新查询开关，不能以弹框调用完成认定已开启。

```typescript
if (deviceInfo.sdkApiVersion >= 23 && canIUse('SystemCapability.Security.DlpAntiPeep')) {
  try {
    const result = await dlpAntiPeep.requestAntiPeepOptions(context);
    if (result === dlpAntiPeep.AntiPeepOptionsResult.SUCCESS ||
        result === dlpAntiPeep.AntiPeepOptionsResult.ALREADY_ON) {
      await this.privacy.start();
    }
  } catch (error) {
    // 使用工程已有错误反馈；保持 unknown/未保护。
    console.error(String(error));
  }
}
```

低于23时使用文档给出的系统设置操作指引。`publishAntiPeepInformation` 为API23可选提示，默认不添加。`passDlpAntiPeepInfo` 仅在用户明确放通时调用，直到锁屏或退出前返回非窥视，不能用于异常恢复。

## 闪控窗联动

按[联动文档](float-view-integration.md)将窗 `STARTED` 的 `getWindowProperties().windowId` 传入会话；其它不可见状态立即清空目标。窗球的状态与资源由窗球所有者管理，防窥会话不创建、停止或重绑窗球。

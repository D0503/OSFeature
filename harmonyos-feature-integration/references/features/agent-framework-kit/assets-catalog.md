# Function 代码资产

[AgentFunctionEntry.ets](assets/AgentFunctionEntry.ets) 为受外层版本/设备门禁保护的增强子组件。导入后按目标布局嵌入，不复制整页。`agentId` 由开发者提供真实值；默认空值不会构建 Function 组件。

```typescript
// 外层 apiAllowed 使用项目已验证的运行 API 判断：应用 20，元服务 21。
if (this.apiAllowed && canIUse('SystemCapability.AI.Agent.AgentKit')) {
  AgentFunctionEntry({ agentId: this.agentId })
}
```

带业务意图的按钮：

```typescript
if (this.apiAllowed && canIUse('SystemCapability.AI.Agent.AgentKit')) {
  AgentFunctionEntry({
    agentId: this.agentId,
    title: this.confirmedTitle,
    queryText: this.confirmedQueryText
  })
}
```

外层门禁未满足时沿用接入前原业务，不增加空白占位。apiAllowed 是宿主已有运行检查的结果，不是由 compileSdkVersion 推断的运行值。初始化参数需改变时由宿主销毁旧增强实例后重建，不依靠 @Prop/@State 修改使 FunctionComponent 动态更新。

## 可选控制器

仅在需要查询或事件时，在受保护增强组件内创建 `private controller: FunctionController = new FunctionController()`，并给 FunctionComponent 传入 `controller: this.controller`。不在可能运行于低版本的外层页面无条件构造控制器。

```typescript
private onAgentOpenedCallback = (): void => { /* 在此调用已有的打开处理 */ };
private onAgentClosedCallback = (): void => { /* 在此调用已有的关闭处理 */ };

aboutToAppear(): void {
  this.controller?.on('agentDialogOpened', this.onAgentOpenedCallback);
  this.controller?.on('agentDialogClosed', this.onAgentClosedCallback);
}

aboutToDisappear(): void {
  this.controller?.off('agentDialogOpened', this.onAgentOpenedCallback);
  this.controller?.off('agentDialogClosed', this.onAgentClosedCallback);
}
```

此片段只展示事件配对，复用时合并现有生命周期；重复进入、部分订阅失败及 controller 共用时按实际控制流处理，不直接全量退订。可用性查询采用[实施](implementation.md)中的 true/false/异常与生命周期规则，不默认把查询加成必需步骤。

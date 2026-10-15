# Function 代码资产

## ComponentV2 页面示例

[Agent.ets](assets/Agent.ets) 使用 `@Entry`、`@ComponentV2` 和 `@Local`。运行 API 与 SysCap 满足要求后才创建 FunctionController；查询返回 true 时显示“智能创建”按钮。查询、事件订阅/退订和组件构建均受版本与能力检查保护。

同一个控制器用于查询、组件绑定及对话框事件。页面进入时查询可用性并订阅事件，离开时以同一回调分别退订。

### 运行 API 与前置条件

- **应用**：本机 SDK、compile 至少 API 20（HarmonyOS 6.0.0），`minAgentApi` 使用 20；**元服务**：本机 SDK、compile 至少 API 21（HarmonyOS 6.0.1），将 `minAgentApi` 设置为 21。若使用 `ICON_ABOVE_TITLE`，应用也须使用 API 21 门槛。运行判断读取 `deviceInfo.sdkApiVersion`，不以编译版本代替运行版本。
- 使用 Stage 工程，页面由 UIAbility 承载，可取得有效的 UIAbilityContext；按工程现有页面路由方式注册并进入该页面。宿主本身需支持示例所用的 ComponentV2 状态管理；既有页面使用其他状态管理方式时按原架构合并逻辑，不整页替换。
- 在支持 `SystemCapability.AI.Agent.AgentKit` 的 Phone/Tablet 真机运行，适用地区为中国境内（不含港澳台）；模拟器不支持。SysCap 检查不能代替设备、地区及服务条件核验。
- 在 `agentId` 中填写真实且已关联当前应用的 Agent ID（1–64 字符）。默认空值不创建控制器、不查询，也不显示 Function 入口。根据实际业务调整 title/queryText。
- 完成 Agent 开发、应用关联、手动签名身份核对，以及正式发布或面向当前测试账号的真机测试发布；设备登录华为账号并联网。具体操作见[前置操作指引](prerequisites.md)。
- **用户已完成小艺隐私授权**。本示例以查询成功作为展示条件；若查询抛出 `1022400011`，入口不会显示，不能用它作为首次授权的唯一入口。面向首次用户时，采用下方直接展示入口的片段，或复用已有授权入口；完成授权后重新进入页面查询。

### 融入现有工程

版本或能力不满足时，示例不执行 Agent 接口及组件构建。接入已有页面时，在此分支保留接入前的布局、操作、状态及业务路径，不照搬空白页面作为业务回退，不自动提高 compatibleSdkVersion。更多规则见[兼容性](compatibility.md)和[回退](fallback.md)。

FunctionComponent 参数仅在初始化时生效；运行中切换 Agent 或业务意图时，需要销毁重建组件并隔离旧查询结果。填写实际配置后，完成工程构建和真机点击、打开、关闭验证。

## 直接展示入口的片段

只需要用户主动点击拉起、不需要预查询和事件监听时，直接在现有页面嵌入 FunctionComponent，无需创建 FunctionController。以下片段合并进现有 build；页面导入 FunctionComponent、BusinessError、deviceInfo 和 hilog，定义 `agentId` 及 `minAgentApi`（应用 20，元服务 21）。

```typescript
if (deviceInfo.sdkApiVersion >= this.minAgentApi &&
  this.agentId.length > 0 && this.agentId.length <= 64) {
  FunctionComponent({
    agentId: this.agentId,
    onError: (error: BusinessError): void => {
      hilog.error(0x0001, 'AgentExample', 'Function error: %{public}d', error.code);
    }
  })
}
```

不传 title 时显示图标；需要带业务意图的按钮时，增加 `options: { title: this.confirmedTitle, queryText: this.confirmedQueryText }`，内容使用用户确认的业务文案。组件自行处理点击与系统授权，不叠加自动拉起或覆盖点击事件。门禁不满足时沿用原业务，不为新增入口保留空白占位。

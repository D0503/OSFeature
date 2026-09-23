# 资产目录

| 路线 | 最小资产 | 使用方式 |
|---|---|---|
| 系统组件原生适配（如 HDS） | [HdsTabs 属性片段](routes/native-component/assets.md) | 合并到实际 HdsTabs，保留控制器、内容、事件和原分支 |
| 操作手 | [OperatingHandSession.ets](assets/OperatingHandSession.ets) | 移植或合并到现有服务；授权由调用方完成 |
| 握持手 | [HoldingHandSession.ets](assets/HoldingHandSession.ets) | 移植或合并到现有服务；仅输出有效左右方向 |

两个 Session 为最小生命周期适配示例，不带 UI、业务状态或默认右侧位置。`start()` 返回是否启用；`stop()` 返回退订是否完成。调用方在关闭、隐藏、失败时恢复基线，并自行连接真实可见期、交互锁与动画。构造参数是左右方向回调和错误码回调；错误日志不要包含无关个人数据。

示例以当前 SDK 编译，运行时保护分别为 API 15/20。若项目 compatible 更低，连 Session 的创建/入口使用也放在版本分支内。系统关闭通知没有已确认公开 API，不提供伪造监听器。

算法测试可以模拟动作与异常；必须在用户工程编译和支持真机验证后才能标注已验证。

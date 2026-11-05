# 公共实施

1. 记录用户确认的入口、目标、资源、路线与可选能力；扫描 entry、现有 Ability 生命周期、路由和资源，保存接入前源程序基线。
2. 读取[兼容性](compatibility.md)，核验实际 SDK 清单、compile/target/compatible 及目标设备；按实际使用的运行接口计算 requiredApi。visible 声明式字段直接配置，由系统处理低版本兼容。低版本原有功能、布局、导航与状态保持可用。
3. 按 selectedRoutes 读取[静态](routes/static-shortcut.md)或[动态](routes/dynamic-shortcut.md)正文与[资产目录](assets-catalog.md)。动态预置资源复用静态配置段落；自定义资源不强制生成静态配置。
4. 增量合并已有 metadata、资源和生命周期。快捷方式只拉起具体 UIAbility；业务页面由应用处理 Want 后经现有路由到达，不将页面路径当作 abilityName。不为快捷方式新建无关示例业务页面。
5. 仅使用约定的业务标识或内容 ID，限制允许目标；缺失、未知参数与失效内容按原应用行为处理。保持登录、隐私协议等既有前置流程，不能绕过业务鉴权。
6. 冷启动在 onCreate 接收参数，等待窗口内容和导航容器就绪后，由现有页面或 ViewModel 处理；暖启动在 onNewWant 更新参数并触发同一业务分支，消费后清空标识。根页面或导航容器销毁时清空尚未消费的参数。
7. 按[回退](fallback.md)对照源程序；执行静态、构建及[运行验收](performance-validation.md)。组合路线分别执行验证，最终汇总到现有报告。

脚本只发现候选与确定性错误。封装、动态值、导航就绪和异常路径由 AI 沿调用链核对；不能将文件中出现同名符号、导入存在或截图采集成功当作功能成功。

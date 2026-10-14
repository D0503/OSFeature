# Function 组件接入

## 工程实施步骤

1. 读取[兼容性](compatibility.md)，运行工程扫描和兼容性脚本；记录目标页面接入前的组件、布局、状态与业务行为。确认真实 agentId、入口位置、图标或按钮形式及可选业务意图，避免自行增加页面或聊天实现。
2. 核对[前置操作](prerequisites.md)。平台条件未就绪时可以完成代码与构建，交付明确未联调，不填写虚构 ID。
3. 引入 `FunctionComponent`；需要支持查询或事件时再引入 `FunctionController`，以及 `common.UIAbilityContext`、`BusinessError` 等实际使用类型。使用[代码资产](assets-catalog.md)，融合现有组件结构和错误处理，不整页替换用户页面。
4. API 20/21 与 SysCap 守卫通过后再构建组件、创建控制器。compatible 低于门槛时，增强子组件内部承载控制器，外层受运行版本保护；使用项目已经验证的版本判断，不凭 SysCap 替代 API 检查。
5. 必填 `agentId`、`onError`。无 title 默认圆形图标，有 title 默认胶囊按钮；`queryText` 仅使用用户确认的业务意图。让系统 FunctionComponent 自身处理点击，不额外覆盖点击或自动拉起。
6. 如需打开/关闭事件，将相同 controller 传给组件，在组件可见生命周期 on，并以同一回调 off；复用已有生命周期，防止重复注册、全量退订影响其他调用方。
7. 所有入参都是初始化配置；agentId/title/queryText/options 改变时销毁旧组件并创建新实例。同步释放旧监听，使用请求序号或可见标志忽略旧查询结果，不能仅改 @State 后声称参数已更新。
8. 按[回退](fallback.md)检查异常和低版本路径，再按[验证](performance-validation.md)执行静态、构建与真机验证。

## 可选可用性查询

`controller.isAgentSupport(context, agentId): Promise<boolean>` 使用当前页面的 UIAbilityContext。context 不可用时不发起查询。查询不是强制步骤；简单入口可以由 Function 组件直接承载系统授权流程。

- true：允许展示 Function 组件；仍不等于点击与对话框打开已经验证。
- false：Agent ID 无效或当前不支持，保留原业务路径；允许在条件改变后由用户重试。
- 1022400011：小艺隐私协议未同意，属于待用户授权。若可用性查询用于隐藏入口，此错误不能让唯一授权入口永久消失；在版本/设备门禁满足时保留用户主动点击 Function 组件完成系统授权的路径，再查询。
- 1022400012/1022400013：引导开发者核对设备账号与网络。恢复后在页面重新可见或用户重试时重新查询，禁止无限自动重试。
- 参数错误或内部错误：按[排障](troubleshooting.md)处理，恢复原业务行为。

组件离开、ID 改变或新查询开始后，旧 Promise 的结果不得覆盖新实例状态。不要自动登录账号、接受隐私协议或上传额外业务数据。

## options 取值

| 参数 | 约束 |
|---|---|
| title | 默认空；超过 8 个中文字符宽度会省略；大字体时核对显示 |
| titleFontSize | 14–16vp，默认 16，越界取默认 |
| iconSize | 16–24vp；CIRCLE 默认 24，CAPSULE 默认 20 |
| iconColors | 仅支持一种颜色，不设置使用系统默认渐变 |
| queryText | 初始查询文本，默认空 |
| controlSize | 默认 ControlSize.NORMAL |
| buttonType | CIRCLE / CAPSULE；ICON_ABOVE_TITLE 要求 API 21 |
| isShowShadow | 默认 false，只对 CAPSULE 有效 |
| backgroundColor | 默认 sys.color.comp_background_tertiary |
| titleColors | 最多两种颜色，两色渐变，未设置使用系统默认 |

样式只配置用户要求的属性。CAPSULE 在字体倍数大于等于 1.75 时显示为矩形倒角按钮，不以此现象判定接入失败。

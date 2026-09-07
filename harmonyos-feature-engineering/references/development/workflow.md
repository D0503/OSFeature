# 代码开发验证流程

1. 用 `scripts/validate-capability-package.mjs` 核验能力包，使用 `scripts/resolve-capability.mjs` 解析能力和场景。不是唯一场景时只列候选并请求选择，不修改工程。
2. 用 `scripts/inspect-development-project.mjs` 扫描工程。非绝对路径、非 Stage、所选路线要求的 module/SDK/target/compatible 门槛不满足、SDK 缺失或符号缺失均进入门禁。ArkUI 应用级配置额外要求 entry module；HDS 路线不套用该 metadata 限制。
3. API/target/compatible 升级需单独取得用户授权。未授权时报告 `blocked`，不得顺手修改版本。
4. 完整读取所选能力包 `entry.md`、`implementation.md`、`validation.md`，以及场景引用的资产。按场景的 `route` 选择对应 SDK 与实现规则。运行期禁止读取任何原始 Markdown、URL、审查报告或验证清单（Web-first 对勘抓取的现网正文只用于校验能力包来源，不作为新的开发判据）。构建或运行前完成程序强制的 Web-first 对勘：`scripts/verify-capability-sources.mjs crosscheck --scenario <场景ID>` 实时抓取官网做漂移门禁与锚点定位，逐条忠实性判定后经 `--faithfulness` 注入 `verify-development.mjs`；`unfaithful/cannot_determine/未判定` 均拒绝构建，drifted 需重审换锁，unreachable 即阻塞。
5. 确定将触及的文件，用 `scripts/snapshot-project-files.mjs capture` 记录 before 哈希和内容。检查 git 脏文件，局部补丁保留用户修改。
6. 根据场景步骤实施最小改动，并按 [报告契约](report-contract.md) 顺序记录实际实施步骤、修改前/后文件位置及依据。特性 API、参数、配置引用能力包事实；页面布局、演示状态等工程配套实现记录选择理由；找不到特性依据时标为待确认。对照变体在系统临时目录运行，目标工程只保留用户要求的最终状态。
7. 执行场景静态规则和 SDK 符号核验，再用 `devecocli build` 构建。构建错误必须与本次修改有可定位关系才可修复，最多两轮；失败后保留代码。
8. 用户要求运行验证时先执行 `devecocli device list`。唯一设备可运行；多个设备要求用户选择；无设备时不创建或下载模拟器。用 `devecocli run` 时禁止 `--uninstall`。
9. 视觉层只接受截图、录屏、日志可观察状态、用户明确观察或通过校验的模型判定记录。构建通过不能替代视觉通过。
10. 设备运行成功后执行导航与自动判图：目标页面不是启动页时，先生成冻结的 `route-steps.json`（步骤序列 `stepId/action/locator/expectPage`，动作仅限 launch/tap/swipe/input/wait，locator 仅限 text/id/type，多入口或分支拆多条路径，无法核实的动态目标不写入步骤），经 `--navigate` 执行；带 `expectPage` 的步骤用组件树核验当前页面，失败停止在该步骤并记录 `stepId + expected + actual`；导航失败跳过截图采集，视觉层保持 `not_run`；路由切换不点返回键，重新推包从首页执行。随后 `scripts/verify-development.mjs` 以 `--capture-screenshot` 采集设备截图并登记 `screenshot` 证据，以 `--capture-layout` 采集完整组件树并登记 `component_tree` 证据。模型先自检能否读取图片，不能时视觉层保持 `not_run` 并把原因写入 `pendingVerifications`。可读图时逐条对照场景 `expectedOutcomes` 判定，图片无法判定时用组件树做结构判断；判定写入 `visual-judgment.json`（schemaVersion、scenarioId、可选 runtime、visual.status/basis/evidence、matchedFactRefs，冲突场景须声明匹配的冲突事实），经 `--judgment` 注入。判定记录登记为 `visual_judgment` 证据；判图不确定只能 `inconclusive`，不得反向改写能力包事实。
11. 比较文件基线，通过 `verify-development.mjs --baseline <基线文件> --implementation <实施记录文件>` 生成 1.1 版规范 JSON，用 `scripts/validate-development-report.mjs` 校验，再由 `scripts/render-development-report.mjs` 生成 Markdown。步骤需覆盖每个变更文件，修复步骤也要说明修复依据及对应构建证据；失败时仍保留记录。报告将位置与实际 diff 对照；文件差异只能证明关联改动存在，不能代替对步骤描述、引用事实是否支持代码语义的复核。

报告中的官网 URL、快照位置和哈希由已校验能力包展开，不接受实施记录中的自定义规范陈述或来源替代。引用冲突事实时同时披露同组预期，明确采用的实现和待观察行为。运行时不访问官网或原始资料，链接缺失就如实显示缺失。旧版报告不补写推测的执行步骤；无记录、无基线或没有对应差异时不能声称已完成实施，记录完整性不改变构建和运行结果。

始终生成报告文件。默认写入本次执行开始时的当前工作目录；用户指定输出目录时使用指定目录。报告和证据使用固定名称，重复运行只覆盖这些已登记产物。

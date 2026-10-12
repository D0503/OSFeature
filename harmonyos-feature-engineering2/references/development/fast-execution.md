# 本轮执行复用

## 同一 Demo 优先

开始前检查本特性已有 Demo，优先扩展满足当前目标的工程。没有可复用工程时才根据本次官方示例与接口生成最小 Demo；后续直接修改原工程，不能因生成步骤面向空目录就另建 D02 或复制工程。

参数变体优先使用按钮、开关、选择器、滑块或测试状态入口切换；显示当前参数，切换前重置相关状态，截图分别命名。多页面和多个验证点可以属于同一 Demo。不能运行时修改的 metadata、权限、资源或编译期配置仍在同一个 Demo 内依次修改、校验和重建。

同页并列是可选展示方式；空间不足、状态互斥或组件独占屏幕时，通过稳定页面入口顺序切换、恢复相同状态并分别截图。

验证点 ID（包括骨架中的 Dxx 前缀）是报告标识，不要求创建对应编号的工程。多个场景共用工程时保留各自判据校验，以 `scenarioId + pointId` 定位验证点，判据引用也限定于所属场景。模拟器与真机复用同一工程，在同一报告按 Demo、环境和场景分别记录结果；不能为了保存对照复制工程。独立工程仅用于确实无法共存的工程模型、依赖或构建配置，或用户明确要求拆分，原因写入报告。

## 多场景编排

1. 按用户目标列出所需场景，支持一次多选。多个明确目标分别调用单目标路由，再用 `resolveScenarios(capability, goals)` 汇总；用户已选 ID 时用 `resolveScenarios(capability, [], selectedIds)`，校验注册信息并保留全部选择。未明确的目标展示各自候选，允许多选；不能把歧义候选自动全部加入，也不能把多个明确需求压成单选。
2. 同一特性调用 `prepare-demo-output.mjs --root <result> --feature <ID> --demo-id D01 --scenarios <ID1,ID2>` 一次，所有场景共用返回的 `projectDirectory`。`scenarioOutputs[场景ID]` 提供各自 selection、validationPlan、results、baseline 与 implementation 临时路径，不能互相覆盖。新增场景用相同 Dxx 和 `--work-dir` 扩展。不同特性沿用各自能力包与报告目录。
3. 按所选场景集合冻结一次官网资料；对每个场景分别执行 `derive-criteria.mjs materials/validate --scenario <ID>`，得到独立 `criteria-<ID>.json`。分别生成所选验证点的计划和实施记录，全部适用门禁通过后才构建共用工程。各场景记录完整覆盖其校验基线差异，不用其他场景的判据或记录替代。
4. 能共存的效果通过页面导航、参数或状态切换验证。应用级开关等互斥编译配置仍在原工程依次修改和重建；各场景说明自己的页面入口和状态，记录源码及安装包身份。只在无法共存或用户要求独立工程时拆分。
5. 分别调用 `verify-development.mjs --scenario <ID> --criteria <对应判据> --goal <该场景目标> --output <同一特性目录>`，验证入口采用已选场景，不重新竞争路由。运行时状态切换复用已验证的同一构建和安装，复用证据需关联相同源码、安装包及设备；每个场景仍独立完成运行和效果判断。开发报告累计场景条目，设备报告按 `demoId + deviceType + scenarioId` 累计；只替换同一组合的复测结果。

## 本轮资料与构建复用

1. 每批任务首个 Demo 创建一次临时 workDirectory，后续 Demo 用 `prepare-demo-output.mjs --work-dir <首次返回路径>` 共用页面缓存、公共判据和按特性隔离的 collection。不同任务不得复用该目录，结束后按交付规则清理。
2. 冻结支持多个场景：`node scripts/freeze-snapshot.mjs --feature <ID> --scenario <ID1,ID2> --work-dir <本轮临时目录> --concurrency 4 --output <本轮临时目录>/<featureId>/frozen`。同次调用按 URL 去重，最多 8 并发、默认 4；按特性顺序调用仍可通过同一 work-dir 复用共同页面。任一入口失败仍阻塞该次冻结，失败不缓存。不要同时向同一 frozen 目录写入。
3. 每轮对本次冻结快照执行 materials/validate；不读取、比较或归档上次基线。用户单独要求文档变化审查时，作为独立审阅任务处理，不改变开发判据来源。
4. 同一场景的多个 Demo 共用通过校验的 criteria 文件。跨场景公共主题可复用本轮已经提取的原文判据到新草稿，但必须在目标场景执行 validate，核对来源、锚点、必需主题和冲突结论；不能直接复制旧场景结果当作已验证。公共判据不跨任务保存。
5. single_page 变体先一次完成所需代码，构建安装一次，再切换运行时参数或恢复页面状态并分别截图。配置、源码、资源、依赖、SDK、签名或构建选项变化必须重新构建。
6. 用 `node scripts/variant-build-decision.mjs <工程> <工具链标识> <上次成功构建记录.json或-> runtime` 比较构建输入，输出 rebuild 与 fingerprint。工具链标识包含 SDK/编译器版本、构建选项、工程外依赖和签名文件的内容哈希；不写入密码。仅构建成功后将 fingerprint 与 buildPassed=true 写入本轮记录。rebuild=false 才跳过构建；安装复用还须确认同一设备已有相同安装包，换设备仍要安装。输入未知、失败构建或非运行时变化均重新构建。

本规则优先于“每个变体必重建”的统一要求。实现门禁、判据覆盖和运行证据仍需完成；最终仍只交付 Demo、截图和报告。

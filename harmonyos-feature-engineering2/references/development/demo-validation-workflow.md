# Demo 自动开发、调参与验证

当用户要求“生成 Demo 并比较不同配置效果”时使用本流程。具体规范预期只能来自本次冻结判据；`scenarios.json` 的 `demoValidation` 只定义实验骨架、参数矩阵和展示方式。

## 产物目录

最终输出遵循 [最终产物保留规则](delivery-policy.md)。validation-plan、collection、冻结判据和非截图证据均使用 `prepare-demo-output.mjs` 返回的临时 `workDirectory`，最终目录仅保留 Demo、截图与报告。

在用户指定的结果根目录下直接创建以注册表英文 `featureId` 命名的特性文件夹；不再增加 `features/` 或 `demos/` 中间层。结果根目录及其下所有生成路径不得包含中文字符。交付的 Demo、截图和报告放在这个文件夹中，不同 Demo 分别使用 D01、D02 等子文件夹。不同特性不得共用临时集合、报告、Demo 编号序列或证据目录：

```text
<result>/
  <featureId>/                       # 例如：immersive-light
    development-verification-report.md
    development-verification-report.json
    demo-real-device-validation-report.md
    demo-real-device-validation-report.json
    D01/
      test-demo/                      # 根据本次官方依据生成或适配的工程
      evidence/
        emulator/                    # 仅保留报告引用的截图
        real-device/
    D02/
      ...
```

每个特性从 D01 独立编号。即使两个特性都存在 D01，也因位于不同 `<featureId>` 文件夹而互不影响。`featureId` 必须是小写英文、数字和连字符组成的 slug。必须先运行 `prepare-demo-output.mjs` 获取并创建标准目录，后续命令只能使用它返回的绝对路径，不得自行拼接、改名、改变层级或写入旁路目录。脚本对含中文的结果根路径、非法 featureId 和非法 Demo 编号直接失败。渲染器校验 plan、collection 的 `featureId`；不一致时拒绝写入，不能把其他特性的 Demo 追加到当前报告。

能力包不提供完整 Demo 工程模板。生成工程不得携带签名材料、缓存、依赖、历史报告或本机绝对路径；签名配置属于用户环境前置，在生成工程上按编排步骤 6 提示用户完成。

## 编排步骤

Demo 复用、编号与拆分规则按 [本轮执行复用](fast-execution.md#同一-demo-优先) 执行。

用户可一次选择多个场景；按 [多场景编排](fast-execution.md#多场景编排) 分别提取和校验判据、生成计划，在同一 Demo 内通过页面或状态切换验证。调用目录脚本时传 `--scenarios <ID1,ID2>`，各场景使用返回的 `scenarioOutputs[ID]` 临时路径，共用同一工程、截图根目录与两份报告。结果的 `scenarioId` 必须匹配所属计划；验证点与判据 ID 在场景内定位，不因骨架编号相同就新建 Demo。

按 [本轮执行复用](fast-execution.md) 在多个 Demo 间共享本轮资料与公共判据；运行时变体构建安装一次，构建输入改变才重新构建。首个 Demo 创建临时 workDirectory；后续 Demo 调用 `prepare-demo-output.mjs --work-dir <该目录>`。同特性的临时 collection 共用 `<workDirectory>/<featureId>/feature-report-data.json`，不同特性隔离。

开始前读取 [验证环境选择](validation-environment.md)，记录模拟器/真机及选择理由。下文运行与结果流程适用于两种环境，只有真机签名检查限定于真机。

1. 按正常开发链路完成场景解析、官网冻结和本次判据生成。验证点只从提示词直接指定的组件、效果、参数或状态及其原文档相关段落中提炼，使用最小充分集合；不能因为同一页面还提到其他能力就扩展验证范围。
2. 按上文“产物目录”运行 `prepare-demo-output.mjs --root <result> --feature <特性> --demo-id <Dxx>`，在其返回的 `projectDirectory` 生成或适配最小 HarmonyOS 工程。生成沉浸光感 Demo 时，运行 `install-immersive-light-backing.mjs --project <projectDirectory>`，将能力包唯一保留的视觉素材 `assets/backing.png` 复制为 `entry/src/main/resources/base/media/backing.png`。每个沉浸光感验证页面必须直接使用资源 `app.media.backing` 作为全屏根背景，至少保留 `.width('100%')`、`.height('100%')`、`.backgroundImage($r('app.media.backing'))`、`.backgroundImageSize(ImageSize.Cover)`；该图片是固定观察衬底，不得换图、改名或用运行时生成图替代。验证控件位于背景上方，使透明、模糊和材质差异可观察；同页各变体衬底保持一致。其他特性不继承这项固定背景约束。
3. 用 `generate-validation-plan.mjs` 将场景实验骨架与本次判据结合。每个验证点必须含 `criteriaRefs` 和 `expectedFromCurrentSnapshot`；缺少所需主题时停止，不得用骨架提示代替官网事实。严格区分特性验证点与 Demo 搭建前提：为了让目标效果可触发、可见而必须实现的普通组件交互、数据、导航和页面状态，登记为 `demoSetupRequirements`，只接受实施记录与静态门禁检查，`countsAsFeatureValidation=false`，不生成真机验证结果、不进入报告验证点、不计入通过数。版本、SDK、设备能力、算力分档、功耗、滤镜和其他视觉参数若只是实现前提或相邻说明，也只进入环境记录、静态门禁或限制说明；只有提示词明确要求该维度本身时，才单独规划 Demo。
4. 先实现 `execution=single_page` 的验证点。同一验证点的变体应在一个页面中并列或分区展示，使用一致的背景、尺寸、内容、滚动位置和状态；每个区域显示简短配置标签。不要把互斥配置误放在同一组件上。官网存在适用示例时，优先从本次冻结的示例代码复用目标组件结构、必要状态、回调和关键属性，再做最小页面适配；不复制无关装饰、业务数据或其他示例场景，并在实施记录 `samples[].usage=adopted` 中登记来源和关键适配点。
5. 生成或修改完沉浸光感 Demo 的全部页面后，运行 `node scripts/validate-immersive-light-background.mjs --project <Demo工程绝对路径>`。该门禁扫描所有模块 `main_pages.json` 登记页面及 `src/main/ets/pages/` 下页面；任一页面缺少 `backing.png`、未直接使用 `app.media.backing`、不是全屏或缺少 `ImageSize.Cover` 时停止，不得进入构建、截图和报告生成。其他特性不运行此门禁。
6. **真机构建运行前检查签名配置**：真机不能安装未签名 artifact。检查生成工程 `build-profile.json5` 的 `signingConfigs` 为空或 product 未通过 `signingConfig` 字段引用签名配置时，先提示用户配置签名并等待完成：可在 DevEco Studio 中对生成工程执行自动签名，或登录华为开发者账号后执行 `devecocli signature generate` 自动生成签名材料并写入工程配置。提示中说明签名是用户环境前置；不得自行生成签名密码材料、不得绕过提示直接执行真机构建。用户完成配置后将签名相关文件变化登记基线（环境前置，非实施改动）。模拟器按目标安装环境要求继续构建、安装、运行和截图；无设备时按仅构建处理。
7. 对 `execution=rebuild_per_variant` 的验证点，保存实验基线，然后逐变体执行：恢复实验基线 → 只修改该变体参数 → 更新实施记录 → applied 门禁 → 沉浸光感场景执行背景门禁 → 构建 → 安装运行 → 导航到相同页面状态 → 截图/录屏 → 保存源码和 HAP/APP 哈希。上一变体不得污染下一变体。
8. 每个变体失败时保留现场并按构建失败归因处理。不得为了得到"通过"截图而改写判据、同时修改未登记参数或选择视觉更接近预期的替代实现。
9. 使用 `verify-development.mjs --device-type emulator|real-device --output <prepare-demo-output 返回的 featureDirectory>` 执行六层自动验证，生成独立的 `development-verification-report.json/md`，记录 static、SDK、构建、安装、运行、视觉、实施依据及失败归因。设备效果报告只记录各验证点、参数变体和设备观察，不重复六层报告。验证中的日志、组件树等过程文件可临时存于该目录，交付前按 [保留规则](delivery-policy.md) 清理；报告引用的截图保留。设备证据按环境放入当前 Dxx 的 `evidence/emulator/` 或 `evidence/real-device/`。
10. 用户要求验证默认行为，或本次已选验证点包含 `defaultEquivalence` 时，执行默认等价对照；不能仅因组件存在默认开启逻辑就追加验证点。对照预期须来自本次冻结判据：默认变体与“组件级显式设置为官网声明默认样式”的变体，在相同背景、尺寸、状态下比较。默认变体不显式设置材质字段；显式变体只设置该组件的材质字段。结果 JSON 单列填写对照结论；未获得可比证据时标为“无法判定”，不得以主观观察代替。
11. 将各场景实际结果写入对应临时 results JSON，共用同一 `demoId`（D01、D02……）和 `demoOrder`，填写 `scenarioId` 与 `environment.deviceType` 后逐场景运行 `render-real-device-report.mjs --plan <对应计划> --results <对应结果> --collection <prepare-demo-output 返回的 collection> --output <featureReport>`。渲染器累计写出最终 Markdown 和结构化 JSON；只有同编号、同环境、同场景复测才替换对应结果，其他场景和环境继续保留。新一批运行从最终 JSON 报告续接。每个所选验证点及其所选变体都必须有结果，附件必须真实存在；没有证据时报告明确证据不足。全部场景完成或明确受阻后，清理构建缓存、依赖和过程附件，对共用交付 Demo 执行一次 `validate-demo-source.mjs --project <projectDirectory>`；门禁失败须先修正再交付。

场景专属实验骨架、参数与搭建前提读取对应 `scenarios.json` 的 `demoValidation`；IL-S003 的补充解释见 [沉浸光感场景映射](scenario-routing.md#il-s003-demo-边界)。生成计划前由 AI 按用户目标在临时目录写入 `selection.json`，格式为 `{"points":[{"id":"D01-02","goalAnchor":"索引条提示弹窗","variantIds":["indexer-system-material-thin"]}]}`。每项只包含本次需要的验证点及变体，`goalAnchor` 逐字引用目标中的相关要求；不得自动选整个骨架或添加未要求的对比参数。脚本先校验选择，再检查所选点的判据覆盖；缺少选择、不存在或重复的编号、目标引用不匹配均拒绝生成。目标有实质歧义时展示候选请用户选择；目标明确时直接完成选择，无需例行确认。保留默认等价对照时须选择其两侧变体，预期仍从本次冻结判据核对。

## 命令入口

```text
node scripts/prepare-demo-output.mjs --root <result> --feature <特性名或ID> --demo-id D01 --scenarios <ID1,ID2> [--work-dir <本批首次返回的 workDirectory>]
node scripts/install-immersive-light-backing.mjs --project <result>/immersive-light/D01/test-demo
node scripts/validate-immersive-light-background.mjs --project <result>/immersive-light/D01/test-demo
node scripts/generate-validation-plan.mjs --feature <特性ID> --goal <该场景目标> --criteria <该场景判据> --selection <scenarioOutputs[ID].selection> --output <scenarioOutputs[ID].validationPlan>
node scripts/verify-development.mjs --project <prepare-demo-output 返回的 projectDirectory> --scenario <ID> --goal <该场景目标> --criteria <该场景判据> --frozen <本轮冻结目录> --baseline <该场景基线> --implementation <该场景实施记录> --device-type emulator|real-device --output <prepare-demo-output 返回的 featureDirectory> [--execute-build] [--execute-run --device <设备>]
node scripts/render-real-device-report.mjs --plan <validation-plan.json> --results <results.json> --collection <prepare-demo-output 返回的 collection> --output <prepare-demo-output 返回的 featureReport>
```

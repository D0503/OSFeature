# 验证闭环工作流

## 执行顺序

1. 保存改造前 SDK、compile/target/compatible API 和源程序状态证据；按实际修改填写改造记录，不从接入后工程反推改造前版本。按页面与组件拆分改造项，整体接入按能力包的覆盖清单逐项记录与验收。
2. 运行 `verify-development.mjs`，内部复用现有静态检查。SDK 或静态检查明确失败时停止本轮构建，并进入下方“失败修复与重验”；`warn` 保留为待核验项，不写成通过。
3. 自动传入 `--execute-build`，按现有 product/build-mode 运行 ohpm 和 Hvigor，同步与打包使用 `--no-daemon`。完整产品构建前，执行器从工程配置生成 `deployment_targets`，明确当前产品的 entry/feature/shared 模块与 target，包括未被 entry 显式依赖的动态路由 HSP，HAR 不单独部署；发现不依赖已有构建产物。运行验证使用 `assembleApp` 构建当前产品，`--module` 仅选择启动模块，不能缩小构建范围而遗漏 HSP。构建成功后立即保存 `deployment_manifest`，记录完整产物路径与哈希；缺包时阻断部署。只编译不运行时仍可指定模块级构建，但该运行不能补录安装通过；转入手动安装前须重新执行完整产品构建。失败保留首个失败阶段与日志，由 AI 按下方流程分析、修复并重新构建。允许修正本次接入引起的错误配置，不得通过删除必要检查、降低已确认的路线要求或绕过签名来掩盖失败。
4. 目标设备明确时自动传入 `--execute-run --device <设备>`。执行器依据当前产品的 `targets/applyToProducts` 收集全部本地 entry/feature/shared 模块（包括动态路由 HSP，HAR 不单独安装），按各 target 的 `output_metadata.json` 选择产物（真机要求签名，模拟器沿用原签名要求）并保存路径、哈希与部署清单；不从其他 product/target 或任意旧目录捡包。先一次安装完整 HAP/HSP 集，再查询设备应用信息，核对 bundle、versionCode 和模块集合，最后启动指定 Ability。缺包、漏装、版本不符、残留其他产品模块时停止导航并报告具体原因；先修正产物或部署条件，再重验，不将空白页直接归因于业务代码。多 target 无法唯一选择或元数据包含尚不能核实的外部 HSP 时明确阻断，不静默漏装；不自动卸载应用或清除数据。未指定设备时先查询可用设备，多设备需明确选择，不任意安装，不创建或下载模拟器。效果验证的设备限制按能力包执行。
5. 根据实际导航填写步骤，最后一步必须断言目标页独有的业务文本或控件，不能仅断言 NavDestination 等容器；到达后采集截图、组件树和运行日志。导航失败不得使用其他页面截图判定目标效果。空壳页面即使存在导航容器也不能验收。
6. 具备条件时使用执行器完成构建与部署，不能因命令简单而改走单包安装。执行器安装、启动或导航受阻且无法由代理自动解决时（如设备锁屏需人工解锁、系统弹窗或账号授权需真人交互、无障碍采集被安全策略限制），记录具体阻断原因后转入手动验证：保持本轮构建与设备不变，只手动完成受阻步骤；部署已核验时不重新单包覆盖安装。手动安装同样必须安装清单内全部 HAP/HSP、查询安装后的设备应用信息，并由同一校验器核对模块集合与版本，缺包、查询失败或缺少证据时不标记安装和运行通过。同步采集截图、组件树与运行日志，再按“手动验证证据补录”纳入同一份报告。效果类改造至少采集操作前与操作后（或保护前与保护后）两张不同截图，支持 PNG 与 JPEG，不得因格式问题省略。
7. 按[回退路径实测](#回退路径实测)验证兼容方案，并结合能力包列出的门槛、触发条件和保留行为补录判定。
8. AI 实际读取证据并对照能力包后补录判定。能力查询启动时机、滚动末项可达、交互回退等动态行为需要运行观察，单张静态图不能证明。手动验证导入的截图同样必须由 AI 实际阅读后再补录视觉判定。
   必须尝试用当前可用的图片读取工具打开截图后再判定；读取失败时准确记录失败原因。截图中的几何布局、实际材质观感与动态交互分开判断；没有错误日志只能作为辅助信息，不能推导材质生效或作用域合法。一个页面的截图不能验收其他页面、未弹出的浮层或未操作的列表。
   按能力包的运行矩阵验证每个目标和窗口条件，判定规则见所选路线的验证资料。
9. 输出一份 Markdown 与其截图附件。编译通过不代表视觉通过；低版本、不支持、关闭、设备算力、系统设置和性能未覆盖时明确标记未验证，所有回退条件与实施前源程序状态基线逐项对照。

## 回退路径实测

工程 compatible API 低于所选路线 minApi（存在低版本兼容分支），或能力包声明了设备不支持、特性关闭回退路径时，验证闭环必须包含回退实测，不得以 staticReview 复核、代码走查或“构建通过”替代。
- 在满足回退条件的环境安装**本轮构建的同一产物**实测：低版本回退使用 API 低于路线门槛的真机或模拟器（回退实测验证的是“增强不启用、源基线保持”，不依赖特性识别硬件，允许使用模拟器）；设备不支持、特性关闭路径按能力包的触发方式构造。
- 逐项核对改造记录 `fallback` 声明的保留行为：增强入口不出现或不生效、接入前布局/功能/交互/状态逐项一致、无报错崩溃；采集回退环境运行截图与日志，截图至少体现目标页在回退环境下的实际表现。
- 证据与判定：回退环境截图用 `--import-screenshot <路径> --screenshot-purpose fallback` 导入，再用 `--judgment` 的 `fallback` 字段补录（condition + status + summary + evidence）。回退截图单独标注用途，不改变原设备的安装、导航、运行和视觉结论；允许来自低版本模拟器，不能用于目标特性的视觉验收。`summary` 必须写明回退环境（真机/模拟器与系统 API 版本）与实际观察结论，`passed` 必须引用回退环境运行截图。`low-api/unsupported/disabled` 可分别补录，`passed/failed` 会同步到报告“升级与兼容”回退表。
- 无法获得回退环境（如无 API 低于门槛的设备或模拟器）时，报告保留未验证并写明具体阻断原因与所需条件；不得默认跳过，也不得据此宣称兼容方案有效。能力包的效果验证设备限制与低版本回退实测分别适用。

## 失败修复与重验

设备命令的证据保留退出码及分隔标记后的原始 stdout、stderr。组件树或设备信息解析失败时，先确认提示实际进入哪个输出流；证据末尾出现提示不代表 stdout 被污染。执行器仅忽略 JSON 前后独立行中已识别的 CLI/docs 升级提示及组件树采集进度，仍检查完整 JSON 和用途对应的结构；截断、未知文本或多个 JSON 结果不能当作成功。区分命令失败、输出解析失败与目标页面断言未命中，不因解析失败默认执行 `devecocli update` 或 `devecocli docs update`；仅在确认版本兼容问题且符合现有授权时升级。采集到基线截图仍需补录实际运行、视觉判定，`inconclusive` 不代表特性验收通过。

此流程适用于用户已授权的工程接入或修复任务；仅诊断任务仍只检查和报告。执行器负责单轮检查、构建和取证，AI 负责分析、修改和重新调用执行器。

1. 读取本轮输出 `evidence` 中的实际文件：SDK/静态门禁失败时读取 `type: static` 的 `inspection`、`compatibility` 和 `staticResult`；构建失败时读取 `type: build_log` 的完整日志，定位首个失败阶段、错误信息及相关文件位置。尚未构建时没有构建日志，不将门禁失败误称为编译失败；执行器异常则读取命令的标准错误输出。
2. 对照接入前状态与本次改动确认原因。本次接入引起的代码、导入、API 用法或版本配置错误，由 AI 在已确认范围内作最小修复，无需为修复自身改动再次请求授权。版本配置须区分用于比较的 API 等级与写入工程的版本格式，按[兼容性模型](../shared/compatibility-model.md)核对；不新增无关改动，不修改签名或权限要求来绕过阻断。
3. 修复后使用相同改造项标识、输出目录和已确认的路线、product/module/build-mode，重新执行完整验证命令并传入 `--execute-build`，生成新运行；不要用仅支持补录与取证的 `--resume` 代替重建。重新通过 SDK、静态与构建检查后，继续安装启动、导航及效果验证。仍失败时依据新的检查结果或日志继续定位修复，不在未改变条件时重复执行相同失败命令。
4. 缺失 SDK、签名、权限等条件且在现有授权和环境中无法自行解决，或问题超出本次接入范围时，停止受阻步骤并报告具体原因。说明失败阶段、具体错误或检查项、相关文件位置、缺失条件及需要用户提供的信息；无法确认根因时明确写明尚不能确认，不根据笼统的门禁提示推断原因。
5. 单轮失败报告是工作中的当前状态，不是可修复问题的最终交付。最终报告呈现修复重验后的结果；确有阻断时写明该阻断及其导致未执行的后续阶段，不仅写“SDK 或静态门禁失败，未构建”或“视觉未验证”。未执行的视觉验证仍标记未验证，不将其描述为视觉效果失败。

## 命令

```text
node scripts/verify-development.mjs --project <工程> --feature immersive-light --route arkui --goal <目标> --changes <改造记录.json> --sdk <SDK目录> --product <产品名> --module <模块名> --build-mode debug --execute-build --execute-run --device <设备> --navigate <导航.json> --capture-screenshot --capture-layout
```

- `--route` 明确为 `arkui` 或 `hds`，组合路线和多个目标顺序执行，汇总到同一报告。
- `--product`、`--build-mode` 默认 `default`、`debug`，执行前核对工程。运行验证始终构建并部署当前产品的完整本地运行模块集，`--module` 指定其中的启动模块，只填模块名（如 `entry`），不填 Hvigor 的 `entry@default`；省略时须存在唯一 entry 模块。`--ability` 指定启动模块中实际声明的 Ability，`--bundle` 限定运行日志所属应用。
- `--import-screenshot <路径>` 可重复传入开发者按引导在真机采集的 PNG/JPEG 截图，随新运行或与 `--resume` 组合为已有运行补挂截图；导入后仍须由 AI 实际阅读并补录视觉判定。
- `--screenshot-purpose target|fallback` 与 `--import-screenshot` 配合使用，默认 `target`。目标截图导入后视觉状态变为未确认，须重新判图；回退截图用 `fallback`，在同一 `runId` 下导入并补录回退判定，保留原设备的效果结论。
- 同一改造项需要基线、左手、右手等多张执行器截图时，首次运行用 `--capture-screenshot --screenshot-scenario <场景>`；保持该次 `runId`，开发者切换到下一姿态并等待稳定后，用 `--resume <runId> --capture-screenshot --screenshot-scenario <新场景>` 补采。补采沿用已安装并导航通过的设备，不重新构建或安装；同名场景重采会替换该场景旧图。全部截图作为同一运行的证据写入报告。不要为每种握姿创建新的同改造项运行，否则新运行仍会替换旧运行。
- SDK 自动定位规则沿用现有工程检查；无法定位时显式指定 `--sdk`。
- 未传执行开关仅检查并报告。实施代理须主动传入具备条件的执行开关；运行只使用本轮成功构建的产物，不使用旧包绕过失败。
- 默认输出 `<工程>/os-feature-integration/integration-report.md`，`--output` 可覆盖目录。
- stdout 返回报告路径、`runId`、临时证据路径及哈希。退出码 0 表示没有确定失败（仍可能未验证），1 表示存在失败，2 表示输入或执行器错误；不能仅凭退出码验收。

## 改造记录

实施代理在系统临时目录准备输入，不把过程 JSON 放进交付目录。以下内容须按真实改动和证据填写：

```json
{
  "schemaVersion": "1.0",
  "id": "home-floating-tabs",
  "page": "首页",
  "component": "Tabs",
  "category": "悬浮 Tab",
  "effect": "底部 Tabs 配置悬浮样式与系统默认材质",
  "files": ["entry/src/main/ets/pages/Home.ets"],
  "before": { "sdk": 26, "compile": 26, "target": 26, "compatible": 23 },
  "fallback": [
    { "condition": "low-api", "behavior": "保留原导航布局、交互与普通样式", "status": "not_run" },
    { "condition": "unsupported", "behavior": "保留原组件状态和普通样式", "status": "not_run" },
    { "condition": "disabled", "behavior": "保留原普通样式与交互", "status": "not_run" }
  ]
}
```

每条记录只覆盖一个可独立验证的页面/组件改造项，列出该项实际修改文件。`effect` 只描述已经实施的代码配置，例如“列表已添加尾部补偿，滚动效果待验证”，不得把预期效果写成验证结论。应用级 ENABLE 单独作为配置记录；具体组件是否生效仍需分别验证，不能据此宣称全量覆盖。

`fallback` 各条件的 `status` 反映实测进度：存在低版本兼容分支（compatible 低于路线 minApi）时，`low-api` 不得停留在 `not_run` 交付——要么按[回退路径实测](#回退路径实测)完成回退实测并填写 `evidence`，要么在报告待处理事项中写明无法获得回退环境的具体阻断；工程最低兼容 API 不低于路线门槛时该项填 `not_applicable` 并说明依据。`unsupported`、`disabled` 同理按能力包声明的回退路径处理。

`id` 是推荐填写的稳定改造项标识，同一位置重验或修改目标标题仍使用同一个值；同页不同组件或同类组件的不同实例使用不同标识。旧输入未提供 `id` 时，按 `page + component` 精确匹配，保持这两个字段稳定；不按目标文案或修改文件列表去重。无法精确识别的旧记录不作模糊合并，实施代理须核对原位置并使用一致标识重验。

版本无法确认填 `"unknown"`。回退状态允许 `passed`、`failed`、`not_run`、`not_applicable`；除 `not_run` 外须填写 `evidence`，说明实际证据或不适用依据。

## 导航与采集

```json
{
  "schemaVersion": "1.0",
  "steps": [
    { "stepId": "open-benefits", "action": "tap", "locator": { "by": "id", "value": "benefit-tab" }, "expectPage": { "by": "id", "value": "benefit-page" } }
  ]
}
```

支持 `launch`、`tap`、`swipe`、`input`、`wait`。定位与页面断言为 `{ "by": "id|text|type", "value": "精确值" }`，点击和输入定位必须唯一。`swipe` 使用 `direction`（up/down/left/right）或 `from/to` 两点坐标；`input` 使用 `value` 和可选 `locator`；`wait` 使用 1～30000 的 `timeoutMs`，等待后仍须用实际页面断言确认，不能以固定等待代替启动就绪条件。最后一步必须有 `expectPage`。

## 补录判定

实际阅读本轮证据后填写：

```json
{
  "schemaVersion": "1.0",
  "runId": "本次运行ID",
  "goal": "与本次目标完全一致",
  "visual": { "status": "passed", "summary": "实际观察到的目标特性效果及对应检查项", "evidence": [{ "id": "截图证据ID", "sha256": "本次截图哈希" }] },
  "runtime": { "status": "inconclusive", "summary": "已观察的交互和仍待确认项", "evidence": [{ "id": "运行日志或组件树证据ID", "sha256": "本次证据哈希" }], "observations": [{ "scenario": "实际验证场景", "note": "该场景的实际操作与观察结果", "evidence": [{ "id": "运行日志或组件树证据ID", "sha256": "本次证据哈希" }] }] },
  "fallback": { "condition": "low-api", "status": "passed", "summary": "回退环境（真机/模拟器与系统 API 版本）及逐项核对的保留行为结论", "evidence": [{ "id": "purpose=fallback的回退环境截图证据ID", "sha256": "本次证据哈希" }] },
  "staticReview": { "results": [{ "id": "静态warn项ID", "status": "passed", "note": "复核结论与代码依据" }] }
}
```

```text
node scripts/verify-development.mjs --project <工程> --resume <runId> --judgment <判定.json> [--output <原输出目录>]
```

补录判定只更新报告，不执行构建或设备操作；`--resume` 也可以补采当前设备截图、导入开发者真机截图或下文的手动验证证据。补采执行器截图要求本轮安装和目标页导航已通过；智感握姿每次补采均再次确认真机。视觉判定必须引用本轮截图；运行判定须引用本轮日志或交互组件树。过期运行、其他目标或哈希不符的证据均拒绝。状态允许 `passed`、`failed`、`inconclusive`，没有实际依据时保持未确认。视觉通过不能覆盖静态 `warn`。构建未通过时不能补录任何效果判定；安装与导航未通过时，可以补录全部引用导入真机截图的视觉判定，以及全部引用手动证据且为 `inconclusive` 的有限运行观察，不能补录运行通过。

`fallback` 补录要求本轮构建已通过（回退实测使用同一构建产物，但不要求本轮安装与导航设备一致）；回退环境截图经 `--import-screenshot --screenshot-purpose fallback` 导入后，以返回的新证据 `id`/`sha256` 引用。同设备手动采集的日志可按下文 `--manual-evidence` 规则导入，不能以其他设备的安装、导航状态覆盖原设备。`condition` 只允许 `low-api`、`unsupported`、`disabled`，可多次 `--resume` 分别补录；`passed`/`failed` 会同步更新改造记录 `fallback` 对应条件项与报告“升级与兼容”回退表，`inconclusive` 保持回退表未验证并保留观察记录。`summary` 必须写明回退环境（真机/模拟器与系统 API 版本）；静态复核结论（`staticReview`）不能代替 `fallback` 实测。

截图用途双向校验：`purpose=target` 的截图不能用于回退判定，`purpose=fallback` 的截图不能用于目标效果的视觉验收；回退 `passed` 至少引用一张 `purpose=fallback` 的截图。执行器采集及 `--manual-evidence` 导入的效果截图均标记为 `target`，回退截图按上文单独导入。未标记用途的旧截图可用于未确认观察，不能单独支撑回退通过；核实其确实来自回退环境后，用 `--import-screenshot <原截图路径> --screenshot-purpose fallback` 重新导入并引用返回的新证据 ID，不能直接修改旧证据用途。环境真实性须结合设备信息、实际截图与运行证据核实，不能仅依据用途标签或 `summary` 文案。

`runtime.observations` 用于保存逐场景运行观察，内容写入报告“运行观察明细”。每项提供非空 `scenario`、`note`，并引用该次 `runtime.evidence` 中的日志或组件树；能力包另有必验场景时仍须完整覆盖。不通过手改 Markdown 补充这些明细。

`staticReview` 用于补录静态 `warn` 项的复核结论：`id` 必须是本次报告中存在的 warn 检查项，`status` 只允许 `passed`（复核无问题）或 `failed`（确认缺陷，需修复后重验），`note` 必填并写明代码依据。复核按检查项 ID 在整个工程的所有改造项上生效并在此后重验中继承；`fail` 级发现不接受复核补录，必须修复。仅包含 `staticReview` 的补录不要求构建或安装已通过。所有 warn 项复核通过后静态检查才标记通过。

`summary` 用简短中文说明本改造项实际观察到的结果、尚未覆盖的内容及限制；证据 ID 和哈希只放在 `evidence` 字段，正文不堆放 E 编号、日志原文或设备 JSON。几何参数仅支持布局结论，材质观感需实际判图；存在未验证要求时不得整体写成通过。

## 手动验证证据补录

执行器受工具格式或命令限制时，允许在已授权的同一设备上手动验证，但须将结果纳入同一份报告；转入时机与截图要求见“执行顺序”第 6 条。真机核验可依据 devecocli 的 `kind: device/emulator`；`deviceType` 仅说明设备形态，特性支持范围以能力包为准，未知设备和明确模拟器不得按真机验收。

手动安装通过要求本轮成功执行完整产品构建并已生成 `deployment_manifest`。具备条件时仍使用 `--execute-build --execute-run`；确有工具阻断而需只构建后手动部署时，使用 `--execute-build` 且省略 `--module` 完成产品级构建，保留原 `--device`、product、build-mode 与输出目录；多入口无法唯一确定时先明确启动配置，不能用单模块编译绕过。模块级构建或没有产物快照的旧运行须重新完整构建，不能仅凭旧构建日志补录通过。

手动验证补录分两步执行，顺序不可颠倒：

1. **先导入证据**：`--manual-evidence` 登记文件并校验 `install`/`navigation` 阶段；`buildEvidence`、安装通过所需的 `deploymentEvidence` 的 id 与 sha256 均从本轮输出复制，分别引用 `build_log` 和 `deployment_manifest`，不可引用其他轮次。导入成功后，**以命令返回的 `origin: manual` 证据列表为准**——其中每条的新 `id` 是后续判定的唯一合法引用，清单里的 `key` 不会出现在判定引用中。
2. **再补录判定**：用上一步返回的新证据 `id`/`sha256` 填写 `--judgment` 的 `runtime`/`visual` 与 `observations`；引用导入前预估的 id 会被拒绝。

先将清单写入临时目录，再执行：

```text
node scripts/verify-development.mjs --project <工程> --resume <runId> --manual-evidence <手动证据清单.json> [--output <原输出目录>]
```

清单格式如下，路径、哈希、说明和引用必须来自实际证据，不照抄示例结论：

```json
{
  "schemaVersion": "1.0",
  "runId": "本次运行ID",
  "goal": "与本次目标一致",
  "device": "本次设备ID",
  "buildEvidence": { "id": "本轮build_log证据ID", "sha256": "该证据哈希" },
  "deploymentEvidence": { "id": "本轮deployment_manifest证据ID", "sha256": "该证据哈希" },
  "installedModules": "modules",
  "provenance": "说明转入手动的具体阻断、采集设备、完整安装产物与本轮构建的关联依据及实际采集过程",
  "files": [
    { "key": "install", "type": "install_log", "path": "安装与启动日志绝对路径", "sha256": "实际哈希" },
    { "key": "modules", "type": "installed_modules", "path": "安装后从该设备查询的应用信息原始JSON绝对路径", "sha256": "实际哈希" },
    { "key": "home", "type": "component_tree", "path": "目标页组件树绝对路径", "sha256": "实际哈希" },
    { "key": "dialog", "type": "screenshot", "path": "打开状态截图绝对路径（PNG 或 JPEG）", "sha256": "实际哈希" }
  ],
  "stages": {
    "install": { "status": "passed", "summary": "完整安装产物、设备模块核验与启动结果", "evidence": ["install", "modules"] },
    "navigation": { "status": "passed", "summary": "实际目标页断言与定位依据", "evidence": ["home"] }
  }
}
```

- `files` 支持 `screenshot`、`component_tree`、`runtime_log`、`install_log`、`navigation_log`、`device_info`、`installed_modules`。`key` 唯一；文件哈希须匹配。截图接受 PNG 与 JPEG（设备端 `snapshot_display`/`uitest` 采集的 JPEG 可直接提供，脚本按实际格式校验与保存）。效果类改造须包含操作前与操作后（或保护前与保护后）至少两张不同截图，不得因格式或采集不便省略。需要补充设备身份时，用可选 `deviceInfo` 引用 `device_info` 的 key，内容须为原始设备查询 JSON，序列号须与本轮设备一致；不得用补录覆盖明确模拟器事实。
- 先阅读日志、组件树和截图，核实同设备、同目标及本轮构建产物的关联，再填写清单。`stages` 可省略或仅包含有证据的阶段；`passed`、`failed`、`inconclusive` 均需说明和文件引用。安装通过须引用安装及启动日志，并以 `installedModules` 指定同次导入的设备应用信息 JSON（在该阶段的 `evidence` 中引用）。执行器验证本轮产物清单的哈希与当前文件一致，再复用 `verifyInstalledModules` 核对 bundle、versionCode、完整模块集合及设备返回的模块版本；缺 HSP、版本不符、旧模块残留或无法解析时拒绝安装通过。仅有构建日志哈希、`install successfully` 或首页截图不满足要求。导航通过须安装已通过完整部署核验并有页面断言日志或组件树。缺原始证据时保留未确认，不根据聊天总结补造成功日志。
- 导入仅记录阶段及证据，截图和运行日志不会自动生成效果通过。使用返回的证据 ID/哈希，按上文 `--judgment` 补录运行、视觉和静态复核结论。能力包要求的场景和目标一致性仍须逐项验证。截图证明的现象与未覆盖的回退、平台条件分别记录。

## 结果与存储

- 最终只交付改造汇总、特性类别或路线与模式、视觉验证结果、升级与兼容四部分组成的 `integration-report.md`，以及它引用的 `evidence/*.png`。不生成 JSON 汇总报告。
- 日志、组件树和合并状态存放在系统临时目录 `harmonyos-os-feature-verification/`。清理临时记录后 MD 与截图仍可独立阅读，但不能补录原运行；需要重验时指定新输出目录，避免覆盖无法合并的旧报告。
- 同工程、特性、路线、产品、构建模式、模块下，按稳定改造项标识更新当前结果，目标标题变化不会创建重复项；不同标识但目标标题、页面、组件、类别、效果和修改文件完全相同的重复记录也合并。历史记录误填 `entry@default` 后更正为 `entry` 时按同一模块合并，其他模块或非默认 target 不作模糊合并。保留首次已知改造前版本，其他改造项保留。同一运行的各场景截图一并引用；不再引用的执行器截图自动清理。
- 最终报告只呈现当前结果，不并列保留同一改造项的历史失败与重验成功。已实施配置、运行验证、视觉验证分列；阶段结果用简短中文，静态提示转为待处理事项并附代码位置，已复核项注明复核结论，完整原始日志留在临时目录。版本任一侧不完整时明确无法确认升级。升级与兼容按整个工程输出一份：版本对照一份，回退表按条件合并所有改造项的保留行为。
- 只有必需阶段及回退检查均通过才标记整体通过；回退检查包含低版本等回退路径的实测（或确认不适用），不以 staticReview 复核替代。缺条件、未判图或未覆盖场景时保留未确认，未完成的回退实测在报告中列明阻断原因与所需条件。
- 报告正文每次从结构化记录重建，不能通过直接编辑 `integration-report.md` 补充验证结论；这种编辑不会写入运行记录，后续补录会将其覆盖。手动结果通过 `--manual-evidence` 和 `--judgment` 落盘，修复代码后重新构建产生新运行，不能继承旧运行的效果通过。
- 交付前读取最终生成的报告，逐项核对聊天总结中的静态复核、构建、安装、运行、视觉及回退结论。手动验证须先导入证据、补录判定并重新生成报告，仅保存文件或在聊天中声称通过不算更新完成。总结不得高于报告中的实际结果；仍有未确认、未验证或目标不一致时明确列出，不宣称“全部验证完成”。补录受阻时说明具体限制，不以另一份手动总结代替统一报告。

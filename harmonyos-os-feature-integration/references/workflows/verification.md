# 验证闭环工作流

## 执行顺序

1. 保存改造前 SDK、compile/target/compatible API 和源程序状态证据；按实际修改填写改造记录，不从接入后工程反推改造前版本。
2. 运行 `verify-development.mjs`，内部复用现有静态检查。SDK 或静态检查明确失败时停止构建；`warn` 保留为待核验项，不写成通过。
3. 自动传入 `--execute-build`，按现有 product/module/build-mode 运行 ohpm 和 Hvigor，同步与打包使用 `--no-daemon`。失败保留首个失败阶段与日志，不修改签名或工程配置以绕过失败。
4. 目标设备明确时自动传入 `--execute-run --device <设备>`，安装本轮构建产物并启动。未指定设备时先查询可用设备，多设备需明确选择，不任意安装，不创建或下载模拟器。
5. 根据实际导航填写步骤，最后一步必须断言目标页；到达后采集截图、组件树和运行日志。导航失败不得使用其他页面截图判定目标效果。
6. AI 实际读取证据并对照能力包后补录判定。能力查询启动时机、滚动末项可达、交互回退等动态行为需要运行观察，单张静态图不能证明。
7. 输出一份 Markdown 与其截图附件。编译通过不代表视觉通过；低版本、不支持、关闭、设备算力、系统设置和性能未覆盖时明确标记未验证，所有回退条件与实施前源程序状态基线逐项对照。

## 命令

```text
node scripts/verify-development.mjs --project <工程> --feature immersive-light --route arkui --goal <目标> --changes <改造记录.json> --sdk <SDK目录> --product <产品名> --module <模块名> --build-mode debug --execute-build --execute-run --device <设备> --navigate <导航.json> --capture-screenshot --capture-layout
```

- `--route` 明确为 `arkui` 或 `hds`，组合路线和多个目标顺序执行，汇总到同一报告。
- `--product`、`--build-mode` 默认 `default`、`debug`，执行前核对工程；省略 `--module` 构建整个产品，运行模块须能唯一确定。`--ability` 指定启动 Ability，`--bundle` 限定运行日志所属应用。
- SDK 自动定位规则沿用现有工程检查；无法定位时显式指定 `--sdk`。
- 未传执行开关仅检查并报告。实施代理须主动传入具备条件的执行开关；运行只使用本轮成功构建的产物，不使用旧包绕过失败。
- 默认输出 `<工程>/os-feature-integration/integration-report.md`，`--output` 可覆盖目录。
- stdout 返回报告路径、`runId`、临时证据路径及哈希。退出码 0 表示没有确定失败（仍可能未验证），1 表示存在失败，2 表示输入或执行器错误；不能仅凭退出码验收。

## 改造记录

实施代理在系统临时目录准备输入，不把过程 JSON 放进交付目录。以下内容须按真实改动和证据填写：

```json
{
  "schemaVersion": "1.0",
  "page": "首页",
  "component": "Tabs",
  "category": "悬浮 Tab",
  "effect": "底部导航接入悬浮材质，列表末项可滚到栏上方",
  "files": ["entry/src/main/ets/pages/Home.ets"],
  "before": { "sdk": 26, "compile": 26, "target": 26, "compatible": 23 },
  "fallback": [
    { "condition": "low-api", "behavior": "保留原导航布局、交互与普通样式", "status": "not_run" },
    { "condition": "unsupported", "behavior": "保留原组件状态和普通样式", "status": "not_run" },
    { "condition": "disabled", "behavior": "保留原普通样式与交互", "status": "not_run" }
  ]
}
```

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
  "visual": { "status": "passed", "summary": "实际观察到的材质效果及对应检查项", "evidence": [{ "id": "截图证据ID", "sha256": "本次截图哈希" }] },
  "runtime": { "status": "inconclusive", "summary": "已观察的交互和仍待确认项", "evidence": [{ "id": "运行日志或组件树证据ID", "sha256": "本次证据哈希" }] }
}
```

```text
node scripts/verify-development.mjs --project <工程> --resume <runId> --judgment <判定.json> [--output <原输出目录>]
```

补录只更新报告，不执行构建或设备操作。视觉判定必须引用本轮截图；运行判定须引用本轮日志或交互组件树。过期运行、其他目标或哈希不符的证据均拒绝。状态允许 `passed`、`failed`、`inconclusive`，没有实际依据时保持未确认。视觉通过不能覆盖静态 `warn`。

## 结果与存储

- 最终只交付改造汇总、沉浸光感类别、视觉验证结果、升级与兼容四部分组成的 `integration-report.md`，以及它引用的 `evidence/*.png`。不生成 JSON 汇总报告。
- 日志、组件树和合并状态存放在系统临时目录 `harmonyos-os-feature-verification/`。清理临时记录后 MD 与截图仍可独立阅读，但不能补录原运行；需要重验时指定新输出目录，避免覆盖无法合并的旧报告。
- 同工程、特性、路线、目标、产品、构建模式、模块的重验替换对应结果，其他目标保留。同一报告顺序写入；不再引用的执行器截图自动清理。
- 只有必需阶段及回退检查均通过才标记整体通过；缺条件、未判图或未覆盖场景时保留未确认。

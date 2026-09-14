# 官网依据开发

## 模式与实现范围

先依据用户意图记录 `developmentMode`。要求 Demo、示例工程或效果复现用 `demo`；已有业务工程接入能力用 `existing_project`。目录存在或模板为空不能决定模式；意图不明确且影响实现时询问一次。

两种模式均完整阅读本次冻结的相关接口、说明、限制及示例上下文。`criteriaStrategy=reuse` 也不能跳过阅读。区分强制约束、建议与示例选择，不把建议提升为强制要求。

- Demo 有适用示例：以示例为基础做最小适配，保留目标相关组件关系、关键属性、调用顺序、状态计算。只替换必要资源、命名和接入位置，不带入无关业务数据、装饰或页面。
- Demo 无示例或示例不完整：直接依据官方接口、说明和契约设计、补齐实现；缺少示例不是失败或额外确认的理由。普通实现细节在需求范围内自行决定。
- 现有工程：保留有效架构、组件组织、状态管理和业务交互，参考示例实现最小必要改动。示例结构、变量、计算方式不同不构成失败；仅需求或官方契约要求时调整现有实现。
- 两种模式都检查版本、参数、生效范围、生命周期及调用规则。示例缺失与契约不明确分别处理：影响正确实现的关键歧义先核对适用版本与上下文，仍无法解决才标记待解决。不能用工程选择绕过契约。

## 开发前与开发后

HDS 接口起始版本不等于工程最低兼容版本。不得仅因接口从 API 23 起提供就要求提高 `compatibleSdkVersion`；按用户需求保留最低兼容范围，并从本次冻结官网与实际代码核验低版本调用条件、加载方式及兼容行为。关键兼容问题无法确定时明确记录待解决项，不得将缺少回退示例表述为官网强制要求 compatible ≥ 23，也不得将程序门禁通过表述为低版本运行安全。

当开发目标使用 API 26 时，Demo 与现有工程均在根目录 `build-profile.json5` 的目标 product 中使用 `"targetSdkVersion": "26.0.0"`，不得生成 `"6.1.0(26)"`。这是用户指定的工程配置约束，不作为官网判据。`compatibleSdkVersion` 按实际最低兼容要求确定，不能仅因 target 为 26 就同步提高；若其要求也是 API 26，同样使用 `"26.0.0"`。修改前登记基线与实施依据，构建前核对实际配置；版本字符串符合此约束不代表本机工具链或构建已验证通过。

1. 修改前用 `snapshot-project-files.mjs capture` 保存所有将触及文件的基线，新增文件也提前登记；扩大修改范围时，先补充尚未修改文件的基线。基线脚本只检查登记文件，不代表全工程审计。
2. 在同一份 `implementation-<场景ID>.json` 中填写模式、requirements 和计划 steps，运行 plan 校验。每条判据均记录实施方式或不适用/冲突上下文的依据；不得为了通过门禁删掉未解决的判据。
3. 按模式实施。每个步骤关联官方判据；契约未规定的实现选择通过 `engineering_choice` 记录具体工程约束，不能替代官方依据。
4. 对照冻结原文与真实代码，填写 review：需求到代码检查遗漏，代码到依据检查额外改动。Demo 采用示例时同时对照关键点；现有工程不做示例相似度检查。对照依据具体说明满足的位置与行为，不能只写“符合”。
5. 运行 applied 校验。构建入口自动重复该门禁；它检查来源与覆盖，AI 负责语义对照，运行和视觉验证负责实际效果，三者不能替代。

```text
node scripts/validate-implementation.mjs --project <工程绝对路径> --criteria <判据文件> --implementation <实施记录> --phase plan [--frozen <冻结目录>]
node scripts/validate-implementation.mjs --project <工程绝对路径> --criteria <判据文件> --implementation <实施记录> --baseline <基线文件> --phase applied [--frozen <冻结目录>]
```

冻结目录默认 `<工程>/ohos-feature-engineering/frozen`；`verify-development.mjs` 也接受 `--frozen`。构建/运行必须提供 baseline 和完整 implementation；历史报告仍可读取，历史记录用于新构建时补齐新增字段。

## 实施记录契约

保留原有 steps，并增加以下字段。plan 阶段不要求代码位置及 review 已完成；applied 阶段要求真实位置与通过的对照。下例为字段示意，来源哈希必须从实际正文计算。

```json
{
  "developmentMode": "demo",
  "requirements": [{
    "criteriaId": "C01",
    "strength": "required",
    "disposition": "implement",
    "approach": "通过官方接口在目标组件配置材质",
    "sources": [{ "snapshotId": "api", "lineStart": 10, "lineEnd": 18, "sha256": "实际片段SHA-256" }],
    "review": { "status": "passed", "basis": "实际代码位置、契约要求及对应行为" }
  }],
  "steps": [{
    "id": "S01",
    "description": "配置目标组件",
    "status": "applied",
    "locations": [{ "path": "entry/src/main/ets/pages/Index.ets", "version": "after", "lineStart": 10, "lineEnd": 18 }],
    "basis": [{ "type": "criteria", "criteriaId": "C01", "reason": "对应的官方接口约束" }]
  }]
}
```

- `strength`：`required|recommendation|example`，忠实反映官网语气；字段合法不能证明分类语义正确。
- `disposition`：`implement|not_applicable|conflict_context`。后两者须填 `reason` 并保留来源；`conflict_context` 仅用于带 conflictGroup 的判据，不要求实现互斥的两侧，但须保留冲突并解释适用性。关键问题未解决时 review 不能 passed。
- 每个 source 的行号按冻结 Markdown 正文从 1 开始；片段取闭区间，按 LF 连接、不另加末尾换行，以 UTF-8 计算 SHA-256。程序还核验全页哈希、冻结批次与官网 URL。
- `samples` 可省略或为空。元素为 `{usage: "adopted|reference", scope, source, keyPoints?}`；source 同上。Demo 有适用示例应采用，不能通过标 reference 绕过采用要求；程序不推断官网是否存在适用示例，由原文检查负责。
- Demo 的 adopted 示例要求非空 `keyPoints`，每项为 `{description, adaptation, review: {status, basis}}`；无需适配时 adaptation 写“原样保留”。局部示例只登记其覆盖的关键点，其他部分按契约补齐。现有工程无需 keyPoints。
- review.status 使用 `passed|unresolved|failed`；applied 只接受 passed。该记录是 AI 的语义观察，不是程序对语义的证明。
- `engineering_choice` 除 reason 外必须有 `constraint`，说明具体工程限制与必要性；同一步仍须关联相关 criteria。
- `steps[].status=existing` 表示已有代码满足：引用基线内未修改文件的 after 位置，无需制造 diff。修改过的文件中引用保留代码用 applied，并登记该文件实际修改位置。
- applied 覆盖基线 diff 的 before 删除行和 after 新增行，不得以同文件的一处引用代替所有变更。使用基线比较脚本实际输出的区段登记；宽范围声明仍须由语义对照检查其真实性。

门禁失败使用明确的实施依据错误，不写成视觉 inconclusive。没有示例、示例字段为空、现有工程与示例结构不同均不单独导致拒绝。

## 构建失败归因

构建执行器顺序运行 `ohpm install --all`、Hvigor `--sync --no-daemon`、Hvigor 打包 `--no-daemon`。产品构建使用 `assembleApp`；指定模块时按模块类型选择 `assembleHap`、`assembleHsp` 或 `assembleHar`，保留 product、buildMode 和模块选择。每阶段失败立即停止，实际命令与输出合并到本轮 `build.log`，构建失败继续遵循下述归因规则。该执行方式用于避免 daemon 常驻影响工具调用收尾，不修改工程 `execution.daemon` 或全局工具链，也不清理其他 daemon。安装运行仍使用 `devecocli run --skip-build`。

工具链优先采用 `DEVECO_CLI_STUDIO_PATH` / `DEVECO_CLI_CLT_PATH`（兼容 `DEVECO_HOME` / `DEVECO_PATH`），未指定时从已检查的 SDK 路径定位所属 Studio。CLT 需提供 `JAVA_HOME`。无法找到对应 Node、ohpm、Hvigor、JDK 时明确失败，不回退到启用 daemon 的构建。构建使用 `.hvigor/.build-lock` 防止与其他构建并发；已有锁时报告阻塞，不自动删除。同步每轮执行，不依赖 devecocli 的同步缓存；不执行其 C++ 语言服务索引合并。

构建失败先只读对照本轮构建日志、本次冻结官网、失败时代码和对应版本 SDK 声明，再决定后续动作。不能依据错误关键词自动归因官网。

| category | decision | 动作 |
|---|---|---|
| `unknown` | `investigate_only` | 原因待确认，继续只读排查；证据仍不足则报告，不猜测修改 |
| `implementation_error` | `repair_according_to_official` | AI 漏导入、错误参数等实现问题：按官网修复，更新实施记录，重新执行门禁和构建 |
| `environment_issue` | `resolve_prerequisites` | 定位 SDK、依赖、配置等前提；仅在已授权范围内处理，不能处理则报告阻塞 |
| `official_documentation` | `stop_repair` | 确认官网问题：停止修改和重试，保留失败现场与证据，直接报告 |

确认官网问题须证明相关代码忠实采用说明，且满足文档声明的版本和配置前提。示例与 SDK 不一致也可能是本机版本不符；未排除时保持 unknown 或 environment_issue。归因是 AI 的证据分析，程序仅核验记录、归属和哈希。

不自动修正官网判据、不删除能力或降级需求、不生成替代实现。用户之后明确要求绕过官网问题时才另行处理。`repair-attempts` 仍仅为 0–2 的记录字段，不自动执行修复、不累计跨轮次数，也不构成重试控制器。

构建失败后本轮安装、运行、导航、截图和组件树采集全部停止；外部观察、判图结论不再注入。install/runtime/visual 保持 not_run，总结果保持 failed。初次失败自动登记 unknown。构建前将基线登记的现存代码与冻结正文复制到本轮 evidence 下，报告的 `buildInputs` 记录路径和全文件哈希；归因引用这些副本，不引用后来修改的源文件。SDK 声明引用本轮 sdk_declaration 证据，文件变化后不能继续使用原哈希确认。

AI 完成分析后编写归因 JSON，通过下列命令更新已有报告，不重跑构建：

```text
node scripts/record-build-diagnosis.mjs --report <development-verification-report.json> --diagnosis <build-diagnosis.json>
```

归因字段：`category`、`decision`、`summary`、`buildLog: {path, sha256}`、`evidence: [{type, path, sha256, lineStart, lineEnd}]`。类型为 code、official_source、sdk_declaration；行号从 1 开始，哈希为全文件 SHA-256。buildLog 必须唯一匹配汇总报告中失败条目的本轮构建日志；其他证据须匹配该条目的 buildInputs 或 SDK 证据。未知原因可以只有日志，不能虚构其他材料。

official_documentation 额外必填：

- evidence 至少包含 official_source 和 code；正文引用需覆盖实际矛盾的接口、说明或示例。
- `sdkComparisonRequired`：涉及接口签名或版本差异时必须 true，并引用对应 sdk_declaration；其他文档问题填 false。
- `premises: {codeMatchesOfficial: true, versionSatisfied: true, configurationSatisfied: true, basis: "具体对照说明"}`。任一项无法确认时不能声明官网问题。

证据不足、路径或哈希不匹配、同一日志匹配多个目标时拒绝写回，原报告保留。归因成功后报告展示原因、处理决定和证据位置，并保留 failed。历史报告仍可阅读；历史失败报告缺少构建输入证据时不能凭空确认官网问题。

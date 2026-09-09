---
name: harmonyos-feature-engineering2
description: 资料审阅（document-review）与官网冻结驱动的判据现提式开发（code-development-validation）。能力包只登记场景、官网入口与判据骨架；开发时按“冻结本次官网内容 → 与上次审查比较 → 变化部分现提判据 → 从判据生成代码 → 构建运行”执行，判据权威来源是每次冻结的官网现网页。当前覆盖沉浸光感（ArkUI API 26 与 HDS 6.1.0(23)）。
metadata:
  short-description: 资料审阅与官网冻结判据现提开发
---

# 鸿蒙特性工程（官网冻结 · 判据现提）

**能力包不预存规范事实**。它只登记场景路由、官网入口映射、判据需求骨架与冲突监测点；每次开发时实时抓取官网、冻结快照、与上次审查比较，变化部分现提判据，代码从判据生成。判据的权威来源始终是本次冻结快照。

两个模式的依据与副作用相互隔离：审阅只产出 findings 与门禁；开发只消费冻结快照与本次判据。

## 路由

- 用户要求审查 Markdown/HTML/TXT 单文件、文档目录或 `developer.huawei.com` URL，或要求审查某次开发冻结的官网快照：进入 `document-review`。
- 用户提供特性名、目标 HarmonyOS 工程绝对路径和自然语言开发目标，要求接入、开发、构建或验证：进入 `code-development-validation`（七步链路）。
- 开发目标先按 [场景与资料映射](references/development/scenario-routing.md) 定位。“沉浸光感典型场景：搜索框标题栏具有沉浸光感效果”对应 IL-S013，“内容区标题栏开启沉浸光感”对应 IL-S014；缺工程路径仍可先定位场景和章节，实施前补齐路径。
- 只询问接口、支持范围、设计建议或两套 Kit 差异时，按场景映射读取相关资料并解释，不创建工程、不执行构建。用户要求多个效果时分别解析目标，不能用单个最高分丢弃其他需求。
- 同时要求多模式输出时先明确独立产物；审查报告不作为开发的直接判据，开发判据只能来自本次冻结快照现提。

## document-review 工作流（资料审阅）

1. 完整阅读 [审查流程](references/review/workflow.md)、[质量模型](references/review/quality-model.md) 和 [证据规则](references/review/evidence-rules.md)。输入是 URL 时先按 [URL 快照](references/review/url-snapshot.md) 用 `scripts/snapshot-url.mjs` 生成资料目录。
2. 输入支持三种形态：本地单文件/目录、官网 URL、**开发链路的冻结快照目录**（`<工程>/ohos-feature-engineering/frozen/snapshots/`，freeze 产物直接作为审阅边界，用于在现提判据前发现新冲突与歧义）。
3. 按 [输入抽取](references/review/extraction.md) 用 `scripts/prepare-review.mjs` 预检，双层审查（内部质量始终执行；外部技术事实定向取证，默认最多 12 个官方页面）。
4. findings 按严重度排序保留全部；按 [报告契约](references/review/report-contract.md) 形成 JSON，`scripts/validate-report.mjs` 校验后 `scripts/render-report.mjs` 渲染。始终生成 `review-report.json/md`，不得改写源文档。
5. 版本保护写法等自登记工程判断按 [工程验证规则](references/engineering-verification-rules.md) 执行——它们不是官网事实，不得进入能力包或开发判据。

## code-development-validation 工作流（七步链路，程序编排）

1. **场景解析**：完整阅读 [能力包契约](references/development/capability-contract.md) 与 [报告契约](references/development/report-contract.md)，按自然语言目标路由唯一场景（`scripts/lib/capability-tools.mjs` 的 `resolveScenario`）；不唯一时列候选请用户选择，选择前不得动工程。
2. **冻结快照**：`node scripts/freeze-snapshot.mjs --scenario <ID> --project <工程绝对路径>` 按场景入口实时抓取全部页面并冻结（全页 SHA-256），产物写入 `<工程>/ohos-feature-engineering/frozen/`（`--output` 显式优先）。任一入口不可达即整体失败——网页是唯一真值，不回退缓存。
3. **比较上次**：`node scripts/diff-snapshots.mjs --frozen <工程>/ohos-feature-engineering/frozen --project <工程绝对路径>` 与 `capabilities/<feature>/sessions/latest` 比较（diff-report.json 写入 `<工程>/ohos-feature-engineering/`）。unchanged / changed（分类 api-signature｜version｜deletion｜content，前三类+新增页为高危）。
4. **现提判据**：`node scripts/derive-criteria.mjs materials --scenario <ID> --frozen <目录> --project <工程绝对路径> [--diff diff-report.json]`（产物按场景命名，写入 `<工程>/ohos-feature-engineering/`）
   - 全部 unchanged → 直接产出复用判据集 `criteria-<场景ID>.json`（strategy=reuse，锚点已重新命中本次快照）；
   - 有变化 → 产出 `materials-<场景ID>.json`（变化段原文＋骨架 required topics＋冲突监测点含上次结论＋高危清单）。代理逐条现提草稿：每个 topic 至少一条判据（statement 忠实原文、anchor 逐字存在于本次快照）；每个冲突监测点给结论（persists/resolved/changed，persists 时两侧判据成对标 conflictGroup）；**高危变化先向用户确认**再记入 confirmations。
   - `node scripts/derive-criteria.mjs validate --scenario <ID> --frozen <目录> --project <工程绝对路径> --draft <草稿> [--diff ...]` 校验（锚点命中、骨架覆盖、监测结论、高危确认；未覆盖 topic 自动补入锚点仍命中的 reused 判据），通过产出最终 `criteria-<场景ID>.json`。
5. **生成代码**：按场景实施规则与判据改代码；实施记录三层链——代码行 → 判据 id（`basis.type="criteria"`）→ 快照原文行。
6. **构建运行**：`node scripts/verify-development.mjs --project <绝对路径> --goal <目标> --criteria <工程>/ohos-feature-engineering/criteria-<场景ID>.json [--execute-build] [--execute-run --device <设备>] [--navigate route-steps.json] [--capture-screenshot] [--judgment visual-judgment.json] [--implementation 实施记录]`。所有目标的报告合并写入 `<工程>/ohos-feature-engineering/development-verification-report.json/md`（`--output` 显式优先）。多个场景按顺序执行并更新同一份报告；同一场景的同一目标重跑替换结果，不同目标保留。Markdown 按开发目标展示并内嵌截图，截图与日志保存在报告旁的 `evidence/` 中。`--execute-build/--execute-run` 时判据集必检（结构＋冲突监测点覆盖），缺失即拒绝。六层验证（static/sdk/build/install/runtime/visual）、导航编排（route-steps.json＋expectPage 断言）、截图采集与模型判图注入。
7. **归档**：验证成功后 `node scripts/archive-session.mjs --frozen <目录> --criteria <工程>/ohos-feature-engineering/criteria-<场景ID>.json` 按 topic/快照合并为新的 `sessions/latest`（其他场景未触及的判据与快照保留）。

## 硬性边界

- 两模式隔离：审阅 findings 不作为开发判据；开发只消费本次冻结快照与由其现提的判据。
- 审阅的外部技术事实只有同版本官方证据支撑才可 `confirmed`；模型记忆与第三方内容不能单独支撑；抓取时间未知保持 null。
- 自登记工程验证规则（见 [工程验证规则](references/engineering-verification-rules.md)）仅限审阅模式使用。
- 判据只能来自本次冻结快照正文；上次判据仅是复用缓存与对照，锚点失效即不得复用。
- 官网不可达即阻塞；本地不保留可回退的判据正文缓存。
- 高危变化（api-signature/version/deletion/新页）未经用户确认不得继续生成代码。
- 冲突监测点结论为 persists 时必须保留双预期（两条判据同 conflictGroup），验证按 `passed_with_spec_conflict/inconclusive/failed` 状态机裁决，不得提前选边。
- 构建与运行前的判据校验由程序强制；判图结论只能匹配判据预期，不得反向改写判据。
- 实施记录引用不存在的判据 id 时拒绝；报告契约要求 criteriaRefs/conflictingCriteriaRefs/frozenAt。开发汇总报告默认写入 `<工程>/ohos-feature-engineering/`，截图须在 Markdown 中直接展示。

## 资源

- 审阅：`scripts/prepare-review.mjs`（预检）、`scripts/snapshot-url.mjs`（URL 快照）、`scripts/fetch-doc.mjs`（官方抓取）、`scripts/validate-report.mjs` / `render-report.mjs`。
- 开发链路：`scripts/freeze-snapshot.mjs` / `diff-snapshots.mjs` / `derive-criteria.mjs` / `archive-session.mjs`（链路 2/3/4/7）。
- `scripts/verify-development.mjs`：判据门禁＋六层验证＋导航＋判图。
- `scripts/lib/capability-tools.mjs`：能力包加载与契约校验（scenarios＋sessions/latest 完整性）。
- `capabilities/immersive-light/`：scenarios.json（18 场景＋15 官网入口＋判据骨架＋冲突监测点）、sessions/latest（上次审查）、assets（带来源分类）。
- `references/engineering-verification-rules.md`：自登记工程验证规则（非官网事实），仅限审阅模式。
- evals：`run-development-tests.mjs`（开发链路）、`run-routing-tests.mjs`（自然语言路由、来源与新增判据门禁）。

## 完成标准

- 审阅产出覆盖九个质量维度的完整 findings 与 `integrationGate`，可从 `confirmed` 反查证据。
- 开发每次均产生（统一落在 `<工程>/ohos-feature-engineering/` 单一目录）：frozen.json（冻结快照）、diff-report.json、criteria-<场景ID>.json（reuse 或 fresh）、开发汇总报告（`development-verification-report.json/md`，含各目标结果与截图预览）。
- 开发报告可从代码行反查判据、判据反查冻结快照锚点、快照反查官网 URL 与哈希。
- 全部断言（`node evals/run-development-tests.mjs` 和 `node evals/run-routing-tests.mjs`）通过。

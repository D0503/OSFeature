---
name: harmonyos-feature-engineering2
description: v2 实验版：资料审阅（document-review）、开发验证清单（development-validation-planning）与官网冻结驱动的判据现提式开发（code-development-validation）。能力包只登记场景、官网入口与判据骨架；开发时按“冻结本次官网内容 → 与上次审查比较 → 变化部分现提判据 → 从判据生成代码 → 构建运行”执行，判据权威来源是每次冻结的官网现网页。当前覆盖沉浸光感（ArkUI API 26 与 HDS 6.1.0(23)）。
metadata:
  short-description: 资料审阅、验证清单与官网冻结判据现提开发（v2）
---

# 鸿蒙特性工程 v2（官网冻结 · 判据现提）

与 v1（harmonyos-feature-engineering）的核心区别：**能力包不再预存规范事实**。它只登记场景路由、官网入口映射、判据需求骨架与冲突监测点；每次开发时实时抓取官网、冻结快照、与上次审查比较，变化部分现提判据，代码从判据生成。判据的权威来源始终是本次冻结快照。

三个模式的依据与副作用相互隔离：审阅只产出 findings 与门禁；清单只规划不执行；开发只消费冻结快照与本次判据。

## 路由

- 用户要求审查 Markdown/HTML/TXT 单文件、文档目录或 `developer.huawei.com` URL，或要求审查某次开发冻结的官网快照：进入 `document-review`。
- 用户要求根据文档或审查结果列出需要写代码验证的场景、最小工程实验或验证清单：进入 `development-validation-planning`。没有同一资料的有效审查报告时必须先审阅。
- 用户提供特性名、目标 HarmonyOS 工程绝对路径和自然语言开发目标，要求接入、开发、构建或验证：进入 `code-development-validation`（七步链路）。
- 同时要求多模式输出时先明确独立产物；审查报告与清单不作为开发的直接判据，开发判据只能来自本次冻结快照现提。

## document-review 工作流（资料审阅）

1. 完整阅读 [审查流程](references/review/workflow.md)、[质量模型](references/review/quality-model.md) 和 [证据规则](references/review/evidence-rules.md)。输入是 URL 时先按 [URL 快照](references/review/url-snapshot.md) 用 `scripts/snapshot-url.mjs` 生成资料目录。
2. 输入支持三种形态：本地单文件/目录、官网 URL、**开发链路的冻结快照目录**（`evidence/frozen/snapshots/`，freeze 产物直接作为审阅边界，用于在现提判据前发现新冲突与歧义）。
3. 按 [输入抽取](references/review/extraction.md) 用 `scripts/prepare-review.mjs` 预检，双层审查（内部质量始终执行；外部技术事实定向取证，默认最多 12 个官方页面）。
4. findings 按严重度排序保留全部；按 [报告契约](references/review/report-contract.md) 形成 JSON，`scripts/validate-report.mjs` 校验后 `scripts/render-report.mjs` 渲染。始终生成 `review-report.json/md`，不得改写源文档。
5. 版本保护写法等自登记工程判断按 [工程验证规则](references/engineering-verification-rules.md) 执行——它们不是官网事实，不得进入能力包或开发判据。

## development-validation-planning 工作流（开发验证清单）

1. 完整阅读 [验证规划流程](references/validation-planning/workflow.md) 和 [清单契约](references/validation-planning/checklist-contract.md)。必须先有同一资料（含冻结快照）的有效 `review-report.json`，并读取全部正文。
2. 登记工程事实台账（冲突并列保留），整理“可以开发什么”（developmentOptions），每个待验证事实至少一个 `DEVVAL-*` 验证项：自然 `developerPrompt`（不泄露内部 ID 与结论）+ 分层验证（static/sdk/build/simulator/device；视觉不得只凭编译确认）。
3. 事实级门禁：`reviewGate` 不整体扩散，仅条目引用的未决事实触发 `fact_gate`；裁决实验在 `resolutionFactRefs` 声明并用最小工程。
4. 清单只规划：所有条目初始状态仅 `not_run/blocked`，不创建工程、不执行验证。
5. 按 [清单契约](references/validation-planning/checklist-contract.md) 形成 1.3 版 JSON，`scripts/validate-validation-checklist.mjs` 校验后 `scripts/render-validation-checklist.mjs` 渲染。
6. 与开发链路的衔接：清单中的冲突/歧义项是 v2 冲突监测点（conflictProbes）的来源之一；清单不直接产出判据，判据仍由开发链路从冻结快照现提。

## code-development-validation 工作流（七步链路，程序编排）

1. **场景解析**：按自然语言目标路由唯一场景（`scripts/lib/capability2-tools.mjs` 的 `resolveScenario2`）；不唯一时列候选请用户选择，选择前不得动工程。
2. **冻结快照**：`node scripts/freeze-snapshot.mjs --scenario <ID> [--output evidence/frozen]` 按场景入口实时抓取全部页面并冻结（全页 SHA-256）。任一入口不可达即整体失败——网页是唯一真值，不回退缓存。
3. **比较上次**：`node scripts/diff-snapshots.mjs --frozen <目录>` 与 `capabilities2/<feature>/sessions/latest` 比较。unchanged / changed（分类 api-signature｜version｜deletion｜content，前三类+新增页为高危）。
4. **现提判据**：`node scripts/derive-criteria.mjs materials --scenario <ID> --frozen <目录> [--diff diff-report.json]`
   - 全部 unchanged → 直接产出复用判据集 `criteria.json`（strategy=reuse，锚点已重新命中本次快照）；
   - 有变化 → 产出 `materials.json`（变化段原文＋骨架 required topics＋冲突监测点含上次结论＋高危清单）。代理逐条现提草稿：每个 topic 至少一条判据（statement 忠实原文、anchor 逐字存在于本次快照）；每个冲突监测点给结论（persists/resolved/changed，persists 时两侧判据成对标 conflictGroup）；**高危变化先向用户确认**再记入 confirmations。
   - `node scripts/derive-criteria.mjs validate --scenario <ID> --frozen <目录> --draft <草稿> [--diff ...]` 校验（锚点命中、骨架覆盖、监测结论、高危确认；未覆盖 topic 自动补入锚点仍命中的 reused 判据），通过产出最终 `criteria.json`。
5. **生成代码**：按场景实施规则与判据改代码；实施记录三层链——代码行 → 判据 id（`basis.type="criteria"`）→ 快照原文行。
6. **构建运行**：`node scripts/verify-development.mjs --project <绝对路径> --goal <目标> --criteria criteria.json [--execute-build] [--execute-run --device <设备>] [--navigate route-steps.json] [--capture-screenshot] [--judgment visual-judgment.json] [--implementation 实施记录]`。报告与 `evidence/` 默认写入**目标工程根目录**（`--output` 显式优先）。`--execute-build/--execute-run` 时判据集必检（结构＋冲突监测点覆盖），缺失即拒绝。六层验证（static/sdk/build/install/runtime/visual）、导航编排、截图采集、模型判图与 v1 相同。
7. **归档**：验证成功后 `node scripts/archive-session.mjs --frozen <目录> --criteria criteria.json` 按 topic/快照合并为新的 `sessions/latest`（其他场景未触及的判据与快照保留）。

## 硬性边界

- 三模式隔离：审阅 findings 与清单计划不作为开发判据；开发只消费本次冻结快照与由其现提的判据；清单不得把计划项写成已通过或失败。
- 审阅的外部技术事实只有同版本官方证据支撑才可 `confirmed`；模型记忆与第三方内容不能单独支撑；抓取时间未知保持 null。
- `developerPrompt` 必须可独立理解，不出现内部编号或预设答案；自登记工程验证规则（见 [工程验证规则](references/engineering-verification-rules.md)）仅限审阅与清单模式使用。
- 判据只能来自本次冻结快照正文；上次判据仅是复用缓存与对照，锚点失效即不得复用。
- 官网不可达即阻塞；本地不保留可回退的判据正文缓存。
- 高危变化（api-signature/version/deletion/新页）未经用户确认不得继续生成代码。
- 冲突监测点结论为 persists 时必须保留双预期（两条判据同 conflictGroup），验证按 `passed_with_spec_conflict/inconclusive/failed` 状态机裁决，不得提前选边。
- 构建与运行前的判据校验由程序强制；判图结论只能匹配判据预期，不得反向改写判据。
- 实施记录引用不存在的判据 id 时拒绝；报告 2.0 契约（criteriaRefs/conflictingCriteriaRefs/frozenAt）。开发报告默认写入目标工程根目录。

## 资源

- 审阅：`scripts/prepare-review.mjs`（预检）、`scripts/snapshot-url.mjs`（URL 快照）、`scripts/fetch-doc.mjs`（官方抓取）、`scripts/validate-report.mjs` / `render-report.mjs`。
- 清单：`scripts/validate-validation-checklist.mjs` / `render-validation-checklist.mjs`。
- 开发链路：`scripts/freeze-snapshot.mjs` / `diff-snapshots.mjs` / `derive-criteria.mjs` / `archive-session.mjs`（链路 2/3/4/7）。
- `scripts/verify-development.mjs`：判据门禁＋六层验证＋导航＋判图（报告 2.0）。
- `scripts/lib/capability2-tools.mjs`：v2 能力包契约（scenarios 2.0＋sessions/latest 完整性）。
- `capabilities2/immersive-light/`：scenarios.json（11 场景＋11 官网入口＋判据骨架＋冲突监测点）、sessions/latest（上次审查）、assets（带来源分类）。
- `references/engineering-verification-rules.md`：自登记工程验证规则（非官网事实），仅限审阅与清单模式。
- evals：`run-v2-tests.mjs`（开发链路 42 断言）、`run-validation-planning-tests.mjs`（清单 31 断言）。

## 完成标准

- 审阅产出覆盖九个质量维度的完整 findings 与 `integrationGate`，可从 `confirmed` 反查证据。
- 清单完整登记工程事实、提供可黑盒使用的 `developerPrompt`、事实级门禁只作用于引用项，全部初始状态 `not_run/blocked`。
- 开发每次均产生：frozen.json（冻结快照）、diff-report.json、criteria.json（reuse 或 fresh）、2.0 版验证报告。
- 开发报告可从代码行反查判据、判据反查冻结快照锚点、快照反查官网 URL 与哈希。
- 全部断言（`node evals/run-v2-tests.mjs` 与 `node evals/run-validation-planning-tests.mjs`）通过。

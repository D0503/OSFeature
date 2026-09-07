---
name: harmonyos-feature-engineering2
description: v2 实验版：能力包只登记场景、官网入口与判据骨架，开发时按“冻结本次官网内容 → 与上次审查比较 → 变化部分现提判据 → 从判据生成代码 → 构建运行”执行；判据权威来源是每次冻结的官网现网页。当前覆盖沉浸光感（ArkUI API 26 与 HDS 6.1.0(23)）。
metadata:
  short-description: 官网冻结驱动的判据现提式开发验证（v2）
---

# 鸿蒙特性工程 v2（官网冻结 · 判据现提）

与 v1（harmonyos-feature-engineering）的核心区别：**能力包不再预存规范事实**。它只登记场景路由、官网入口映射、判据需求骨架与冲突监测点；每次开发时实时抓取官网、冻结快照、与上次审查比较，变化部分现提判据，代码从判据生成。判据的权威来源始终是本次冻结快照。

## 七步链路（程序编排，逐步执行）

1. **场景解析**：按自然语言目标路由唯一场景（`scripts/lib/capability2-tools.mjs` 的 `resolveScenario2`）；不唯一时列候选请用户选择，选择前不得动工程。
2. **冻结快照**：`node scripts/freeze-snapshot.mjs --scenario <ID> [--output evidence/frozen]` 按场景入口实时抓取全部页面并冻结（全页 SHA-256）。任一入口不可达即整体失败——网页是唯一真值，不回退缓存。
3. **比较上次**：`node scripts/diff-snapshots.mjs --frozen <目录>` 与 `capabilities2/<feature>/sessions/latest` 比较。unchanged / changed（分类 api-signature｜version｜deletion｜content，前三类+新增页为高危）。
4. **现提判据**：`node scripts/derive-criteria.mjs materials --scenario <ID> --frozen <目录> [--diff diff-report.json]`
   - 全部 unchanged → 直接产出复用判据集 `criteria.json`（strategy=reuse，锚点已重新命中本次快照）；
   - 有变化 → 产出 `materials.json`（变化段原文＋骨架 required topics＋冲突监测点含上次结论＋高危清单）。代理逐条现提草稿：每个 topic 至少一条判据（statement 忠实原文、anchor 逐字存在于本次快照）；每个冲突监测点给结论（persists/resolved/changed，persists 时两侧判据成对标 conflictGroup）；**高危变化先向用户确认**再记入 confirmations。
   - `node scripts/derive-criteria.mjs validate --scenario <ID> --frozen <目录> --draft <草稿> [--diff ...]` 校验（锚点命中、骨架覆盖、监测结论、高危确认；未覆盖 topic 自动补入锚点仍命中的 reused 判据），通过产出最终 `criteria.json`。
5. **生成代码**：按场景实施规则与判据改代码；实施记录三层链——代码行 → 判据 id（`basis.type="criteria"`）→ 快照原文行。
6. **构建运行**：`node scripts/verify-development.mjs --project <绝对路径> --goal <目标> --criteria criteria.json [--execute-build] [--execute-run --device <设备>] [--navigate route-steps.json] [--capture-screenshot] [--judgment visual-judgment.json] [--implementation 实施记录]`。`--execute-build/--execute-run` 时判据集必检（结构＋冲突监测点覆盖），缺失即拒绝。六层验证（static/sdk/build/install/runtime/visual）、导航编排、截图采集、模型判图与 v1 相同。
7. **归档**：验证成功后 `node scripts/archive-session.mjs --frozen <目录> --criteria criteria.json` 按 topic/快照合并为新的 `sessions/latest`（其他场景未触及的判据与快照保留）。

## 硬性边界

- 判据只能来自本次冻结快照正文；上次判据仅是复用缓存与对照，锚点失效即不得复用。
- 官网不可达即阻塞；本地不保留可回退的判据正文缓存。
- 高危变化（api-signature/version/deletion/新页）未经用户确认不得继续生成代码。
- 冲突监测点结论为 persists 时必须保留双预期（两条判据同 conflictGroup），验证按 `passed_with_spec_conflict/inconclusive/failed` 状态机裁决，不得提前选边。
- 构建与运行前的判据校验由程序强制；判图结论只能匹配判据预期，不得反向改写判据。
- 实施记录引用不存在的判据 id 时拒绝；报告 2.0 契约（criteriaRefs/conflictingCriteriaRefs/frozenAt）。

## 资源

- `scripts/freeze-snapshot.mjs` / `diff-snapshots.mjs` / `derive-criteria.mjs` / `archive-session.mjs`：链路 2/3/4/7。
- `scripts/verify-development.mjs`：判据门禁＋六层验证＋导航＋判图（报告 2.0）。
- `scripts/lib/capability2-tools.mjs`：v2 能力包契约（scenarios 2.0＋sessions/latest 完整性）。
- `capabilities2/immersive-light/`：scenarios.json（11 场景＋11 官网入口＋判据骨架＋冲突监测点）、sessions/latest（上次审查）、assets（带来源分类）。
- `evals/run-v2-tests.mjs`：离线回归（契约/链路/门禁/三层链/判图导航）。
- 详细契约见 [能力包契约](references/capability-contract.md) 与 [报告契约](references/report-contract.md)。

## 完成标准

- 每次开发均产生：frozen.json（冻结快照）、diff-report.json、criteria.json（reuse 或 fresh）、2.0 版验证报告。
- 报告可从代码行反查判据、判据反查冻结快照锚点、快照反查官网 URL 与哈希。
- 全部断言（`node evals/run-v2-tests.mjs`）通过。

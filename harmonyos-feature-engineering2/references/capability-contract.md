# v2 能力包契约

## 目录结构

```
capabilities2/<feature>/
  scenarios.json            # 场景注册（契约 2.0）
  sessions/latest/          # 上次审查基线（自动演进）
    session.json
    snapshots/<snapshotId>.md
  assets/                   # 最小参考资产（带来源分类）
capabilities2/registry.json # 能力注册表（2.0）
```

## scenarios.json（2.0）

- `entryPoints[]`：官网入口全集——`snapshotId`（唯一）、`officialUrl`（华为开发者官网 HTTPS）、`title`（必填）。
- `routes[] / safety / verification / projectSignals`：技术路线门槛、安全策略与六层验证策略（语义同 v1）。
- `scenarios[]`：每个场景必须包含——
  - `id / displayName / route / intentPatterns / targets`：路由信息；
  - `sources[]`：该场景需要的官网入口（⊆ entryPoints）；
  - `criteriaSpec.required[]`：判据需求骨架——`topic`（稳定主题名）、`hint`（上次审查结论参考）、`mustResolve`；
  - `criteriaSpec.conflictProbes[]`：冲突监测点——`id`、`topic`、`positions`；现提时必须逐一给结论；
  - `expectedOutcomeTemplates[]`：运行预期模板（`assertion` + `criteriaTopics`）；
  - `implementation / staticRules / negativeCases / requiredChecks`：实施与验证规则（语义同 v1）；
  - assets 必须对象化：`{path, origin(official-exact|mechanical-adaptation|derived-implementation|test-harness|corrected-variant), sourceSnapshotId?, anchor?, adaptationNotes?}`，origin 为 official-exact/mechanical-adaptation 时强制来源锚点，corrected-variant 强制偏离说明。
- **包内不预存任何规范事实正文**；判据在每次开发时从冻结快照现提。

## sessions/latest（上次审查基线）

- `session.json`：`frozenAt`、`snapshots[]`（snapshotId/officialUrl/contentSha256/title/updatedDate）、`criteria[]`（id/type/topic/statement/snapshotId/anchor/status(fresh|reused)/conflictGroup?）、`conflictResolutions[]`（probeId/verdict(persists|resolved|changed)/basis）、`confirmations[]`。
- 每个 snapshots 条目必须有对应正文文件且哈希一致，否则包校验失败。
- 基线由 `archive-session.mjs` 在验证成功后按 topic/snapshotId 合并更新；不得手工编辑。

## 与 v1 的差异

| 维度 | v1.5 | v2 |
|---|---|---|
| 规范事实 | 预提炼 facts＋锁哈希，漂移阻塞 | 判据每次现提，漂移由增量重审消化 |
| 忠实性 | faithfulness 判定层 | 现提即锚定（anchor 必须命中本次快照） |
| 冲突记忆 | 静态双预期 | 冲突监测点＋persists 时双判据成对标组 |
| 快照 | 锁只存哈希 | sessions 显式存正文，双快照可 diff |

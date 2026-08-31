# Skill Benchmark: harmonyos-doc-review

**Model**: <model-name>
**Date**: 2026-08-31T02:59:48Z
**Evals**: 1, 2, 3 (1 run per eval/configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 93% ± 12% | +0.07 |
| Time | 0.0s ± 0.0s | 0.0s ± 0.0s | +0.0s |
| Output characters (token proxy) | 3144 ± 715 | 1198 ± 223 | +1946 |

## Analyst notes

- 唯一拉开通过率的项目是 internal-conflicts 中的“显式置信度”：带 Skill 报告明确给出 confidence，基线没有。
- 另外两个案例两种配置均满分，说明当前测试对基础模型偏简单；第一轮结果不能证明大幅正确率提升。
- 带 Skill 输出平均更长，因为固定交付维度评分、证据索引、待确认项和逐 finding 的严重度/置信度。
- 本轮未取得可靠的执行 token 与 duration 通知；表中的长度是输出字符代理，0 秒表示未采集。
- 每个案例每种配置只运行一次，尚不能评价随机波动或长期稳定性。

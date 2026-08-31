# 报告模板与 JSON 契约

## Markdown 报告

使用以下结构；无内容的章节写“无”，不要省略审查限制和待确认项。

```markdown
# HarmonyOS 官方文档质量审查报告

## 1. 审查结论
- 文档：<标题与 URL/文件>
- 文档类型：<类型>
- 版本上下文：<API Level / SDK / 未知>
- 审查日期：<YYYY-MM-DD>
- 结论：<合理 / 基本合理但需小修 / 需要修订 / 不合理/高风险 / 证据不足无法判断>
- 综合分：<0-100 或 N/A>
- 一句话依据：<由最关键证据支撑的摘要>

## 2. 审查范围与限制
- 已检查：<正文、关联页、SDK、构建等>
- 未检查：<原因>
- 关键假设：<如有>

## 3. 维度评分
| 维度 | 得分 | 主要依据 |
|---|---:|---|

## 4. 问题清单
### DOC-001 <问题标题>
- 维度：<dimension>
- 状态：<confirmed / likely / ambiguous / version_caveat / editorial / pending>
- 严重度：<Blocker / High / Medium / Low / Suggestion>
- 置信度：<certain / high / medium / low>
- 原文位置：<章节、步骤、表格或 API 名>
- 原文短摘录：<仅保留必要短句>
- 问题分析：<目标主张与问题>
- 核验证据：<官方 URL + 章节，或 SDK 路径 + API Level + 行号>
- 影响：<对读者或实现的后果>
- 修改建议：<具体补充、删除、改写或核对动作>
- 建议改写：<可选；不要伪造未核实 API>

## 5. 待确认项
| 项目 | 缺少的证据 | 建议核验动作 |

## 6. 总体修订建议
1. <按优先级排序>

## 7. 证据索引
| # | 来源 | 版本/日期 | 定位 | 用途 |
```

按 `Blocker → High → Medium → Low → Suggestion` 排序。问题编号稳定使用 `DOC-001` 形式。同一来源只需在证据索引完整列一次，finding 中可引用其编号。

## JSON 契约

需要机器可读结果时，输出：

```json
{
  "reportVersion": "1.0",
  "document": {
    "title": "文档标题",
    "source": "https://developer.huawei.com/...",
    "docType": "guide",
    "versionContext": "API 18",
    "reviewedAt": "2026-08-31"
  },
  "verdict": {
    "label": "需要修订",
    "score": 72,
    "rationale": "存在一个已确认的关键前置缺失",
    "limitations": []
  },
  "dimensions": [
    {"name": "技术正确性", "score": 85, "notes": "API 签名已与同版本 SDK 核对"}
  ],
  "findings": [
    {
      "id": "DOC-001",
      "title": "缺少运行时授权步骤",
      "dimension": "完整性",
      "status": "confirmed",
      "severity": "High",
      "confidence": "high",
      "location": {"section": "开发步骤 > 配置权限", "quote": "声明定位权限"},
      "analysis": "正文只声明权限，没有说明运行时申请。",
      "evidence": [
        {
          "source": "官方权限参考 URL",
          "locator": "申请权限 > user_grant",
          "claim": "该权限还需要运行时申请",
          "version": "API 18"
        }
      ],
      "impact": "首次调用可能因未授权失败。",
      "recommendation": "补充运行时申请与拒绝授权分支。"
    }
  ],
  "pendingVerifications": []
}
```

`score` 在无法判断时使用 `null`。生成后运行：

```text
node "<skill>/scripts/validate-report.mjs" "<report.json>"
```

校验器只检查结构、枚举和最低证据约束，不替代人工判断证据是否真实支持结论。


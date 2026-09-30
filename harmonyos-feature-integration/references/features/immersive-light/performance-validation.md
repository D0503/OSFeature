# 沉浸光感验证路由

所有路线先读取[共享性能、降级与验证](shared/validation.md)，再加载实际选中路线的验证资料：

| 路线 | 必读验证 |
|---|---|
| `hds` | [HDS 验证与排障](routes/hds/validation.md) |
| `arkui` | [ArkUI 验证与排障](routes/arkui/validation.md) |
| `hds + arkui` | 两份路线验证都读取，分别报告结果 |

组合路线不能用 ArkUI 构建通过替代 HDS 悬浮导航验证，也不能用 HDS 真机效果证明 ArkUI 普通组件材质已经生效。交付报告按路线分别列出静态检查、构建、真机结果和未完成项。

# 实施入口

1. 记录目标组件的源程序基线：位置、断点、横竖屏、控制器、业务事件、选中态、滚动/导航状态、安全区与当前操作。
2. 区分目标要跟随握持手还是触控操作手，并确定下文的跟手模式。已有系统组件且原生属性满足要求时优先建议原生路线；自定义组件依据目标信号选型，不为了本特性替换全页组件体系。
3. 完成 [兼容性](compatibility.md) 门禁。多路线/升级按主 Skill 确认；已确认的选择不重复询问。
4. 根据 `selectedRoutes` 加载下表中的路线文档，复用原状态管理，自定义感知路线在所属 HAP 声明对应权限；同一组件仅使用一个位置决策者。

| 路线 | 实现 | 资产 | 验证 |
|---|---|---|---|
| native-component | [系统组件原生适配](routes/native-component/implementation.md) | [原生资产](routes/native-component/implementation.md#资产与接入) | [原生验证](routes/native-component/implementation.md#原生路线验证) |
| operating-hand | [操作手](routes/operating-hand/implementation.md) | [操作手示例](routes/operating-hand/implementation.md) | [操作手验证](routes/operating-hand/implementation.md#操作手验证) |
| holding-hand | [握持手](routes/holding-hand/implementation.md) | [握持手资产](routes/holding-hand/implementation.md#资产与接入) | [握持手验证](routes/holding-hand/implementation.md#握持手验证) |

按[知识库查询流程](../../workflows/knowledge-query.md)读取所需正文。

## 跟手模式

读取《智感握姿跟手模式》全文，按目标组件和用户要求确定跟手模式。仅在用户明确要求或已确认后采用新增同步跟手组件模式，已确认的选择不重复询问。

## 自定义路径的共同约束

读取《智感握姿自定义感知共同约束》全文，将订阅、位置更新和退订接入页面的实际生命周期。

失败和关闭行为见 [回退](fallback.md)。

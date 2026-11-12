# ArkUI 弹窗类组件

按[知识库查询流程](../../../../../workflows/knowledge-query.md)读取《ArkUI 沉浸光感弹窗与菜单组件适配》。

## 实施规则

按正文核对实际调用入口。SelectionMenu、文本选择菜单和 PickerDialog 的系统默认行为按[组件矩阵](../component-profile.json)逐项核对。

## 显式定制材质示例

需要定制材质时，按实际入口选用正文中的示例。知识库中的代码是接入片段，未在目标工程编译或真机验证。示例共用以下导入，方法放入工程原有组件。

```typescript
import { uiMaterial } from '@kit.ArkUI';
```

满足[前置门禁](../implementation.md#前置门禁)中的版本、启动就绪、设备能力及应用状态条件后，再构造材质对象并调用带材质配置的弹窗。声明式 `bindSheet` 片段放在对应接入分支。低版本、不支持及关闭路径按[回退策略](../../../shared/fallback.md)保留原配置。

复用原工程的内容、状态和业务回调。示例中的日志仅标识接入业务回调的位置。

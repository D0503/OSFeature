# 按需管理能力

先确认需要的功能，按[版本矩阵](compatibility.md#版本矩阵)选择对应代码。以下片段置于已核验版本、SysCap 与 context 的分支中；每项调用分别处理失败，沿用工程已有提示，不默认创建页面。

## 配置查询与显示隐藏（API20）

```typescript
import { shortcutManager } from '@kit.AbilityKit';

const configured = await shortcutManager.getAllShortcutInfoForSelf();
await shortcutManager.setShortcutVisibleForSelf(shortcutId, visible);
```

查询的是当前应用配置文件定义的快捷方式，不是桌面上已添加的图标。ID 来自真实配置；隐藏长按菜单入口不等于删除已加桌图标，也不能替代权限或业务鉴权。默认 visible=true；恢复显示仅恢复用户确认的入口。

## 已加桌查询与删除（API24）

```typescript
import { productViewManager } from '@kit.AppGalleryKit';

const pinned = await productViewManager.getPinShortcutInfos(context);
await productViewManager.removePinShortcut(context, shortcutId);
```

查询结果为当前应用已加桌快捷方式；删除传真实 shortcutId，不传校验 tid。默认经过系统确认，拒绝1006620013保留原业务和真实状态。删除成功后按需重新查询，不先清空业务记录冒充系统已删除。列表或标签等业务内容由现有业务决定。

### 静默删除申请（仅明确要求时）

依据[官方删除指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/appgallery-productview-removeshortcut)：当应用已有自己的删除确认框，且其中明确提示用户删除桌面快捷方式，才考虑申请静默删除开放能力。开发者在开发者联盟对应应用的开放能力管理中选择该能力并新建申请，填写应用介绍和使用场景（≤256字符），提供包含自有确认框及删除提示的场景录屏附件（单个≤500MB），提交后等待审批。文档说明通常1～3个工作日反馈，实际以平台为准。

审批、账号登录与提交材料由开发者完成；未获批保持系统确认，不新增未公开参数、权限或跳过系统弹窗逻辑。交付选择此能力时展示官网链接、材料要求及当前审批状态。

## 设备支持查询（API26）

```typescript
import { shortcutManager } from '@kit.AbilityKit';

const supported = shortcutManager.isShortcutSupported();
```

同步接口，仍处理异常。false 时继续原业务；true 也不替代动态加桌服务、参数、配额与真机检查。API26 以下不调用该符号，按当前版本和设备证据判断，不将“无法查询”等同于“支持”。

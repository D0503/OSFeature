---
title: "HDS 沉浸光感材质路线与版本保护"
summary: "API 23 材质路线、版本保护、设备档位和导航接口"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","HDS"]
---

# HDS 沉浸光感材质路线与版本保护

## HDS 沉浸光感材质路线：API 23+

`HdsNavigation`/`HdsNavDestination` 从 API 18 起可用，`HdsTabs` 从 API 20 起可用；下面使用的 `hdsMaterial`、`systemMaterialEffect` 和悬浮页签 `barFloatingStyle` 则从 API 23 起可用。已有旧版 HDS 组件不等于已经具备沉浸光感能力，不能把组件的 since 版本当作本路线门槛。

标题栏或底部导航优先使用系统自适应材质：

```typescript
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

`compatibleSdkVersion >= 23` 时无需增加 API 23 版本分支；低于 23 时，在 SDK 26.0.0+ 编译环境中用 `deviceInfo.apiAvailable` 保护 HDS 材质配置和调用。普通 ArkTS 方法内的最小示例：

```typescript
import { deviceInfo } from '@kit.BasicServicesKit';
import { hdsMaterial, SystemMaterialParams } from '@kit.UIDesignKit';

if (deviceInfo.apiAvailable(23)) {
  const materialParams: SystemMaterialParams = {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  };
  // 在目标组件支持的配置入口使用 materialParams。
}
```

版本判断只说明接口版本可用，不代表设备支持所有材质档位；SDK 26.0.0+ 编译时推荐使用 `deviceInfo.apiAvailable` 保护低版本。页面从原生组件迁移到 HDS 时，在受影响组件范围保留低版本原组件分支，继续复用原状态、控制器调用和业务内容；HDS 专属枚举、配置和对象构造不得提前在分支外求值。

如果业务必须自定义档位，先查询设备支持类型：

```typescript
  // 获取系统支持的材质类型，用于根据设备能力选择合适的材质等级
  let materialTypes: Array<hdsMaterial.MaterialType> = hdsMaterial.getSystemMaterialTypes();
  if (materialTypes.indexOf(hdsMaterial.MaterialType.IMMERSIVE) < 0) {
    // 当前设备不支持IMMERSIVE材质类型，则使用SMOOTH效果以优化性能，降低卡顿和发热风险
    this.customMaterialLevel = hdsMaterial.MaterialLevel.SMOOTH;
  }
```

- 支持 `IMMERSIVE` 时可选择 `EXQUISITE` 或 `GENTLE`；
- 不支持时降级为 `SMOOTH`；
- 普通业务继续优先选择 `ADAPTIVE + ADAPTIVE`。

导航框架中的职责要分开：

- `systemMaterialEffect` 设置材质；
- `scrollEffectOpts` 设置滚动渐变模糊；
- `dynamicHideTitleBar` 控制标题栏和状态栏随滚动显隐；
- `bindToScrollable` 把效果与内容滚动组件关联。

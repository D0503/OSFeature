---
title: "ArkUI 沉浸光感 AlphabetIndexer 索引提示弹窗"
summary: "说明索引条提示弹窗沉浸光感的默认材质、背景互斥条件、算力降级和索引数据回调。"
createdAt: "2026-11-11"
updatedAt: "2026-11-12"
tags: ["HarmonyOS","沉浸光感","ArkUI","AlphabetIndexer","索引条","提示弹窗","THICK"]
---

# ArkUI 沉浸光感 AlphabetIndexer 索引提示弹窗

适用于 Stage 模型的原生 ArkUI。编译 SDK、target 和启用材质的运行系统须达到 API 26。兼容更低版本时先保护新增接口调用。应用启动完成并退出加载页后，在版本保护内查询 `uiMaterial.isImmersiveMaterialSupported()`。应用级 `DISABLE` 会关闭材质，材质不可用时沿用普通视觉样式。

- 应用级为 `DEFAULT` 或 `ENABLE` 时，如果 `popupBackground` 和 `popupBackgroundBlurStyle` 均未设置或为 `undefined`，提示弹窗默认使用 `THICK` 材质；
- 两个背景属性与沉浸光感互斥，主动设置后材质不生效；
- 高、中算力设备显示 `THICK`，低算力设备降级为普通白色背景；
- 提示弹窗通过上述背景属性条件控制默认材质，回退时保留普通背景路径。

最小示例（依据[官方示例 4：设置提示弹窗的沉浸光感效果](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/ts-container-alphabet-indexer#示例4设置提示弹窗的沉浸光感效果)提炼）：

```typescript
@Component
struct AlphabetIndexerMaterialExample {
  private indexLabels: string[] = ['A', 'B'];
  private popupItems: string[][] = [['安'], ['卜', '白', '包']];
  @State selectedIndex: number = 0;

  build() {
    AlphabetIndexer({ arrayValue: this.indexLabels, selected: this.selectedIndex })
      .usingPopup(true)
      .alignStyle(IndexerAlign.Left)
      .onSelect((index: number) => {
        this.selectedIndex = index;
      })
      .onRequestPopupData((index: number): string[] => {
        return this.popupItems[index] ?? [];
      })
      .onPopupSelect((index: number) => {
        console.info(`Popup item selected: ${index}`);
      })
  }
}
```

将片段合入满足前置条件的 API 26 接入分支。`.usingPopup(true)` 开启提示弹窗。应用级为 `DEFAULT` 或 `ENABLE` 且满足上述背景条件时，系统使用默认材质，无需额外调用 `.systemMaterial(...)`。已有代码显式配置这两个属性时，仅在接入分支移除配置或传入 `undefined`，回退分支保留原值。

接入时复用工程已有索引数据、选中状态和列表联动：`onSelect` 对应一级索引，`onRequestPopupData` 返回该索引下的二级数据，`onPopupSelect` 的参数是弹窗二级数据中的位置。示例日志应替换为原有业务回调；无需复制官网示例的背景图或列表布局。实际材质效果随设备算力及系统沉浸光感档位调整。

---
title: "HDS 沉浸光感标题栏滚动绑定与过渡"
summary: "滚动绑定、嵌套滚动与模糊过渡配置"
createdAt: "2026-11-13"
updatedAt: "2026-11-13"
tags: ["HarmonyOS","沉浸光感","HDS"]
---

# HDS 沉浸光感标题栏滚动绑定与过渡

## 滚动绑定与过渡配置

单层滚动使用 `bindToScrollable`；真实嵌套滚动使用 `bindToNestedScrollable`，`child` 必须是 `parent` 的后代且参与嵌套滚动，不能仅因文件中同时出现 Scroll、List 就绑定。多个容器绑定同一导航组件时，任一个滚动均可能触发标题栏显隐，到顶或到底也可能触发显示；避免同时驱动多个容器，验证滚动交接。

以下为页面组件内的接入片段：`scroller`、`listScroller` 分别是页面持有的 `Scroller`、`ListScroller` 实例，`headerContent` 为工程已有 Builder，`listViewportHeight` 为实际列表视口高度。不要为套用示例而新增嵌套滚动。

```typescript
HdsNavigation() {
  Scroll(this.scroller) {
    Column() {
      this.headerContent()
      List({ scroller: this.listScroller }) {
        // 保留业务 ListItem
      }
      .height(this.listViewportHeight)
      .nestedScroll({
        scrollForward: NestedScrollMode.PARENT_FIRST,
        scrollBackward: NestedScrollMode.SELF_FIRST
      })
    }
  }
  .height('100%')
}
.bindToNestedScrollable([{ parent: this.scroller, child: this.listScroller }])
```

`scrollEffectOpts.enableScrollEffect: true` 表示按滚动总偏移从 `originalStyle` 过渡到 `scrollEffectStyle`；为 false 时仅使用 `originalStyle`。需要调整区间时配置 `blurEffectiveStartOffset`、`blurEffectiveEndOffset`，两者均非负且终点不小于起点。两端样式的可配置范围须结合模糊类型、材质配置和目标 SDK 核对。

| HDS ScrollEffectType | 起始 API | 用途 |
|---|---|---|
| `COMMON_BLUR` | 18 | 通用均匀模糊，适用于非沉浸式列表 |
| `GRADUAL_BLUR` | 20 | 过渡模糊，标题栏内容颜色或状态随滚动线性变化 |
| `GRADIENT_BLUR` | 20 | 空间渐变模糊，适用于列表型非沉浸式场景 |
| `IMMERSIVE_GRADIENT_BLUR` | 23 | 沉浸式渐变模糊，适用于沉浸式图文场景 |

模糊枚举的起始版本不降低本路线材质的 API 23 门槛。下例使用 `GRADUAL_BLUR`，不作为 HDS 全路线默认值；从 `@kit.ArkUI` 导入 `LengthMetrics`，从 `@kit.UIDesignKit` 导入 `ScrollEffectType`、`hdsMaterial`，将片段合并到已有 `titleBar.style`：

```typescript
style: {
  scrollEffectOpts: {
    enableScrollEffect: true,
    scrollEffectType: ScrollEffectType.GRADUAL_BLUR,
    blurEffectiveStartOffset: LengthMetrics.vp(0),
    blurEffectiveEndOffset: LengthMetrics.vp(56)
  },
  originalStyle: {
    contentStyle: {
      titleStyle: { mainTitleColor: $r('sys.color.font_on_primary') }
    }
  },
  scrollEffectStyle: {
    contentStyle: {
      titleStyle: { mainTitleColor: $r('sys.color.font_primary') }
    }
  },
  systemMaterialEffect: {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  }
}
```

需配合真实滚动绑定；距离和前景色按页面背景及主题选择，不固定套用示例值。菜单、返回按钮颜色如需联动，在对应 `contentStyle` 中补齐，验证两端可读性。滚动模糊不替代材质配置，不重复调用 `titleBar` 覆盖原有菜单和样式。

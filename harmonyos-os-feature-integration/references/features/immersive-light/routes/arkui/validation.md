# ArkUI 路线验证与排障

先执行[共享验证](../../shared/validation.md)，再覆盖本路线矩阵。

## ArkUI 矩阵

- API 26 版本门禁成功与失败两条路径；
- `isImmersiveMaterialSupported()` 返回 true/false；
- 高、中、低算力设备及系统“强、均衡、弱”档位；
- 深色和浅色模式；
- 实际使用的普通组件、菜单、弹窗、Popup、Sheet 和 Select 双入口；
- 应用级 `default`、`enable`、`disable`，并确认 metadata 只在符合条件的 entry module；
- `materialColor`、`colorInvert`、`applyShadow`、`interactive` 和 `lightEffect` 的设备降级；
- 不透明背景、背景模糊、边框、阴影和材质的属性覆盖顺序；
- 自绘制组件、材质布局区域与薄材质折射表现。

## 常见问题

| 现象 | 检查 | 处理 |
|---|---|---|
| 材质完全不生效 | API、Stage、module、应用状态、能力判断 | 对齐前置条件并保留普通样式 |
| 材质视觉无变化 | 不透明背景或背景模糊是否盖住背板 | 调整属性顺序或透明度 |
| TextArea 等材质被遮盖 | 内容层背景位于材质背板之上 | 不同时使用冲突背景和材质 |
| 材质区域不符合预期 | 布局区域、圆角和真实可视区域 | 调整 width/height/borderRadius |
| 薄材质边缘出现环境颜色 | `THIN`/`ULTRA_THIN` 折射 | 接受效果、加厚或调整 materialColor |
| 显式关闭后又出现 | 是否传入 `undefined` 且应用为 ENABLE | 使用 `uiMaterial.Material.empty` |
| 阴影或边框异常 | `applyShadow` 和属性顺序 | 移除重复效果并明确最终覆盖 |
| 低性能设备没有流光 | 设备算力 | 接受系统降级，关键交互使用其他反馈 |

## ArkUI 验收

- 所有 API 26 调用包含版本和设备能力判断；
- 不支持、禁用和旧版本路径保持接入前组件状态与普通样式；
- 应用级配置满足 target API 与 entry module 限制；
- 没有大面积、嵌套、动态背景或无限动画风险；
- 静态检查、真实构建和待真机项分别报告。

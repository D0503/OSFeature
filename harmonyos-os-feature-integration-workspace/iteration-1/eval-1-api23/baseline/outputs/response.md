# API 23 沉浸光感接入方案

结论：该工程是 `compatibleSdkVersion: 23`、`targetSdkVersion: 23` 的 Stage 模型 `entry` module，应只采用 API 23+ 的 HDS 路线；不能引入 API 26 的 ArkUI `uiMaterial`。当前 `Index.ets` 已使用 `HdsNavigation`、`HdsTabs`，并在 `barFloatingStyle.systemMaterialEffect` 中配置了 `ADAPTIVE + ADAPTIVE`，所以悬浮导航 Tab 的核心材质入口已经具备，本次不修改工程。

## 方案与改动范围

- 保持 `HdsNavigation` 作为导航容器，`HdsTabs` 作为底部悬浮页签。
- 保持 `barFloatingStyle.systemMaterialEffect` 的自适应材质配置；它负责材质效果，勿与标题栏滚动模糊或动态隐藏能力混为一项。
- 如果后续需要 MiniBar，再在真实交互需求确定后设计 `barFloatingStyle.miniBar`；当前夹具没有足够业务信息，不应擅自添加。
- 若需要给标题栏增加光感，应通过标题栏样式的 `systemMaterialEffect` 单独设计；滚动渐变模糊属于 `scrollEffectOpts`，不是材质本身。
- 接入前还需确认工程实际已声明并可解析 UI Design Kit 依赖；当前夹具未提供依赖清单，不能据此断言构建可用。

## 兼容与降级

- API 23～25 仅保留 HDS 路线，任何路径都不得引用 API 26 `uiMaterial`。
- 现有 `ADAPTIVE` 材质是首选，可让系统按设备能力调整。只有业务必须指定材质档位时，才先查询设备支持类型；不支持沉浸类型时退回 `SMOOTH`，再不满足时使用普通背景色、边框和必要阴影。
- 普通样式必须独立保证文字可读、控件可点击，不能把材质或流光作为唯一状态提示。
- 若 Web 同层渲染中的内嵌 ArkUI 控件出现透明，关闭对应控件的光感或关闭同层渲染。

## 性能风险

- 材质只用于悬浮 Tab、标题栏等局部区域，不扩展到整页、大量列表项或父子嵌套节点。
- 避免与背景模糊、背景效果、多重阴影重复叠加，也不要覆盖视频、动图等持续变化背景。
- 避免持续改变材质区域的尺寸、位置、透明度或子树结构，以及无限循环动画。
- 若真机出现卡顿或视觉过重，优先维持 `ADAPTIVE`，或降为 `SMOOTH` 并缩小材质面积。

## 验证计划与边界

1. 静态检查：确认 API 23、Stage/entry、HDS 导入、`HdsTabs` 及 `barFloatingStyle.systemMaterialEffect` 均位于有效代码路径，且没有 API 26 接口。
2. 构建检查：在完整工程中使用其现有 Hvigor 流程验证依赖、类型和编译；当前夹具不包含完整构建条件，本次未执行构建。
3. 真机检查：覆盖 phone、tablet、2in1，以及高/中/低算力、深浅色、系统光感档位、滚动与动态内容场景；验证不支持材质时的普通样式。
4. 负向检查：验证 Web 同层渲染透明、重复模糊、材质面积过大和持续动画等场景。

本结论仅来自给定静态夹具；未验证 UI Design Kit 依赖解析、Hvigor 构建、设备支持能力及最终视觉效果，因此不能宣称接入已完成或真机验收通过。

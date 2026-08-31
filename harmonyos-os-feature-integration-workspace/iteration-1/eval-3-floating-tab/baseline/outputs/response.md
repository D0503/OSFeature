它属于已注册的“沉浸光感（`immersive-light`）”，准确说是 HDS 路线中的悬浮胶囊式底部页签，不属于窗口沉浸式。

由于没有提供工程上下文，当前应给出条件化选型，不能直接断言可实施：

- API 低于 23：不接入，保留普通 `Tabs` 样式。
- API 23～25：使用 HDS 路线，将目标导航迁移到 `HdsTabs`；Stage 模型是前置条件。
- API 26+：底部导航仍可由 HDS 承担；ArkUI `uiMaterial` 更适合普通组件、菜单、弹窗和自定义布局，不需要为了悬浮导航 Tab 强行改成 ArkUI 材质路线。

关键配置与职责：

- 由 `HdsTabsFloatingStyle.systemMaterialEffect` 配置页签材质，优先采用 `hdsMaterial.MaterialType.ADAPTIVE` 与 `hdsMaterial.MaterialLevel.ADAPTIVE`。
- 由 `barFloatingStyle.miniBar` 控制可折叠 MiniBar；它可以与沉浸光感组合，但不是材质本身。
- 如果业务必须自定义材质档位，应先通过 `hdsMaterial.getSystemMaterialTypes()` 查询设备支持类型；支持 `IMMERSIVE` 时才选择相应强度，不支持时降为 `SMOOTH`。
- 不要混用 `hdsMaterial.MaterialLevel` 与 API 26 的 `uiMaterial.MaterialLevel`。前者是 HDS 视觉强度选择，后者表示设备算力档位。
- 实施前还需从工程确认 `compatibleSdkVersion`、`targetSdkVersion`、Stage/FA、目标 module、现有 Tabs 结构与 HDS 依赖；缺少这些信息时只形成改造方案，不生成最终工程代码。

降级策略：

- API 低于 23、非 Stage 工程或无法采用 HDS 时，保持现有普通底部导航。
- 设备不支持目标 HDS 材质时，使用 `ADAPTIVE`/`SMOOTH` 或普通背景色、边框和必要阴影，保证文字、图标和点击区域始终可读可用。
- 用户关闭沉浸光感或设备算力不足时，不依赖流光、模糊或空间动效表达选中状态。
- 避免在导航及其父子节点重复叠加材质、背景模糊或多重阴影；不要让材质覆盖持续变化的视频、动图背景。
- 若页面含 Web 同层渲染并出现控件透明，关闭该控件光感或关闭同层渲染。

验收至少覆盖 API 23 与 API 26、高/中/低算力设备、深浅色模式、系统沉浸光感强/均衡/弱、材质支持与不支持两种能力结果。重点验证普通 Tabs 到悬浮态的结构和交互没有回归、选中态清晰、MiniBar 折叠正常、滚动与动画流畅、降级样式可用，并执行工程静态检查和构建。真机材质观感、系统档位和设备能力必须单列验证，不能以编译通过代替。

边界上，悬浮导航 Tab 解决的是底部导航组件的系统材质与悬浮形态；窗口沉浸式解决的是全屏布局、状态栏/导航条显隐、安全区和内容避让。若问题是内容被系统栏遮挡、状态栏透明或安全区布局，应转到窗口沉浸式流程，不能用本能力包的材质配置代替。

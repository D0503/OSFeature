# 工程发现工作流

先从工程事实建立上下文，避免向用户询问可直接读取的信息。

1. 运行 `node scripts/inspect-project.mjs --project <path>`；无法从工程 `local.properties` 或受支持环境变量定位 SDK 时，让用户提供实际 SDK 根目录并用 `--sdk <path>` 重跑。
2. 先核对 `localSdk.status`、`sdk-pkg.json`、本机 SDK API 和版本，再核对工程根、Stage/FA 模型、compile/target/compatible API、module 类型、配置文件和组件体系。工程未显式声明 `compileSdkVersion` 时，脚本将已验证的活动 SDK API 标记为 `api.compile`，并把 `api.compileSource` 设为 `local-sdk-default`。模块扫描同时保留原始 `applicationMaterialState`，并输出规范化的 `effectiveApplicationMaterialState`；未配置时为 `default`，非法值为 `invalid`。
   平行视界使用 `easyGo` 扫描结果：各模块顶层引用、全部资源变体、pages 页面表、Router/Navigation 信号、页面名称和 id 候选；无法解析的清单和动态名称必须保留待核验。
3. `localSdk.status` 不是 `valid` 时停止路线判断；不得把 DevEco Studio 已安装、工程能打开或配置了高 target API 当作本机 SDK API 已满足的证明。
4. 读取脚本提供的 `evidence` 文件定位；值为 `unknown` 时人工检查对应配置，不用默认版本补齐。
5. 排除 `build`、`oh_modules`、`.git` 和生成目录，不把缓存命中当作源码事实。
6. 记录用户目标组件、设备范围、任务类型和不能从工程发现的外部条件。
   沉浸光感需区分“指定组件接入”和“工程整体接入”。指定组件只处理授权范围；整体接入读取 `materialInventory` 的完整候选位置，并对照 ArkUI 组件矩阵及 HDS 组件范围逐项盘点，不能只处理底部 Tab。
   候选发现不依赖 `systemMaterial`，包含组件调用、Popup/Tips/Sheet/Menu 绑定入口、Toast/Dialog 方法及 Options 引用。`signals` 的位置证据有数量上限，不能代替 `materialInventory.candidates`。配置类型引用只是线索，须关联实际调用并合并同一实例；继承类型、命名空间别名、动态调用和业务封装继续人工追踪。`unresolvedEntrypoints` 中的 PromptAction、原生接口线索必须核对其实际方法和版本，不套用 ArkTS Options。
   对扫描未命中的矩阵类别也检查项目封装、导入别名与调用入口；确认未使用后记录“未发现实际使用”，无法确定则记录“待核对”，不能把正则未命中等同于不存在。普通内容区 Button 等仍列为候选，核对生效区域后决定是否不适用，不自动添加材质。
   在执行期间维护逐实例清单：页面、文件与行号、组件/接口、宿主层级、版本分支、应用状态、默认开启条件、背景等属性、处理结论、验证状态及证据。处理结论使用“默认开启无需新增配置 / 需要显式接入 / 冲突需处理 / 不支持或区域不适用 / 待核对”。这一清单放在临时执行记录中，不新增交付文件。
7. 在实施前建立“源程序状态基线”：保存目标代码当前的组件树或业务路径、断点/方向/窗口条件、状态与数据流、控制器、事件、生命周期、异常/拒绝路径和普通视觉样式。只记录与目标特性改造直接相关的内容；它是所有低版本和不可用分支的对照基线。

发现结果只描述现状，不在本阶段修改工程或判断最终可行性。

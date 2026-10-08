# harmonyos-feature-integration —— HarmonyOS OS 新特性接入 Skill

本仓库是一个注册表驱动的 HarmonyOS 新特性接入技能（Skill）。当用户要求接入或排查已注册的系统新特性时，按"识别特性 → 验证本机 SDK → 扫描工程 → 兼容性与 SDK 门禁 → 加载能力包 → 方案或实施 → 静态验证 → 构建 → 安装启动 → 目标页导航 → 运行与视觉验证 → 交付报告"的固定数据流执行，每一步保留文件证据。

- 运行环境：Windows / macOS / Linux，Node.js 18+
- 实际接入还需要：可读取的 HarmonyOS Stage 模型工程、本机 HarmonyOS SDK（含可验证的 `sdk-pkg.json`）、可用的签名与设备环境
- 主入口：SKILL.md；特性注册表：references/feature-registry.json

## 实现的功能

### 1. 沉浸光感（immersive-light）

为应用提供沉浸光感系统材质接入。支持两条**可组合**路线：

| 路线 | 版本门槛 | 适用范围 |
|---|---|---|
| `hds` | API 23+（材质能力门槛；HdsNavigation/HdsNavDestination 组件自 API 18、HdsTabs 自 API 20） | UI Design Kit / HDS 标题栏、悬浮导航Tab（HdsTabs）、底部页签等 HDS 组件 |
| `arkui` | API 26+（compile 与 target 均须达到 26） | 原生 ArkUI Navigation/Tabs、普通组件、弹窗、菜单、Toast、交互组件，基于 `uiMaterial`/`systemMaterial` |

能力包括：路线判断与升级接入选项、从原生 `Tabs`/自研悬浮导航迁移到 `HdsTabs` 的代码资产、ArkUI 能力门禁与场景材质工厂、按 `fallbackPolicy` 在旧版本/不支持设备/系统关闭/低性能路径保留接入前源程序状态的回退设计，以及材质未生效、组件透明、视觉属性冲突、性能问题的排查。

**边界**：不处理窗口沉浸式、系统栏显隐或安全区布局——"窗口沉浸式"不是"沉浸光感"。

### 2. 平行视界（easygo-parallel）

应用尚未适配原生分栏时，通过 `easy_go.json` 配置在宽屏窗口并排显示两个页面的系统兼容方案。`router` 与 `navigation` 为**互斥**技术路线（导航模式/购物模式为路线内部交互方式）：

- API 23：支持开发者配置（新接入默认 `enableReducedContainerSize=true`）
- API 24：可调用 `UIContext.isEasySplit()` 查询分栏状态
- API 26：增强配置（默认 `drawableRectHook=true`）

接入时自动扫描开屏广告页、启动页、隐私协议页等独立路由页面并加入 `fullScreenPages`；其余配置项（全屏页、购物模式过渡页等）必须与用户逐项确认后写入，不静默使用默认值。

**边界**：不等同于 Navigation 原生双栏、应用多窗口或通用自适应布局；已有原生分栏的目标不叠加两套分栏。

### 3. 智感握姿（smart-reach）

把高频且单手难触达的操作放到易操作区。三条路线**可组合**：

| 路线 | 版本门槛 | 适用目标 |
|---|---|---|
| `native-component` 系统组件原生适配（如 HdsTabs） | 当前实例 API 23 | 提供原生跟手属性的组件 |
| `operating-hand` 操作手感知 | API 15 | 自定义组件随触控操作手变化 |
| `holding-hand` 握持手感知 | API 20 | 自定义悬浮按钮等随握持手变化 |

一个组件只能有一个位置决策者，不自动订阅两种事件竞争位置。低频、非操作类组件以及广告或诱导类按钮不建议接入。

**特殊限制：视觉验证仅限真机**——握持手、操作手和原生跟手都需要真实人手握持与触控，模拟器一律不采集、不导入、不判定。

### 通用能力

- **升级接入**：工程 API 或本机 SDK 低于路线门槛时，不是终止结论，而是给出"升级 SDK / compileSdkVersion 至路线 `minApi`、targetSdkVersion 至 `minTargetApi`、compatibleSdkVersion 保持不变"的接入选项，由用户决定。
- **用户路线决策**：存在多条可用路线或升级选项（`decisionRequired`）时，必须把可选方式、建议路线和理由一并列给用户确认。
- **验证闭环**：`verify-development.mjs` 自动执行静态检查、SDK 检查、ohpm/Hvigor 构建（`--no-daemon`）、安装启动、目标页导航与截图采集，最终只交付一份 `integration-report.md` 及其截图。
- **未注册特性**：如"碰一碰"等未注册能力，只返回注册边界，不生成猜测性实现，也不借用名称相近能力的资料。

## 具体可实现的功能

以下为本 Skill 当前可实际落地到工程中的具体能力清单，均可按"指定组件接入"或"工程整体接入"两种范围实施。

### 沉浸光感

**HDS 路线（API 23+）**：

- HDS 标题栏沉浸材质
- 悬浮导航Tab 接入
- 迁移改造：从原生 `Tabs` 或自研悬浮导航迁移到 `HdsTabs`（含低版本保留原组件分支的迁移规则）

**ArkUI 路线（API 26+，compile 与 target 均须达 26）**：

- 应用级开启：entry 模块 `module.json5` metadata 配置 MaterialState（DEFAULT/ENABLE/DISABLE 整体策略）；
- ArkUI 底部 Tab 沉浸光感接入
- 原生 Navigation 标题栏接入
- 弹窗/浮层/按钮/交互等组件接入：Toast、Popup、Tips、Menu、Dialog、Sheet、Button、Select、Toggle、Slider、Chip/ChipGroup、SegmentButton、Text 长按选择菜单（SelectionMenu、copyOption）、CalendarPickerDialog、DatePickerDialog、TextPickerDialog、TimePickerDialog、等组件接入
- 设备能力查询与低算力设备回退

### 平行视界

- 基础分栏接入（API 23+）：`easy_go.json` 配置 `wideWindowMode: routerSplit / navigationSplit`，宽屏窗口左右并排显示两个页面；
- Router 路线接入
- Navigation 路线接入

### 智感握姿

- 系统组件原生跟手接入：如 `HdsTabs` 底部页签原生属性随操作手移动（API 23）；
- 操作手感知接入
- 握持手感知接入
- 原组件位移模式：目标组件本身随有效手别平移（贴边组件屏外绕行、底部宽组件屏内平移）；
- 新增同步跟手组件模式：保留原组件不动，在易操作区新增同功能组件（如来电横幅在握持手侧增加接听/挂断按钮组，两组共享业务状态与防重复提交）

## 目录结构

```text
harmonyos-feature-integration/
├── SKILL.md                          # Skill 主入口：路由规则、固定数据流、执行规则
├── README.md                         # 本文件
├── assets/templates/                 # 输出模板（接入方案、接入报告、能力包模板）
├── evals/                            # 测试
│   ├── evals.json                    # 评测用例集（路由、选路、边界等场景）
│   ├── fixtures/                     # 测试夹具工程
│   ├── run-smoke-tests.mjs           # 冒烟测试
│   ├── run-tool-tests.mjs            # 工具脚本单元测试
│   ├── run-development-tests.mjs     # 验证执行器测试
│   ├── run-smart-reach-tests.mjs     # 智感握姿专项测试
│   └── run-easygo-tests.mjs          # 平行视界专项测试
├── references/
│   ├── feature-registry.json         # 特性注册表（唯一路由依据）
│   ├── feature-package-contract.md   # 能力包契约（新增特性前必读）
│   ├── workflows/                    # 通用工作流（发现/门禁/设计/实施/验证/排障）
│   ├── shared/                       # 共享资料（兼容性模型、设备矩阵、证据规则、输出契约等）
│   └── features/                     # 三大能力包
│       ├── immersive-light/          # 沉浸光感（routes: hds / arkui）
│       ├── easygo-parallel/          # 平行视界（routes: router / navigation）
│       └── smart-reach/              # 智感握姿（routes: native-component / operating-hand / holding-hand）
└── scripts/                          # 工具脚本（见下表）
```

## 测试人员的测试步骤

### 第一步：环境准备

1. Node.js 18+（`node -v` 确认）。
2. 工作目录，无需安装额外 npm 依赖。
3. 如涉及端到端验证，需准备：HarmonyOS SDK、可构建的 Stage 模型测试工程、签名与目标设备（真机/模拟器；智感握姿必须真机）。

### 第二步：端到端接入验证（需真实工程与设备）

1. **安装 Skill**：将本仓库整个目录复制或克隆到 opencode 的技能目录，Windows 为 `C:\Users\<用户名>\.config\opencode\skills\harmonyos-feature-integration`（macOS/Linux 为 `~/.config/opencode/skills/`），确保 `SKILL.md` 位于该目录根；重启 opencode 会话使技能生效。
2. **准备模板工程**：在 DevEco Studio 中使用组件模板创建测试工程（如"快递物流"模板，自带底部 Tab 首页），在 opencode 中打开该工程作为当前工作目录。
3. **逐特性实测示例**：在 opencode 中分别使用以下提示词，验证特性路由、SDK 门禁、路线确认、工程实施与验证闭环：

   | 特性 | 测试工程 | 提示词 |
   |---|---|---|
   | 沉浸光感 | 快递物流模板 | 请使用harmonyos-feature-integration，对当前工程实现底部tab接入沉浸光感 |
   | 沉浸光感 | 空目录 | 请使用harmonyos-feature-integration，生成一个demo实现标题栏接入沉浸光感 |
   | 平行视界 | 综合商城模板 | 请使用harmonyos-feature-integration，对当前工程实现平行视界 |
   | 智感握姿 | 综合新闻模板 | 请使用harmonyos-feature-integration，为首页发表按钮接入智感握姿。悬浮球本身随握持手左右换侧，保留支持纵向拖拽，横向拖拽去除，不新增按钮 |

4. **结果验收**：每个场景完成后核对是否产出 `<工程>/os-feature-integration/integration-report.md` 及其截图；构建通过不代表视觉通过，未执行真机验证的项必须标注未验证，不得写成通过。


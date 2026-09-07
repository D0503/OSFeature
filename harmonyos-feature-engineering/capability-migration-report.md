# 能力包 1.5.0 迁移报告（Web-first 对勘）

迁移时间：2026-09-07 · 方式：fetch-doc 实时抓取 13 页官网正文，逐条人工对勘后锚定

## 漂移判定

- 零漂移（哈希+updatedDate 双证据）：hds-component-material-guide、hds-navigation-api、hds-tabs-api、hds-material-api
- 未更新（updatedDate 2026-09-03 早于制包 2026-09-04）：common、constraints、faq、overview
- 已更新：enable（2026-09-06（targetAPIVersion→targetSDKVersion、生效区域规则重写、disable 冲突双表述保留））；component（2026-09-06（新增『其余组件』章节，原有章节未变））；development（导航页子页列表精简为 3 项）
- 已下线：compatibility、sample（正文接口 document not found，站内搜索无新去处）

## 删除的事实与场景（来源下线，失去官网唯一证据）

- **IL-F021**：compatible API 低于 26 时应使用版本条件保留原普通样式分支，不能在低版本路径引用 API 26 能力。
  - 原因：来源页 arkts-immersive-light-sense-compatibility 已从官网下线，站内搜索无新去处，失去官网唯一证据
- **IL-F022**：设备不支持沉浸材质时必须保留接入前的背景、边框、布局、状态、事件和恢复路径。
  - 原因：来源页 compatibility 已下线（同上）
- **IL-F025**：官方示例的若干 materialColor 值呈现为不透明颜色，但未解释其与透明度规则的关系，接入时必须单独验证而不能直接照搬。
  - 原因：来源页 arkts-immersive-light-sense-sample 已从官网下线
- **IL-F026**：官网代码为上下文片段，部分 import、变量和类型未在片段内定义，不能把整段复制可编译视为规范保证。
  - 原因：来源页 sample 已下线（同上）
- **IL-S007**：API 26 以下与设备不支持时回退
  - 原因：低版本回退的官网依据（compatibility 页）已下线，场景失去存在意义；设备能力查询由 IL-S002 覆盖；IL-F001（版本门槛）转移至 IL-S001 引用
- 连带调整：profile arkui 路线 `compatibleApiMayBeLower` 改为 false；IL-S002 factRefs 移除 IL-F022/IL-F026；IL-S006 factRefs 移除 IL-F025

## 修正的事实（对现网原文对勘）

- **IL-F001**
  - 修正前：ArkUI 沉浸光感接口从 API 26 起提供；官网要求开启沉浸光感时应用 targetSDKVersion 不低于 26.0.0。
  - 修正后：ArkUI 沉浸光感接口从 API 26 起提供；官网要求开启沉浸光感时应用 targetSDKVersion 不低于 26.0.0。
  - 依据：官网 2026-09-06 将 targetAPIVersion 表述更改为 targetSDKVersion
- **IL-F032**
  - 修正前：HDS MaterialLevel 取值为 EXQUISITE=0、GENTLE=1、SMOOTH=2、ADAPTIVE=10；ADAPTIVE 档由系统按设备算力自适应；设备不支持 IMMERSIVE 时官网建议使用 SMOOTH 以降低卡顿和发热风险。
  - 修正后：HDS MaterialLevel 取值为 EXQUISITE=0、GENTLE=1、SMOOTH=2、ADAPTIVE=10；ADAPTIVE 档由系统按设备算力自适应；设备不支持 IMMERSIVE 时官网建议使用 SMOOTH 以降低卡顿和发热风险。
  - 依据：原文无『精美耗费更多性能』的直接对比表述，改为贴原文措辞
- **IL-F036**
  - 修正前：HDS 官网指南示例是需补齐工程上下文的片段：示例导入仅含 @kit.UIDesignKit 与 @kit.ArkUI 的 SymbolGlyphModifier，示例本身不含异常处理代码；scenery01 明确要求替换为本地资源。
  - 修正后：HDS 官网指南示例是需补齐工程上下文的片段：示例导入仅含 @kit.UIDesignKit 与 @kit.ArkUI 的 SymbolGlyphModifier，示例本身不含异常处理代码；scenery01 明确要求替换为本地资源。
  - 依据：对现网原文核验：指南页示例中 BusinessError 出现 0 次、try 块 0 次，原 statement『使用 BusinessError 但未导入』为提炼幻觉（金标负例 IL-F036）

## 锚点统计

- 43 个来源条目全部完成文本锚点迁移，全部在现网正文命中（记录出现次数）

## Asset 来源分类

- IL-S001 · `assets/ApplicationMaterialMetadata.json5` → **mechanical-adaptation**
- IL-S001 · `assets/ImmersiveMaterialProbe.ets` → **test-harness**
- IL-S002 · `assets/ImmersiveMaterialFactory.ets` → **derived-implementation**
- IL-S003 · `assets/ImmersiveMaterialFactory.ets` → **derived-implementation**
- IL-S004 · `assets/ImmersiveMaterialFactory.ets` → **derived-implementation**
- IL-S005 · `assets/ImmersiveMaterialFactory.ets` → **derived-implementation**
- IL-S006 · `assets/ImmersiveMaterialFactory.ets` → **derived-implementation**
- IL-S008 · `assets/ImmersiveMaterialProbe.ets` → **test-harness**
- IL-S009 · `assets/HdsMaterialFactory.ets` → **derived-implementation**
- IL-S010 · `assets/HdsMaterialFactory.ets` → **derived-implementation**
- IL-S011 · `assets/HdsMaterialFactory.ets` → **derived-implementation**
- IL-S012 · `assets/HdsMaterialFactory.ets` → **derived-implementation**

## 其他结构变更

- profile：arkui 路线 `compatibleApiMayBeLower` 改为 false，新增 compatibilityPolicy 声明官网已下线低版本指引
- 锁：sourceDocuments 删除下线两页，其余 11 页登记 `officialBodySha256`（official-body 统一口径）+ 真实 `retrievedAt` + `updatedDate`
- 最终：32 条事实 / 11 个场景 / 11 个来源


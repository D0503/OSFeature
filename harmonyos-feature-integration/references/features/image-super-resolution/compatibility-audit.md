# 图像超分兼容性扫描与修复

扫描通过 `@kit.CoreVisionKit` 的 `imageSuperResolution` 导入绑定识别 `ImageSRAnalyzer` 候选。沿别名、变量赋值、跨文件包装与异步流程追踪实际 `create`、`process`、`destroy`；其他 Core Vision 功能、普通图片缩放和同名类型不能作为命中依据。动态导入、转导或其他未识别写法需人工补查，不能把无候选当成不存在调用。

逐 product 确定实际 `compatibleSdkVersion` 与活动 SDK；回到声明核实成员所属类型及 `@since`，区分基类与子类覆写，不能用基类的较早版本覆盖 `ImageSRAnalyzer` 约束。同文件出现 `apiAvailable` 或 `canIUse` 仅是候选：检查三段调用都在版本及能力门禁后、失败不会清空原图、清理不会与处理中请求竞争；必要时核对引入模块时是否提前触发高版本访问。

只在获授权修复时补齐实际缺失的保护，保留原 `compatible` 和所有既有图像业务，不借扫描引入新的 UI、保存或处理策略。修复后复扫、构建并按[验收](validation.md#验收)分开核对支持真机与低版本回退。

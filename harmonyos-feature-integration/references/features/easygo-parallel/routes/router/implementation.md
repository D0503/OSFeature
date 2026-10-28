# Router 路线

前置：[公共流程](../../implementation.md)、[配置规则](../../configuration.md)。本路线与 Navigation 互斥，不改变现有 Router 框架。

- 解析 entry.module.pages 指向的 profile 资源，用其中 src 数组核对页面路径；homePage 等写 `pages/Index` 格式，不能填组件类名、文件系统绝对路径或 .ets 后缀。
- 将显示模式设为 routerSplit，并配置 routerSplitOptions；API 23 最小模板见 [资产](implementation.md#资产与接入)。保留既有 push/replace/back 的传参和返回逻辑。
- 主页/关联页、全屏页和过渡页均用同一页面路径体系；关联页必须无需跳转传参即可初始化。不要用虚构页面填齐配置。
- API 26 导航模式的 pagePairs 使用真实 from/to；购物模式用 mode=0，编辑等不应右推左的页面按需求加入 transPages。
- 裁切先采用页面实际宽度；API 23 的 routerPageUpdate 信息可含页面大小，onRouterPageSizeChange 可监听尺寸变化。动态路由或资源无法静态解析时保留待核验，不把缺失证据当通过。

完成后按 [路线验收](implementation.md#路线验收) 验证。

## 资产与接入

读取 [资产目录](../../assets-catalog.md)，按 API 和模式选择 Router 配置。所有页面值与所属模块 pages 资源一致；不能将导航组件名称直接写入 Router 配置。

## 路线验收

执行 [公共验证](../../performance-validation.md)。额外核对配置页面存在于 module.pages 引用的 src 列表，push/replace/back 的参数和返回路径保持；关联页不能依赖上次跳转参数。静态页面表无法读取时需补齐证据，不直接判断通过。

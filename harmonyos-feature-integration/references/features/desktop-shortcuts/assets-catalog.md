# 资产目录

| 资产 | 版本与用途 |
|---|---|
| [静态路线配置与跳转片段](routes/static-shortcut.md) | API9 Stage 静态配置、UIAbility 参数接收及页面跳转，按现有工程合并 |
| [动态路线开发步骤](routes/dynamic-shortcut.md) | API14；静态资源与自定义资源的参数构造、预校验、用户点击加桌及结果处理 |
| [管理调用片段](management.md) | API20/24/26；按已确认的可选功能提取，不能整段复制提高无关工程门槛 |

按[公共实施](implementation.md)和所选路线，将配置、参数接收及加桌调用片段合并到现有工程。动态自定义图标在调用校验接口前核对实际文件的格式、可读性与大小，规格见下文。

## 图标资源规范

按实际使用的资源方式检查，预置资源与自定义文件分别遵循对应约束。

| 使用位置 | 图标来源与限制 |
|---|---|
| 静态快捷方式配置 | `icon` 引用工程中的 `$media:资源名`；预置图标支持 SVG、PNG，规格见下文 |
| 动态加桌的静态资源重载 | `iconResName` 填预置媒体资源名称，不带 `$media:` 前缀；必须与 shortcuts 配置引用同一资源，采用同一预置图标规格 |
| 动态加桌的自定义资源重载 | `foregroundIcon` 为应用沙箱内实际可读的 png/webp 文件路径，文件大小≤100KB；`backgroundIcon` 为预留字段，当前必须传空字符串 |

### 预置图标尺寸与样式

- **SVG**：官方建议优先提供 SVG；要求透明背景，资源大小为 **24×24vp**。同时满足下文的解析复杂度限制。
- **PNG**：资源尺寸为 **1024×1024px**，必须是正方形图像，**无需预先制作圆角**；添加到桌面后由系统生成圆角遮罩并裁切。验证裁切后的关键图形是否完整。
- **分层图标**：配置文档推荐使用分层资源。前景图显示大小为 **450×450px**，资源大小为 **1024×1024px 的透明图层**；背景图大小为 **1024×1024px**。在工程中通过媒体资源索引引用对应分层资源，并核对其前景、背景文件均存在。

### 动态自定义图标

自定义资源重载按 png/webp、沙箱文件路径和≤100KB 的接口要求准备图标；SVG 预置资源不能直接作为该重载的文件入参，分层配置也不能作为 `backgroundIcon` 传入。调用前检查文件实际编码、可读性与大小，不能仅凭后缀判断格式；校验及加桌期间保持文件可读。只拿到资源名或网络图片地址时，先按现有业务流程准备沙箱文件，再调用校验接口。

### SVG 复杂度限制

使用 SVG 预置图标时，按官方最佳实践核对以下解析和渲染限制；遇到资源无法解析或显示异常时检查源文件，不能只改扩展名。

| 规格 | 上限 |
|---|---|
| 构建时 DOM 深度、渲染节点及内部引用的统一递归路径 | 256 |
| XML 元素与文本节点总数 | 100,000 |
| XML DOM arena 中受计费分配的累计字节数 | 64 MiB |
| 全文所有 `<style>` 文本回调的累计字节数 | 1 MiB |
| 单个 `<text>` 子树的 UTF-8 文本长度 | 1 MiB |
| CSS style map 中不同 selector key 数量 | 10,000 |
| 单条 CSS 规则的声明数 | 1,000 |
| 全 DOM 的 `class` 属性实际展开的属性总数 | 1,000,000 |
| 单个通用 list 属性值的字节数 | 1,000,000 |
| 单个 polyline/polygon 解析出的点数 | 100,000 |
| 单个 path 解析出的非 move verb 数 | 100,000 |
| mask/filter/opacity 累计设备像素消耗 | 500,000,000 |
| 单个 `<feMerge>` 的输入数 | 10 |

规格来源：[快捷方式 UX 设计规范](https://developer.huawei.com/consumer/cn/doc/doccenter-ux-design/shortcat-0000002550987962)、[module.json5 的 shortcuts 标签](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/module-configuration-file)、[桌面快捷方式最佳实践](https://developer.huawei.com/consumer/cn/doc/doccenter-feature-dev/bpta-desktop-shortcuts)、[自定义资源重载 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/store-productviewmanager)。名称、ID 与数量限制见[兼容性资料](compatibility.md)。

# 图像超分

HarmonyOS Core Vision Kit 的 `imageSuperResolution` 对单张低分辨率图片做超分辨率重建，适合老照片、低清商品图等已有图片增强场景。不是普通缩放、裁剪、锐化、视频超分、去划痕，也不是 Android HMS Core／HiAI 的同名服务；无法保证还原真实细节。

唯一路线 `core-vision-image-sr`：将现有业务的单张 `PixelMap` 送入 `ImageSRAnalyzer`，结果独立交回原流程。不要求创建页面、批处理、对比 UI 或保存入口。

| 任务 | 读取 |
|---|---|
| 发现／可行性／接口版本查询 | [profile](profile.json)、[兼容与前置条件](compatibility.md)，可行性另读[实施](implementation.md)的输入与资源约束 |
| 设计／实施 | [兼容与前置条件](compatibility.md)、[实施与资产](implementation.md)、[回退基线](#回退基线)、[验证与排障](validation.md)；实施前打开实际资产源码 |
| 验证 | [回退基线](#回退基线)、[验证](validation.md#验收)；需要定位调用或资源时读[实施与资产](implementation.md) |
| 兼容性扫描／修复 | [兼容与前置条件](compatibility.md)、[调用链复核](compatibility-audit.md)及相关[实施与资产](implementation.md)；修复再读回退与验证 |
| 排障 | [兼容与前置条件](compatibility.md)、[故障排查](validation.md#故障排查)及其涉及的实施、回退与验收条目 |

## 回退基线

实施前记录目标入口、原图载入与预览、现有编辑或保存、布局导航、状态事件与资源所有权。低版本、SysCap 不可用、业务关闭、选图取消／拒绝、输入不可处理或服务失败时，继续接入前的流程，原图、上一个有效结果与既有业务状态不被失败或过期回调覆盖。保留原组件树、断点和窗口模式、普通样式、导航、已有权限拒绝与异常行为。不要用插值结果冒充超分，也不要为了回退额外实现一套低配页面。

# 单图超分实施与资产

## 接入步骤

1. 定位原图选择／解码、结果展示及保存调用链，记录[回退基线](README.md#回退基线)。只在确认的业务操作中启用超分，不在页面刷新、应用启动或滑动时自动处理。
2. 使用已有 `PixelMap` 或用户授权的单张图片 URI。若需新增选图，使用 [PhotoViewPicker](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/arkts-apis-photoaccesshelper-photoviewpicker) 的 `IMAGE_TYPE` 与 `maxSelectNumber: 1`；空结果不调用分析器。读取 URI 时通过 `fileIo` 打开、`image.createImageSource` 解码，异常和成功路径都释放 `ImageSource`、关闭描述符。先读尺寸再决定是否等比降采样，不强制拉伸两边；按目标 SDK 验证像素格式，Demo 用 `RGBA_8888` 规范化。
3. 调用前检查**实际输入**宽高均满足 `16 < size < 2048`；边界是开区间。官方建议处理 1024×1024 以下的输入，较大图可能超时。可按现有业务策略降采样或走原流程，不照搬 Demo 的 1280 门槛。`process` 单次只接受一张图：`visionBase.Request.inputData` 传 `{ pixelMap }`，结果取 `response.pixelMap`。两份 Demo 核对输出宽高各为实际输入的 4 倍；验收应对照真机返回尺寸，不以原文件尺寸或 UI 显示尺寸推算。
4. 各业务入口共享单飞门控，禁止同一进程并发提交；按请求创建和销毁分析器，等待 `process` 结束后清理，不把 `destroy()` 当成取消接口。已有页面级实例可保留，但需处理初始化期间退出、处理中离开与延迟销毁。用请求序号或同等机制隔离选图切换、页面销毁后的旧结果，未提交的输出由调用方释放。
5. 输入归原流程，等待处理结束后由持有者释放；返回的输出归调用方，替换、丢弃或页面退出后释放。RGBA 像素数据可按宽×高×4 字节粗估，长宽各放大 4 倍时输出像素数约为 16 倍，另有解码、处理和编码峰值；不要为比较长期驻留多个大图。仅在原流程或用户要求保存时另存结果，不覆盖源文件；成功前核对写入完成并关闭编码器和文件句柄。

## 可复用资产

[ImageSuperResolutionProcessor.ets](assets/ImageSuperResolutionProcessor.ets) 封装 API/SysCap、单飞、尺寸校验和单次分析器生命周期，不依赖 UI、选图、存盘、签名或 Demo。各入口复用同一资产模块；`processImageSuperResolution` 返回空结果表示未执行（能力不可用、输入尺寸不合格或忙），异常交给现有错误／回退处理。调用方管理输入、返回结果、已有界面与旧请求隔离。未引入本资产的项目也必须满足相同约束。

## 两份 Demo 的适用参考

| Demo | 可借鉴 | 边界 |
|---|---|---|
| `imageSuperResolutionDemo`：`ImageSuperResolutionService.ets`、`OfficialSample.ets` | 选图 URI 解码、等比 `desiredSize`、处理服务和交互分离 | 示例的临时预览、场景页与尺寸策略不作为工程需求；低版本守卫与异步结果隔离按本包实施。 |
| `image-super-resolution-demo`：`visioncore/SuperResolutionExperiment.ets`、`entry` 的 `Index.ets` | 单次分析器清理、串行处理、输入／输出尺寸和耗时核对、系统文件保存后验证 | 实验批次、样图、日志导出与 Demo 界面不是接入依赖。 |

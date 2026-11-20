# 单图超分实施与资产

## 接入步骤

1. 定位原图选择／解码、结果展示及保存调用链，记录[回退基线](README.md#回退基线)。只在确认的业务操作中启用超分，不在页面刷新、应用启动或滑动时自动处理。
2. 优先复用现有的 `PixelMap`；需要解码时，按[图源获取与解码](#图源获取与解码)将资源表媒体、图库图片或远端图片转为单张 `PixelMap`。只接入业务实际使用的图源。
3. 调用前检查**实际输入**宽高均满足 `16 < size < 2048`；边界是开区间。官方建议处理 1024×1024 以下的输入，较大图可能超时。可按现有业务策略降采样或走原流程。`process` 单次只接受一张图：`visionBase.Request.inputData` 传 `{ pixelMap }`，结果取 `response.pixelMap`。验收时比较实际传入和真机返回的 `PixelMap` 像素宽高，不以原文件尺寸或 UI 显示尺寸推算。
4. 各业务入口共享单飞门控，禁止同一进程并发提交；按请求创建和销毁分析器，等待 `process` 结束后清理，不把 `destroy()` 当成取消接口。已有页面级实例可保留，但需处理初始化期间退出、处理中离开与延迟销毁。用请求序号或同等机制隔离选图切换、页面销毁后的旧结果，未提交的输出由调用方释放。
5. 输入归原流程，等待处理结束后由持有者释放；返回的输出归调用方，替换、丢弃或页面退出后释放。RGBA 像素数据可按宽×高×4 字节粗估，长宽各放大 4 倍时输出像素数约为 16 倍，另有解码、处理和编码峰值；不要为比较长期驻留多个大图。仅在原流程或用户要求保存时另存结果，不覆盖源文件；成功前核对写入完成并关闭编码器和文件句柄。

## 图源获取与解码

### 资源表媒体

- 预置封面等媒体资源的名称在运行时才确定时，用当前业务模块的 `context.resourceManager.getMediaByName(name)` 取图片字节。固定资源也可从字面量 `$r('app.media.cover').id` 取数字 ID，再调用 `getMediaContent(id)`。
- 不要拼接 `$r` 参数后把得到的 `Resource` 交给 `getMediaContent`：动态构造的引用可能没有有效资源 ID，`Image()` 能显示也不代表能取到字节。遇到 401／9001001 先核对参数和资源 ID；`getMediaByName` 报 9001003／9001004 时核对资源名及其所属模块。
- `getMediaByName` 返回 `Uint8Array`，用 `data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)` 取得有效字节，再传给 `image.createImageSource(buffer)`，避免把视图之外的字节也送入解码器。

### 图库选择

1. 复用已有选图流程。需要选择单图时，用 [PhotoViewPicker](https://developer.huawei.com/consumer/cn/doc/doccenter-references/api/arkts-apis-photoaccesshelper-photoviewpicker) 的 `select()`，设置 `MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE` 和 `maxSelectNumber: 1`，读取 `result.photoUris[0]`。取消或空结果直接结束，不清空当前图片。只读取用户选中的 URI，不为此申请全图库权限。
2. 将返回的 URI 原样传给 `fileIo.open(uri, fileIo.OpenMode.READ_ONLY)`，再用 `image.createImageSource(file.fd)` 创建图源，不把媒体 URI 当沙箱文件路径拼接。解码完成前保持文件打开；成功或失败都先释放 `ImageSource`，再关闭文件。URI 不可读时沿用原有错误处理，不提交超分。

### 远端图片

1. 优先复用应用现有图片加载器取得的 `PixelMap`、原图字节或沙箱缓存文件，沿用已有鉴权和缓存规则，不重复下载。手头只有 HTTPS URL 时，从已有网络层取图；如使用 [Network Kit HTTP 请求](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/http-request)，用 `http.createHttp()` 创建请求对象，再调用其 `request()` 发起 GET，设置 `expectDataType: http.HttpDataType.ARRAY_BUFFER`、连接／读取超时和响应字节上限 `maxLimit`。仅涉及联网获取时核对 `ohos.permission.INTERNET` 声明；它不是超分本身的权限。
2. 检查响应状态与实际字节：只将完整、非空的图片响应体作为 `ArrayBuffer` 传入 `image.createImageSource`，不要把 URL、错误页或 Base64 文本直接传给解码器。若应用已有流式下载到沙箱的路径，可在文件下载完整后按文件描述符解码，无需把文件再读成内存字节。
3. 超时、非预期响应、下载超限或解码失败时跳过超分，保留原有显示和重试行为。自行创建的 HTTP 请求对象在 `finally` 中销毁，临时文件按原流程回收；切图或退出后不提交旧请求的解码结果。

### 统一解码与尺寸检查

- 从 `ImageSource.getImageInfo()` 读取原始像素尺寸。需要缩小大图时，按长边计算等比目标尺寸，通过 `createPixelMap({ desiredSize })` 在解码时缩小；按目标 SDK 核对所需像素格式，不为符合门槛拉伸或放大小图。参见[图片解码](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/image-decoding)。
- 即使已设置 `desiredSize`，也要用 `PixelMap.getImageInfo()` 校验真正送入分析器的宽高，任一边不满足 `16 < size < 2048` 则不调用。负责解码的一方在 `finally` 中释放自己创建的 `ImageSource`；不要释放仍由图片加载器或原流程持有的 `PixelMap`。

## 可复用资产

[ImageSuperResolutionProcessor.ets](assets/ImageSuperResolutionProcessor.ets) 封装 API/SysCap、单飞、尺寸校验和单次分析器生命周期，不依赖 UI、选图、存盘或签名。各入口复用同一资产模块；`processImageSuperResolution` 返回空结果表示未执行（能力不可用、输入尺寸不合格或忙），异常交给现有错误／回退处理。调用方管理输入、返回结果、已有界面与旧请求隔离。未引入本资产的项目也必须满足相同约束。

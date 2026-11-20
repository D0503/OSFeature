import { deviceInfo } from '@kit.BasicServicesKit';
import { imageSuperResolution, visionBase } from '@kit.CoreVisionKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

let processing = false;

export async function processImageSuperResolution(input: PixelMap): Promise<PixelMap | undefined> {
  if (!deviceInfo.apiAvailable('26.0.0') || !canIUse('SystemCapability.AI.Vision.VisionBase') || processing) {
    return undefined;
  }

  processing = true;
  let analyzer: imageSuperResolution.ImageSRAnalyzer | undefined;
  try {
    const size = (await input.getImageInfo()).size;
    if (size.width <= 16 || size.width >= 2048 || size.height <= 16 || size.height >= 2048) {
      return undefined;
    }

    analyzer = await imageSuperResolution.ImageSRAnalyzer.create();
    const imageData: visionBase.ImageData = { pixelMap: input };
    const request: visionBase.Request = { inputData: imageData };
    const response = await analyzer.process(request);
    return response.pixelMap;
  } finally {
    try {
      if (analyzer) {
        await analyzer.destroy();
      }
    } catch {
      hilog.warn(0x0000, 'ImageSuperResolution', 'ImageSRAnalyzer cleanup failed');
    } finally {
      processing = false;
    }
  }
}

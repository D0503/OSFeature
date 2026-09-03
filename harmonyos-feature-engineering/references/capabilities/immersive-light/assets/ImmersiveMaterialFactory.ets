import { deviceInfo } from '@kit.BasicServicesKit';
import { uiMaterial } from '@kit.ArkUI';

/** API 26 编译环境使用。目标工程按需复制成员，不要覆盖现有页面。 */
export class ImmersiveMaterialFactory {
  static readonly MIN_API: number = 26;

  static runtimeApiAvailable(): boolean {
    return deviceInfo.sdkApiVersion >= ImmersiveMaterialFactory.MIN_API;
  }

  static supported(): boolean {
    return ImmersiveMaterialFactory.runtimeApiAvailable() &&
      uiMaterial.isImmersiveMaterialSupported();
  }

  static create(style: uiMaterial.ImmersiveStyle,
    interactive: boolean = false): uiMaterial.ImmersiveMaterial | undefined {
    if (!ImmersiveMaterialFactory.supported()) {
      return undefined;
    }
    return new uiMaterial.ImmersiveMaterial({
      style,
      interactive
    });
  }

  static close(): uiMaterial.Material {
    return uiMaterial.Material.empty;
  }

  static restore(): undefined {
    return undefined;
  }
}

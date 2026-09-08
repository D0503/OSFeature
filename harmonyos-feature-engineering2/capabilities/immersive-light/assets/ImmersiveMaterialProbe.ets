import { deviceInfo } from '@kit.BasicServicesKit';
import { uiMaterial } from '@kit.ArkUI';

export interface ImmersiveMaterialProbeResult {
  sdkApiVersion: number;
  supported: boolean;
  globalLevel: string;
}

/** 只产生运行证据，不对规范冲突作裁决。 */
export function probeImmersiveMaterial(): ImmersiveMaterialProbeResult {
  if (deviceInfo.sdkApiVersion < 26) {
    return { sdkApiVersion: deviceInfo.sdkApiVersion, supported: false, globalLevel: 'api-below-26' };
  }
  const supported = uiMaterial.isImmersiveMaterialSupported();
  return {
    sdkApiVersion: deviceInfo.sdkApiVersion,
    supported,
    globalLevel: supported ? String(uiMaterial.getGlobalMaterialLevel()) : 'unsupported'
  };
}

import { harmonyShare } from '@kit.ShareKit';
import { deviceInfo } from '@kit.BasicServicesKit';
const callback = (target: harmonyShare.SharableTarget) => { target.share(currentPreparedData).catch(reportError); };
function visible() {
  if (deviceInfo.sdkApiVersion >= 20 && canIUse('SystemCapability.Collaboration.HarmonyShare')) {
    harmonyShare.on('gesturesShare', { windowId }, callback);
  }
}
function hidden() {
  if (deviceInfo.sdkApiVersion >= 20 && canIUse('SystemCapability.Collaboration.HarmonyShare')) {
    harmonyShare.off('gesturesShare', { windowId }, callback);
  }
}

import { dlpAntiPeep } from '@kit.DeviceSecurityKit';
export async function protect(windowId: number): Promise<void> {
  if (await dlpAntiPeep.isDlpAntiPeepSwitchOn()) {
    dlpAntiPeep.on('dlpAntiPeep', changed);
    const status = dlpAntiPeep.getDlpAntiPeepInfo();
    if (status === dlpAntiPeep.DlpAntiPeepStatus.HIDE) await dlpAntiPeep.setAntiPeepMaskLayer(windowId);
    dlpAntiPeep.off('dlpAntiPeep', changed);
  }
}
function changed(status: dlpAntiPeep.DlpAntiPeepStatus): void {}

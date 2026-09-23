import { motion } from '@kit.MultimodalAwarenessKit';
import { deviceInfo } from '@kit.BasicServicesKit';
import { BusinessError, Callback } from '@kit.BasicServicesKit';

export class OperatingHandSession {
  private active: boolean = false;
  private subscribed: boolean = false;
  private onDirection: (left: boolean) => void;
  private onError: (code: number) => void;
  private callback: Callback<motion.OperatingHandStatus> = (status: motion.OperatingHandStatus): void => {
    if (!this.active) { return; }
    if (status === motion.OperatingHandStatus.LEFT_HAND_OPERATED) {
      this.onDirection(true);
    } else if (status === motion.OperatingHandStatus.RIGHT_HAND_OPERATED) {
      this.onDirection(false);
    }
  };

  constructor(onDirection: (left: boolean) => void, onError: (code: number) => void) {
    this.onDirection = onDirection;
    this.onError = onError;
  }

  start(): boolean {
    if (this.subscribed) { return this.active; }
    if (deviceInfo.sdkApiVersion < 15 || !canIUse('SystemCapability.MultimodalAwareness.Motion')) {
      return false;
    }
    // Declare the route permission in the owning HAP module.json5.
    this.active = true;
    try {
      motion.on('operatingHandChanged', this.callback);
      this.subscribed = true;
      return true;
    } catch (err) {
      this.active = false;
      this.onError((err as BusinessError).code);
      return false;
    }
  }

  stop(): boolean {
    this.active = false;
    if (!this.subscribed) { return true; }
    try {
      motion.off('operatingHandChanged', this.callback);
      this.subscribed = false;
      return true;
    } catch (err) {
      // Retain ownership until off succeeds; start must not add another callback.
      this.onError((err as BusinessError).code);
      return false;
    }
  }
}

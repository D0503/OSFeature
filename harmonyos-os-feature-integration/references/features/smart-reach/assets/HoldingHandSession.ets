import { motion } from '@kit.MultimodalAwarenessKit';
import { deviceInfo } from '@kit.BasicServicesKit';
import { BusinessError, Callback } from '@kit.BasicServicesKit';

export class HoldingHandSession {
  private active: boolean = false;
  private subscribed: boolean = false;
  private onDirection: (left: boolean) => void;
  private onError: (code: number) => void;
  private callback: Callback<motion.HoldingHandStatus> = (status: motion.HoldingHandStatus): void => {
    if (!this.active) { return; }
    if (status === motion.HoldingHandStatus.LEFT_HAND_HELD) {
      this.onDirection(true);
    } else if (status === motion.HoldingHandStatus.RIGHT_HAND_HELD) {
      this.onDirection(false);
    }
  };

  constructor(onDirection: (left: boolean) => void, onError: (code: number) => void) {
    this.onDirection = onDirection;
    this.onError = onError;
  }

  start(): boolean {
    if (this.subscribed) { return this.active; }
    if (deviceInfo.sdkApiVersion < 20 || !canIUse('SystemCapability.MultimodalAwareness.Motion')) {
      return false;
    }
    this.active = true;
    try {
      motion.on('holdingHandChanged', this.callback);
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
      motion.off('holdingHandChanged', this.callback);
      this.subscribed = false;
      return true;
    } catch (err) {
      // Retain ownership until off succeeds; start must not add another callback.
      this.onError((err as BusinessError).code);
      return false;
    }
  }
}

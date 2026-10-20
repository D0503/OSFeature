import { dlpAntiPeep } from '@kit.DeviceSecurityKit';
import { deviceInfo } from '@kit.BasicServicesKit';

export type PrivacyState = 'unknown' | 'pass' | 'hide';
export interface PrivacyObservation {
  state: PrivacyState;
  maskApplied: boolean;
  error?: string;
}

// One instance belongs to one protected window; its owner supplies the current window ID.
export class AntiPeepSession {
  private active: boolean = false;
  private subscribed: boolean = false;
  private generation: number = 0;
  private targetGeneration: number = 0;
  private eventVersion: number = 0;
  private hideCycle: number = 0;
  private attemptedKey: string = '';
  private pending: boolean = false;
  private windowId: number | undefined = undefined;
  private state: PrivacyState = 'unknown';
  private maskApplied: boolean = false;
  private systemMask: boolean;
  private changed: (observation: PrivacyObservation) => void;
  private listener = (value: dlpAntiPeep.DlpAntiPeepStatus): void => {
    if (!this.active) return;
    this.eventVersion++;
    this.accept(value);
  };

  constructor(systemMask: boolean, changed: (observation: PrivacyObservation) => void) {
    this.systemMask = systemMask;
    this.changed = changed;
  }

  private report(error?: string): void {
    this.changed({ state: this.state, maskApplied: this.maskApplied, error });
  }

  async start(): Promise<void> {
    const target = this.windowId;
    this.stop();
    this.setTargetWindow(target);
    const generation = this.generation;
    this.active = true;
    const minApi = this.systemMask ? 21 : 20;
    if (deviceInfo.sdkApiVersion < minApi || !canIUse('SystemCapability.Security.DlpAntiPeep')) {
      this.active = false;
      this.report('防窥能力不可用');
      return;
    }
    try {
      const opened = await dlpAntiPeep.isDlpAntiPeepSwitchOn();
      if (!this.active || this.generation !== generation) return;
      if (!opened) {
        this.active = false;
        this.report('当前应用防窥开关未开启');
        return;
      }
      dlpAntiPeep.on('dlpAntiPeep', this.listener);
      this.subscribed = true;
      const version = this.eventVersion;
      const value = dlpAntiPeep.getDlpAntiPeepInfo();
      if (this.active && generation === this.generation && version === this.eventVersion) this.accept(value);
    } catch (error) {
      if (!this.active || this.generation !== generation) return;
      this.state = 'unknown';
      this.maskApplied = false;
      this.report(String(error));
    }
  }

  setTargetWindow(windowId: number | undefined): void {
    const next = windowId !== undefined && Number.isInteger(windowId) && windowId > 0 ? windowId : undefined;
    if (next === this.windowId) return;
    this.windowId = next;
    this.targetGeneration++;
    this.attemptedKey = '';
    this.maskApplied = false;
    this.report();
    this.applyMask();
  }

  private accept(value: dlpAntiPeep.DlpAntiPeepStatus): void {
    const next: PrivacyState = value === dlpAntiPeep.DlpAntiPeepStatus.HIDE ? 'hide' :
      value === dlpAntiPeep.DlpAntiPeepStatus.PASS ? 'pass' : 'unknown';
    if (next !== this.state) {
      this.hideCycle++;
      this.maskApplied = false;
    }
    this.state = next;
    this.report();
    this.applyMask();
  }

  private applyMask(): void {
    if (!this.active || !this.systemMask || this.state !== 'hide' || this.windowId === undefined || this.pending) return;
    const generation = this.generation;
    const targetGeneration = this.targetGeneration;
    const cycle = this.hideCycle;
    const id = this.windowId;
    const key = `${generation}:${targetGeneration}:${cycle}`;
    if (this.attemptedKey === key) return;
    this.attemptedKey = key;
    this.pending = true;
    this.requestMask(id, generation, targetGeneration, cycle);
  }

  private async requestMask(id: number, generation: number, target: number, cycle: number): Promise<void> {
    try {
      await dlpAntiPeep.setAntiPeepMaskLayer(id);
      if (this.isCurrent(generation, target, cycle)) {
        this.maskApplied = true;
        this.report();
      }
    } catch (error) {
      if (this.isCurrent(generation, target, cycle)) {
        this.maskApplied = false;
        this.report(String(error));
      }
    } finally {
      this.pending = false;
      // A new target/cycle may have arrived while the previous request was pending.
      this.applyMask();
    }
  }

  private isCurrent(generation: number, target: number, cycle: number): boolean {
    return this.active && this.generation === generation && this.targetGeneration === target &&
      this.hideCycle === cycle && this.state === 'hide';
  }

  stop(): void {
    this.active = false;
    this.generation++;
    this.windowId = undefined;
    this.targetGeneration++;
    this.state = 'unknown';
    this.maskApplied = false;
    this.attemptedKey = '';
    this.report();
    if (this.subscribed) {
      // If off throws, retain the subscription flag and callback so the owner can retry.
      dlpAntiPeep.off('dlpAntiPeep', this.listener);
      this.subscribed = false;
    }
  }
}

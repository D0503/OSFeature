import { deviceInfo } from '@kit.BasicServicesKit';
import { textSearchImage } from '@kit.CoreVisionKit';

export class TextSearchImageSession {
  private pending: Promise<void> = Promise.resolve();
  private initialized: boolean = false;

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.then((): void => {}, (): void => {});
    return result;
  }

  private isSupported(): boolean {
    return deviceInfo.apiAvailable('26.0.0') && canIUse('SystemCapability.AI.Vision.VisionBase');
  }

  private requireReady(): void {
    if (!this.initialized || !this.isSupported()) {
      throw new Error('Text search image session is unavailable');
    }
  }

  open(): Promise<boolean> {
    return this.enqueue(async (): Promise<boolean> => {
      if (!this.isSupported()) {
        return false;
      }
      if (!this.initialized) {
        this.initialized = await textSearchImage.init();
      }
      return this.initialized;
    });
  }

  insert(imagePath: string, scope: string): Promise<boolean> {
    return this.enqueue(async (): Promise<boolean> => {
      this.requireReady();
      return textSearchImage.insertImage(imagePath, scope);
    });
  }

  search(query: string, scope: string, topKey?: number): Promise<textSearchImage.ImageObject[]> {
    return this.enqueue(async (): Promise<textSearchImage.ImageObject[]> => {
      this.requireReady();
      return topKey === undefined
        ? textSearchImage.search(query, scope)
        : textSearchImage.search(query, scope, topKey);
    });
  }

  remove(imagePath: string, scope: string): Promise<boolean> {
    return this.enqueue(async (): Promise<boolean> => {
      this.requireReady();
      return textSearchImage.deleteImage(imagePath, scope);
    });
  }

  clearAllIndexes(): Promise<boolean> {
    return this.enqueue(async (): Promise<boolean> => {
      this.requireReady();
      return textSearchImage.clearData();
    });
  }

  close(): Promise<boolean> {
    return this.enqueue(async (): Promise<boolean> => {
      if (!this.initialized) {
        return true;
      }
      this.requireReady();
      const released = await textSearchImage.release();
      if (released) {
        this.initialized = false;
      }
      return released;
    });
  }
}

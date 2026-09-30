// Static fixture: this is not a buildable application or hardware evidence.
import { motion } from '@kit.MultimodalAwarenessKit';
import { HdsTabs } from '@kit.UIDesignKit';

@Entry
@Component
struct Index {
  private onHolding: Callback<motion.HoldingHandStatus> = (state: motion.HoldingHandStatus) => {};
  aboutToAppear(): void {
    motion.on('holdingHandChanged', this.onHolding);
  }
  aboutToDisappear(): void {
    motion.off('holdingHandChanged', this.onHolding);
  }
  build() {
    HdsTabs() { TabContent() { Text('content') } }
      .barOverlap(true)
      .vertical(false)
      .barPosition(BarPosition.End)
      .barFloatingStyle({ adaptToHandedness: true })
  }
}

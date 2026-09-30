import { HdsNavigation, HdsTabs, hdsMaterial } from '@kit.UIDesignKit'

@Entry
@Component
struct Index {
  build() {
    HdsNavigation() {
      HdsTabs({ barPosition: BarPosition.End }) {
        Text('Home')
          .backgroundColor('#F5F5F5')
      }
      .barHeight(56)
      .barOverlap(true)
      .barFloatingStyle({
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
        }
      })
    }
  }
}

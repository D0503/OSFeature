import { HdsNavigation, HdsTabs, hdsMaterial } from '@kit.UIDesignKit'

@Entry
@Component
struct Index {
  build() {
    HdsNavigation() {
      HdsTabs() {
        Text('Home')
          .backgroundColor('#F5F5F5')
      }
      .barFloatingStyle({
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
        }
      })
    }
  }
}

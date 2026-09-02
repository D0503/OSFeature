import { deviceInfo } from '@kit.BasicServicesKit'
import { uiMaterial } from '@kit.ArkUI'

@Entry
@Component
struct Index {
  private canUseMaterial(): boolean {
    return deviceInfo.sdkApiVersion >= 26 && uiMaterial.isImmersiveMaterialSupported()
  }

  build() {
    Column() {
      Text('Material card')

      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          Text('Home')
        }.tabBar('Home')
        TabContent() {
          Text('Profile')
        }.tabBar('Profile')
      }
      .vertical(false)
      .barOverlap(true)
      .barFloatingStyle({
        systemMaterial: this.canUseMaterial()
          ? new uiMaterial.ImmersiveMaterial({ style: uiMaterial.ImmersiveStyle.ULTRA_THIN })
          : uiMaterial.Material.empty
      })
    }
    .backgroundColor('#F5F5F5')
    .borderColor('#1A000000')
    .systemMaterial(this.canUseMaterial()
      ? new uiMaterial.ImmersiveMaterial()
      : uiMaterial.Material.empty)
  }
}

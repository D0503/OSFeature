import { deviceInfo } from '@kit.BasicServicesKit'
import { uiMaterial } from '@kit.ArkUI'

@Entry
@Component
struct Index {
  private canUseMaterial(): boolean {
    return deviceInfo.apiAvailable('26.0.0') && uiMaterial.isImmersiveMaterialSupported()
  }

  build() {
    Column() {
      Text('Material card')
    }
    .backgroundColor('#F5F5F5')
    .borderColor('#1A000000')
    .systemMaterial(this.canUseMaterial()
      ? new uiMaterial.ImmersiveMaterial()
      : uiMaterial.Material.empty)
  }
}

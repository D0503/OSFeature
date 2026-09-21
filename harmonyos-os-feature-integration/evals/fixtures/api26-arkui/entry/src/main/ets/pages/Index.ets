@Entry
@Component
struct Index {
  build() {
    Column() {
      Text('System default THIN native Tabs')

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
        maskColor: Color.Transparent,
        adaptToHandedness: true
      })
    }
    .backgroundColor('#F5F5F5')
    .borderColor('#1A000000')
  }
}

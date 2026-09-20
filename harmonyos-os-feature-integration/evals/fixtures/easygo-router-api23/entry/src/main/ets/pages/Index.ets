import router from '@ohos.router'
@Entry
@Component
struct Index {
  build() { Column() { Button('详情').onClick(() => router.pushUrl({ url: 'pages/Details' })) } }
}

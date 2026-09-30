@Entry
@Component
struct Index {
  stack: NavPathStack = new NavPathStack()
  build() { Navigation(this.stack) { Text('首页') }.id('mainNavigation') }
}

@Entry
@Component
struct Index {
  stack: NavPathStack = new NavPathStack()
  build() { Navigation(this.stack) { Text('首页') }.id('mainNavigation') }
}
// Static fixture: the caller must confirm its runtime version guard.
function query(context: UIContext): boolean { return context.isEasySplit() }

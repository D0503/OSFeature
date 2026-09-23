# 最小资产

模板仅提供配置起点，不直接覆盖已有资源。实际 module.easyGo 引用位置、文件名、页面和设备覆盖须由工程事实确定。

- [Router API 23](assets/router-api23.json)：基础导航配置；pages/Index 必须替换为实际主页路径。
- [Navigation API 23](assets/navigation-api23.json)：以 Navigation 首页 navBar 为主页的基础配置。
- [Router API 26 购物模式](assets/router-shopping-api26.json)：在基础配置上显式启用 mode=0。
- [Navigation API 26 购物模式](assets/navigation-shopping-api26.json)：在基础配置上显式启用 mode=0。

四份模板均设置 enableReducedContainerSize=true，API 26 模板同时设置 drawableRectHook=true。API 26 导航模式可使用基础模板并补入 drawableRectHook=true，无需为了默认字段启用购物模式。先完成 [配置确认](configuration-confirmation.md)，再按确认结果填写页面与其他选项；已核实的开屏广告页、启动页、隐私协议页按规则加入 fullScreenPages，模板不预填任何虚构业务页面名；其他未决定的全屏页、过渡页不能因模板省略而视为无需。拖拽、关联页、其他全屏页和窗口分屏不擅自启用；已有显式 false 或用户选择优先于模板默认值。

在 module.json5 的 module 对象中添加 `"easyGo": "$profile:easy_go"`；如果工程已经引用其他名称，沿用它并修改所引用资源。

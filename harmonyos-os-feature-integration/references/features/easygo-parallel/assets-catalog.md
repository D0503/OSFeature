# 最小资产

模板仅提供配置起点，不直接覆盖已有资源。实际 module.easyGo 引用位置、文件名、页面和设备覆盖须由工程事实确定。

- [Router API 23](assets/router-api23.json)：基础导航配置；pages/Index 必须替换为实际主页路径。
- [Navigation API 23](assets/navigation-api23.json)：以 Navigation 首页 navBar 为主页的基础配置。
- [Router API 26 购物模式](assets/router-shopping-api26.json)：在基础配置上显式启用 mode=0。
- [Navigation API 26 购物模式](assets/navigation-shopping-api26.json)：在基础配置上显式启用 mode=0。

按需求从配置说明添加增强字段，不默认开启虚拟容器、拖拽、关联页、全屏页或窗口分屏。本包配置为独立最小示例，没有复制购物工程中的业务 UI、媒体或缓存。

在 module.json5 的 module 对象中添加 `"easyGo": "$profile:easy_go"`；如果工程已经引用其他名称，沿用它并修改所引用资源。

# 接入实施

先扫描实际入口、宿主 module、页面注册、已有浮窗/画中画和控制器所有者。确认用户需要 float-view、floating-ball 还是 binding；展示可用路线与 SDK 升级选择。绑定只选 binding，不再同时选择两条独立路线。

首次修改前按[权限与提醒要求](compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。

1. 记录接入前源程序状态，完成 [兼容性](compatibility.md) 门禁与权限准备。
2. 按目标读取 [窗路线](routes/float-view.md)、[球路线](routes/floating-ball.md)；绑定才加载 [绑定流程](routes/binding.md)，使用独立组合资产按 prepare、bind、start、stop、双端停止后 release 分步接入，unbind 按需使用。
3. 在原业务入口串行管理创建、启动、切换和停止。控制器所有者应覆盖其持续展示期；主页面暂时隐藏不等于全局窗口业务结束，不机械地在 aboutToDisappear 停掉所有窗口。
4. 创建前、await 返回后及事件回调中复核所有者是否仍有效。防止重复点击产生多个控制器，失败后释放本次已建立的监听/资源，不影响已有业务实例。
5. 平台请求的 Promise 不替代 STARTED／STOPPED 等系统状态通知。窗球控制器资产的异步操作返回 Promise，失败交给调用方处理；系统关闭、替换和主窗口销毁仍通过终态清理。
6. 按 [验证](performance-validation.md) 完成静态、构建与运行证据。

交付时按[权限与提醒要求](compatibility.md#权限声明acl-与用户授权)向开发者说明本次路线的权限条件和申请入口。

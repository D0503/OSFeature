# 故障排查

先记录 SDK/系统 API、设备形态、窗口尺寸和模式、用户开关、entry 引用、实际资源及路由体系；区分未满足条件、配置错误与运行行为限制。只要求诊断时不直接修改。

| 现象 | 检查与处理 |
|---|---|
| 不分栏 | 检查 entry.module.easyGo 的真实资源、窗口阈值、设备覆盖是否 original、系统开关和自由多窗；查询 isEasySplit 需 API 24，不是启用接口 |
| 购物/拖拽等不生效 | 检查 API 26、mode 与 pagePairs/transPages 的适用模式；拖拽开启后 ratio 失效，不误判为配置未读取 |
| 内容截断 | 检查整窗宽计算；优先自适应容器，按需求启用 enableReducedContainerSize 或使用页面尺寸监听，比例变化时不写死二分之一 |
| 左右资源只显示一次 | 检查 NodeContainer/复用节点是否共享同一 UI 实例；两页应各持独立 UI 资源，业务数据是否共享按原业务保持 |
| 页面级方向无效 | 双页需要统一方向；使用窗口级 setPreferredOrientation，结束恢复原策略，不假设 NavDestination.preferredOrientation 可独立控制左右页 |
| 一镜到底等转场失效 | 系统可能屏蔽或调整部分动效；记录已观察场景，不以强制动画改写系统行为 |
| 主页或关联页错误 | 区分 Router 路径、navBar、目的页 name；检查 homeNavigationId 是否全局容器，关联页是否依赖动态参数 |
| 混合路由异常 | 定位 Router 与 Navigation 的实际使用链；先确认路线和产品范围，再决定调整，不自动迁移整个工程 |
| 动态配置无法判定 | 配置不等于当前分栏；API 24+ 在有效 UIContext 查询，API 23 用页面/组件树和操作证据确认 |

修复后回归受影响模式、真实跳转和关闭/低版本路径，按 [验证](performance-validation.md) 提交证据。

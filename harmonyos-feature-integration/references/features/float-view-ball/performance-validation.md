# 性能与验证

运行通用 inspect-project、check-compatibility、verify-integration，feature 使用 float-view-ball。auto 在发现 bind 时选择 binding，否则保留检测到的独立路线。verify-development 的独立场景使用 float-view 或 floating-ball，绑定场景使用 binding，一轮覆盖两端与系统切换。

静态 warn 逐项附文件证据复核；扫描仅解析直接调用和字面量，动态参数、跨模块控制器、HAR宿主、控制流和授权不能由关键字证明。目标参数对象里的 titleColor/contentColor/textUpdateAnimationType 计入 API 26；候选同名字段需核对用途。

运行日志/交互树观察项使用 runtime.observations：window-started、content-updated（STATIC 可记录不可更新的预期与证据）、window-stopped、fallback-preserved、device-support-confirmed。绑定另需 view-to-ball、ball-to-view、pair-stopped。每项包含 note 和本轮 runtime.evidence 的 id/sha256。visual 需引用显示态与关闭/切换态至少两张不同截图。窗球模拟器可用性由 device-support-confirmed 记录对应工具/系统版本及实测，未确认不通过。

使用工具资产时，额外验证 startParams/updateParams 原样传入、可选回调组合、有 want 才点击恢复、无 want 的绑定切换、球控制器未创建时拒绝操作且不误报成功，以及监听注册失败的退订、启动／停止失败后的引用保留和 STOPPED 清理。Node 模拟测试不等于 HarmonyOS 编译或设备验收。

检查高频更新合并、PixelMap释放、重复启动与监听数量、长时间后台展示、旋转和窗口限制变化。未执行的设备、权限、交互和视觉验证保留 not_run/inconclusive；构建与模拟输入不能证明实际窗口效果。

更新与替换验收：

- 同一条目数据变化时，窗与球取自同一份最新数据；球不因数据事件意外推进轮换，控制器不重复创建。
- 当前条目删除、下一条删除、列表重排和列表清空时无越界或空参数更新；空列表不继续轮换。
- 窗往返切换模板时，系统尺寸与页面布局一致；接口失败不提交新布局，显示区域和条目数量变化后尺寸仍符合当前模板限制。
- 模板切换、恢复主窗口和普通数据更新不会隐式重建；仅明确的替换请求触发旧组双端停止、释放、新组创建与启动。
- 双端 STOPPED 不同顺序、停止失败、重复替换请求、用户关闭及旧数据请求晚到时，不重复创建、不误重开、不让旧数据覆盖新实例。
- 连续切换布局或重新开启后，轮换任务和数据／显示事件订阅数量不增长；可选 unbind 不成为常规停止释放的前置步骤。

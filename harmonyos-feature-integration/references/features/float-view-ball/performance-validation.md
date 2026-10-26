# 性能与验证

运行通用 inspect-project、check-compatibility、verify-integration，feature 使用 float-view-ball。auto 保留检测到的组合路线；verify-development 按 float-view/floating-ball 分别执行，共用报告但不以一条路线代替另一条。

静态 warn 逐项附文件证据复核；扫描仅解析直接调用和字面量，动态参数、跨模块控制器、HAR宿主、控制流和授权不能由关键字证明。目标参数对象里的 titleColor/contentColor/textUpdateAnimationType 计入 API 26；候选同名字段需核对用途。

运行日志/交互树观察项使用 runtime.observations：window-started、content-updated（STATIC 可记录不可更新的预期与证据）、window-stopped、fallback-preserved、device-support-confirmed。绑定另需 view-to-ball、ball-to-view、pair-stopped。每项包含 note 和本轮 runtime.evidence 的 id/sha256。visual 需引用显示态与关闭/切换态至少两张不同截图。窗球模拟器可用性由 device-support-confirmed 记录对应工具/系统版本及实测，未确认不通过。

使用工具资产时，额外验证 startParams/updateParams 原样传入、可选回调组合、有 want 才点击恢复、无 want 的绑定切换、球控制器未创建时拒绝操作且不误报成功，以及监听注册失败的退订、启动／停止失败后的引用保留和 STOPPED 清理。Node 模拟测试不等于 HarmonyOS 编译或设备验收。

检查高频更新合并、PixelMap释放、重复启动与监听数量、长时间后台展示、旋转和窗口限制变化。未执行的设备、权限、交互和视觉验证保留 not_run/inconclusive；构建与模拟输入不能证明实际窗口效果。

绑定资产另运行 `node evals/run-float-view-ball-controller-tests.mjs`，覆盖部分准备失败、双初始展示、双端终态先后顺序和解绑原始引用。与窗、球资产回归共同执行，系统切换仍须设备验收。

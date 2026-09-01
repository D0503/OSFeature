# 工程发现工作流

先从工程事实建立上下文，避免向用户询问可直接读取的信息。

1. 运行 `node scripts/inspect-project.mjs --project <path>`；无法从工程 `local.properties` 或受支持环境变量定位 SDK 时，让用户提供实际 SDK 根目录并用 `--sdk <path>` 重跑。
2. 先核对 `localSdk.status`、`sdk-pkg.json`、本机 SDK API 和版本，再核对工程根、Stage/FA 模型、compile/target/compatible API、module 类型、配置文件和组件体系。工程未显式声明 `compileSdkVersion` 时，脚本将已验证的活动 SDK API 标记为 `api.compile`，并把 `api.compileSource` 设为 `local-sdk-default`。
3. `localSdk.status` 不是 `valid` 时停止路线判断；不得把 DevEco Studio 已安装、工程能打开或配置了高 target API 当作本机 SDK API 已满足的证明。
4. 读取脚本提供的 `evidence` 文件定位；值为 `unknown` 时人工检查对应配置，不用默认版本补齐。
5. 排除 `build`、`oh_modules`、`.git` 和生成目录，不把缓存命中当作源码事实。
6. 记录用户目标组件、设备范围、任务类型和不能从工程发现的外部条件。

发现结果只描述现状，不在本阶段修改工程或判断最终可行性。

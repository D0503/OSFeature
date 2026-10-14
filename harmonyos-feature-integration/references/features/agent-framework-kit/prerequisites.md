# 开发者前置操作指引

这些操作由开发者在[小艺开放平台](https://developer.huawei.com/consumer/cn/hag/hagindex.html?isInFrame=true&lang=zh_CN#/)、[AppGallery Connect](https://developer.huawei.com/consumer/cn/service/josp/agc/index.html) 和本机签名环境中完成。缺少前置条件时明确指出尚缺哪一项，同时继续不依赖该条件的工程检查。

## 创建与准备 Agent

1. 在小艺开放平台创建或选择已有 Agent，进入编排页，配置其名称、说明和业务能力，使用平台调试预览确认回答与功能符合预期。操作参见[开发 Agent](https://developer.huawei.com/consumer/cn/doc/service/developing-intelligent-agents-0000002435989592)和[开发界面介绍](https://developer.huawei.com/consumer/cn/doc/service/development-guide-0000002670266897)。具体智能体开发模式按业务选择，不在 Function 接入中实现端/云 A2A 或后端。
2. 在智能体配置页面的网址中获取该智能体的 `agentId`，用于 FunctionComponent，长度为 1–64 个字符。不要使用示例中的 Agent ID，也不要把应用 appid、包名或显示名称当作 agentId。
3. 如果尚未创建鸿蒙应用，先按[创建鸿蒙应用指导](https://developer.huawei.com/consumer/cn/doc/app/agc-help-create-app-0000002247955506)在 AppGallery Connect 创建；关联列表只支持选择当前账号在 AppGallery Connect 中已上架的应用。若目标应用未出现在列表，先核对账号、应用与上架状态，不承诺创建后即可关联。

## 关联应用与签名

1. 在 Agent 编排页的“关联应用”右侧选择“添加”，为目标应用打开“是否关联应用”开关，具体参见[关联应用](https://developer.huawei.com/consumer/cn/doc/service/related-applications-0000002437785706)。
2. 核对应用名称、包名和 appid 与实际安装应用一致。该关联决定 Agent 允许在哪些应用中被拉起。
3. 按[手动配置签名信息](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-signing-manual#section15586174616)配置手动签名并签署真机调试 HAP。未签名 HAP 不能真机调试；自动签名生成的运行时 appid 可能与平台关联 appid 不一致，导致“Agent 未授权给该应用”。不把密钥、证书口令写入代码或验证报告。
4. 关联修改后重新发布 Agent 测试版本，再验证授权。

## 发布真机测试

1. 在 Agent 调试预览区进入“真机测试 → 白名单”，选择测试用户组。没有用户组时创建并添加实际登录测试设备的华为账号；也可从[真机测试管理](https://developer.huawei.com/consumer/cn/hag/hagindex.html?isInFrame=true&lang=zh_CN#/console-web/pub-management/userList)进入，操作参见[真机测试指南](https://developer.huawei.com/consumer/cn/doc/service/list-of-user-groups-for-real-machine-testing-0000002471264273)。
2. 测试成员需要属于当前团队并拥有小艺开放平台权限，添加成员参见[管理团队账号](https://developer.huawei.com/consumer/cn/doc/start/mta-0000001059655998)；Inhouse 类型账号不能为团队成员添加该权限时，按平台限制使用主账号测试。
3. 返回编排页，选择“真机测试 → 发布真机测试”。重新启动小艺，通常 3–5 分钟内在对话列表出现带“开发中”标签的 Agent。
4. 测试版本有效期 15 天，范围与有效期以最后一次测试发布及选中用户组为准。过期或成员变更后重新核对发布状态。
5. 测试设备登录华为账号并联网；测试态拉起要求小艺版本至少 11.3.8.300。应用端接入后点击 Function 入口进行联调。

正式发布及上架操作仍由开发者完成。白名单内账号会优先拉起测试态 Agent；验收正式版本时，可由开发者删除对应白名单配置或取消测试发布。不要为修复拉起问题自动操作平台发布、上架或白名单。

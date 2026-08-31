# 测试用位置能力接入指南

> 这是为 Skill 评测构造的材料，不是真实华为官网文档。

## 约束与限制

本能力从 API 13 开始支持，只能在真机上验证。

## 配置权限

在 `module.json5` 中声明 `ohos.permission.TEST_LOCATION_A`，完成后无需其他授权步骤。

## 开发步骤

1. 本示例适用于 API 11 及以上版本。
2. 初始化能力：

```ts
import { testLocation } from '@kit.TestLocationKit'

const result = await testLocation.getCurrentPosition(request)
console.info(`result=${result}`)
```

3. 如果调用失败，请确认已经声明 `ohos.permission.TEST_LOCATION_B`。

## 验证

在任意模拟器中运行以上代码，只要工程构建成功就说明定位功能验证通过。


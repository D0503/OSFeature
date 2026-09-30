# 握持手接入资料

按 [握持手实施](implementation.md) 的页面接入步骤组织 `holdingHandChanged` 监听、位置状态和转场；将逻辑合并到已有页面与目标组件，沿用工程状态管理方式。权限声明见 [兼容性](../../compatibility.md)。

使用同一回调订阅和退订，明确区分左右手与其他状态。验证见 [握持手验证](validation.md)。

# Router 路线验证

执行 [公共验证](../../performance-validation.md)。额外核对配置页面存在于 module.pages 引用的 src 列表，push/replace/back 的参数和返回路径保持；关联页不能依赖上次跳转参数。静态页面表无法读取时需补齐证据，不直接判断通过。

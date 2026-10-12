# 最终产物保留规则

最终输出仅保留 Demo 工程、截图与报告。过程材料只在本轮临时目录保存，不保留历史基线。

- Demo：保留可继续开发的源码、资源和必要工程配置；本次构建产生的缓存、依赖目录、日志、安装包及中间产物不作为交付内容。不得清理用户已有文件或现有工程的依赖、配置。
- 截图：仅保留报告实际引用的截图，使用交付目录内的相对链接。日志、组件树和录屏可在验证中临时使用，结束后不单独交付。
- 报告：保留 Markdown 和需要的结构化 JSON 报告；将结论、设备类型、环境、关键错误、必要日志摘录、判据原文摘录、官网来源、抓取时间及哈希直接写入报告。不要将快照、计划或判据文件改名为“报告”保留。

本批首个 `prepare-demo-output.mjs` 返回 `workDirectory`，后续 Demo 用 `--work-dir` 复用；验证计划和报告集合工作数据写入该临时目录。冻结快照、判据草稿/最终集、基线、实施记录、导航、判图、日志和构建证据副本同样在临时目录处理。调用链使用显式 `--output`、`--frozen`、`--criteria`、`--baseline`、`--implementation` 等参数引用它们；不使用目标 Demo 下的默认过程目录。

完成或明确受阻时，先把需要的事实和失败原因写进报告，再确认截图已复制、报告不存在临时文件链接，最后只清理本次创建的临时目录及明确登记的生成文件。不得因清理丢失诊断结论，不对用户提供的原始资料或既有产物做递归删除。本次规则不要求清理历史输出。

每次运行重新从现网冻结并现提判据；不读取或写入历史基线。

多 Demo 累计报告在同一批任务中共享一份临时 collection；渲染器同时交付 Markdown 与结构化 JSON 报告，本批结束后清理临时目录。跨批次需要累计时从交付的 JSON 报告续接，不依赖已清理的工作文件。

最终目录示例：

```text
<result>/<featureId>/
  development-verification-report.md
  development-verification-report.json
  demo-real-device-validation-report.md
  demo-real-device-validation-report.json
  D01/
    test-demo/
    evidence/
      emulator/       # 仅截图
      real-device/    # 仅截图
```

报告文件名保留兼容性，设备类型以报告正文为准。目录中的报告按实际需要生成，不要求重复输出同一结论。

---
name: abnormal-report-system
description: Use when querying abnormal-report-mcp for Andon abnormal records, abnormal status, handling results, handling progress, abnormal causes, or historical Andon handling experience.
---

# 安灯系统异常报告 MCP

## 核心规则

这个 skill 只适用于 `abnormal-report-mcp`。当前 MCP 只提供安灯系统异常报告查询能力。

当用户询问安灯系统中的异常、状态、处理结果、处理进度、关闭情况、异常原因或历史处理经验时，必须调用 `queryAbnormalReportPage` 查询 `AndonAbnormalReport` 记录后再回答。

不要凭常识编造安灯异常数据、状态、处理结果、处理人、处理时间或关闭情况。查询结果不足时，明确说明缺少哪些条件或记录。

## 参考文档

处理安灯异常报告查询时，只读取：

- `references/abnormal-report.md`

## 查询规则

`queryAbnormalReportPage` 支持：

- `page`
- `limit`
- `contain`
- `exclude`
- `filters`

构造 `filters` 时：

- key 使用 `AndonAbnormalReport` 的字段名，不要使用中文标题作为 key。
- 文本字段可用于模糊查询。
- 日期时间字段使用 `{ "start": "...", "end": "..." }` 表示范围。
- 状态、处理结果等枚举字段优先使用系统字段值；不确定字段值时先放宽条件查询。
- 用户没有指定分页时，默认 `page=1`、`limit=5`。
- 条件不充分时，先用已知条件查询；不要虚构字段或值。

## 输出要求

回答应基于 `queryAbnormalReportPage` 的返回结果，并尽量包含：

1. 结论
2. 查询条件
3. 关键异常记录
4. 异常状态或处理结果
5. 后续建议

如果没有查到匹配记录：

- 说明没有匹配结果。
- 不要编造异常原因或处理结果。
- 建议用户补充工位、设备、产线、物料、人员、时间范围或异常关键词等查询条件。

# 生产任务流程

## 查询生产任务

调用 `queryProductionTaskList` 查询生产任务。

后续下达或反下达时，必须从返回的 Work Buddy 查询上下文中获取：

- 生产任务 `id`
- `billNo`
- `materielName`
- `stationName`
- `checkStatus`

## 状态值

生产任务 `checkStatus` 的含义：

| 值 | 含义 |
|---|---|
| `0` | 未下达 |
| `1` | 已下达 |
| `2` | 生产中 |
| `3` | 已完成 |
| `4` | 已作废 |
| `5` | 已暂停 |

## 下达生产任务

用户要下达生产任务时，按下面流程执行：

1. 调用 `queryProductionTaskList`。
2. 让用户选择一个或多个生产任务。
3. 校验每个选中任务的 `checkStatus=0`。
4. 调用 `auditProductionTask`。

只有未下达的任务可以下达。其他状态必须拒绝，不能调用下达工具。

## 反下达生产任务

用户要反下达生产任务时，按下面流程执行：

1. 调用 `queryProductionTaskList`。
2. 让用户选择一个或多个生产任务。
3. 校验每个选中任务的 `checkStatus=1`。
4. 调用 `reverseAuditProductionTask`。

只有已下达的任务可以反下达。其他状态必须拒绝，不能调用反下达工具。

## 批量操作

下达和反下达都支持批量操作。

不要在对话中手动拼接逗号分隔的 `ids`。把用户选中的任务记录传给工具，由工具内部负责拼接 id。

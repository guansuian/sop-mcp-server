# 项目流程

## 查询项目

调用 `queryProjProjectList` 查询项目记录。

后续修改项目、删除项目、查询项目任务时，必须从返回的 Work Buddy 查询上下文中获取项目 `id`。

## 新增项目

用户要新增项目时，按下面流程执行：

1. 调用 `queryProjCustomer` 查询客户。
2. 让用户选择客户。
3. 使用选中客户的字段：
   - `customerId`
   - `customerName`
   - `customerCode`
4. 如果需要项目经理，调用 `queryProjUser` 查询用户。
5. 使用查询返回的用户数据构造项目经理字段。
6. 调用 `saveProjProject`。

不要手写或猜测客户字段。客户字段必须来自 `queryProjCustomer`。

## 修改项目

用户要修改项目信息时，按下面流程执行：

1. 调用 `queryProjProjectList` 查询项目。
2. 让用户选择要修改的项目。
3. 调用 `updateProjProject`，传入选中项目的 `id`。
4. 只传用户明确要修改的字段。

如果要修改客户相关字段，先调用 `queryProjCustomer`。

如果要修改项目经理相关字段，先调用 `queryProjUser`。

## 删除项目

用户要删除项目时，按下面流程执行：

1. 调用 `queryProjProjectList` 查询项目。
2. 让用户选择一个或多个项目。
3. 校验每个选中项目的 `projectStatus=0`。
4. 调用 `deleteProjProject`。

只有未开始状态的项目可以删除。其他状态都不能删除。

## 查询项目任务

用户要查询某个项目下的任务时，按下面流程执行：

1. 调用 `queryProjProjectList` 查询项目。
2. 让用户选择项目。
3. 调用 `queryProjectTask`，传入项目 `id`。

返回的任务结构是树形结构。后续修改或删除任务时，使用任务 `id`。

## 新增项目任务

用户要新增任务或新增子任务时，按下面流程执行：

1. 通过 `queryProjProjectList` 确定目标 `projectId`。
2. 如果是新增子任务，通过 `queryProjectTask` 确定 `parentId`。
3. 调用 `queryDutyList` 查询责任人。
4. 让用户选择责任人。
5. 使用选中责任人的字段：
   - `dutyUserId`
   - `dutyUserName`
6. 调用 `saveProjTask`。

任务必填字段：

- `taskName`
- `dutyUserId`
- `dutyUserName`
- `notifyType`
- `projectId`

工具内部会固定 `delayDays=0` 和 `progress=0`。

## 修改项目任务

用户要修改任务信息时，按下面流程执行：

1. 调用 `queryProjectTask` 查询任务。
2. 让用户选择要修改的任务。
3. 如果要修改责任人，先调用 `queryDutyList`。
4. 调用 `updateProjTask`，传入选中任务的 `id`。

只传用户明确要修改的字段。`dutyUserId` 和 `dutyUserName` 必须成对传入。

## 删除项目任务

用户要删除任务时，按下面流程执行：

1. 调用 `queryProjectTask` 查询任务。
2. 让用户选择一个或多个任务。
3. 调用 `deleteProjTask`。

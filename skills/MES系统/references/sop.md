# SOP 流程

## 上传 SOP

用户要上传 SOP 文件时，按下面流程执行：

1. 调用 `selectCategoryTreeList` 查询 SOP 分类。
2. 让用户选择分类。
3. 使用选中分类的 `id` 作为 `esopCategoryId`。
4. 调用 `likeSelectMaterielList` 查询物料。
5. 让用户选择物料。
6. 使用选中物料的 `id` 作为 `materielId`。
7. 调用 `uploadSop` 上传文件。

`uploadSop` 必填参数：

- `version`：SOP 版本号。
- `file_path`：MCP Server 所在电脑可读取的本地文件路径。
- `materielId`：来自 `likeSelectMaterielList`。
- `esopCategoryId`：来自 `selectCategoryTreeList`。

限制：

- 不要凭空构造 `materielId` 或 `esopCategoryId`。
- `file_path` 必须是 MCP Server 所在电脑上的可读路径。
- 文件大小不能超过 100 MB。
- 不需要上传 `procedureId`。

## 查询 SOP 列表

调用 `querySopList` 查询 SOP 附件列表。

后续如果要下发或选择 SOP，必须从返回的 Work Buddy 查询上下文中读取 SOP 记录 `id`。

## 下发 SOP 到工位机

用户要把 SOP 下发到工位机时，按下面流程执行：

1. 调用 `querySopList` 查询 SOP。
2. 让用户选择一个或多个 SOP 记录。
3. 调用 `queryWorkstationList` 查询工位机。
4. 让用户选择工位机。
5. 调用 `dispatchToStation`。

`dispatchToStation` 必填参数：

- `sops`：用户选中的 SOP 记录列表，每条记录必须包含 `id`。
- `stationId`：来自 `queryWorkstationList`。
- `stationName`：来自 `queryWorkstationList`。

支持批量下发。不要使用未从 `queryWorkstationList` 返回的工位机 id 或名称。

## 查询异常图纸

调用 `queryAbnormalDrawingList` 查询 SOP 异常图纸或异常标注点。

该工具内部规则：

- `/form/initFieldData` 使用 `className=AbnormalDrawing`。
- `/attachment/queryPageMap` 使用 `className=Attachment`。
- 固定查询参数：`fileType=abnormalDrawing`。

## 预览 SOP 异常标注图片

用户要查看 SOP 异常标注点对应的前端图片时，按下面流程执行：

1. 调用 `queryAbnormalDrawingList`。
2. 让用户选择要查看的记录。
3. 调用 `previewSopFile`，参数使用选中记录的 `id`。
4. 读取工具返回的图片 URL，并将图片展示给用户。

不要要求用户提供 `pathField`；工具内部固定使用 `filePath`。

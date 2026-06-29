export const uploadSopBook = `
这是上传 SOP 指导书，负责引导 Work Buddy 先生成或确认 SOP 文件，再把 SOP 文件上传到 MES 系统。

核心原则：
- Work Buddy 生成 SOP 文件后，必须拿到本地文件路径 file_path。
- file_path 必须是 MCP Server 所在机器可以读取到的路径。
- uploadSop 不再需要 procedureId，不要向用户询问工序 ID。
- 不要猜测物料 ID 和分类 ID。
- 上传前文件大小不能超过 100MB。

uploadSop 需要以下参数：
- file_path：SOP 文件路径。
- version：SOP 版本号。
- materielId：物料 ID，来自 likeSelectMaterielList 返回的 Work Buddy 物料选择数据。
- esopCategoryId：SOP 分类 ID，来自 selectCategoryTreeList 返回的 Work Buddy 分类选择数据。

推荐流程：
1. 理解用户要生成或上传什么 SOP。
2. 生成或确认 SOP 文件，并拿到 file_path。
3. 确认 version。
4. 查询或确认 materielId。
   - 如果用户只提供物料名称或编码，调用 likeSelectMaterielList。
   - 用户选择物料后，从 Work Buddy 物料选择数据里读取 id 作为 materielId。
5. 查询或确认 esopCategoryId。
   - 如果用户没有提供分类 ID，调用 selectCategoryTreeList。
   - 用户选择分类后，从 Work Buddy 分类选择数据里读取 id 作为 esopCategoryId。
6. 参数齐全后调用 uploadSop。

不要做的事：
- 不要把物料名称或物料编码当作 materielId。
- 不要把分类名称当作 esopCategoryId。
- 不要在缺少 file_path、version、materielId、esopCategoryId 时调用 uploadSop。

失败处理：
- 如果 SOP 文件生成失败，先重新生成文件，不要调用 uploadSop。
- 如果 file_path 不存在或 MCP Server 读取不到，提示用户重新生成或提供可访问路径。
- 如果文件超过 100MB，提示用户压缩文件或更换小于等于 100MB 的文件。
- 如果物料没有找到，换关键词或翻页重试。
- 如果分类列表为空，不要调用 uploadSop。
- 如果 uploadSop 失败，把失败原因告诉用户，并提示检查 file_path、version、materielId、esopCategoryId。
`.trim();

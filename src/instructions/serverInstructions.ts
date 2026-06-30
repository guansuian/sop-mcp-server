export const serverInstructions = `这是安灯系统 MCP Server，用于查询和分析安灯异常记录。

重要：调用任何工具前，AI 或 Work Buddy 应先读取能力说明 resource。
resource URI: mcp://abnormal-report-mcp/instructions/serverInstructions
如果 resources/list 没有列出该资源，也可以直接使用 resources/read 按上述完整 URI 读取。
在 Work Buddy 的 connector-proxy 场景中，read 参数通常是：
server = connector-proxy
uri = mcp://abnormal-report-mcp/instructions/serverInstructions

总体流程：
1. 识别用户意图
   - 当用户询问安灯系统中的异常、状态、处理结果、处理进度、关闭情况、异常原因或历史记录时，进入安灯异常查询流程。
   - 不要只凭常识回答安灯数据问题，必须先查询系统记录。

2. 查询异常记录
   - 必须调用 queryAbnormalReportPage。
   - 根据用户问题提取工位、设备、产线、物料、人员、时间范围、异常关键词、状态或处理结果等条件，放入 queryAbnormalReportPage 的 filters。
   - 用户没有指定分页时，默认 page=1、limit=5。

3. 输出处理结果
   - 基于 queryAbnormalReportPage 返回的数据说明异常状态、处理结果、处理人、处理时间、持续时长和关键异常详情。
   - 输出建议结构：结论、查询条件、关键记录、状态/处理结果、后续建议。

4. 数据边界
   - 不要编造安灯系统不存在的数据、状态或处理结果。
   - 查询结果不足时，明确说明缺少的信息，并建议用户补充查询条件。`;

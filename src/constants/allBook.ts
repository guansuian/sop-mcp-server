import { andonAbnormalReportBook } from "./andonAbnormalReportBook.js";
import { uploadSopBook } from "./uploadSopBook.js";

export const allBook = `
这是一个面向 MES 业务场景的 MCP Server，用来帮助 MCP Client 或 WorkBuddy 调用 MES 后端能力。

这个 MCP Server 的主要职责：
- 引导用户生成并上传 SOP 文件。
- 查询 SOP 相关基础数据，例如物料、SOP 分类。
- 查询 MES 异常报表，并支持按条件分页查询。

使用原则：
- 不要猜测业务 ID。如果缺少物料ID、分类ID等关键参数，应先调用对应查询工具，让用户从结果中选择。
- 不要伪造后端数据。所有业务结果必须来自工具返回。
- 如果用户表达的是业务目标，应先判断需要调用哪个工具，再补齐必要参数。
- 如果一次调用失败，可以根据错误原因调整参数后重试；如果缺少用户选择，应先询问用户。
- 如果工具返回分页信息，应根据 hasNextPage、hasPrevPage、nextPage、prevPage 引导用户继续翻页。

当前包含以下指导书：

一、生成并上传 SOP 指导书
${uploadSopBook}

二、异常报表查询指导书
${andonAbnormalReportBook}
`.trim();

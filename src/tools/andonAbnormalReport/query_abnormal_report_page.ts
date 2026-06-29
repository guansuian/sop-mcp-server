import * as z from "zod/v4";
import type { MesClient } from "../../services/mesClient.js";
import { FormPageQueryService } from "../../services/abstract/formPageQueryService.js";
import { DynamicPageToolFormatter } from "../../services/abstract/DynamicPageToolFormatter.js";
import type { ToolCallResult } from "../../types/toolContent.js";
import { logger } from "../../utils/logger.js";

export const name = "queryAbnormalReportPage";
const REPORT_CLASS_NAME = "AndonAbnormalReport";
const REPORT_ENDPOINT = "/andonAbnormalReport";

export const description =
    "查询 MES 异常报表/安灯异常记录时使用本工具；当用户明确想查看异常报表、异常记录、异常统计、异常处理历史时，应调用本工具。用户提出制造现场、生产现场、工位、设备、质量、物料、节拍等问题或异常，并希望查找原因、处理结果、历史解决方案、处置经验时，也应先调用本工具查询 AndonAbnormalReport 历史异常记录，再从查询结果中的异常详情、处理结果、处理人、持续时长等字段中总结可参考的解决方案。工具会先读取 AndonAbnormalReport 表单字段配置，构建动态查询参数，查询分页数据，并使用数据字典翻译展示值。";

export const inputSchema = z.object({
    page: z.number().int().min(1).default(1).describe("页码，从 1 开始。默认 1。"),
    limit: z.number().int().min(1).max(100).default(5).describe("每页数量，默认 5，最大 100。"),
    contain: z.string().trim().default("").describe("初始化表单字段时只包含指定字段，默认空。"),
    exclude: z.string().trim().default("").describe("初始化表单字段时排除指定字段，默认空。"),
    filters: z.record(z.string(), z.unknown()).default({}).describe("动态查询条件。key 必须是表单字段 field；文本字段模糊查，时间字段传 {start,end} 范围查。"),
});

export async function handler(
    client: MesClient,
    params: Record<string, unknown>,
): Promise<ToolCallResult> {
    const query = inputSchema.parse(params);

    logger.info("异常记录动态分页查询", query);

    const service = new FormPageQueryService(client);
    const result = await service.query({
        className: REPORT_CLASS_NAME,
        endpoint: REPORT_ENDPOINT,
        page: query.page,
        limit: query.limit,
        contain: query.contain,
        exclude: query.exclude,
        filters: query.filters,
    });
    const formatter = new DynamicPageToolFormatter();

    return {
        content: [
            {
                type: "text",
                text: formatter.format({
                    title: "异常记录分页查询结果",
                    result,
                }),
            },
        ],
    };
}

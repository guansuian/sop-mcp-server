import type { MesClient } from "../services/mesClient.js";
import type { AppConfig } from "../types/api.js";
import type { ToolCallResult } from "../types/toolContent.js";

import * as queryAbnormalReportPage from "./andonAbnormalReport/query_abnormal_report_page.js";

type ToolHandler = (
    client: MesClient,
    params: Record<string, unknown>,
) => Promise<ToolCallResult>;

export interface ToolDefinition {
    name: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSchema: any;
    handler: ToolHandler;
}

const allTools: ToolDefinition[] = [
    {
        name: queryAbnormalReportPage.name,
        description: queryAbnormalReportPage.description,
        inputSchema: queryAbnormalReportPage.inputSchema,
        handler: queryAbnormalReportPage.handler,
    },
];

export function getEnabledTools(config: AppConfig): ToolDefinition[] {
    const toolsConfig = config.tools || {};

    return allTools.filter((tool) => toolsConfig[tool.name] !== false);
}

export const allToolNames = allTools.map((tool) => tool.name);

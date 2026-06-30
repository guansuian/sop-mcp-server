import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { serverInstructions } from "../instructions/serverInstructions.js";

export const serverInstructionsResourceUri =
    "mcp://abnormal-report-mcp/instructions/serverInstructions";

export function registerResources(server: McpServer): void {
    server.registerResource(
        "serverInstructions",
        serverInstructionsResourceUri,
        {
            title: "安灯系统 MCP 能力与流程说明",
            description:
                "这个 resource 说明本 MCP 具备哪些安灯系统能力、每个流程的产出要求，以及何时调用 queryAbnormalReportPage。Work Buddy 或 AI 在调用任何工具前应先读取这个 resource。完整 URI: mcp://abnormal-report-mcp/instructions/serverInstructions。如果 resources/list 为空，也可以直接用 resources/read 读取该 URI。",
            mimeType: "text/plain",
        },
        (uri) => ({
            contents: [
                {
                    uri: uri.href,
                    mimeType: "text/plain",
                    text: serverInstructions,
                },
            ],
        }),
    );
}

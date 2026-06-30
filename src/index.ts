import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { MesClient } from "./services/mesClient.js";

import { serverInstructions } from "./instructions/serverInstructions.js";
import { registerResources } from "./resources/index.js";
import { getEnabledTools} from "./tools/index.js";
import { logger } from "./utils/logger.js";

import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {existsSync, readFileSync} from "node:fs";
import {AppConfig,MesConfig,ToolsConfig} from "./types/api.js";



/**
 * 加载配置
 */
function loadConfig(): AppConfig {
  // 优先从环境变量获取配置路径
  const configPathEnv = process.env.MES_CONFIG_PATH;

  // 当前模块所在目录（tsc 输出时为 dist/，esbuild bundle 时为 bundle 文件所在目录）
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const moduleRelative = resolve(moduleDir, "config", "mes-config.json");

  const defaultPath = resolve(process.cwd(), "config", "mes-config.json");

  const configPaths = [
    configPathEnv,
    moduleRelative,
    resolve(process.cwd(), "mes-config.json"),
    defaultPath,
  ].filter(Boolean) as string[];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        const config = JSON.parse(raw) as AppConfig;

        if (!config.mes?.baseUrl) {
          throw new Error("Missing required field: mes.baseUrl");
        }
        if (!config.mes?.auth) {
          throw new Error("Missing required field: mes.auth");
        }

        logger.info(`Config loaded from: ${configPath}`);
        logger.info(`MES Base URL: ${config.mes.baseUrl}`);
        logger.info(`Auth type: ${config.mes.auth.type}`);

        const enabledNames = Object.entries(config.tools || {})
            .filter(([, v]) => v !== false)
            .map(([k]) => k);
        logger.info(
            `Enabled tools: ${enabledNames.length > 0 ? enabledNames.join(", ") : "all"}`
        );

        return config;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to load config from ${configPath}: ${errMsg}`);
        throw error;
      }
    }
  }
  throw new Error(
      `Configuration file not found. Searched:\n` +
      configPaths.map((p) => `  - ${p}`).join("\n") +
      `\n\nPlease create a config file or set MES_CONFIG_PATH environment variable.`
  );
}



async function main(): Promise<void> {
  logger.info("MES TaskReport MCP Server starting...");

  try {
    // 加载配置
    const config = loadConfig();

    // 创建 MES API 客户端
    const mesClient = new MesClient(config.mes);

    // 创建 MCP Server
    const server = new McpServer(
        {
          name: "abnormal-report-mcp",
          version: "1.0.0",
        },
        {
          instructions: serverInstructions,
        }
    );

    // 注册所有启用的 Tool
    const tools = getEnabledTools(config);

    for (const tool of tools) {
      server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          async (params: Record<string, unknown>) => {
            logger.info(`Tool called: ${tool.name}`);
            const result = await tool.handler(mesClient, params);
            logger.info(`Tool completed: ${tool.name}`);
            return result;
          }
      );
    }

    logger.info(
        `Registered ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`
    );
    registerResources(server);
    logger.info("Registered resources: serverInstructions");
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("MES TaskReport MCP Server is ready. Waiting for requests...");
    for (const tool of tools) {
      logger.info(`  - ${tool.name}: ${tool.description.slice(0, 80)}...`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to start MCP Server: ${errMsg}`, error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  logger.error("Failed to start MCP server", error);
  process.exitCode = 1;
});

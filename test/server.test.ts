import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("exposes the abnormal report MCP tool", async () => {
  const client = new Client({
    name: "hello-world-test-client",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/src/index.js"],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  let serverLogs = "";
  transport.stderr?.on("data", (chunk: Buffer) => {
    serverLogs += chunk.toString();
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      ["queryAbnormalReportPage"],
    );

    const abnormalReportTool = tools.tools[0];
    assert.ok(abnormalReportTool);
    assert.equal(abnormalReportTool.name, "queryAbnormalReportPage");

    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.match(serverLogs, /MCP Server starting/);
  } finally {
    await client.close();
  }
});

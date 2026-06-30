import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function createTestClient(): {
  client: Client;
  transport: StdioClientTransport;
} {
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

  return { client, transport };
}

test("exposes the abnormal report MCP tool", async () => {
  const { client, transport } = createTestClient();
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
    assert.match(
      abnormalReportTool.description ?? "",
      /mcp:\/\/abnormal-report-mcp\/instructions\/serverInstructions/,
    );
    assert.match(abnormalReportTool.description ?? "", /调用工具前/);

    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.match(serverLogs, /MCP Server starting/);
  } finally {
    await client.close();
  }
});

test("publishes andon system workflow instructions during initialization", async () => {
  const { client, transport } = createTestClient();

  try {
    await client.connect(transport);

    const instructions = client.getInstructions();
    assert.ok(instructions);
    assert.match(instructions, /安灯系统/);
    assert.match(instructions, /总体流程/);
    assert.match(instructions, /queryAbnormalReportPage/);
    assert.match(instructions, /异常、状态、处理结果/);
    assert.match(
      instructions,
      /mcp:\/\/abnormal-report-mcp\/instructions\/serverInstructions/,
    );
    assert.match(instructions, /resources\/read/);
  } finally {
    await client.close();
  }
});

test("exposes and reads the server instructions resource", async () => {
  const { client, transport } = createTestClient();

  try {
    await client.connect(transport);

    const resources = await client.listResources();
    const resource = resources.resources.find(
      (item) =>
        item.uri === "mcp://abnormal-report-mcp/instructions/serverInstructions",
    );

    assert.ok(resource);
    assert.equal(resource.name, "serverInstructions");
    assert.match(resource.description ?? "", /Work Buddy/);
    assert.match(resource.description ?? "", /调用任何工具前应先读取/);
    assert.match(
      resource.description ?? "",
      /mcp:\/\/abnormal-report-mcp\/instructions\/serverInstructions/,
    );
    assert.match(resource.description ?? "", /queryAbnormalReportPage/);

    const content = await client.readResource({
      uri: resource.uri,
    });

    assert.equal(content.contents.length, 1);
    const [item] = content.contents;
    assert.equal(item.uri, resource.uri);
    assert.equal(item.mimeType, "text/plain");
    assert.ok("text" in item);
    assert.match(item.text, /安灯系统/);
    assert.match(item.text, /总体流程/);
    assert.match(item.text, /queryAbnormalReportPage/);
    assert.match(
      item.text,
      /mcp:\/\/abnormal-report-mcp\/instructions\/serverInstructions/,
    );
  } finally {
    await client.close();
  }
});

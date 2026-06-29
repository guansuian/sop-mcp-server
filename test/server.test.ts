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

test("publishes andon system workflow instructions during initialization", async () => {
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

  try {
    await client.connect(transport);

    const instructions = client.getInstructions();
    assert.ok(instructions);
    assert.match(instructions, /安灯系统/);
    assert.match(instructions, /总体流程/);
    assert.match(instructions, /queryAbnormalReportPage/);
    assert.match(instructions, /异常、状态、处理结果/);
  } finally {
    await client.close();
  }
});

test("exposes the abnormal report MCP prompt", async () => {
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

  try {
    await client.connect(transport);

    const prompts = await client.listPrompts();
    assert.deepEqual(
      prompts.prompts.map((prompt) => prompt.name),
      ["abnormalReportAssistant"],
    );

    const prompt = await client.getPrompt({
      name: "abnormalReportAssistant",
    });

    assert.equal(prompt.messages.length, 1);
    assert.equal(prompt.messages[0].role, "user");
    assert.equal(prompt.messages[0].content.type, "text");
    assert.match(
      prompt.messages[0].content.text,
      /安灯系统/,
    );
    assert.match(
      prompt.messages[0].content.text,
      /异常、状态、处理结果/,
    );
    assert.match(
      prompt.messages[0].content.text,
      /queryAbnormalReportPage/,
    );
  } finally {
    await client.close();
  }
});

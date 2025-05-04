import type { ResponseInputItem } from "openai/resources/responses/responses";

import { ORIGIN, CLI_VERSION } from "../session.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const mcpClients: Record<string, Client> = {};

/**
 * Generate OpenAI function definitions for each configured MCP server.
 */
export function getMcpToolDefinitions(
  servers?: Record<string, { url: string }>,
): Array<Record<string, unknown>> {
  if (!servers) {
    return [];
  }
  return Object.entries(servers).map(([serverName]) => ({
    type: "function",
    name: serverName,
    description: `Call remote MCP server '${serverName}' tool`,
    strict: false,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name" },
        args: { type: "object", description: "Tool args" },
      },
      required: ["name", "args"],
      additionalProperties: false,
    },
  }));
}

/**
 * Handle a function call routed to an MCP server.
 * Parses arguments, initializes client, invokes tool, and formats output.
 */
export async function handleMcpFunctionCall(
  servers: Record<string, { url: string }>,
  serverName: string,
  rawArguments: string | undefined,
  callId: string,
): Promise<Array<ResponseInputItem.FunctionCallOutput>> {
  const paramsRaw = rawArguments ?? "{}";

  const formatRaw = (raw: string) => [
    { type: "function_call_output" as const, call_id: callId, output: raw },
  ];

  const formatOutput = (
    output: string,
    exit_code: number,
    duration_seconds: number,
  ) => ({
    type: "function_call_output" as const,
    call_id: callId,
    output: JSON.stringify({
      output,
      metadata: { exit_code, duration_seconds },
    }),
  });

  if (!servers[serverName]) {
    return formatRaw(paramsRaw);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(paramsRaw) as Record<string, unknown>;
  } catch {
    return formatRaw(paramsRaw);
  }

  const { name: toolName, args, ...other } = parsed;
  if (typeof toolName !== "string") {
    return formatRaw(paramsRaw);
  }

  const callArgs = args ?? other;

  if (!mcpClients[serverName]) {
    const cfg = servers[serverName];

    // Validate the configured URL before attempting to create the transport.
    if (typeof cfg?.url !== "string" || cfg.url.trim() === "") {
      return [
        formatOutput(
          `MCP error: Missing 'url' for server '${serverName}' in configuration`,
          1,
          0,
        ),
      ];
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cfg.url);
    } catch {
      return [
        formatOutput(
          `MCP error: Invalid URL for server '${serverName}': ${cfg.url}`,
          1,
          0,
        ),
      ];
    }

    const client = new Client({ name: ORIGIN, version: CLI_VERSION });
    const transport = new SSEClientTransport(parsedUrl);
    await client.connect(transport);
    mcpClients[serverName] = client;
  }

  const start = Date.now();

  const getDuration = () => Math.round((Date.now() - start) / 100) / 10;

  try {
    const response = await mcpClients[serverName].callTool({
      name: toolName,
      arguments: callArgs,
    });
    const outputText = Array.isArray(
      (response as { content?: Array<{ text: string }> }).content,
    )
      ? (response as { content?: Array<{ text: string }> })
          .content!.map((c) => c.text)
          .join("\n")
      : JSON.stringify(response);
    return [formatOutput(outputText, 0, getDuration())];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return [formatOutput(`MCP error: ${msg}`, 1, getDuration())];
  }
}

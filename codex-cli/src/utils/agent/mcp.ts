import type { ResponseInputItem } from "openai/resources/responses/responses.mjs";

import { ORIGIN, CLI_VERSION } from "../session.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { parseToolCallArguments } from "../parsers.js";

const mcpClients: Record<string, Client> = {};

/**
 * Generate OpenAI tool definitions for each configured MCP server/tool.
 * The function name itself is treated as the MCP tool name.
 */
export function getMcpToolDefinitions(
  servers?: Record<string, { url: string }>
): any[] {
  if (!servers) return [];
  // Each key in servers is now treated as a potential tool name routed via that server's URL
  // We might need a more sophisticated way to map tool names to server URLs if multiple tools use the same server.
  // For now, assume a 1:1 mapping or that the server routes based on the tool name provided in the call.
  // The function name IS the tool name.
  return Object.entries(servers).map(([toolName, config]) => ({
    type: "function",
    name: toolName, // The function name LLM calls IS the MCP tool name
    description: `Calls the remote MCP tool '${toolName}' via server at ${config.url}`,
    // Parameters are now just a generic object, as they are specific to the MCP tool itself.
    parameters: {
      type: "object",
      // We don't know the specific properties required by the remote tool,
      // so we allow any properties. Consider adding specific schemas if known.
      properties: {},
      // Mark additionalProperties as true or omit it to allow any properties.
      // If the specific MCP tool has a strict schema, validation might happen server-side.
    },
    // The following are fields for older OpenAI models, might need adjustment based on target model
    // strict: false, // strict mode might be less useful now
    // parameters: { // This format might be deprecated depending on OpenAI API version/model
    //   type: "object",
    //   properties: {}, // Allow any properties
    //   // required: [], // Cannot determine required fields generically
    //   additionalProperties: true, // Allow any arguments
    // },
  }));
}

/**
 * Handle a function call routed to an MCP server.
 * Parses arguments, initializes client, invokes tool, and formats output.
 * The 'serverName' is now treated as the 'toolName'.
 */
export async function handleMcpFunctionCall(
  servers: Record<string, { url: string }>,
  toolName: string, // Renamed parameter for clarity; this IS the MCP tool name
  rawArguments: string | undefined,
  callId: string
): Promise<ResponseInputItem.FunctionCallOutput[]> {
  // Find the server URL configured for this tool name.
  // This assumes the toolName directly maps to a key in the servers config.
  // A more complex setup might involve a different mapping if multiple tools share a server URL.
  const serverConfig = servers[toolName];

  const formatError = (message: string, exitCode = 1) => {
    const start = Date.now(); // Approx duration for error formatting
    const getDuration = () => Math.round((Date.now() - start) / 100) / 10;
    return [formatOutput(`MCP error: ${message}`, exitCode, getDuration(), callId)];
  };

  if (!serverConfig) {
    return formatError(
      `No MCP server configuration found for tool '${toolName}'. Check your config file.`
    );
  }

  const paramsRaw = rawArguments ?? "{}";

  // Use a robust parsing function if available
  const callArgs = parseToolCallArguments(paramsRaw);
  if (callArgs === null) { // Check if parsing failed
      return formatError(`Failed to parse arguments JSON for tool '${toolName}': ${paramsRaw}`);
  }

  // Use toolName as the key for the client cache, assuming one client per tool/server endpoint.
  // If multiple tools share the same URL, they can share the client.
  const clientKey = serverConfig.url; // Use URL as key to potentially reuse clients for the same server
  if (!mcpClients[clientKey]) {
    try {
      const client = new Client({name: ORIGIN, version: CLI_VERSION});
      const transport = new SSEClientTransport(new URL(serverConfig.url));
      await client.connect(transport);
      mcpClients[clientKey] = client;
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        return formatError(`Failed to connect to MCP server for tool '${toolName}' at ${serverConfig.url}: ${msg}`);
    }
  }

  const start = Date.now();
  const getDuration = () => Math.round((Date.now() - start) / 100) / 10;

  try {
    // Call the tool using the function name as the tool name and parsed args directly
    const response = await mcpClients[clientKey].callTool({
      name: toolName, // The function name called by LLM is the MCP tool name
      arguments: callArgs, // Pass the parsed arguments object directly
    });
    const outputText = Array.isArray((response as any).content)
      ? (response as any).content.map((c: any) => c.text).join("\\n")
      : JSON.stringify(response);
    return [formatOutput(outputText, 0, getDuration(), callId)];
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return formatError(`Error calling MCP tool '${toolName}': ${msg}`, 1);
  }
}

// Helper to consistently format the output
function formatOutput(
  output: string,
  exit_code: number,
  duration_seconds: number,
  callId: string
): ResponseInputItem.FunctionCallOutput {
  return {
    type: "function_call_output",
    call_id: callId,
    output: JSON.stringify({output, metadata: {exit_code, duration_seconds}}),
  };
}

// Clean up clients on exit (consider adding proper lifecycle management)
process.on('exit', () => {
  Object.values(mcpClients).forEach(client => client.disconnect());
});

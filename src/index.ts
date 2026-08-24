import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GraphClient } from "./auth/graph-client.js";
import { getConfig } from "./config.js";
import { createAllTools } from "./tools/index.js";
import type { ToolDefinition } from "./tools/types.js";

/**
 * Convert a JSON Schema property definition to a Zod schema.
 */
function jsonPropertyToZod(prop: Record<string, any>): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (prop.type) {
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "array":
      schema = z.array(prop.items ? jsonPropertyToZod(prop.items) : z.any());
      break;
    case "object":
      schema = prop.properties
        ? z.object(buildZodShapeFromProperties(prop.properties, prop.required || []))
        : z.record(z.any());
      break;
    case "string":
    default:
      schema = z.string();
  }

  return prop.description ? schema.describe(prop.description) : schema;
}

/**
 * Build a Zod raw shape from a plain JSON Schema `properties` object
 * (used for both top-level tool inputs and nested object properties).
 */
function buildZodShapeFromProperties(
  props: Record<string, any>,
  required: string[],
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(props) as [string, Record<string, any>][]) {
    let schema = jsonPropertyToZod(prop);
    if (!required.includes(key)) {
      schema = schema.optional();
    }
    shape[key] = schema;
  }

  return shape;
}

/**
 * Build a Zod raw shape from a ToolDefinition's inputSchema.
 */
function buildZodShape(
  tool: ToolDefinition,
): Record<string, z.ZodTypeAny> | undefined {
  const props = tool.inputSchema.properties;
  if (!props || Object.keys(props).length === 0) {
    return undefined;
  }

  return buildZodShapeFromProperties(props, tool.inputSchema.required || []);
}

const server = new McpServer({
  name: "cowork-outlook",
  version: "0.1.0",
});

const config = getConfig();
const graphClient = new GraphClient(config.tokenStorePath);
const tools = createAllTools(graphClient);

for (const tool of tools) {
  const zodShape = buildZodShape(tool);
  const handler = tool.handler;

  if (zodShape) {
    server.tool(tool.name, tool.description, zodShape, async (args: any) => {
      try {
        return await handler(args);
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${error.message}` },
          ],
          isError: true,
        };
      }
    });
  } else {
    server.tool(tool.name, tool.description, async () => {
      try {
        return await handler({});
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${error.message}` },
          ],
          isError: true,
        };
      }
    });
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cowork Outlook MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

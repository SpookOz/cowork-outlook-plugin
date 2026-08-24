import { createMailTools } from "./mail/index.js";
import { createCalendarTools } from "./calendar/index.js";
import {
  createLoginTool,
  createLoginCompleteTool,
  createLogoutTool,
  createWhoamiTool,
} from "./auth/index.js";
import type { GraphClient, ToolDefinition } from "./types.js";

export function createAllTools(graph: GraphClient): ToolDefinition[] {
  return [
    createLoginTool(),
    createLoginCompleteTool(),
    createLogoutTool(),
    createWhoamiTool(graph),
    ...createMailTools(graph),
    ...createCalendarTools(graph),
  ];
}

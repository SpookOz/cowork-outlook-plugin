import { join } from "node:path";
import { homedir } from "node:os";
import { platform } from "node:process";
import type { AppConfig } from "./types/config.js";

const SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Calendars.ReadWrite",
];

function getTokenStorePath(): string {
  const home = homedir();
  switch (platform) {
    case "win32":
      return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "cowork-outlook-mcp", "tokens.json");
    case "darwin":
      return join(home, "Library", "Application Support", "cowork-outlook-mcp", "tokens.json");
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "cowork-outlook-mcp", "tokens.json");
  }
}

// Microsoft's own public client ID for "Microsoft Graph Command Line Tools"
// (used by Connect-MgGraph). Device code flow needs no redirect URI, so this
// avoids the app-registration/tenant requirement entirely.
export const CLIENT_ID = "14d82eec-204b-4c2f-b7e8-296a70dab67e";

export function getConfig(): AppConfig {
  const clientId = CLIENT_ID;
  const tenantId = "common";

  return {
    clientId,
    tenantId,
    scopes: SCOPES,
    tokenStorePath: getTokenStorePath(),
  };
}

export const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
export const AUTHORITY_BASE_URL = "https://login.microsoftonline.com";

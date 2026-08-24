import { startDeviceCodeFlow, pollDeviceCodeToken } from "../../auth/oauth.js";
import { saveTokens } from "../../auth/token-store.js";
import { getConfig } from "../../config.js";
import type { AppConfig } from "../../types/config.js";
import type { ToolDefinition } from "../types.js";

interface PendingDeviceLogin {
  deviceCode: string;
  interval: number;
  expiresAt: number;
  config: AppConfig;
}

let pendingLogin: PendingDeviceLogin | null = null;

export function createLoginTool(): ToolDefinition {
  return {
    name: "o365_login",
    description:
      "Start Microsoft 365 sign-in via device code (no browser popup). Returns a code and a URL to visit; after signing in there, call o365_login_complete.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      const config = getConfig();
      const device = await startDeviceCodeFlow(config);

      pendingLogin = {
        deviceCode: device.deviceCode,
        interval: device.interval,
        expiresAt: Date.now() + device.expiresIn * 1000,
        config,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: `${device.message}\n\nOnce you've signed in, tell Claude to run o365_login_complete.`,
          },
        ],
      };
    },
  };
}

export function createLoginCompleteTool(): ToolDefinition {
  return {
    name: "o365_login_complete",
    description:
      "Finish device-code sign-in after visiting the verification URL and entering the code from o365_login. Waits for Microsoft to confirm the sign-in.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => {
      if (!pendingLogin) {
        throw new Error("No sign-in in progress. Call o365_login first.");
      }

      const { deviceCode, interval, expiresAt, config } = pendingLogin;
      const remainingSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));

      const tokens = await pollDeviceCodeToken(config, deviceCode, interval, remainingSeconds);
      await saveTokens(tokens, config.tokenStorePath);
      pendingLogin = null;

      return {
        content: [
          {
            type: "text" as const,
            text: "Authentication successful! Tokens have been saved. You can now use email and calendar tools.",
          },
        ],
      };
    },
  };
}

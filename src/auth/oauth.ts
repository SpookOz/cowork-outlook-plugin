import { AUTHORITY_BASE_URL } from "../config.js";
import type { AppConfig, TokenCache, TokenResponse } from "../types/config.js";

export class OAuthError extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly errorDescription: string,
  ) {
    super(`${errorCode}: ${errorDescription}`);
    this.name = "OAuthError";
  }
}

export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

/**
 * Start the OAuth 2.0 Device Authorization Grant. No redirect URI is
 * involved: the user visits verificationUri on any device and enters
 * userCode, while this process polls the token endpoint separately.
 */
export async function startDeviceCodeFlow(config: AppConfig): Promise<DeviceCodeInfo> {
  const url = `${AUTHORITY_BASE_URL}/${config.tenantId}/oauth2/v2.0/devicecode`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(" "),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new OAuthError(err.error, err.error_description);
  }

  const data = await response.json();

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
    message: data.message,
  };
}

/**
 * Poll the token endpoint until the user finishes signing in at
 * verificationUri, the device code expires, or an unrecoverable error occurs.
 */
export async function pollDeviceCodeToken(
  config: AppConfig,
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
): Promise<TokenCache> {
  const url = `${AUTHORITY_BASE_URL}/${config.tenantId}/oauth2/v2.0/token`;
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: config.clientId,
      device_code: deviceCode,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await response.json();

    if (response.ok) {
      const tokenData = data as TokenResponse;
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        scope: tokenData.scope,
      };
    }

    if (data.error === "authorization_pending") {
      continue;
    }
    if (data.error === "slow_down") {
      interval += 5;
      continue;
    }

    throw new OAuthError(data.error, data.error_description);
  }

  throw new OAuthError("expired_token", "Device code expired before sign-in completed. Run o365_login again.");
}

/**
 * Refresh an expired access token using the refresh token (no client_secret).
 */
export async function refreshToken(
  config: AppConfig,
  refreshTokenValue: string,
): Promise<TokenCache> {
  const url = `${AUTHORITY_BASE_URL}/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    scope: config.scopes.join(" "),
    refresh_token: refreshTokenValue,
    grant_type: "refresh_token",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new OAuthError(err.error, err.error_description);
  }

  const data = (await response.json()) as TokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

/**
 * Apple OAuth Adapter - Singleton Pattern
 */

import {
  type Result,
  ok,
  err,
  AuthErrors,
  InfraErrors,
  type DomainError,
} from "../../../core";
import type { OAuthPort, OAuthTokens, OAuthUserInfo, LoggerPort } from "../../../application/ports";

// ============================================
// Types
// ============================================

export interface AppleOAuthConfig {
  clientId: string; // Service ID
  teamId: string;
  keyId: string;
  privateKey: string; // PEM format
  scopes?: string[];
}

// ============================================
// Singleton Implementation
// ============================================

let instance: OAuthPort | null = null;

export const createAppleOAuthClient = (
  config: AppleOAuthConfig,
  logger: LoggerPort
): OAuthPort => {
  if (instance) {
    logger.debug("Returning existing Apple OAuth client instance");
    return instance;
  }

  logger.info("Creating Apple OAuth client");

  const scopes = config.scopes || ["name", "email"];

  // Generate client secret JWT for Apple (valid for 6 months max)
  const generateClientSecret = async (): Promise<string> => {
    // In production, use jose or similar library to create JWT
    // This is a placeholder - actual implementation requires JWT signing
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: config.teamId,
      iat: now,
      exp: now + 86400 * 180, // 180 days
      aud: "https://appleid.apple.com",
      sub: config.clientId,
    };

    // Sign with ES256 using config.privateKey
    // For now, return placeholder
    logger.warn("Apple client secret generation not fully implemented");
    return "placeholder_client_secret";
  };

  const client: OAuthPort = {
    getAuthorizationUrl(state: string, redirectUri: string): string {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        response_mode: "form_post",
      });

      return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    },

    async exchangeCodeForToken(
      code: string,
      redirectUri: string
    ): Promise<Result<OAuthTokens, DomainError>> {
      try {
        logger.debug("Exchanging Apple OAuth code for token");

        const clientSecret = await generateClientSecret();

        const response = await fetch("https://appleid.apple.com/auth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          logger.error("Apple token exchange failed", undefined, { status: response.status, error: errorData });
          return err(AuthErrors.OAUTH_TOKEN_EXCHANGE_FAILED("Apple"));
        }

        const data = await response.json();

        return ok({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          idToken: data.id_token,
        });
      } catch (error) {
        logger.error("Apple token exchange error", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Apple OAuth", error as Error));
      }
    },

    async getUserInfo(idToken: string): Promise<Result<OAuthUserInfo, DomainError>> {
      try {
        logger.debug("Parsing Apple ID token for user info");

        // Decode JWT (id_token) to extract user info
        // In production, verify the token signature
        const parts = idToken.split(".");
        if (parts.length !== 3) {
          return err(AuthErrors.TOKEN_INVALID());
        }

        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8")
        );

        return ok({
          id: payload.sub, // Apple user ID
          email: payload.email,
          emailVerified: payload.email_verified === "true" || payload.email_verified === true,
          name: undefined, // Apple provides name only on first authorization
        });
      } catch (error) {
        logger.error("Apple user info parsing error", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Apple OAuth", error as Error));
      }
    },

    async refreshToken(refreshToken: string): Promise<Result<OAuthTokens, DomainError>> {
      try {
        logger.debug("Refreshing Apple OAuth token");

        const clientSecret = await generateClientSecret();

        const response = await fetch("https://appleid.apple.com/auth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        if (!response.ok) {
          logger.error("Apple token refresh failed", undefined, { status: response.status });
          return err(AuthErrors.TOKEN_EXPIRED());
        }

        const data = await response.json();

        return ok({
          accessToken: data.access_token,
          refreshToken: refreshToken, // Apple doesn't return new refresh token
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          idToken: data.id_token,
        });
      } catch (error) {
        logger.error("Apple token refresh error", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Apple OAuth", error as Error));
      }
    },
  };

  instance = client;
  return client;
};

export const getAppleOAuthClient = (): OAuthPort | null => instance;

export const resetAppleOAuthClient = (): void => {
  instance = null;
};

/**
 * Google OAuth Adapter - Singleton Pattern
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

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

// ============================================
// Singleton Implementation
// ============================================

let instance: OAuthPort | null = null;

export const createGoogleOAuthClient = (
  config: GoogleOAuthConfig,
  logger: LoggerPort
): OAuthPort => {
  if (instance) {
    logger.debug("Returning existing Google OAuth client instance");
    return instance;
  }

  logger.info("Creating Google OAuth client");

  const scopes = config.scopes || [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const client: OAuthPort = {
    getAuthorizationUrl(state: string, redirectUri: string): string {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
      });

      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },

    async exchangeCodeForToken(
      code: string,
      redirectUri: string
    ): Promise<Result<OAuthTokens, DomainError>> {
      try {
        logger.debug("Exchanging Google OAuth code for token");

        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          logger.error("Google token exchange failed", undefined, { status: response.status, error: errorData });
          return err(AuthErrors.OAUTH_TOKEN_EXCHANGE_FAILED("Google"));
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
        logger.error("Google token exchange error", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Google OAuth", error as Error));
      }
    },

    async getUserInfo(accessToken: string): Promise<Result<OAuthUserInfo, DomainError>> {
      try {
        logger.debug("Fetching Google user info");

        const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          logger.error("Google user info fetch failed", undefined, { status: response.status });
          return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Google OAuth", new Error("Failed to fetch user info")));
        }

        const data = await response.json();

        return ok({
          id: data.id,
          email: data.email,
          emailVerified: data.verified_email,
          name: data.name,
          picture: data.picture,
        });
      } catch (error) {
        logger.error("Google user info error", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Google OAuth", error as Error));
      }
    },

    async refreshToken(refreshToken: string): Promise<Result<OAuthTokens, DomainError>> {
      try {
        logger.debug("Refreshing Google OAuth token");

        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        if (!response.ok) {
          logger.error("Google token refresh failed", undefined, { status: response.status });
          return err(AuthErrors.TOKEN_EXPIRED());
        }

        const data = await response.json();

        return ok({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresIn: data.expires_in,
          tokenType: data.token_type,
          idToken: data.id_token,
        });
      } catch (error) {
        logger.error("Google token refresh error", error as Error);
        return err(InfraErrors.EXTERNAL_SERVICE_ERROR("Google OAuth", error as Error));
      }
    },
  };

  instance = client;
  return client;
};

export const getGoogleOAuthClient = (): OAuthPort | null => instance;

export const resetGoogleOAuthClient = (): void => {
  instance = null;
};

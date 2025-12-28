/**
 * OAuth Service Implementation
 * Supports Google and Apple OAuth
 */

import { IOAuthService, OAuthUserInfo } from "../../application/ports/services/oauth.service";
import { AuthProvider } from "../../shared/types";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class OAuthServiceImpl implements IOAuthService {
  constructor(
    private readonly googleConfig: OAuthConfig,
    private readonly appleConfig: OAuthConfig
  ) {}

  async getAuthorizationUrl(
    provider: AuthProvider,
    redirectUri: string
  ): AsyncResult<string, DomainError> {
    try {
      let url: string;

      switch (provider) {
        case AuthProvider.GOOGLE:
          url = this.getGoogleAuthUrl(redirectUri);
          break;
        case AuthProvider.APPLE:
          url = this.getAppleAuthUrl(redirectUri);
          break;
        default:
          return Err(
            new InfrastructureError(
              "Unsupported OAuth provider",
              ErrorCode.OAUTH_ERROR
            )
          );
      }

      return Ok(url);
    } catch (error) {
      logger.error("Error generating authorization URL", { error, provider });
      return Err(
        new InfrastructureError(
          "Failed to generate authorization URL",
          ErrorCode.OAUTH_ERROR,
          { error }
        )
      );
    }
  }

  async exchangeCodeForToken(
    provider: AuthProvider,
    code: string
  ): AsyncResult<string, DomainError> {
    try {
      let accessToken: string;

      switch (provider) {
        case AuthProvider.GOOGLE:
          accessToken = await this.exchangeGoogleCode(code);
          break;
        case AuthProvider.APPLE:
          accessToken = await this.exchangeAppleCode(code);
          break;
        default:
          return Err(
            new InfrastructureError(
              "Unsupported OAuth provider",
              ErrorCode.OAUTH_ERROR
            )
          );
      }

      return Ok(accessToken);
    } catch (error) {
      logger.error("Error exchanging code for token", { error, provider });
      return Err(
        new InfrastructureError(
          "Failed to exchange code for token",
          ErrorCode.OAUTH_ERROR,
          { error }
        )
      );
    }
  }

  async getUserInfo(
    provider: AuthProvider,
    accessToken: string
  ): AsyncResult<OAuthUserInfo, DomainError> {
    try {
      let userInfo: OAuthUserInfo;

      switch (provider) {
        case AuthProvider.GOOGLE:
          userInfo = await this.getGoogleUserInfo(accessToken);
          break;
        case AuthProvider.APPLE:
          userInfo = await this.getAppleUserInfo(accessToken);
          break;
        default:
          return Err(
            new InfrastructureError(
              "Unsupported OAuth provider",
              ErrorCode.OAUTH_ERROR
            )
          );
      }

      return Ok(userInfo);
    } catch (error) {
      logger.error("Error getting user info", { error, provider });
      return Err(
        new InfrastructureError(
          "Failed to get user info",
          ErrorCode.OAUTH_ERROR,
          { error }
        )
      );
    }
  }

  // Google OAuth implementation
  private getGoogleAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.googleConfig.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async exchangeGoogleCode(code: string): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.googleConfig.clientId,
        client_secret: this.googleConfig.clientSecret,
        redirect_uri: this.googleConfig.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange Google code");
    }

    const data = await response.json();
    return data.access_token;
  }

  private async getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to get Google user info");
    }

    const data = await response.json();
    return {
      providerId: data.id,
      email: data.email,
      firstName: data.given_name,
      lastName: data.family_name,
      avatarUrl: data.picture,
    };
  }

  // Apple OAuth implementation
  private getAppleAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.appleConfig.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "email name",
      response_mode: "form_post",
    });
    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  private async exchangeAppleCode(code: string): Promise<string> {
    const response = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.appleConfig.clientId,
        client_secret: this.appleConfig.clientSecret,
        redirect_uri: this.appleConfig.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange Apple code");
    }

    const data = await response.json();
    return data.access_token;
  }

  private async getAppleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // Apple doesn't provide a userinfo endpoint, 
    // user info is provided in the initial token response
    // This is a simplified implementation
    const response = await fetch("https://appleid.apple.com/auth/keys", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to get Apple user info");
    }

    const data = await response.json();
    return {
      providerId: data.sub,
      email: data.email,
      firstName: data.given_name,
      lastName: data.family_name,
    };
  }
}

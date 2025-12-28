/**
 * OAuth Service Port (Interface)
 * Defines the contract for OAuth operations
 */

import { AuthProvider } from "../../../shared/types";
import { AsyncResult } from "../../../shared/result";
import { DomainError } from "../../../shared/errors";

export interface OAuthUserInfo {
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface IOAuthService {
  getAuthorizationUrl(provider: AuthProvider, redirectUri: string): AsyncResult<string, DomainError>;
  exchangeCodeForToken(provider: AuthProvider, code: string): AsyncResult<string, DomainError>;
  getUserInfo(provider: AuthProvider, accessToken: string): AsyncResult<OAuthUserInfo, DomainError>;
}

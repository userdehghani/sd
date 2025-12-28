/**
 * Authentication Controller
 * Handles all authentication-related HTTP requests
 */

import { Context } from "elysia";
import { RegisterWithTOTPCommand } from "../../../application/use-cases/auth/register-with-totp.command";
import { RegisterWithOAuthCommand } from "../../../application/use-cases/auth/register-with-oauth.command";
import { RegisterWithPassKeyCommand } from "../../../application/use-cases/auth/register-with-passkey.command";
import { LoginWithTOTPCommand } from "../../../application/use-cases/auth/login-with-totp.command";
import { LoginWithOAuthCommand } from "../../../application/use-cases/auth/login-with-oauth.command";
import { LoginWithPassKeyCommand } from "../../../application/use-cases/auth/login-with-passkey.command";
import { AuthMiddleware } from "../middleware/auth.middleware";
import {
  RegisterWithTOTPDto,
  RegisterWithOAuthDto,
  RegisterWithPassKeyDto,
  LoginWithTOTPDto,
  LoginWithOAuthDto,
  LoginWithPassKeyDto,
  AuthResponseDto,
  TOTPSetupResponseDto,
} from "../dtos/auth.dto";
import { AuthProvider } from "../../../shared/types";
import { logger } from "../../../logger";

export class AuthController {
  constructor(
    private readonly registerWithTOTPCommand: RegisterWithTOTPCommand,
    private readonly registerWithOAuthCommand: RegisterWithOAuthCommand,
    private readonly registerWithPassKeyCommand: RegisterWithPassKeyCommand,
    private readonly loginWithTOTPCommand: LoginWithTOTPCommand,
    private readonly loginWithOAuthCommand: LoginWithOAuthCommand,
    private readonly loginWithPassKeyCommand: LoginWithPassKeyCommand,
    private readonly authMiddleware: AuthMiddleware
  ) {}

  async registerWithTOTP(context: Context) {
    const body = context.body as RegisterWithTOTPDto;

    const result = await this.registerWithTOTPCommand.execute(body);

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const response: TOTPSetupResponseDto = {
      secret: result.value.totpSecret,
      qrCode: result.value.qrCode,
      backupCodes: result.value.backupCodes,
    };

    context.set.status = 201;
    return response;
  }

  async registerWithOAuth(context: Context) {
    const body = context.body as RegisterWithOAuthDto;
    const deviceInfo = this.authMiddleware.getDeviceInfo(context);

    const result = await this.registerWithOAuthCommand.execute({
      provider: AuthProvider[body.provider],
      code: body.code,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    context.set.status = result.value.isNewUser ? 201 : 200;
    return { user: result.value.user.toJSON() };
  }

  async registerWithPassKey(context: Context) {
    const body = context.body as RegisterWithPassKeyDto;

    const result = await this.registerWithPassKeyCommand.execute(body);

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    context.set.status = 201;
    return { user: result.value.user.toJSON() };
  }

  async loginWithTOTP(context: Context) {
    const body = context.body as LoginWithTOTPDto;
    const deviceInfo = this.authMiddleware.getDeviceInfo(context);

    const result = await this.loginWithTOTPCommand.execute({
      ...body,
      deviceInfo,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const response: AuthResponseDto = {
      accessToken: result.value.accessToken,
      user: {
        id: result.value.session.userId.getValue(),
        email: body.email,
        // Additional user data would be fetched here
      },
      session: {
        id: result.value.session.id.getValue(),
        expiresAt: result.value.session.expiresAt.toISOString(),
      },
    };

    return response;
  }

  async loginWithOAuth(context: Context) {
    const body = context.body as LoginWithOAuthDto;
    const deviceInfo = this.authMiddleware.getDeviceInfo(context);

    const result = await this.loginWithOAuthCommand.execute({
      provider: AuthProvider[body.provider],
      code: body.code,
      deviceInfo,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const response: AuthResponseDto = {
      accessToken: result.value.accessToken,
      user: {
        id: result.value.session.userId.getValue(),
        email: "", // Would be fetched from user entity
      },
      session: {
        id: result.value.session.id.getValue(),
        expiresAt: result.value.session.expiresAt.toISOString(),
      },
    };

    return response;
  }

  async loginWithPassKey(context: Context) {
    const body = context.body as LoginWithPassKeyDto;
    const deviceInfo = this.authMiddleware.getDeviceInfo(context);

    const result = await this.loginWithPassKeyCommand.execute({
      ...body,
      deviceInfo,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const response: AuthResponseDto = {
      accessToken: result.value.accessToken,
      user: {
        id: result.value.session.userId.getValue(),
        email: body.email,
      },
      session: {
        id: result.value.session.id.getValue(),
        expiresAt: result.value.session.expiresAt.toISOString(),
      },
    };

    return response;
  }

  private getStatusCode(error: any): number {
    const code = error.code || "INTERNAL_ERROR";
    
    switch (code) {
      case "INVALID_CREDENTIALS":
      case "INVALID_TOKEN":
      case "TOKEN_EXPIRED":
        return 401;
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
      case "USER_NOT_FOUND":
        return 404;
      case "VALIDATION_ERROR":
      case "EMAIL_ALREADY_EXISTS":
      case "PHONE_ALREADY_EXISTS":
        return 400;
      case "RATE_LIMIT_EXCEEDED":
        return 429;
      default:
        return 500;
    }
  }
}

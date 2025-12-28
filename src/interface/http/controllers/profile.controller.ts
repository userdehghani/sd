/**
 * Profile Controller
 * Handles user profile-related HTTP requests
 */

import { Context } from "elysia";
import { GetProfileCommand } from "../../../application/use-cases/profile/get-profile.command";
import { UpdateProfileCommand } from "../../../application/use-cases/profile/update-profile.command";
import { VerifyEmailCommand } from "../../../application/use-cases/profile/verify-email.command";
import { VerifyPhoneCommand } from "../../../application/use-cases/profile/verify-phone.command";
import { AuthContext } from "../middleware/auth.middleware";
import {
  UpdateProfileDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  ProfileResponseDto,
} from "../dtos/profile.dto";
import { logger } from "../../../logger";

export class ProfileController {
  constructor(
    private readonly getProfileCommand: GetProfileCommand,
    private readonly updateProfileCommand: UpdateProfileCommand,
    private readonly verifyEmailCommand: VerifyEmailCommand,
    private readonly verifyPhoneCommand: VerifyPhoneCommand
  ) {}

  async getProfile(context: Context & { auth: AuthContext }) {
    const result = await this.getProfileCommand.execute({
      userId: context.auth.userId,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const user = result.value;
    const response: ProfileResponseDto = {
      id: user.id.getValue(),
      email: user.email.getValue(),
      phone: user.phone?.getValue(),
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      authProviders: user.authProviders,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return response;
  }

  async updateProfile(context: Context & { auth: AuthContext }) {
    const body = context.body as UpdateProfileDto;

    const result = await this.updateProfileCommand.execute({
      userId: context.auth.userId,
      ...body,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    const user = result.value;
    const response: ProfileResponseDto = {
      id: user.id.getValue(),
      email: user.email.getValue(),
      phone: user.phone?.getValue(),
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      authProviders: user.authProviders,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return response;
  }

  async verifyEmail(context: Context & { auth: AuthContext }) {
    const body = context.body as VerifyEmailDto;

    const result = await this.verifyEmailCommand.execute({
      userId: context.auth.userId,
      code: body.code,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    return { message: "Email verified successfully" };
  }

  async verifyPhone(context: Context & { auth: AuthContext }) {
    const body = context.body as VerifyPhoneDto;

    const result = await this.verifyPhoneCommand.execute({
      userId: context.auth.userId,
      code: body.code,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    return { message: "Phone verified successfully" };
  }

  private getStatusCode(error: any): number {
    const code = error.code || "INTERNAL_ERROR";
    
    switch (code) {
      case "UNAUTHORIZED":
      case "INVALID_TOKEN":
        return 401;
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
      case "USER_NOT_FOUND":
        return 404;
      case "VALIDATION_ERROR":
        return 400;
      default:
        return 500;
    }
  }
}

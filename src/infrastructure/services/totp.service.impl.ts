/**
 * TOTP Service Implementation
 */

import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { ITOTPService, TOTPSetup } from "../../application/ports/services/totp.service";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, InfrastructureError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class TOTPServiceImpl implements ITOTPService {
  constructor(
    private readonly appName: string = "MyApp",
    private readonly window: number = 1 // Allow 1 step before/after for clock skew
  ) {}

  async generateSecret(): AsyncResult<TOTPSetup, DomainError> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: this.appName,
        length: 32,
      });

      if (!secret.otpauth_url) {
        throw new Error("Failed to generate TOTP URL");
      }

      // Generate QR code
      const qrCode = await qrcode.toDataURL(secret.otpauth_url);

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        this.generateBackupCode()
      );

      return Ok({
        secret: secret.base32,
        qrCode,
        backupCodes,
      });
    } catch (error) {
      logger.error("Error generating TOTP secret", { error });
      return Err(
        new InfrastructureError(
          "Failed to generate TOTP secret",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  async verifyToken(secret: string, token: string): AsyncResult<boolean, DomainError> {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token,
        window: this.window,
      });

      return Ok(verified);
    } catch (error) {
      logger.error("Error verifying TOTP token", { error });
      return Err(
        new InfrastructureError(
          "Failed to verify TOTP token",
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { error }
        )
      );
    }
  }

  private generateBackupCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

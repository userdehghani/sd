/**
 * JWT Service Implementation
 */

import jwt from "jsonwebtoken";
import { IJWTService } from "../../application/ports/services/jwt.service";
import { JWTPayload } from "../../shared/types";
import { AsyncResult, Ok, Err } from "../../shared/result";
import { DomainError, AuthenticationError, ErrorCode } from "../../shared/errors";
import { logger } from "../../logger";

export class JWTServiceImpl implements IJWTService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string = "30d"
  ) {}

  async sign(payload: JWTPayload): AsyncResult<string, DomainError> {
    try {
      const token = jwt.sign(payload, this.secret, {
        expiresIn: this.expiresIn,
        algorithm: "HS256",
      });

      return Ok(token);
    } catch (error) {
      logger.error("Error signing JWT", { error });
      return Err(
        new AuthenticationError("Failed to generate token", ErrorCode.INTERNAL_ERROR)
      );
    }
  }

  async verify(token: string): AsyncResult<JWTPayload, DomainError> {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
      }) as JWTPayload;

      return Ok(decoded);
    } catch (error) {
      logger.error("Error verifying JWT", { error });
      
      if (error instanceof jwt.TokenExpiredError) {
        return Err(
          new AuthenticationError("Token expired", ErrorCode.TOKEN_EXPIRED)
        );
      }

      return Err(
        new AuthenticationError("Invalid token", ErrorCode.INVALID_TOKEN)
      );
    }
  }

  decode(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error("Error decoding JWT", { error });
      return null;
    }
  }
}

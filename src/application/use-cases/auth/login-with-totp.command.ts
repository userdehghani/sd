/**
 * Login with TOTP Command
 */

import { Session } from "../../../domain/entities/session.entity";
import { Email } from "../../../domain/value-objects/email.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { ISessionRepository } from "../../ports/repositories/session.repository";
import { ITOTPService } from "../../ports/services/totp.service";
import { IJWTService } from "../../ports/services/jwt.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { UserLoggedInEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err, Ok } from "../../../shared/result";
import { DomainError, AuthenticationError, ErrorCode } from "../../../shared/errors";
import { AuthProvider, JWTPayload } from "../../../shared/types";
import { logger } from "../../../logger";

export interface LoginWithTOTPInput {
  email: string;
  totpToken: string;
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceType?: string;
  };
}

export interface LoginWithTOTPOutput {
  accessToken: string;
  session: Session;
}

export class LoginWithTOTPCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly totpService: ITOTPService,
    private readonly jwtService: IJWTService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: LoginWithTOTPInput): AsyncResult<LoginWithTOTPOutput, DomainError> {
    logger.info("Executing LoginWithTOTPCommand", { email: input.email });

    // Validate email
    const emailResult = Email.create(input.email);
    if (!emailResult.success) {
      logger.warn("Invalid email provided", { email: input.email });
      return emailResult;
    }
    const email = emailResult.value;

    // Find user
    const userResult = await this.userRepository.findByEmail(email);
    if (!userResult.success) {
      logger.error("Error finding user", { error: userResult.error });
      return userResult;
    }
    if (!userResult.value) {
      logger.warn("User not found", { email: input.email });
      return Err(
        new AuthenticationError("Invalid credentials", ErrorCode.INVALID_CREDENTIALS)
      );
    }
    const user = userResult.value;

    // Check if user has TOTP enabled
    if (!user.hasAuthProvider(AuthProvider.TOTP) || !user.totpSecret) {
      logger.warn("User does not have TOTP enabled", { userId: user.id.getValue() });
      return Err(
        new AuthenticationError("TOTP not enabled for this user", ErrorCode.TOTP_INVALID)
      );
    }

    // Verify TOTP token
    const verifyResult = await this.totpService.verifyToken(user.totpSecret, input.totpToken);
    if (!verifyResult.success) {
      logger.error("Error verifying TOTP token", { error: verifyResult.error });
      return verifyResult;
    }
    if (!verifyResult.value) {
      logger.warn("Invalid TOTP token", { userId: user.id.getValue() });
      return Err(
        new AuthenticationError("Invalid TOTP token", ErrorCode.TOTP_INVALID)
      );
    }

    // Create session
    const session = Session.create(user.id, input.deviceInfo);
    const sessionResult = await this.sessionRepository.save(session);
    if (!sessionResult.success) {
      logger.error("Error saving session", { error: sessionResult.error });
      return sessionResult;
    }

    // Generate JWT
    const jwtPayload: JWTPayload = {
      userId: user.id.getValue(),
      sessionId: session.id.getValue(),
      email: user.email.getValue(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(session.expiresAt.getTime() / 1000),
    };
    const tokenResult = await this.jwtService.sign(jwtPayload);
    if (!tokenResult.success) {
      logger.error("Error generating JWT", { error: tokenResult.error });
      return tokenResult;
    }

    // Publish event
    const event = new UserLoggedInEvent(
      user.id.getValue(),
      session.id.getValue(),
      AuthProvider.TOTP
    );
    await this.eventBus.publish(event);

    logger.info("User logged in successfully with TOTP", { 
      userId: user.id.getValue(),
      sessionId: session.id.getValue() 
    });

    return Ok({
      accessToken: tokenResult.value,
      session: sessionResult.value,
    });
  }
}

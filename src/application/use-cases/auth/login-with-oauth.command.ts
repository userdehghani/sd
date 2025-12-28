/**
 * Login with OAuth Command (Google, Apple)
 */

import { Session } from "../../../domain/entities/session.entity";
import { Email } from "../../../domain/value-objects/email.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { ISessionRepository } from "../../ports/repositories/session.repository";
import { IOAuthService } from "../../ports/services/oauth.service";
import { IJWTService } from "../../ports/services/jwt.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { UserLoggedInEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err, Ok } from "../../../shared/result";
import { DomainError, AuthenticationError, ErrorCode } from "../../../shared/errors";
import { AuthProvider, JWTPayload } from "../../../shared/types";
import { logger } from "../../../logger";

export interface LoginWithOAuthInput {
  provider: AuthProvider;
  code: string;
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceType?: string;
  };
}

export interface LoginWithOAuthOutput {
  accessToken: string;
  session: Session;
}

export class LoginWithOAuthCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly oauthService: IOAuthService,
    private readonly jwtService: IJWTService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: LoginWithOAuthInput): AsyncResult<LoginWithOAuthOutput, DomainError> {
    logger.info("Executing LoginWithOAuthCommand", { provider: input.provider });

    // Exchange code for access token
    const tokenResult = await this.oauthService.exchangeCodeForToken(input.provider, input.code);
    if (!tokenResult.success) {
      logger.error("Error exchanging OAuth code", { error: tokenResult.error });
      return tokenResult;
    }
    const accessToken = tokenResult.value;

    // Get user info from OAuth provider
    const userInfoResult = await this.oauthService.getUserInfo(input.provider, accessToken);
    if (!userInfoResult.success) {
      logger.error("Error getting OAuth user info", { error: userInfoResult.error });
      return userInfoResult;
    }
    const userInfo = userInfoResult.value;

    // Validate email
    const emailResult = Email.create(userInfo.email);
    if (!emailResult.success) {
      logger.warn("Invalid email from OAuth provider", { email: userInfo.email });
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
      logger.warn("User not found", { email: userInfo.email });
      return Err(
        new AuthenticationError("User not found. Please register first.", ErrorCode.USER_NOT_FOUND)
      );
    }
    const user = userResult.value;

    // Check if user has this OAuth provider
    if (!user.hasAuthProvider(input.provider)) {
      logger.warn("User does not have this OAuth provider", { 
        userId: user.id.getValue(),
        provider: input.provider 
      });
      return Err(
        new AuthenticationError("This OAuth provider is not linked to your account", ErrorCode.OAUTH_ERROR)
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
    const jwtResult = await this.jwtService.sign(jwtPayload);
    if (!jwtResult.success) {
      logger.error("Error generating JWT", { error: jwtResult.error });
      return jwtResult;
    }

    // Publish event
    const event = new UserLoggedInEvent(
      user.id.getValue(),
      session.id.getValue(),
      input.provider
    );
    await this.eventBus.publish(event);

    logger.info("User logged in successfully with OAuth", { 
      userId: user.id.getValue(),
      sessionId: session.id.getValue(),
      provider: input.provider 
    });

    return Ok({
      accessToken: jwtResult.value,
      session: sessionResult.value,
    });
  }
}

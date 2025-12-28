/**
 * Register User with OAuth Command (Google, Apple)
 */

import { User } from "../../../domain/entities/user.entity";
import { Email } from "../../../domain/value-objects/email.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { IOAuthService } from "../../ports/services/oauth.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { UserRegisteredEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err, Ok } from "../../../shared/result";
import { DomainError, AuthenticationError, ErrorCode } from "../../../shared/errors";
import { AuthProvider } from "../../../shared/types";
import { logger } from "../../../logger";

export interface RegisterWithOAuthInput {
  provider: AuthProvider;
  code: string;
}

export interface RegisterWithOAuthOutput {
  user: User;
  isNewUser: boolean;
}

export class RegisterWithOAuthCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly oauthService: IOAuthService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: RegisterWithOAuthInput): AsyncResult<RegisterWithOAuthOutput, DomainError> {
    logger.info("Executing RegisterWithOAuthCommand", { provider: input.provider });

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

    // Check if user already exists
    const existingUserResult = await this.userRepository.findByEmail(email);
    if (!existingUserResult.success) {
      logger.error("Error finding user", { error: existingUserResult.error });
      return existingUserResult;
    }

    if (existingUserResult.value) {
      const existingUser = existingUserResult.value;
      
      // Add OAuth provider if not already present
      if (!existingUser.hasAuthProvider(input.provider)) {
        existingUser.addAuthProvider(input.provider);
        const updateResult = await this.userRepository.update(existingUser);
        if (!updateResult.success) {
          logger.error("Error updating user", { error: updateResult.error });
          return updateResult;
        }
      }

      logger.info("Existing user logged in with OAuth", { 
        userId: existingUser.id.getValue(),
        provider: input.provider 
      });

      return Ok({
        user: existingUser,
        isNewUser: false,
      });
    }

    // Create new user
    const user = User.create({
      email,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      avatarUrl: userInfo.avatarUrl,
      isEmailVerified: true, // OAuth providers verify email
      isPhoneVerified: false,
      authProviders: [input.provider],
    });

    // Save user
    const saveResult = await this.userRepository.save(user);
    if (!saveResult.success) {
      logger.error("Error saving user", { error: saveResult.error });
      return saveResult;
    }

    // Publish event
    const event = new UserRegisteredEvent(
      user.id.getValue(),
      user.email.getValue(),
      input.provider
    );
    await this.eventBus.publish(event);

    logger.info("User registered successfully with OAuth", { 
      userId: user.id.getValue(),
      provider: input.provider 
    });

    return Ok({
      user: saveResult.value,
      isNewUser: true,
    });
  }
}

/**
 * Register User with PassKey Command
 */

import { User } from "../../../domain/entities/user.entity";
import { Email } from "../../../domain/value-objects/email.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { IPassKeyService } from "../../ports/services/passkey.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { UserRegisteredEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err, Ok } from "../../../shared/result";
import { DomainError, ValidationError, ErrorCode } from "../../../shared/errors";
import { AuthProvider } from "../../../shared/types";
import { logger } from "../../../logger";

export interface RegisterWithPassKeyInput {
  email: string;
  firstName?: string;
  lastName?: string;
  credential: unknown; // WebAuthn credential object
}

export interface RegisterWithPassKeyOutput {
  user: User;
}

export class RegisterWithPassKeyCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passKeyService: IPassKeyService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: RegisterWithPassKeyInput): AsyncResult<RegisterWithPassKeyOutput, DomainError> {
    logger.info("Executing RegisterWithPassKeyCommand", { email: input.email });

    // Validate email
    const emailResult = Email.create(input.email);
    if (!emailResult.success) {
      logger.warn("Invalid email provided", { email: input.email });
      return emailResult;
    }
    const email = emailResult.value;

    // Check if user already exists
    const existsResult = await this.userRepository.exists(email);
    if (!existsResult.success) {
      logger.error("Error checking user existence", { error: existsResult.error });
      return existsResult;
    }
    if (existsResult.value) {
      logger.warn("User already exists", { email: input.email });
      return Err(
        new ValidationError("User with this email already exists", {
          code: ErrorCode.EMAIL_ALREADY_EXISTS,
        })
      );
    }

    // Verify PassKey credential
    const verifyResult = await this.passKeyService.verifyRegistration(input.credential);
    if (!verifyResult.success) {
      logger.error("Error verifying PassKey credential", { error: verifyResult.error });
      return verifyResult;
    }
    const { credentialId, publicKey } = verifyResult.value;

    // Create user
    const user = User.create({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      isEmailVerified: false,
      isPhoneVerified: false,
      authProviders: [AuthProvider.PASSKEY],
      passKeyCredential: JSON.stringify({ credentialId, publicKey }),
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
      AuthProvider.PASSKEY
    );
    await this.eventBus.publish(event);

    logger.info("User registered successfully with PassKey", { userId: user.id.getValue() });

    return Ok({
      user: saveResult.value,
    });
  }
}

/**
 * Register User with TOTP Command
 */

import { User } from "../../../domain/entities/user.entity";
import { Email } from "../../../domain/value-objects/email.vo";
import { IUserRepository } from "../../ports/repositories/user.repository";
import { ITOTPService } from "../../ports/services/totp.service";
import { IEventBusService } from "../../ports/services/event-bus.service";
import { UserRegisteredEvent } from "../../../domain/events/domain-event";
import { AsyncResult, Err, flatMapAsync, Ok } from "../../../shared/result";
import { DomainError, ErrorCode, ValidationError } from "../../../shared/errors";
import { AuthProvider } from "../../../shared/types";
import { logger } from "../../../logger";

export interface RegisterWithTOTPInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterWithTOTPOutput {
  user: User;
  totpSecret: string;
  qrCode: string;
  backupCodes: string[];
}

export class RegisterWithTOTPCommand {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly totpService: ITOTPService,
    private readonly eventBus: IEventBusService
  ) {}

  async execute(input: RegisterWithTOTPInput): AsyncResult<RegisterWithTOTPOutput, DomainError> {
    logger.info("Executing RegisterWithTOTPCommand", { email: input.email });

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

    // Generate TOTP secret
    const totpSetupResult = await this.totpService.generateSecret();
    if (!totpSetupResult.success) {
      logger.error("Error generating TOTP secret", { error: totpSetupResult.error });
      return totpSetupResult;
    }
    const totpSetup = totpSetupResult.value;

    // Create user
    const user = User.create({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      isEmailVerified: false,
      isPhoneVerified: false,
      authProviders: [AuthProvider.TOTP],
      totpSecret: totpSetup.secret,
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
      AuthProvider.TOTP
    );
    await this.eventBus.publish(event);

    logger.info("User registered successfully with TOTP", { userId: user.id.getValue() });

    return Ok({
      user: saveResult.value,
      totpSecret: totpSetup.secret,
      qrCode: totpSetup.qrCode,
      backupCodes: totpSetup.backupCodes,
    });
  }
}

/**
 * Dependency Injection Container
 * Manages all application dependencies (Singleton pattern for infrastructure)
 */

import { PostgresClient } from "./infrastructure/database/postgres.client";
import { RedisClient } from "./infrastructure/database/redis.client";
import { S3ClientSingleton } from "./infrastructure/database/s3.client";
import { UserRepositoryImpl } from "./infrastructure/repositories/user.repository.impl";
import { SessionRepositoryImpl } from "./infrastructure/repositories/session.repository.impl";
import { JWTServiceImpl } from "./infrastructure/services/jwt.service.impl";
import { TOTPServiceImpl } from "./infrastructure/services/totp.service.impl";
import { PassKeyServiceImpl } from "./infrastructure/services/passkey.service.impl";
import { OAuthServiceImpl } from "./infrastructure/services/oauth.service.impl";
import { StorageServiceImpl } from "./infrastructure/services/storage.service.impl";
import { EmailServiceImpl } from "./infrastructure/services/email.service.impl";
import { SMSServiceImpl } from "./infrastructure/services/sms.service.impl";
import { CacheServiceImpl } from "./infrastructure/services/cache.service.impl";
import { EventBusServiceImpl } from "./infrastructure/services/event-bus.service.impl";
import { RegisterWithTOTPCommand } from "./application/use-cases/auth/register-with-totp.command";
import { RegisterWithOAuthCommand } from "./application/use-cases/auth/register-with-oauth.command";
import { RegisterWithPassKeyCommand } from "./application/use-cases/auth/register-with-passkey.command";
import { LoginWithTOTPCommand } from "./application/use-cases/auth/login-with-totp.command";
import { LoginWithOAuthCommand } from "./application/use-cases/auth/login-with-oauth.command";
import { LoginWithPassKeyCommand } from "./application/use-cases/auth/login-with-passkey.command";
import { GetProfileCommand } from "./application/use-cases/profile/get-profile.command";
import { UpdateProfileCommand } from "./application/use-cases/profile/update-profile.command";
import { VerifyEmailCommand } from "./application/use-cases/profile/verify-email.command";
import { VerifyPhoneCommand } from "./application/use-cases/profile/verify-phone.command";
import { ListSessionsCommand } from "./application/use-cases/session/list-sessions.command";
import { RevokeSessionCommand } from "./application/use-cases/session/revoke-session.command";
import { RevokeAllSessionsCommand } from "./application/use-cases/session/revoke-all-sessions.command";
import { UploadAvatarCommand } from "./application/use-cases/storage/upload-avatar.command";
import { DeleteAvatarCommand } from "./application/use-cases/storage/delete-avatar.command";
import { AuthController } from "./interface/http/controllers/auth.controller";
import { ProfileController } from "./interface/http/controllers/profile.controller";
import { SessionController } from "./interface/http/controllers/session.controller";
import { StorageController } from "./interface/http/controllers/storage.controller";
import { AuthMiddleware } from "./interface/http/middleware/auth.middleware";
import { RateLimiterMiddleware } from "./interface/http/middleware/rate-limiter.middleware";
import { logger } from "./logger";

export interface AppConfig {
  // Database
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  // Redis
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  // S3
  s3: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    cdnUrl?: string;
  };
  // JWT
  jwt: {
    secret: string;
    expiresIn: string;
  };
  // OAuth
  oauth: {
    google: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
    apple: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
  };
  // PassKey
  passkey: {
    rpName: string;
    rpId: string;
    origin: string;
  };
  // Email
  email: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  // SMS
  sms: {
    username: string;
    password: string;
    fromNumber: string;
  };
  // Rate Limiter
  rateLimit: {
    capacity: number;
    refillRate: number;
  };
}

export class Container {
  // Infrastructure (Singletons)
  private postgresClient!: PostgresClient;
  private redisClient!: RedisClient;
  private s3Client!: S3ClientSingleton;

  // Repositories
  private userRepository!: UserRepositoryImpl;
  private sessionRepository!: SessionRepositoryImpl;

  // Services
  private jwtService!: JWTServiceImpl;
  private totpService!: TOTPServiceImpl;
  private passkeyService!: PassKeyServiceImpl;
  private oauthService!: OAuthServiceImpl;
  private storageService!: StorageServiceImpl;
  private emailService!: EmailServiceImpl;
  private smsService!: SMSServiceImpl;
  private cacheService!: CacheServiceImpl;
  private eventBusService!: EventBusServiceImpl;

  // Use Cases
  private registerWithTOTPCommand!: RegisterWithTOTPCommand;
  private registerWithOAuthCommand!: RegisterWithOAuthCommand;
  private registerWithPassKeyCommand!: RegisterWithPassKeyCommand;
  private loginWithTOTPCommand!: LoginWithTOTPCommand;
  private loginWithOAuthCommand!: LoginWithOAuthCommand;
  private loginWithPassKeyCommand!: LoginWithPassKeyCommand;
  private getProfileCommand!: GetProfileCommand;
  private updateProfileCommand!: UpdateProfileCommand;
  private verifyEmailCommand!: VerifyEmailCommand;
  private verifyPhoneCommand!: VerifyPhoneCommand;
  private listSessionsCommand!: ListSessionsCommand;
  private revokeSessionCommand!: RevokeSessionCommand;
  private revokeAllSessionsCommand!: RevokeAllSessionsCommand;
  private uploadAvatarCommand!: UploadAvatarCommand;
  private deleteAvatarCommand!: DeleteAvatarCommand;

  // Controllers
  private authController!: AuthController;
  private profileController!: ProfileController;
  private sessionController!: SessionController;
  private storageController!: StorageController;

  // Middleware
  private authMiddleware!: AuthMiddleware;
  private rateLimiter!: RateLimiterMiddleware;

  constructor(private config: AppConfig) {}

  async initialize(): Promise<void> {
    logger.info("Initializing container...");

    // Initialize infrastructure (Singletons)
    this.postgresClient = PostgresClient.getInstance({
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.database,
      user: this.config.database.user,
      password: this.config.database.password,
    });
    await this.postgresClient.connect();

    this.redisClient = RedisClient.getInstance({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });
    await this.redisClient.connect();

    this.s3Client = S3ClientSingleton.getInstance({
      region: this.config.s3.region,
      credentials: {
        accessKeyId: this.config.s3.accessKeyId,
        secretAccessKey: this.config.s3.secretAccessKey,
      },
    });

    // Initialize repositories
    this.userRepository = new UserRepositoryImpl(this.postgresClient.getPool());
    this.sessionRepository = new SessionRepositoryImpl(this.postgresClient.getPool());

    // Initialize services
    this.jwtService = new JWTServiceImpl(this.config.jwt.secret, this.config.jwt.expiresIn);
    this.totpService = new TOTPServiceImpl();
    this.passkeyService = new PassKeyServiceImpl(
      this.config.passkey.rpName,
      this.config.passkey.rpId,
      this.config.passkey.origin
    );
    this.oauthService = new OAuthServiceImpl(
      this.config.oauth.google,
      this.config.oauth.apple
    );
    this.storageService = new StorageServiceImpl(
      this.s3Client.getClient(),
      this.config.s3.bucketName,
      this.config.s3.region,
      this.config.s3.cdnUrl
    );
    this.emailService = new EmailServiceImpl(
      this.config.email.apiKey,
      this.config.email.fromEmail,
      this.config.email.fromName
    );
    this.smsService = new SMSServiceImpl(
      this.config.sms.username,
      this.config.sms.password,
      this.config.sms.fromNumber
    );
    this.cacheService = new CacheServiceImpl(this.redisClient.getClient());
    this.eventBusService = new EventBusServiceImpl(
      this.redisClient.getPublisher(),
      this.redisClient.getSubscriber()
    );

    // Initialize use cases
    this.registerWithTOTPCommand = new RegisterWithTOTPCommand(
      this.userRepository,
      this.totpService,
      this.eventBusService
    );
    this.registerWithOAuthCommand = new RegisterWithOAuthCommand(
      this.userRepository,
      this.oauthService,
      this.eventBusService
    );
    this.registerWithPassKeyCommand = new RegisterWithPassKeyCommand(
      this.userRepository,
      this.passkeyService,
      this.eventBusService
    );
    this.loginWithTOTPCommand = new LoginWithTOTPCommand(
      this.userRepository,
      this.sessionRepository,
      this.totpService,
      this.jwtService,
      this.eventBusService
    );
    this.loginWithOAuthCommand = new LoginWithOAuthCommand(
      this.userRepository,
      this.sessionRepository,
      this.oauthService,
      this.jwtService,
      this.eventBusService
    );
    this.loginWithPassKeyCommand = new LoginWithPassKeyCommand(
      this.userRepository,
      this.sessionRepository,
      this.passkeyService,
      this.jwtService,
      this.eventBusService
    );
    this.getProfileCommand = new GetProfileCommand(this.userRepository);
    this.updateProfileCommand = new UpdateProfileCommand(
      this.userRepository,
      this.eventBusService
    );
    this.verifyEmailCommand = new VerifyEmailCommand(
      this.userRepository,
      this.cacheService,
      this.eventBusService
    );
    this.verifyPhoneCommand = new VerifyPhoneCommand(
      this.userRepository,
      this.cacheService,
      this.eventBusService
    );
    this.listSessionsCommand = new ListSessionsCommand(this.sessionRepository);
    this.revokeSessionCommand = new RevokeSessionCommand(
      this.sessionRepository,
      this.cacheService,
      this.eventBusService
    );
    this.revokeAllSessionsCommand = new RevokeAllSessionsCommand(
      this.sessionRepository,
      this.cacheService,
      this.eventBusService
    );
    this.uploadAvatarCommand = new UploadAvatarCommand(
      this.userRepository,
      this.storageService
    );
    this.deleteAvatarCommand = new DeleteAvatarCommand(
      this.userRepository,
      this.storageService
    );

    // Initialize middleware
    this.authMiddleware = new AuthMiddleware(this.jwtService, this.sessionRepository);
    this.rateLimiter = new RateLimiterMiddleware(this.redisClient.getClient(), {
      capacity: this.config.rateLimit.capacity,
      refillRate: this.config.rateLimit.refillRate,
    });

    // Initialize controllers
    this.authController = new AuthController(
      this.registerWithTOTPCommand,
      this.registerWithOAuthCommand,
      this.registerWithPassKeyCommand,
      this.loginWithTOTPCommand,
      this.loginWithOAuthCommand,
      this.loginWithPassKeyCommand,
      this.authMiddleware
    );
    this.profileController = new ProfileController(
      this.getProfileCommand,
      this.updateProfileCommand,
      this.verifyEmailCommand,
      this.verifyPhoneCommand
    );
    this.sessionController = new SessionController(
      this.listSessionsCommand,
      this.revokeSessionCommand,
      this.revokeAllSessionsCommand
    );
    this.storageController = new StorageController(
      this.uploadAvatarCommand,
      this.deleteAvatarCommand
    );

    logger.info("Container initialized successfully");
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down container...");

    await this.eventBusService.unsubscribeAll();
    await this.redisClient.disconnect();
    await this.postgresClient.disconnect();
    await this.s3Client.destroy();

    logger.info("Container shutdown complete");
  }

  // Getters
  getControllers() {
    return {
      authController: this.authController,
      profileController: this.profileController,
      sessionController: this.sessionController,
      storageController: this.storageController,
    };
  }

  getMiddleware() {
    return {
      authMiddleware: this.authMiddleware,
      rateLimiter: this.rateLimiter,
    };
  }

  async healthCheck(): Promise<{ postgres: boolean; redis: boolean; s3: boolean }> {
    return {
      postgres: await this.postgresClient.healthCheck(),
      redis: await this.redisClient.healthCheck(),
      s3: await this.s3Client.healthCheck(),
    };
  }
}

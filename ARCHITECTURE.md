# Hexagonal Architecture Documentation

## Overview

This project implements a clean hexagonal architecture (ports and adapters) for a user authentication and profile management system, following Domain-Driven Design (DDD) principles and functional programming patterns.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        Interface Layer                           │
│  (HTTP Controllers, DTOs, Routes, Middleware)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      Application Layer                           │
│         (Use Cases/Commands with Port Interfaces)                │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                        Domain Layer                              │
│  (Entities, Value Objects, Domain Events, Business Logic)        │
└──────────────────────────────────────────────────────────────────┘
                         ▲
┌────────────────────────┴────────────────────────────────────────┐
│                    Infrastructure Layer                          │
│  (Database, Redis, S3, OAuth, Email, SMS Adapters)              │
└──────────────────────────────────────────────────────────────────┘
                         ▲
┌────────────────────────┴────────────────────────────────────────┐
│                       Shared Kernel                              │
│      (Result Type, Errors, Common Types, Utilities)              │
└──────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── domain/                      # Domain Layer (Business Logic)
│   ├── entities/                # Aggregate Roots and Entities
│   │   ├── user.entity.ts       # User aggregate root
│   │   └── session.entity.ts    # Session entity
│   ├── value-objects/           # Value Objects (immutable)
│   │   ├── email.vo.ts          # Email with validation
│   │   ├── phone.vo.ts          # Phone number with validation
│   │   ├── user-id.vo.ts        # User identifier
│   │   └── session-id.vo.ts     # Session identifier
│   └── events/                  # Domain Events
│       └── domain-event.ts      # Base event and specific events
│
├── application/                 # Application Layer (Use Cases)
│   ├── ports/                   # Port Interfaces (abstractions)
│   │   ├── repositories/        # Repository interfaces
│   │   │   ├── user.repository.ts
│   │   │   └── session.repository.ts
│   │   └── services/            # Service interfaces
│   │       ├── jwt.service.ts
│   │       ├── oauth.service.ts
│   │       ├── totp.service.ts
│   │       ├── passkey.service.ts
│   │       ├── storage.service.ts
│   │       ├── email.service.ts
│   │       ├── sms.service.ts
│   │       ├── cache.service.ts
│   │       └── event-bus.service.ts
│   └── use-cases/               # Use Cases (Commands)
│       ├── auth/                # Authentication use cases
│       │   ├── register-with-totp.command.ts
│       │   ├── register-with-oauth.command.ts
│       │   ├── register-with-passkey.command.ts
│       │   ├── login-with-totp.command.ts
│       │   ├── login-with-oauth.command.ts
│       │   └── login-with-passkey.command.ts
│       ├── session/             # Session management use cases
│       │   ├── list-sessions.command.ts
│       │   ├── revoke-session.command.ts
│       │   └── revoke-all-sessions.command.ts
│       ├── profile/             # Profile management use cases
│       │   ├── get-profile.command.ts
│       │   ├── update-profile.command.ts
│       │   ├── verify-email.command.ts
│       │   └── verify-phone.command.ts
│       ├── storage/             # Storage use cases
│       │   ├── upload-avatar.command.ts
│       │   └── delete-avatar.command.ts
│       └── notification/        # Notification use cases
│           ├── send-email.command.ts
│           └── send-sms.command.ts
│
├── infrastructure/              # Infrastructure Layer (Adapters)
│   ├── database/                # Database clients (Singletons)
│   │   ├── postgres.client.ts   # PostgreSQL connection pool
│   │   ├── redis.client.ts      # Redis client and pub/sub
│   │   └── s3.client.ts         # S3 client
│   ├── repositories/            # Repository implementations
│   │   ├── user.repository.impl.ts
│   │   └── session.repository.impl.ts
│   └── services/                # Service implementations
│       ├── jwt.service.impl.ts
│       ├── oauth.service.impl.ts
│       ├── totp.service.impl.ts
│       ├── passkey.service.impl.ts
│       ├── storage.service.impl.ts
│       ├── email.service.impl.ts
│       ├── sms.service.impl.ts
│       ├── cache.service.impl.ts
│       └── event-bus.service.impl.ts
│
├── interface/                   # Interface Layer (HTTP)
│   └── http/
│       ├── controllers/         # HTTP Controllers
│       │   ├── auth.controller.ts
│       │   ├── profile.controller.ts
│       │   ├── session.controller.ts
│       │   └── storage.controller.ts
│       ├── dtos/                # Data Transfer Objects
│       │   ├── auth.dto.ts
│       │   ├── profile.dto.ts
│       │   └── session.dto.ts
│       ├── middleware/          # HTTP Middleware
│       │   ├── auth.middleware.ts
│       │   └── rate-limiter.middleware.ts
│       └── routes.ts            # Route definitions
│
├── shared/                      # Shared Kernel
│   ├── result.ts                # Result type for error handling
│   ├── errors.ts                # Domain error types
│   └── types.ts                 # Common types
│
├── container.ts                 # Dependency Injection Container
├── config.ts                    # Configuration management
├── logger.ts                    # Logging utility
├── metrics.ts                   # Metrics collection
├── middleware.ts                # Global middleware
├── health.ts                    # Health checks
├── gsh.ts                       # Graceful shutdown handler
└── index.ts                     # Application entry point
```

## Key Principles

### 1. Dependency Rule

Dependencies flow inward: Interface → Application → Domain ← Infrastructure

- Domain layer has NO dependencies on other layers
- Application layer depends ONLY on Domain layer (through ports)
- Infrastructure layer implements Application ports
- Interface layer orchestrates Application use cases

### 2. Result Type (Functional Error Handling)

Instead of throwing exceptions, we use a `Result<T, E>` type:

```typescript
type Result<T, E> = 
  | { success: true; value: T }
  | { success: false; error: E };
```

Benefits:
- Explicit error handling
- Type-safe error propagation
- No try-catch blocks needed
- Composable with map, flatMap, etc.

### 3. Value Objects

Encapsulate validation and business rules:

```typescript
class Email {
  private constructor(private readonly value: string) {}
  
  static create(email: string): Result<Email, ValidationError> {
    // Validation logic
  }
}
```

### 4. Aggregate Roots

Entities with identity and lifecycle:

```typescript
class User {
  private constructor(private props: UserProps) {}
  
  static create(props): User { /* ... */ }
  static reconstitute(props): User { /* ... */ }
  
  // Domain methods
  updateProfile(data) { /* ... */ }
  verifyEmail() { /* ... */ }
}
```

### 5. Ports and Adapters

**Ports** (interfaces) define contracts:
```typescript
interface IUserRepository {
  findById(id: UserId): AsyncResult<User | null, DomainError>;
  save(user: User): AsyncResult<User, DomainError>;
}
```

**Adapters** implement ports:
```typescript
class UserRepositoryImpl implements IUserRepository {
  constructor(private pool: Pool) {}
  // Implementation
}
```

### 6. Use Cases (Commands)

Single-responsibility operations:

```typescript
class LoginWithTOTPCommand {
  constructor(
    private userRepo: IUserRepository,
    private totpService: ITOTPService,
    // ... other dependencies
  ) {}
  
  async execute(input): AsyncResult<Output, Error> {
    // Use case logic
  }
}
```

### 7. Singleton Infrastructure Clients

Database connections, external service clients are singletons:

```typescript
class PostgresClient {
  private static instance: PostgresClient;
  
  static getInstance(config?): PostgresClient {
    if (!instance) {
      instance = new PostgresClient(config);
    }
    return instance;
  }
}
```

## Authentication Flow Example

1. **Client** → POST `/api/auth/login/totp` with email and TOTP token
2. **AuthController** validates rate limit, calls `LoginWithTOTPCommand`
3. **LoginWithTOTPCommand**:
   - Validates email (Value Object)
   - Finds user via `IUserRepository` port
   - Verifies TOTP via `ITOTPService` port
   - Creates session via `ISessionRepository` port
   - Generates JWT via `IJWTService` port
   - Publishes `UserLoggedInEvent` via `IEventBusService` port
4. **Controller** returns JWT and session info to client

## Database Schema

### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  avatar_url TEXT,
  is_email_verified BOOLEAN,
  is_phone_verified BOOLEAN,
  auth_providers TEXT[],
  totp_secret TEXT,
  passkey_credential TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Sessions Table
```sql
sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  user_agent TEXT,
  ip_address VARCHAR,
  device_type VARCHAR,
  is_revoked BOOLEAN,
  expires_at TIMESTAMP,
  created_at TIMESTAMP,
  revoked_at TIMESTAMP
)
```

## API Endpoints

### Authentication
- `POST /api/auth/register/totp` - Register with TOTP
- `POST /api/auth/register/oauth` - Register with OAuth (Google/Apple)
- `POST /api/auth/register/passkey` - Register with PassKey
- `POST /api/auth/login/totp` - Login with TOTP
- `POST /api/auth/login/oauth` - Login with OAuth
- `POST /api/auth/login/passkey` - Login with PassKey

### Profile (Protected)
- `GET /api/user/me` - Get current user profile
- `PATCH /api/user/profile` - Update profile
- `POST /api/user/verify/email` - Verify email with code
- `POST /api/user/verify/phone` - Verify phone with code

### Sessions (Protected)
- `GET /api/sessions` - List all sessions
- `DELETE /api/sessions/:id` - Revoke specific session
- `DELETE /api/sessions` - Revoke all sessions

### Storage (Protected)
- `POST /api/storage/avatar` - Upload avatar
- `DELETE /api/storage/avatar` - Delete avatar

## Cross-Cutting Concerns

### Rate Limiting
Leaky bucket algorithm implementation using Redis:
- Configurable capacity and refill rate
- Per-IP or per-user limiting
- Atomic operations via Lua scripts

### Authentication Middleware
- JWT token verification
- Session validation
- User context injection

### Logging
Structured logging on every command execution:
```typescript
logger.info("Executing LoginWithTOTPCommand", { email: input.email });
```

### Event Bus
Redis pub/sub for domain events:
- Asynchronous event handling
- Decoupled event subscribers
- Event-driven architecture support

### Graceful Shutdown
Clean shutdown of all resources:
- Close database connections
- Drain Redis connections
- Complete in-flight requests

## Configuration

Environment variables or config file:

```typescript
{
  database: { host, port, database, user, password },
  redis: { host, port, password },
  s3: { region, accessKeyId, secretAccessKey, bucketName },
  jwt: { secret, expiresIn },
  oauth: { google: {...}, apple: {...} },
  email: { apiKey, fromEmail },
  sms: { username, password, fromNumber },
  rateLimit: { capacity, refillRate }
}
```

## Testing Strategy

1. **Unit Tests**: Test domain entities, value objects, and use cases
2. **Integration Tests**: Test repository implementations with test database
3. **E2E Tests**: Test HTTP endpoints with real infrastructure
4. **Contract Tests**: Verify port implementations match interfaces

## Benefits of This Architecture

✅ **Testability**: Easy to mock ports and test use cases in isolation
✅ **Maintainability**: Clear separation of concerns
✅ **Scalability**: Easy to swap implementations (e.g., PostgreSQL → MongoDB)
✅ **Type Safety**: Full TypeScript coverage with strict mode
✅ **Error Handling**: Functional error handling with Result type
✅ **Domain Focus**: Business logic isolated in domain layer
✅ **Cloud Native**: Singleton clients, health checks, graceful shutdown
✅ **DDD Alignment**: Aggregates, entities, value objects, domain events
✅ **Clean Code**: SOLID principles, dependency injection

## Migration from MVC

| MVC Pattern | Hexagonal Architecture |
|-------------|------------------------|
| Model | Domain (Entities + Value Objects) |
| View | Interface Layer (DTOs) |
| Controller | Application Layer (Use Cases) |
| Service | Infrastructure Layer (Adapters) |
| Direct DB Access | Repository Pattern with Ports |
| Global State | Dependency Injection Container |
| Exceptions | Result Type |

## Next Steps

1. Run database migrations
2. Configure environment variables
3. Install dependencies
4. Run tests
5. Start application
6. Access API documentation at `/docs`

## Resources

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Result Type Pattern](https://www.youtube.com/watch?v=srQt1NAHYC0)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

# Hexagonal Architecture Documentation

## Overview

This application follows **Hexagonal Architecture** (also known as Ports and Adapters) combined with **Domain-Driven Design (DDD)** principles and **functional programming** patterns.

## Directory Structure

```
src/
├── core/                           # Shared Kernel
│   ├── types/
│   │   ├── result.ts              # Result<T, E> monad for error handling
│   │   ├── errors.ts              # Domain error types
│   │   └── index.ts               # Common types (UUID, Email, etc.)
│   └── utils/
│       └── id.ts                  # ID generation utilities
│
├── domain/                         # Domain Layer (Entities & Business Rules)
│   ├── user/
│   │   ├── entity.ts              # User aggregate root
│   │   ├── value-objects.ts       # Email, Phone, Name, Avatar, etc.
│   │   └── repository.ts          # Repository port (interface)
│   └── session/
│       ├── entity.ts              # Session entity
│       ├── value-objects.ts       # DeviceInfo, TokenClaims
│       └── repository.ts          # Repository port
│
├── application/                    # Application Layer (Use Cases)
│   ├── ports/
│   │   └── index.ts               # Secondary ports (Storage, Email, SMS, etc.)
│   ├── user/
│   │   ├── auth/
│   │   │   ├── register/          # Registration use cases
│   │   │   ├── login/             # Login use cases
│   │   │   └── session/           # Session management
│   │   └── profile/               # Profile use cases
│   ├── storage/                   # Avatar storage use cases
│   └── notify/                    # Notification use cases
│
├── infrastructure/                 # Infrastructure Layer (Adapters)
│   ├── persistence/
│   │   ├── postgres/              # PostgreSQL adapter (singleton)
│   │   └── redis/                 # Redis adapter (singleton)
│   ├── external/
│   │   ├── oauth/                 # Google, Apple OAuth adapters
│   │   ├── storage/               # S3 adapter
│   │   └── notification/          # Resend, Melli Payamak adapters
│   └── auth/
│       ├── jwt.ts                 # JWT service
│       ├── totp.ts                # TOTP service
│       └── passkey.ts             # WebAuthn/Passkey service
│
├── interfaces/                     # Interface Adapters
│   └── http/
│       ├── middleware/
│       │   ├── auth.ts            # Authentication middleware
│       │   └── rate-limiter.ts    # Leaky bucket rate limiter
│       ├── routes/
│       │   ├── user.routes.ts     # User API routes
│       │   └── storage.routes.ts  # Storage API routes
│       └── schemas/
│           └── validation.ts      # Request/response schemas
│
├── config/
│   └── env.ts                     # Environment configuration
│
├── bootstrap.ts                   # Dependency injection & app setup
└── main.ts                        # Entry point
```

## Key Principles

### 1. Dependency Inversion
- **Domain** has no external dependencies
- **Application** depends only on domain and defines ports
- **Infrastructure** implements ports defined by application
- **Interfaces** handle external communication (HTTP, etc.)

### 2. Result Monad for Error Handling
```typescript
// Instead of throwing exceptions
const result = await userRepository.findById(id);
if (result.isErr()) {
  return err(result.error);
}
const user = result.value;
```

### 3. Singleton Pattern for Infrastructure Clients
```typescript
let instance: PostgresClient | null = null;

export const createPostgresClient = (config, logger) => {
  if (instance) return instance;
  instance = /* create client */;
  return instance;
};
```

### 4. Pure Functions in Use Cases
```typescript
export const getUserProfile = (deps: GetProfileDeps) =>
  async (input: GetProfileInput): Promise<Result<GetProfileOutput, DomainError>> => {
    // Pure business logic
  };
```

### 5. Immutable Domain Entities
```typescript
export const updateUserName = (user: User, name: NameVO): User => ({
  ...user,
  name,
  updatedAt: new Date(),
});
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /user/register/totp/init | Initiate TOTP registration |
| POST | /user/register/totp/verify | Complete TOTP registration |
| GET | /user/register/google | Initiate Google OAuth |
| POST | /user/register/google/callback | Complete Google OAuth |
| GET | /user/register/apple | Initiate Apple OAuth |
| POST | /user/register/apple/callback | Complete Apple OAuth |
| POST | /user/register/passkey/init | Initiate passkey registration |
| POST | /user/register/passkey/complete | Complete passkey registration |
| POST | /user/login/totp/init | Initiate TOTP login |
| POST | /user/login/totp/complete | Complete TOTP login |
| POST | /user/login/oauth/:provider | OAuth login callback |
| POST | /user/login/passkey/init | Initiate passkey login |
| POST | /user/login/passkey/complete | Complete passkey login |
| GET | /user/me | Get current user profile |
| POST | /user/update | Update user profile |
| GET | /user/session | List user sessions |
| POST | /user/session/revoke | Revoke a session |
| POST | /user/session/revoke-all | Revoke all sessions |
| POST | /user/logout | Logout (revoke current session) |
| POST | /user/verify/email/send | Send email verification |
| POST | /user/verify/email | Verify email |
| POST | /user/verify/phone/send | Send phone verification |
| POST | /user/verify/phone | Verify phone |
| POST | /storage/upload | Upload avatar |
| DELETE | /storage/avatar | Delete avatar |
| GET | /health | Health check |
| GET | /health/live | Liveness probe |
| GET | /health/ready | Readiness probe |
| GET | /metrics | Prometheus metrics |
| GET | /openapi | OpenAPI documentation |

## Use Case Mapping

```
user.auth.register.totp     → initiateTOTPRegistration, verifyTOTPRegistration
user.auth.register.google   → initiateGoogleAuth, completeGoogleRegistration
user.auth.register.apple    → initiateAppleAuth, completeAppleRegistration
user.auth.register.passkey  → initiatePasskeyRegistration, completePasskeyRegistration

user.auth.login.totp        → initiateTOTPLogin, completeTOTPLogin
user.auth.login.oauth       → oauthLogin
user.auth.login.passkey     → initiatePasskeyLogin, completePasskeyLogin

user.auth.session.create    → createUserSession
user.auth.session.list      → listUserSessions
user.auth.session.revoke    → revokeUserSession, revokeAllUserSessions, logout

user.profile.get            → getUserProfile
user.profile.update         → updateUserProfile
user.profile.verify.email   → sendEmailVerification, verifyUserEmail
user.profile.verify.phone   → setPhoneAndSendVerification, verifyUserPhone

storage.upload.avatar       → uploadAvatar
storage.delete.avatar       → deleteAvatar

notify.email                → sendEmailNotification
notify.sms                  → sendSMSNotification
```

## Rate Limiting (Leaky Bucket)

The application uses a **Leaky Bucket** algorithm for rate limiting:

```
Bucket Capacity: 100 requests
Leak Rate: 10 requests/second

When a request arrives:
1. Calculate leaked tokens since last request
2. Subtract leaked tokens from current count
3. If count < capacity, allow request and increment count
4. If count >= capacity, reject with 429 and Retry-After header
```

## Testing Strategy

```
tests/
├── unit/           # Unit tests (no external deps)
│   ├── core/       # Result monad, utilities
│   └── domain/     # Entities, value objects
├── integration/    # Integration tests (with mocked infra)
└── e2e/           # End-to-end tests (full stack)
```

Run tests before deployment:
```bash
bun test              # All tests
bun test:unit         # Unit tests only
bun test:integration  # Integration tests
bun test:e2e          # E2E tests
```

## Graceful Shutdown

The application handles SIGTERM and SIGINT signals:

1. Stop accepting new connections
2. Wait for in-flight requests (configurable timeout)
3. Close database connections
4. Close Redis connections
5. Exit gracefully

## Observability

- **Logging**: Structured JSON logging in production
- **Metrics**: Prometheus-compatible `/metrics` endpoint
- **Tracing**: Distributed tracing with correlation IDs
- **Health Checks**: Kubernetes-compatible probes

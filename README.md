# User Authentication & Profile Management System

A cloud-native, production-ready authentication and profile management system built with **Hexagonal Architecture**, **Domain-Driven Design (DDD)**, and **Functional Programming** principles.

## 🏗️ Architecture

This project implements a clean **Hexagonal Architecture** (Ports and Adapters pattern) with:

- ✅ Domain-Driven Design (DDD)
- ✅ Functional programming patterns (Result type)
- ✅ SOLID principles
- ✅ Dependency Injection
- ✅ Repository pattern
- ✅ Command pattern for use cases
- ✅ Singleton pattern for infrastructure clients
- ✅ Event-driven architecture with domain events

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## 🚀 Features

### Authentication Methods
- 📧 **Email + TOTP** (Time-based One-Time Password)
- 🔐 **Google OAuth 2.0**
- 🍎 **Apple OAuth 2.0**
- 🔑 **WebAuthn/PassKey** (passwordless authentication)

### Session Management
- 🎫 **JWT tokens** with signed session IDs
- 📱 **Multi-device sessions** with device info tracking
- 🔄 **Session revocation** (single or all sessions)
- 📊 **Session listing** with active/expired status

### User Profile
- 👤 **Profile management** (name, avatar, phone)
- ✉️ **Email verification** (via code)
- 📱 **Phone verification** (SMS via Melli Payamak)
- 🖼️ **Avatar upload** to S3

### Infrastructure
- 🗄️ **PostgreSQL** for persistent data
- ⚡ **Redis** for caching and pub/sub
- ☁️ **AWS S3** for avatar storage
- 📧 **Resend** for email delivery
- 📲 **Melli Payamak** for SMS delivery

### Best Practices
- 🛡️ **Type-safe error handling** with Result type
- 📝 **Structured logging** on every command
- 🚦 **Leaky bucket rate limiter** (Redis-backed)
- 💪 **Graceful shutdown** with cleanup
- 🏥 **Health checks** for all services
- 📖 **OpenAPI documentation**
- 🧪 **Testable design** with dependency injection

## 📋 Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 14+
- Redis 6+
- AWS S3 account (or compatible service)
- Resend API key (for emails)
- Melli Payamak account (for SMS)
- Google OAuth credentials (optional)
- Apple OAuth credentials (optional)

## 🔧 Installation

### 1. Install Dependencies

```bash
npm install
# or
bun install
```

### 2. Configure Environment

Create a `.env` file:

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=30d

# AWS S3
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=myapp-avatars
S3_CDN_URL=https://cdn.example.com

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# OAuth - Apple
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret
APPLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/apple

# PassKey/WebAuthn
PASSKEY_RP_NAME=MyApp
PASSKEY_RP_ID=localhost
PASSKEY_ORIGIN=http://localhost:3000

# Email (Resend)
EMAIL_API_KEY=your-resend-api-key
EMAIL_FROM_EMAIL=noreply@example.com
EMAIL_FROM_NAME=MyApp

# SMS (Melli Payamak)
SMS_USERNAME=your-melli-payamak-username
SMS_PASSWORD=your-melli-payamak-password
SMS_FROM_NUMBER=your-sender-number

# Rate Limiting
RATE_LIMIT_CAPACITY=100
RATE_LIMIT_REFILL_RATE=10
```

### 3. Database Setup

Run migrations:

```bash
psql -U postgres -d myapp -f src/infrastructure/database/migrations/001_create_users_table.sql
psql -U postgres -d myapp -f src/infrastructure/database/migrations/002_create_sessions_table.sql
```

### 4. Start Application

```bash
# Development
npm run dev
# or
bun run dev

# Production
npm run build
npm start
# or
bun start
```

## 📚 API Documentation

Once running, access the OpenAPI documentation at:

```
http://localhost:3000/openapi
```

### Authentication Endpoints

```
POST /api/auth/register/totp         # Register with TOTP
POST /api/auth/register/oauth        # Register with OAuth
POST /api/auth/register/passkey      # Register with PassKey
POST /api/auth/login/totp            # Login with TOTP
POST /api/auth/login/oauth           # Login with OAuth
POST /api/auth/login/passkey         # Login with PassKey
```

### Profile Endpoints (Protected)

```
GET    /api/user/me                  # Get profile
PATCH  /api/user/profile             # Update profile
POST   /api/user/verify/email        # Verify email
POST   /api/user/verify/phone        # Verify phone
```

### Session Endpoints (Protected)

```
GET    /api/sessions                 # List sessions
DELETE /api/sessions/:id             # Revoke session
DELETE /api/sessions                 # Revoke all sessions
```

### Storage Endpoints (Protected)

```
POST   /api/storage/avatar           # Upload avatar
DELETE /api/storage/avatar           # Delete avatar
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## 📁 Project Structure

```
src/
├── domain/                    # Business logic & entities
├── application/               # Use cases & ports
├── infrastructure/            # External adapters
├── interface/                 # HTTP controllers & routes
├── shared/                    # Shared utilities
├── container.ts               # DI container
└── index.ts                   # Entry point
```

## 🔒 Security

- ✅ JWT tokens with signed session IDs
- ✅ Password hashing with bcrypt
- ✅ Rate limiting (leaky bucket algorithm)
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Input validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention

## 🚀 Deployment

### Docker

```bash
docker build -t myapp .
docker run -p 3000:3000 --env-file .env myapp
```

### Docker Compose

```bash
docker-compose up -d
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests.

## 📊 Monitoring

### Health Checks

```
GET /health         # Overall health
GET /health/live    # Liveness probe
GET /health/ready   # Readiness probe
```

### Metrics

```
GET /metrics        # Prometheus metrics
GET /metrics/json   # JSON metrics
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Hexagonal Architecture by Alistair Cockburn
- Domain-Driven Design by Eric Evans
- Clean Architecture by Robert C. Martin
- Functional Programming principles

## 📞 Support

For questions and support:
- 📧 Email: support@example.com
- 💬 Discord: https://discord.gg/example
- 📖 Documentation: https://docs.example.com

---

Built with ❤️ using TypeScript, Elysia, and Bun

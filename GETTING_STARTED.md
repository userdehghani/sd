# Getting Started Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** or **Bun** (recommended)
- **PostgreSQL 14+**
- **Redis 6+**
- **Git**

## Step 1: Clone or Review the Project

If you haven't already, navigate to the project directory:

```bash
cd /workspace
```

## Step 2: Install Dependencies

Using Bun (recommended):
```bash
bun install
```

Or using npm:
```bash
npm install
```

## Step 3: Setup Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Minimum required for local development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-jwt-key-change-this-minimum-32-characters
```

## Step 4: Setup Database

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE myapp;

# Exit psql
\q
```

### Run Migrations

```bash
# Run user table migration
psql -U postgres -d myapp -f src/infrastructure/database/migrations/001_create_users_table.sql

# Run session table migration
psql -U postgres -d myapp -f src/infrastructure/database/migrations/002_create_sessions_table.sql
```

Verify tables were created:
```bash
psql -U postgres -d myapp -c "\dt"
```

You should see:
```
         List of relations
 Schema |   Name   | Type  |  Owner   
--------+----------+-------+----------
 public | sessions | table | postgres
 public | users    | table | postgres
```

## Step 5: Start Redis

Make sure Redis is running:

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis
# On Linux:
sudo systemctl start redis

# On macOS with Homebrew:
brew services start redis

# Or run Redis in foreground:
redis-server
```

## Step 6: Start the Application

### Development Mode (with hot reload)

Using Bun:
```bash
bun run dev
```

Or using npm:
```bash
npm run dev
```

### Production Mode

```bash
# Build
bun run build
# or
npm run build

# Start
bun start
# or
npm start
```

## Step 7: Verify Installation

### Check Server is Running

You should see output like:
```
✅ Container initialized
✅ Routes registered
🚀 Server running at http://localhost:3000/
📚 API documentation at http://localhost:3000/openapi
📊 Metrics endpoint at http://localhost:3000/metrics
💚 Health check at http://localhost:3000/health
```

### Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "infrastructure": {
    "postgres": "healthy",
    "redis": "healthy",
    "s3": "healthy"
  }
}
```

### Access API Documentation

Open your browser and navigate to:
```
http://localhost:3000/openapi
```

You'll see the complete OpenAPI/Swagger documentation for all endpoints.

## Step 8: Test the API

### Register a User with TOTP

```bash
curl -X POST http://localhost:3000/api/auth/register/totp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Response:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["ABCD1234", "EFGH5678", ...]
}
```

### Login with TOTP

First, generate a TOTP code using the secret (use Google Authenticator app or a TOTP library).

```bash
curl -X POST http://localhost:3000/api/auth/login/totp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "totpToken": "123456"
  }'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "test@example.com"
  },
  "session": {
    "id": "session-uuid",
    "expiresAt": "2024-02-01T00:00:00Z"
  }
}
```

### Get User Profile (Protected)

```bash
curl http://localhost:3000/api/user/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Response:
```json
{
  "id": "uuid",
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe",
  "isEmailVerified": false,
  "isPhoneVerified": false,
  "authProviders": ["TOTP"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Step 9: Run Tests

```bash
# Run all tests
bun test
# or
npm test

# Run specific test suites
bun test:unit
bun test:integration

# Run with coverage
bun test:coverage
```

## Step 10: View Metrics and Logs

### Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

### JSON Metrics

```bash
curl http://localhost:3000/metrics/json
```

### Logs

Logs are output to stdout in JSON format. Watch them in real-time:

```bash
# If using npm run dev
# Logs will appear in your terminal

# If running in production mode
pm2 logs
# or
docker logs <container-name>
```

## Common Issues & Solutions

### Issue: Database Connection Error

**Error:** `Failed to connect to PostgreSQL`

**Solution:**
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify credentials in `.env`
3. Ensure database exists: `psql -U postgres -l`
4. Check PostgreSQL logs: `sudo journalctl -u postgresql`

### Issue: Redis Connection Error

**Error:** `Failed to connect to Redis`

**Solution:**
1. Check Redis is running: `redis-cli ping`
2. Verify Redis host/port in `.env`
3. Check Redis logs: `redis-cli info`

### Issue: Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
1. Change port in `.env`: `PORT=3001`
2. Or kill the process using port 3000:
   ```bash
   # Find process
   lsof -i :3000
   # Kill process
   kill -9 <PID>
   ```

### Issue: JWT Token Invalid

**Error:** `Invalid token`

**Solution:**
1. Ensure JWT_SECRET is set in `.env`
2. Token may have expired - login again
3. Check token format: `Bearer <token>`

## Next Steps

Now that your application is running:

1. 📖 Read the [Architecture Documentation](./ARCHITECTURE.md)
2. 🔌 Review the [API Guide](./docs/API_GUIDE.md)
3. 🚀 Check the [Deployment Guide](./docs/DEPLOYMENT.md)
4. 🧪 Explore the test files in `tests/`
5. 🎯 Start customizing for your needs!

## Quick Command Reference

```bash
# Development
bun run dev              # Start with hot reload
bun test                 # Run tests
bun test:coverage        # Run tests with coverage

# Production
bun run build            # Build for production
bun start                # Start production server

# Database
psql -U postgres -d myapp -f migrations/001_create_users_table.sql
psql -U postgres -d myapp -f migrations/002_create_sessions_table.sql

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # View logs

# Health checks
curl http://localhost:3000/health
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

## Support

If you encounter any issues:

1. Check the logs for detailed error messages
2. Review the documentation in `/docs`
3. Verify all environment variables are set correctly
4. Ensure all required services (PostgreSQL, Redis) are running

---

**Happy coding! 🚀**

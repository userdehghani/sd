# API Guide

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### Register with TOTP

```http
POST /api/auth/register/totp
Content-Type: application/json

{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": [
    "ABCD1234",
    "EFGH5678",
    ...
  ]
}
```

#### Register with OAuth

```http
POST /api/auth/register/oauth
Content-Type: application/json

{
  "provider": "GOOGLE",
  "code": "oauth-authorization-code"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Login with TOTP

```http
POST /api/auth/login/totp
Content-Type: application/json

{
  "email": "user@example.com",
  "totpToken": "123456"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "id": "session-uuid",
    "expiresAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Login with OAuth

```http
POST /api/auth/login/oauth
Content-Type: application/json

{
  "provider": "GOOGLE",
  "code": "oauth-authorization-code"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "id": "session-uuid",
    "expiresAt": "2024-01-01T00:00:00Z"
  }
}
```

### Profile (Protected)

#### Get Profile

```http
GET /api/user/me
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "phone": "+989123456789",
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe",
  "avatarUrl": "https://cdn.example.com/avatars/...",
  "isEmailVerified": true,
  "isPhoneVerified": false,
  "authProviders": ["TOTP", "GOOGLE"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Update Profile

```http
PATCH /api/user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+989123456789"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "fullName": "Jane Smith",
  ...
}
```

#### Verify Email

```http
POST /api/user/verify/email
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "message": "Email verified successfully"
}
```

#### Verify Phone

```http
POST /api/user/verify/phone
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "message": "Phone verified successfully"
}
```

### Sessions (Protected)

#### List Sessions

```http
GET /api/sessions
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "userId": "user-uuid",
      "deviceInfo": {
        "userAgent": "Mozilla/5.0...",
        "ipAddress": "192.168.1.1",
        "deviceType": "desktop"
      },
      "isRevoked": false,
      "expiresAt": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "activeCount": 3,
  "totalCount": 5
}
```

#### Revoke Session

```http
DELETE /api/sessions/:sessionId
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Session revoked successfully"
}
```

#### Revoke All Sessions

```http
DELETE /api/sessions
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "All sessions revoked successfully",
  "revokedCount": 3
}
```

### Storage (Protected)

#### Upload Avatar

```http
POST /api/storage/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary-image-data>
```

**Response (200 OK):**
```json
{
  "url": "https://cdn.example.com/avatars/user-uuid-timestamp.jpg",
  "size": 123456,
  "mimeType": "image/jpeg"
}
```

#### Delete Avatar

```http
DELETE /api/storage/avatar
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Avatar deleted successfully"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `INVALID_CREDENTIALS` (401) - Invalid login credentials
- `INVALID_TOKEN` (401) - Invalid or malformed JWT token
- `TOKEN_EXPIRED` (401) - JWT token has expired
- `UNAUTHORIZED` (401) - Not authenticated
- `FORBIDDEN` (403) - Not authorized for this action
- `NOT_FOUND` (404) - Resource not found
- `USER_NOT_FOUND` (404) - User doesn't exist
- `VALIDATION_ERROR` (400) - Invalid input data
- `EMAIL_ALREADY_EXISTS` (400) - Email already registered
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INTERNAL_ERROR` (500) - Server error

## Rate Limiting

All endpoints are rate-limited using a leaky bucket algorithm:

- **Capacity**: 100 requests
- **Refill Rate**: 10 requests per second

When rate limited, you'll receive a `429 Too Many Requests` response.

## CORS

CORS is enabled for all origins in development. Configure appropriately for production.

## Health Checks

```http
GET /health           # Overall health
GET /health/live      # Liveness probe
GET /health/ready     # Readiness probe
```

## Metrics

```http
GET /metrics          # Prometheus format
GET /metrics/json     # JSON format
```

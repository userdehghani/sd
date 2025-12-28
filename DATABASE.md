# Database Schema

## PostgreSQL Tables

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_at TIMESTAMPTZ,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    avatar_key VARCHAR(255),
    avatar_size INTEGER,
    avatar_mime_type VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    totp_enabled BOOLEAN DEFAULT FALSE,
    totp_secret VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### auth_providers
```sql
CREATE TABLE auth_providers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    UNIQUE(type, provider_id)
);

CREATE INDEX idx_auth_providers_user_id ON auth_providers(user_id);
CREATE INDEX idx_auth_providers_type_provider ON auth_providers(type, provider_id);
```

### passkey_credentials
```sql
CREATE TABLE passkey_credentials (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    device_type VARCHAR(50) NOT NULL,
    backed_up BOOLEAN DEFAULT FALSE,
    transports JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
```

### sessions
```sql
CREATE TABLE sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    user_agent TEXT NOT NULL,
    ip VARCHAR(45) NOT NULL,
    browser VARCHAR(100),
    os VARCHAR(100),
    device VARCHAR(100),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    location_timezone VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    metadata JSONB
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Redis Keys

### Session Cache
- `session:valid:{sessionId}` - Boolean, TTL 5 minutes
- `session:{sessionId}` - Session data cache

### Rate Limiting
- `ratelimit:{ip}` - Leaky bucket state

### Authentication Flow
- `pending_registration:{userId}` - Pending TOTP registration
- `passkey_registration:{userId}` - Pending passkey registration
- `login_attempt:{loginToken}` - TOTP login attempt
- `passkey_auth:{loginToken}` - Passkey authentication challenge
- `oauth_state:{state}` - OAuth state for CSRF protection
- `oauth_state:apple:{state}` - Apple OAuth state

### Verification
- `email_verification:{userId}` - Email verification code
- `phone_verification:{userId}` - Phone verification code

### Pub/Sub Channels
- `user:created` - New user created
- `user:updated` - User updated
- `session:created` - New session created
- `session:revoked` - Session revoked

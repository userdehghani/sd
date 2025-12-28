-- Create sessions table

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  device_type VARCHAR(20),
  is_revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_is_revoked ON sessions(is_revoked);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

-- Add comments
COMMENT ON TABLE sessions IS 'User authentication sessions';
COMMENT ON COLUMN sessions.device_type IS 'Device type (mobile, tablet, desktop)';

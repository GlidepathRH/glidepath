CREATE TABLE IF NOT EXISTS api_auth_rate_limits (
  client_ip INET PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  failure_count INTEGER NOT NULL CHECK (failure_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_auth_rate_limits_window_idx
  ON api_auth_rate_limits (window_started_at);

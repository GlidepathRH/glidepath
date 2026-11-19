CREATE TABLE IF NOT EXISTS api_client_rate_limits (
  client_ip INET PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_client_rate_limits_window_idx
  ON api_client_rate_limits (window_started_at);

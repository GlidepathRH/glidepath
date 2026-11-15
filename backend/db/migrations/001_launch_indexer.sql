CREATE TABLE IF NOT EXISTS chain_indexer_state (
  chain_id INTEGER NOT NULL,
  indexer_name TEXT NOT NULL,
  next_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, indexer_name)
);

CREATE TABLE IF NOT EXISTS launches (
  chain_id INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  pool_id TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_decimals SMALLINT NOT NULL,
  total_supply NUMERIC(78, 0) NOT NULL,
  liquidity_token_amount NUMERIC(78, 0) NOT NULL,
  liquidity_quote_amount NUMERIC(78, 0) NOT NULL,
  creator_first_buy_token_amount NUMERIC(78, 0) NOT NULL,
  creator_first_buy_quote_amount NUMERIC(78, 0) NOT NULL,
  sqrt_price_x96 NUMERIC(78, 0) NOT NULL,
  trading_opens_at BIGINT NOT NULL,
  buy_path JSONB NOT NULL,
  sell_path JSONB NOT NULL,
  creator_buy_ceiling_pips INTEGER NOT NULL,
  creator_sell_ceiling_pips INTEGER NOT NULL,
  snipe_config JSONB NOT NULL,
  snipe_ended BOOLEAN NOT NULL,
  payout_recipients JSONB NOT NULL,
  payout_weights_bps JSONB NOT NULL,
  launch_block_number BIGINT NOT NULL,
  launch_block_timestamp BIGINT NOT NULL,
  launch_transaction_hash TEXT NOT NULL,
  launch_log_index INTEGER NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address),
  UNIQUE (chain_id, pool_id),
  UNIQUE (chain_id, launch_transaction_hash, launch_log_index)
);

CREATE INDEX IF NOT EXISTS launches_latest_idx
  ON launches (chain_id, launch_block_number DESC, launch_log_index DESC);

CREATE INDEX IF NOT EXISTS launches_creator_idx
  ON launches (chain_id, creator_address, launch_block_number DESC);

CREATE TABLE IF NOT EXISTS launch_events (
  chain_id INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp BIGINT NOT NULL,
  contract_address TEXT NOT NULL,
  event_name TEXT NOT NULL,
  pool_id TEXT,
  token_address TEXT,
  args JSONB NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS launch_events_pool_idx
  ON launch_events (chain_id, pool_id, block_number DESC, log_index DESC);

CREATE INDEX IF NOT EXISTS launch_events_token_idx
  ON launch_events (chain_id, token_address, block_number DESC, log_index DESC)
  WHERE token_address IS NOT NULL;

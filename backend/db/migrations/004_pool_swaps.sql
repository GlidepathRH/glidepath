CREATE TABLE IF NOT EXISTS pool_swap_indexer_state (
  chain_id INTEGER NOT NULL,
  pool_id TEXT NOT NULL,
  next_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, pool_id)
);

CREATE TABLE IF NOT EXISTS pool_swaps (
  chain_id INTEGER NOT NULL,
  pool_id TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp BIGINT NOT NULL,
  amount0 NUMERIC(78, 0) NOT NULL,
  amount1 NUMERIC(78, 0) NOT NULL,
  sqrt_price_x96 NUMERIC(78, 0) NOT NULL,
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS pool_swaps_chart_idx
  ON pool_swaps (chain_id, pool_id, block_timestamp, block_number, log_index);

CREATE TABLE IF NOT EXISTS launch_token_images (
  chain_id INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address),
  UNIQUE (chain_id, transaction_hash)
);

CREATE INDEX IF NOT EXISTS launch_token_images_creator_idx
  ON launch_token_images (chain_id, creator_address, created_at DESC);

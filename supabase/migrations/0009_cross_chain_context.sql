CREATE TABLE IF NOT EXISTS cross_chain_context (
  wallet_address TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS cross_chain_context_wallet_lower_idx
  ON cross_chain_context (LOWER(wallet_address));

CREATE INDEX IF NOT EXISTS cross_chain_context_expires_idx
  ON cross_chain_context (expires_at);

CREATE TABLE IF NOT EXISTS wallet_identity_estimations (
  wallet_address TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_identity_estimations_updated_idx
  ON wallet_identity_estimations (updated_at DESC);

CREATE TABLE IF NOT EXISTS wallet_transaction_samples (
  wallet_address TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_transaction_samples_updated_idx
  ON wallet_transaction_samples (updated_at DESC);

CREATE TABLE IF NOT EXISTS trust_snapshots (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  report_hash TEXT NOT NULL,
  risk_score INTEGER,
  risk_tier TEXT NOT NULL,
  confidence TEXT NOT NULL,
  attestation_status TEXT NOT NULL DEFAULT 'not_published',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS trust_snapshots_wallet_created_idx
  ON trust_snapshots (LOWER(wallet_address), created_at DESC);

CREATE INDEX IF NOT EXISTS trust_snapshots_report_hash_idx
  ON trust_snapshots (report_hash);

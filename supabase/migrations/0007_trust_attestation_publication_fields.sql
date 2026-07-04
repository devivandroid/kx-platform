ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS attestation_tx_hash TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS attestation_registry_address TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

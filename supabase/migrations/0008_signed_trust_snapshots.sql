ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS schema_version TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS engine_version TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signer_address TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signing_algorithm TEXT;
ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

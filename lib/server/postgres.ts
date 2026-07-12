import { Pool, type QueryResultRow } from "pg";

const globalForPostgres = globalThis as typeof globalThis & {
  knowledgeExchangePgPool?: Pool;
  knowledgeExchangePgSchemaReady?: Promise<void>;
};

export function isPostgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  try {
    new URL(databaseUrl);
  } catch {
    throw new Error(
      `DATABASE_URL is invalid. Length=${databaseUrl.length}. Make sure special password characters are URL-encoded.`
    );
  }

  if (!globalForPostgres.knowledgeExchangePgPool) {
    globalForPostgres.knowledgeExchangePgPool = new Pool({
      connectionString: databaseUrl,
      ssl:
        databaseUrl.includes("localhost") ||
        databaseUrl.includes("127.0.0.1")
          ? undefined
          : { rejectUnauthorized: false }
    });
  }

  return globalForPostgres.knowledgeExchangePgPool;
}

export async function ensurePostgresSchema(): Promise<void> {
  if (!isPostgresEnabled()) return;

  if (!globalForPostgres.knowledgeExchangePgSchemaReady) {
    globalForPostgres.knowledgeExchangePgSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS resources (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          arc_job_id TEXT,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS purchase_receipts (
          tx_hash TEXT PRIMARY KEY,
          resource_id TEXT NOT NULL,
          buyer_address TEXT NOT NULL,
          seller_address TEXT NOT NULL,
          amount_usdc TEXT NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS risk_events (
          id TEXT PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          event_type TEXT NOT NULL,
          data JSONB NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS participants (
          wallet_address TEXT PRIMARY KEY,
          user_type TEXT,
          entity_type TEXT,
          participant_type TEXT,
          participant_name TEXT,
          operator_address TEXT,
          arc_identity_id TEXT,
          identity_source TEXT,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS resource_ratings (
          resource_id TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ,
          PRIMARY KEY (resource_id, wallet_address)
        );

        CREATE TABLE IF NOT EXISTS resource_files (
          resource_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes BIGINT NOT NULL,
          checksum TEXT,
          storage_provider TEXT NOT NULL DEFAULT 'local',
          storage_key TEXT NOT NULL,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (resource_id, filename)
        );

        CREATE TABLE IF NOT EXISTS arc_network_snapshots (
          wallet_address TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          from_block BIGINT NOT NULL,
          to_block BIGINT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS wallet_identity_estimations (
          wallet_address TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS wallet_transaction_samples (
          wallet_address TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS trust_snapshots (
          id TEXT PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          report_hash TEXT NOT NULL,
          risk_score INTEGER,
          risk_tier TEXT NOT NULL,
          confidence TEXT NOT NULL,
          schema_version TEXT,
          engine_version TEXT,
          signature TEXT,
          signer_address TEXT,
          signing_algorithm TEXT,
          signed_at TIMESTAMPTZ,
          attestation_status TEXT NOT NULL DEFAULT 'not_published',
          attestation_tx_hash TEXT,
          attestation_registry_address TEXT,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          published_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS cross_chain_context (
          wallet_address TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );

        CREATE INDEX IF NOT EXISTS resources_created_at_idx ON resources (created_at DESC);
        CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);
        CREATE INDEX IF NOT EXISTS risk_events_wallet_idx ON risk_events (LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS risk_events_occurred_at_idx ON risk_events (occurred_at DESC);
        CREATE INDEX IF NOT EXISTS resource_ratings_resource_idx ON resource_ratings (resource_id);
        CREATE INDEX IF NOT EXISTS resource_files_resource_idx ON resource_files (resource_id);
        CREATE INDEX IF NOT EXISTS arc_network_snapshots_updated_idx ON arc_network_snapshots (updated_at DESC);
        CREATE INDEX IF NOT EXISTS arc_network_snapshots_wallet_lower_idx ON arc_network_snapshots (LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS wallet_identity_estimations_updated_idx ON wallet_identity_estimations (updated_at DESC);
        CREATE INDEX IF NOT EXISTS wallet_identity_estimations_wallet_lower_idx ON wallet_identity_estimations (LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS wallet_transaction_samples_updated_idx ON wallet_transaction_samples (updated_at DESC);
        CREATE INDEX IF NOT EXISTS wallet_transaction_samples_wallet_lower_idx ON wallet_transaction_samples (LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS trust_snapshots_wallet_created_idx ON trust_snapshots (LOWER(wallet_address), created_at DESC);
        CREATE INDEX IF NOT EXISTS trust_snapshots_report_hash_idx ON trust_snapshots (report_hash);
        CREATE INDEX IF NOT EXISTS cross_chain_context_wallet_lower_idx ON cross_chain_context (LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS cross_chain_context_expires_idx ON cross_chain_context (expires_at);
        DELETE FROM cross_chain_context
        WHERE data->>'schemaVersion' IS DISTINCT FROM 'kx.cross-chain-context.v2'
           OR data::text ILIKE '%polygon%';
      `);
      await pool.query(`
        ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_type TEXT;
        ALTER TABLE participants ADD COLUMN IF NOT EXISTS entity_type TEXT;
        ALTER TABLE participants ADD COLUMN IF NOT EXISTS arc_identity_id TEXT;
        ALTER TABLE participants ADD COLUMN IF NOT EXISTS identity_source TEXT;
        ALTER TABLE requests ADD COLUMN IF NOT EXISTS arc_job_id TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS attestation_tx_hash TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS attestation_registry_address TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS schema_version TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS engine_version TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signature TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signer_address TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signing_algorithm TEXT;
        ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS requests_arc_job_id_idx ON requests (arc_job_id);
        CREATE TABLE IF NOT EXISTS cross_chain_context (
          wallet_address TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS cross_chain_context_wallet_lower_idx ON cross_chain_context (LOWER(wallet_address));
        CREATE INDEX IF NOT EXISTS cross_chain_context_expires_idx ON cross_chain_context (expires_at);
      `);
    })();
  }

  await globalForPostgres.knowledgeExchangePgSchemaReady;
}

export async function pgQuery<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<T[]> {
  try {
    await ensurePostgresSchema();
    const result = await getPool().query<T>(text, values);
    return result.rows;
  } catch {
    globalForPostgres.knowledgeExchangePgSchemaReady = undefined;
    return [];
  }
}

export async function upsertParticipant(input: {
  walletAddress?: string | null;
  participantType?: string | null;
  userType?: string | null;
  entityType?: string | null;
  participantName?: string | null;
  operatorAddress?: string | null;
  arcIdentityId?: string | null;
  identitySource?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!isPostgresEnabled() || !input.walletAddress) return;

  await pgQuery(
    `
      INSERT INTO participants (
        wallet_address,
        user_type,
        entity_type,
        participant_type,
        participant_name,
        operator_address,
        arc_identity_id,
        identity_source,
        data,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        user_type = COALESCE(EXCLUDED.user_type, participants.user_type),
        entity_type = COALESCE(EXCLUDED.entity_type, participants.entity_type),
        participant_type = COALESCE(EXCLUDED.participant_type, participants.participant_type),
        participant_name = COALESCE(EXCLUDED.participant_name, participants.participant_name),
        operator_address = COALESCE(EXCLUDED.operator_address, participants.operator_address),
        arc_identity_id = COALESCE(EXCLUDED.arc_identity_id, participants.arc_identity_id),
        identity_source = COALESCE(EXCLUDED.identity_source, participants.identity_source),
        data = participants.data || EXCLUDED.data,
        updated_at = NOW()
    `,
    [
      input.walletAddress,
      input.userType ?? null,
      input.entityType ?? null,
      input.participantType ?? null,
      input.participantName ?? null,
      input.operatorAddress ?? null,
      input.arcIdentityId ?? null,
      input.identitySource ?? null,
      JSON.stringify(input.data ?? {})
    ]
  );
}

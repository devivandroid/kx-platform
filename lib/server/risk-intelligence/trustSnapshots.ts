import { createHash, randomUUID } from "crypto";
import { Contract, JsonRpcProvider, Wallet, isAddress } from "ethers";
import { isPostgresEnabled, pgQuery } from "@/lib/server/postgres";
import type {
  OnChainTrustAttestation,
  RiskProfile,
  TrustAttestationStatus,
  TrustSnapshot
} from "@/lib/server/risk-intelligence/types";
import {
  getTrustSnapshotCanonicalPayload,
  getTrustSnapshotReportHash,
  trustSnapshotSchemaVersion,
  trustSnapshotSigningAlgorithm,
  verifyTrustSnapshot
} from "@/lib/trust-snapshots/canonical";

export const trustEngineVersion = "kx-trust-engine-v0.1";
const snapshotTtlDays = 30;
const minimumEvidenceForEligibility = 20;
const minimumHistoryForEligibility = 2;
const recentEligibleWindowHours = 24;

type TrustSnapshotRow = {
  data: TrustSnapshot;
};

type TrustSnapshotPublishResult =
  | {
      ok: true;
      snapshot: TrustSnapshot;
      attestation: OnChainTrustAttestation;
      txHash: string;
      explorerUrl: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      message: string;
    };

const trustAttestationRegistryAbi = [
  {
    type: "function",
    name: "publishAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "reportHash", type: "bytes32" },
      { name: "riskTier", type: "string" },
      { name: "humanProbability", type: "uint8" },
      { name: "confidence", type: "string" },
      { name: "engineVersion", type: "string" },
      { name: "evidenceURI", type: "string" }
    ],
    outputs: [{ name: "attestationId", type: "uint256" }]
  },
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "attestationId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "reportHash", type: "bytes32" },
          { name: "riskTier", type: "string" },
          { name: "humanProbability", type: "uint8" },
          { name: "confidence", type: "string" },
          { name: "engineVersion", type: "string" },
          { name: "evidenceURI", type: "string" },
          { name: "timestamp", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getWalletAttestations",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "reportHash", type: "bytes32" },
          { name: "riskTier", type: "string" },
          { name: "humanProbability", type: "uint8" },
          { name: "confidence", type: "string" },
          { name: "engineVersion", type: "string" },
          { name: "evidenceURI", type: "string" },
          { name: "timestamp", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getLatestAttestation",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "reportHash", type: "bytes32" },
          { name: "riskTier", type: "string" },
          { name: "humanProbability", type: "uint8" },
          { name: "confidence", type: "string" },
          { name: "engineVersion", type: "string" },
          { name: "evidenceURI", type: "string" },
          { name: "timestamp", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "event",
    name: "TrustAttestationPublished",
    inputs: [
      { name: "attestationId", type: "uint256", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "reportHash", type: "bytes32", indexed: true },
      { name: "riskTier", type: "string", indexed: false },
      { name: "humanProbability", type: "uint8", indexed: false },
      { name: "confidence", type: "string", indexed: false },
      { name: "engineVersion", type: "string", indexed: false },
      { name: "evidenceURI", type: "string", indexed: false }
    ],
    anonymous: false
  }
] as const;

async function ensureTrustSnapshotTable() {
  if (!isPostgresEnabled()) return;

  await pgQuery(`
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

    CREATE INDEX IF NOT EXISTS trust_snapshots_wallet_created_idx
      ON trust_snapshots (LOWER(wallet_address), created_at DESC);

    CREATE INDEX IF NOT EXISTS trust_snapshots_report_hash_idx
      ON trust_snapshots (report_hash);

    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS attestation_tx_hash TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS attestation_registry_address TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS schema_version TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS engine_version TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signature TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signer_address TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signing_algorithm TEXT;
    ALTER TABLE trust_snapshots ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
  `);
}

function getSignalsSummary(profile: RiskProfile): string[] {
  const behavioral = profile.behavioralSignals
    .slice(0, 4)
    .map((signal) => `${signal.label}: ${signal.status}`);
  const identity = profile.identityEstimation?.signals
    .filter((signal) => signal.result !== "Unknown")
    .slice(0, 4)
    .map((signal) => `${signal.label}: ${signal.result}`) ?? [];

  return [...behavioral, ...identity].slice(0, 8);
}

async function getWalletSnapshotStats(wallet: string) {
  if (!isPostgresEnabled()) {
    return { historyCount: 0, hasRecentEligible: false };
  }

  try {
    await ensureTrustSnapshotTable();
    const rows = await pgQuery<{ history_count: string; recent_eligible_count: string }>(
      `
        SELECT
          COUNT(*)::text AS history_count,
          COUNT(*) FILTER (
            WHERE attestation_status = 'eligible'
              AND created_at > NOW() - ($2::int * INTERVAL '1 hour')
          )::text AS recent_eligible_count
        FROM trust_snapshots
        WHERE LOWER(wallet_address) = LOWER($1)
      `,
      [wallet, recentEligibleWindowHours]
    );
    return {
      historyCount: Number(rows[0]?.history_count ?? 0),
      hasRecentEligible: Number(rows[0]?.recent_eligible_count ?? 0) > 0
    };
  } catch {
    return { historyCount: 0, hasRecentEligible: false };
  }
}

function getAttestationEligibility(
  profile: RiskProfile,
  stats: { historyCount: number; hasRecentEligible: boolean }
): { status: TrustAttestationStatus; reason: string } {
  const evidenceCount = profile.activity.evidenceCount;
  const trustScore = profile.scores.trustScore ?? profile.scores.financialBehaviorScore ?? 0;
  const riskScore = profile.scores.riskScore ?? 100;

  if (profile.scores.confidenceLevel !== "High") {
    return {
      status: "not_published",
      reason: "Confidence below publication threshold."
    };
  }
  if (evidenceCount < minimumEvidenceForEligibility) {
    return {
      status: "not_published",
      reason: "Insufficient evidence for publication."
    };
  }
  if (riskScore > 25 || trustScore < 70) {
    return {
      status: "not_published",
      reason: "Policy threshold not met for publication."
    };
  }
  if (stats.historyCount < minimumHistoryForEligibility) {
    return {
      status: "not_published",
      reason: "Policy threshold not met: more snapshot history is required."
    };
  }
  if (stats.hasRecentEligible) {
    return {
      status: "skipped",
      reason: "Duplicate recent attestation avoided."
    };
  }
  return {
    status: "eligible",
    reason: "Publication policy threshold met."
  };
}

export async function createAndStoreTrustSnapshot(profile: RiskProfile): Promise<TrustSnapshot> {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + snapshotTtlDays * 24 * 60 * 60 * 1000).toISOString();
  const stats = await getWalletSnapshotStats(profile.wallet);
  const eligibility = getAttestationEligibility(profile, stats);
  const baseSnapshot = {
    id: randomUUID(),
    wallet: profile.wallet,
    riskScore: profile.scores.riskScore,
    trustScore: profile.scores.trustScore ?? profile.scores.financialBehaviorScore,
    riskTier: profile.scores.riskTier,
    humanAgentEstimation: profile.identityEstimation?.estimatedUserType,
    humanProbability: profile.identityEstimation?.probability ?? null,
    confidence: profile.scores.confidenceLevel,
    publicationEligibilityReason: eligibility.reason,
    evidenceSource: profile.dataSource ?? "knowledge_exchange",
    signalsSummary: getSignalsSummary(profile),
    schemaVersion: trustSnapshotSchemaVersion,
    engineVersion: trustEngineVersion,
    createdAt,
    expiresAt,
    arcIdentityId: profile.participant.arcIdentityId ?? null,
    arcJobId: null,
  };
  const signedPayload = getTrustSnapshotCanonicalPayload(baseSnapshot);
  const reportHash = getTrustSnapshotReportHash(baseSnapshot);
  const signature = await signTrustSnapshotReportHash(reportHash);
  const snapshot: TrustSnapshot = {
    ...baseSnapshot,
    reportHash,
    signedPayload,
    signature: signature.signature,
    signerAddress: signature.signerAddress,
    signingAlgorithm: trustSnapshotSigningAlgorithm,
    signedAt: signature.signedAt,
    signatureStatus: signature.signature
      ? verifyTrustSnapshot({
          ...baseSnapshot,
          reportHash,
          signedPayload,
          signature: signature.signature,
          signerAddress: signature.signerAddress
        })
        ? "verified"
        : "invalid"
      : signature.signatureStatus,
    attestationTxHash: null,
    attestationRegistryAddress: null,
    attestationStatus: eligibility.status,
    publishedAt: null,
    revokedAt: null,
    revocationReason: null
  };

  if (!isPostgresEnabled()) return snapshot;

  try {
    await ensureTrustSnapshotTable();
    await pgQuery(
      `
        INSERT INTO trust_snapshots (
          id,
          wallet_address,
          report_hash,
          risk_score,
          risk_tier,
          confidence,
          schema_version,
          engine_version,
          signature,
          signer_address,
          signing_algorithm,
          signed_at,
          attestation_status,
          data,
          created_at,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13, $14::jsonb, $15::timestamptz, $16::timestamptz)
      `,
      [
        snapshot.id,
        snapshot.wallet,
        snapshot.reportHash,
        snapshot.riskScore,
        snapshot.riskTier,
        snapshot.confidence,
        snapshot.schemaVersion,
        snapshot.engineVersion,
        snapshot.signature,
        snapshot.signerAddress,
        snapshot.signingAlgorithm,
        snapshot.signedAt,
        snapshot.attestationStatus,
        JSON.stringify(snapshot),
        snapshot.createdAt,
        snapshot.expiresAt
      ]
    );
  } catch {
    // Trust Snapshots are additive evidence. Risk profiles can still be returned if persistence fails.
  }

  return snapshot;
}

export async function getLatestTrustSnapshot(wallet: string): Promise<TrustSnapshot | null> {
  const snapshots = await listTrustSnapshots(wallet, 1);
  return snapshots[0] ?? null;
}

export async function listTrustSnapshots(wallet: string, limit = 25): Promise<TrustSnapshot[]> {
  if (!isPostgresEnabled()) return [];

  try {
    await ensureTrustSnapshotTable();
    const rows = await pgQuery<TrustSnapshotRow>(
      `
        SELECT data
        FROM trust_snapshots
        WHERE LOWER(wallet_address) = LOWER($1)
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [wallet, Math.max(1, Math.min(limit, 100))]
    );
    return rows.map((row) => row.data);
  } catch {
    return [];
  }
}

async function getTrustSnapshotById(wallet: string, snapshotId: string): Promise<TrustSnapshot | null> {
  if (!isPostgresEnabled()) return null;

  try {
    await ensureTrustSnapshotTable();
    const rows = await pgQuery<TrustSnapshotRow>(
      `
        SELECT data
        FROM trust_snapshots
        WHERE LOWER(wallet_address) = LOWER($1)
          AND id = $2
        LIMIT 1
      `,
      [wallet, snapshotId]
    );
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

async function getLatestEligibleTrustSnapshot(wallet: string): Promise<TrustSnapshot | null> {
  if (!isPostgresEnabled()) return null;

  try {
    await ensureTrustSnapshotTable();
    const rows = await pgQuery<TrustSnapshotRow>(
      `
        SELECT data
        FROM trust_snapshots
        WHERE LOWER(wallet_address) = LOWER($1)
          AND attestation_status = 'eligible'
          AND attestation_tx_hash IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [wallet]
    );
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

function normalizePublisherPrivateKey(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  const prefixedValue = trimmedValue?.startsWith("0x")
    ? trimmedValue
    : `0x${trimmedValue ?? ""}`;

  return /^0x[0-9a-fA-F]{64}$/.test(prefixedValue) ? prefixedValue : null;
}

async function signTrustSnapshotReportHash(reportHash: string): Promise<{
  signature: string | null;
  signerAddress: string | null;
  signedAt: string | null;
  signatureStatus: "verified" | "unsigned" | "not_configured" | "invalid";
}> {
  const publisherPrivateKey = normalizePublisherPrivateKey(
    process.env.KX_ATTESTATION_PUBLISHER_PRIVATE_KEY
  );

  if (!publisherPrivateKey) {
    return {
      signature: null,
      signerAddress: null,
      signedAt: null,
      signatureStatus: "not_configured"
    };
  }

  const signer = new Wallet(publisherPrivateKey);
  const signature = await signer.signMessage(Buffer.from(reportHash.slice(2), "hex"));

  return {
    signature,
    signerAddress: signer.address,
    signedAt: new Date().toISOString(),
    signatureStatus: "verified"
  };
}

function getEvidenceURI(snapshot: TrustSnapshot): string {
  return `kx-trust-snapshot:${snapshot.id}`;
}

function getTestReportHash(snapshot: TrustSnapshot): string {
  return `0x${createHash("sha256")
    .update(`TEST:${snapshot.reportHash}:${Date.now()}`)
    .digest("hex")}`;
}

function getExplorerTxUrl(txHash: string): string | null {
  const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/+$/, "");
  return explorerUrl ? `${explorerUrl}/tx/${txHash}` : null;
}

function getRegistryReadContract(): Contract | null {
  const registryAddress = process.env.KX_ATTESTATION_REGISTRY_ADDRESS?.trim();
  if (!registryAddress || !isAddress(registryAddress)) return null;

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new JsonRpcProvider(rpcUrl);
  return new Contract(registryAddress, trustAttestationRegistryAbi, provider);
}

function normalizeOnChainTrustAttestation(value: unknown): OnChainTrustAttestation {
  const tuple = value as {
    id: bigint;
    wallet: string;
    reportHash: string;
    riskTier: string;
    humanProbability: bigint | number;
    confidence: string;
    engineVersion: string;
    evidenceURI: string;
    timestamp: bigint;
  };
  const timestamp = Number(tuple.timestamp ?? 0n);
  const wallet = tuple.wallet ?? "0x0000000000000000000000000000000000000000";
  const isEmpty =
    timestamp === 0 ||
    wallet.toLowerCase() === "0x0000000000000000000000000000000000000000";

  return {
    id: String(tuple.id ?? 0n),
    wallet,
    reportHash: tuple.reportHash,
    riskTier: tuple.riskTier,
    humanProbability: Number(tuple.humanProbability ?? 0),
    confidence: tuple.confidence,
    engineVersion: tuple.engineVersion,
    evidenceURI: tuple.evidenceURI,
    timestamp: timestamp > 0 ? new Date(timestamp * 1000).toISOString() : "",
    isEmpty
  };
}

async function getStoredAttestationId(
  registry: Contract,
  receipt: { logs?: readonly unknown[] | null }
): Promise<bigint | null> {
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = registry.interface.parseLog(log as { topics: string[]; data: string });
      if (parsed?.name === "TrustAttestationPublished") {
        return parsed.args.attestationId as bigint;
      }
    } catch {
      // Ignore logs from other contracts.
    }
  }

  return null;
}

async function markTrustSnapshotPublished(
  snapshot: TrustSnapshot,
  txHash: string,
  registryAddress: string,
  attestation: OnChainTrustAttestation
): Promise<TrustSnapshot> {
  const publishedAt = new Date().toISOString();
  const publishedSnapshot: TrustSnapshot = {
    ...snapshot,
    attestationStatus: "published",
    attestationTxHash: txHash,
    attestationRegistryAddress: registryAddress,
    publishedAt,
    onChainAttestation: attestation
  };

  await pgQuery(
    `
      UPDATE trust_snapshots
      SET
        attestation_status = 'published',
        attestation_tx_hash = $2,
        attestation_registry_address = $3,
        published_at = $4::timestamptz,
        data = $5::jsonb
      WHERE id = $1
    `,
    [
      snapshot.id,
      txHash,
      registryAddress,
      publishedAt,
      JSON.stringify(publishedSnapshot)
    ]
  );

  return publishedSnapshot;
}

export async function publishEligibleTrustSnapshot(input: {
  wallet: string;
  snapshotId?: string;
  mode?: "eligible" | "test";
}): Promise<TrustSnapshotPublishResult> {
  if (!isAddress(input.wallet)) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_WALLET",
      message: "Provide a valid wallet address."
    };
  }

  if (!isPostgresEnabled()) {
    return {
      ok: false,
      status: 503,
      error: "TRUST_SNAPSHOT_STORAGE_UNAVAILABLE",
      message: "Trust Snapshot persistence is required before publishing attestations."
    };
  }

  const registryAddress = process.env.KX_ATTESTATION_REGISTRY_ADDRESS?.trim();
  if (!registryAddress || !isAddress(registryAddress)) {
    return {
      ok: false,
      status: 503,
      error: "ATTESTATION_REGISTRY_NOT_CONFIGURED",
      message: "KX_ATTESTATION_REGISTRY_ADDRESS is not configured."
    };
  }

  const publisherPrivateKey = normalizePublisherPrivateKey(
    process.env.KX_ATTESTATION_PUBLISHER_PRIVATE_KEY
  );
  if (!publisherPrivateKey) {
    return {
      ok: false,
      status: 503,
      error: "ATTESTATION_PUBLISHER_NOT_CONFIGURED",
      message: "KX_ATTESTATION_PUBLISHER_PRIVATE_KEY is not configured."
    };
  }

  const isTestMode = input.mode === "test";
  const snapshot = input.snapshotId
    ? await getTrustSnapshotById(input.wallet, input.snapshotId)
    : isTestMode
      ? await getLatestTrustSnapshot(input.wallet)
      : await getLatestEligibleTrustSnapshot(input.wallet);

  if (!snapshot) {
    return {
      ok: false,
      status: 404,
      error: isTestMode ? "TRUST_SNAPSHOT_NOT_FOUND" : "ELIGIBLE_SNAPSHOT_NOT_FOUND",
      message: isTestMode
        ? "No Trust Snapshot was found for this wallet. Run Risk Intelligence first."
        : "No eligible Trust Snapshot was found for this wallet."
    };
  }

  if (!isTestMode && (snapshot.attestationStatus === "published" || snapshot.attestationTxHash)) {
    return {
      ok: false,
      status: 409,
      error: "SNAPSHOT_ALREADY_PUBLISHED",
      message: "This Trust Snapshot has already been published."
    };
  }

  if (!isTestMode && snapshot.attestationStatus !== "eligible") {
    return {
      ok: false,
      status: 409,
      error: "SNAPSHOT_NOT_ELIGIBLE",
      message: "Only eligible Trust Snapshots can be published."
    };
  }

  if (!isTestMode && Date.parse(snapshot.expiresAt) <= Date.now()) {
    return {
      ok: false,
      status: 409,
      error: "SNAPSHOT_EXPIRED",
      message: "Expired Trust Snapshots cannot be published."
    };
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new JsonRpcProvider(rpcUrl);
  const publisher = new Wallet(publisherPrivateKey, provider);
  const registry = new Contract(registryAddress, trustAttestationRegistryAbi, publisher);
  const publishedReportHash = isTestMode ? getTestReportHash(snapshot) : snapshot.reportHash;

  try {
    const tx = await registry.publishAttestation(
      snapshot.wallet,
      publishedReportHash,
      snapshot.riskTier,
      Math.max(0, Math.min(100, Math.round(snapshot.humanProbability ?? 0))),
      snapshot.confidence,
      isTestMode ? "Test Attestation - Arc Testnet" : snapshot.engineVersion,
      isTestMode ? `${getEvidenceURI(snapshot)}:test` : getEvidenceURI(snapshot)
    );
    const receipt = await tx.wait();
    const txHash = receipt?.hash ?? tx.hash;
    const attestationId = receipt ? await getStoredAttestationId(registry, receipt) : null;
    const onChainAttestation =
      attestationId === null
        ? normalizeOnChainTrustAttestation(await registry.getLatestAttestation(snapshot.wallet))
        : normalizeOnChainTrustAttestation(await registry.getAttestation(attestationId));
    const publishedSnapshot = await markTrustSnapshotPublished(
      {
        ...snapshot,
        attestationStatus: isTestMode ? "published" : snapshot.attestationStatus
      },
      txHash,
      registryAddress,
      onChainAttestation
    );

    return {
      ok: true,
      snapshot: publishedSnapshot,
      attestation: onChainAttestation,
      txHash,
      explorerUrl: getExplorerTxUrl(txHash)
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "ATTESTATION_PUBLISH_FAILED",
      message: "The Trust Attestation transaction could not be published on Arc Testnet."
    };
  }
}

export async function getOnChainTrustAttestation(
  attestationId: string
): Promise<OnChainTrustAttestation | null> {
  const registry = getRegistryReadContract();
  if (!registry) return null;

  try {
    return normalizeOnChainTrustAttestation(await registry.getAttestation(BigInt(attestationId)));
  } catch {
    return null;
  }
}

export async function getWalletOnChainTrustAttestations(
  wallet: string
): Promise<OnChainTrustAttestation[]> {
  const registry = getRegistryReadContract();
  if (!registry || !isAddress(wallet)) return [];

  try {
    const attestations = (await registry.getWalletAttestations(wallet)) as unknown[];
    return attestations.map(normalizeOnChainTrustAttestation).filter((item) => !item.isEmpty);
  } catch {
    return [];
  }
}

export async function getLatestOnChainTrustAttestation(
  wallet: string
): Promise<OnChainTrustAttestation | null> {
  const registry = getRegistryReadContract();
  if (!registry || !isAddress(wallet)) return null;

  try {
    const attestation = normalizeOnChainTrustAttestation(await registry.getLatestAttestation(wallet));
    return attestation.isEmpty ? null : attestation;
  } catch {
    return null;
  }
}

import { getBytes, sha256, toUtf8Bytes, verifyMessage } from "ethers";

export const trustSnapshotSchemaVersion = "kx.trust-snapshot.v1";
export const trustSnapshotSigningAlgorithm = "EIP-191 personal_sign over reportHash";

export type TrustSnapshotCanonicalInput = {
  wallet: string;
  riskScore?: number | null;
  trustScore?: number | null;
  riskTier: string;
  humanAgentEstimation?: string | null;
  humanProbability?: number | null;
  confidence: string;
  evidenceSource: string;
  signalsSummary: string[];
  schemaVersion?: string;
  engineVersion: string;
  createdAt: string;
  expiresAt: string;
  arcIdentityId?: string | null;
  arcJobId?: string | null;
};

export type TrustSnapshotVerifiable = TrustSnapshotCanonicalInput & {
  reportHash: string;
  signedPayload?: string | null;
  signature?: string | null;
  signerAddress?: string | null;
};

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const fieldValue = (value as Record<string, unknown>)[key];
      if (fieldValue !== undefined) {
        normalized[key] = normalizeValue(fieldValue);
      }
    }
    return normalized;
  }

  return value ?? null;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function getTrustSnapshotPayload(snapshot: TrustSnapshotCanonicalInput) {
  return {
    arcIdentityId: snapshot.arcIdentityId ?? null,
    arcJobId: snapshot.arcJobId ?? null,
    confidence: snapshot.confidence,
    createdAt: snapshot.createdAt,
    engineVersion: snapshot.engineVersion,
    evidenceSource: snapshot.evidenceSource,
    expiresAt: snapshot.expiresAt,
    humanAgentEstimation: snapshot.humanAgentEstimation ?? null,
    humanProbability: snapshot.humanProbability ?? null,
    riskScore: snapshot.riskScore ?? null,
    trustScore: snapshot.trustScore ?? null,
    riskTier: snapshot.riskTier,
    schemaVersion: snapshot.schemaVersion ?? trustSnapshotSchemaVersion,
    signalsSummary: snapshot.signalsSummary,
    wallet: snapshot.wallet.toLowerCase()
  };
}

export function getTrustSnapshotCanonicalPayload(snapshot: TrustSnapshotCanonicalInput): string {
  return stableStringify(getTrustSnapshotPayload(snapshot));
}

export function getTrustSnapshotReportHash(snapshot: TrustSnapshotCanonicalInput): string {
  return sha256(toUtf8Bytes(getTrustSnapshotCanonicalPayload(snapshot)));
}

export function verifyReportHash(snapshot: TrustSnapshotVerifiable): boolean {
  if (!snapshot.reportHash) return false;
  const canonicalPayload =
    snapshot.signedPayload && snapshot.signedPayload.trim().startsWith("{")
      ? snapshot.signedPayload
      : getTrustSnapshotCanonicalPayload(snapshot);

  return sha256(toUtf8Bytes(canonicalPayload)).toLowerCase() === snapshot.reportHash.toLowerCase();
}

export function recoverTrustSnapshotSigner(
  snapshot: Pick<TrustSnapshotVerifiable, "reportHash" | "signature">
): string | null {
  if (!snapshot.reportHash || !snapshot.signature) return null;

  try {
    return verifyMessage(getBytes(snapshot.reportHash), snapshot.signature);
  } catch {
    return null;
  }
}

export function verifyTrustSnapshot(snapshot: TrustSnapshotVerifiable): boolean {
  if (!verifyReportHash(snapshot)) return false;
  if (!snapshot.signature || !snapshot.signerAddress) return false;

  const recovered = recoverTrustSnapshotSigner(snapshot);
  return recovered?.toLowerCase() === snapshot.signerAddress.toLowerCase();
}

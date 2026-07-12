import { isAddress } from "ethers";
import { isPostgresEnabled, pgQuery } from "@/lib/server/postgres";
import type { TrustSnapshot } from "@/lib/server/risk-intelligence/types";

export type TrustBadgeDecision = "ALLOW" | "REVIEW" | "BLOCK" | "UNKNOWN";
export type TrustBadgeStatus = "trusted" | "review" | "high_risk" | "not_checked";

export type TrustBadgeSummary = {
  wallet: string;
  decision: TrustBadgeDecision;
  status: TrustBadgeStatus;
  label: "Trusted" | "Review" | "High Risk" | "Not checked yet";
  trustScore: number | null;
  riskScore: number | null;
  riskTier: string | null;
  estimatedIdentity: string | null;
  humanProbability: number | null;
  updatedAt: string | null;
};

type TrustSnapshotRow = {
  wallet_address: string;
  data: TrustSnapshot;
};

function emptyBadge(wallet: string): TrustBadgeSummary {
  return {
    wallet,
    decision: "UNKNOWN",
    status: "not_checked",
    label: "Not checked yet",
    trustScore: null,
    riskScore: null,
    riskTier: null,
    estimatedIdentity: null,
    humanProbability: null,
    updatedAt: null
  };
}

function normalizeRiskTier(snapshot: TrustSnapshot): "Low" | "Medium" | "High" | "Unknown" {
  if (snapshot.riskTier === "Low" || snapshot.riskTier === "Medium" || snapshot.riskTier === "High") {
    return snapshot.riskTier;
  }

  if (typeof snapshot.riskScore === "number") {
    if (snapshot.riskScore <= 25) return "Low";
    if (snapshot.riskScore <= 60) return "Medium";
    return "High";
  }

  return "Unknown";
}

function snapshotToBadge(wallet: string, snapshot?: TrustSnapshot | null): TrustBadgeSummary {
  if (!snapshot) return emptyBadge(wallet);

  const riskTier = normalizeRiskTier(snapshot);
  const riskScore = snapshot.riskScore;
  const isHighRisk = riskTier === "High" || (typeof riskScore === "number" && riskScore > 60);
  const isReview = riskTier === "Medium" || (typeof riskScore === "number" && riskScore > 25);

  if (isHighRisk) {
    return {
      wallet,
      decision: "BLOCK",
      status: "high_risk",
      label: "High Risk",
      trustScore: snapshot.trustScore ?? null,
      riskScore,
      riskTier,
      estimatedIdentity: snapshot.humanAgentEstimation ?? null,
      humanProbability: snapshot.humanProbability ?? null,
      updatedAt: snapshot.createdAt ?? null
    };
  }

  if (isReview) {
    return {
      wallet,
      decision: "REVIEW",
      status: "review",
      label: "Review",
      trustScore: snapshot.trustScore ?? null,
      riskScore,
      riskTier,
      estimatedIdentity: snapshot.humanAgentEstimation ?? null,
      humanProbability: snapshot.humanProbability ?? null,
      updatedAt: snapshot.createdAt ?? null
    };
  }

  return {
    wallet,
    decision: "ALLOW",
    status: "trusted",
    label: "Trusted",
    trustScore: snapshot.trustScore ?? null,
    riskScore,
    riskTier,
    estimatedIdentity: snapshot.humanAgentEstimation ?? null,
    humanProbability: snapshot.humanProbability ?? null,
    updatedAt: snapshot.createdAt ?? null
  };
}

export async function getTrustBadgeSummary(wallet: string): Promise<TrustBadgeSummary> {
  const summaries = await getTrustBadgeSummaries([wallet]);
  return summaries[0] ?? emptyBadge(wallet);
}

export async function getTrustBadgeSummaries(wallets: string[]): Promise<TrustBadgeSummary[]> {
  const uniqueWallets = Array.from(new Set(wallets.filter((wallet) => isAddress(wallet))));
  if (uniqueWallets.length === 0) return wallets.map(emptyBadge);
  if (!isPostgresEnabled()) return wallets.map(emptyBadge);

  try {
    const rows = await pgQuery<TrustSnapshotRow>(
      `
        SELECT DISTINCT ON (LOWER(wallet_address))
          wallet_address,
          data
        FROM trust_snapshots
        WHERE LOWER(wallet_address) = ANY($1::text[])
        ORDER BY LOWER(wallet_address), created_at DESC
      `,
      [uniqueWallets.map((wallet) => wallet.toLowerCase())]
    );
    const byWallet = new Map(rows.map((row) => [row.wallet_address.toLowerCase(), row.data]));

    return wallets.map((wallet) =>
      snapshotToBadge(wallet, isAddress(wallet) ? byWallet.get(wallet.toLowerCase()) : null)
    );
  } catch {
    return wallets.map(emptyBadge);
  }
}

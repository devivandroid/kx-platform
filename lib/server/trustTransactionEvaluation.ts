import { isAddress } from "ethers";
import { getCombinedRiskProfileAsync } from "@/lib/server/risk-intelligence/riskService";
import { getTrustBadgeSummary, type TrustBadgeSummary } from "@/lib/server/trustBadges";
import {
  evaluateTrustPolicyForProfile,
  normalizeTrustPolicyId,
  trustPolicies,
  type TrustPolicyDecision,
  type TrustPolicyId
} from "@/lib/server/trust-policy/policyEngine";

export type InteractionEvaluationContext = "marketplace" | "job" | "payment" | "custom";

export type EvaluateInteractionInput = {
  from: string;
  to: string;
  amount?: string;
  asset?: string;
  context?: InteractionEvaluationContext | string;
  policy?: TrustPolicyId | string;
};

export type InteractionTrustSummary = {
  wallet: string;
  decision: TrustPolicyDecision | "UNKNOWN";
  trustScore: number | null;
  riskScore: number | null;
  riskTier: "Low" | "Medium" | "High" | "Unknown" | string;
  estimatedIdentity: string | null;
  humanProbability: number | null;
  updatedAt: string | null;
  source: "latest_snapshot" | "trust_engine";
};

export type InteractionEvaluationResponse = {
  allow: boolean;
  decision: TrustPolicyDecision;
  fromTrust: InteractionTrustSummary;
  toTrust: InteractionTrustSummary;
  riskTier: "Low" | "Medium" | "High";
  reasons: string[];
  recommendation: "Proceed" | "Review before continuing" | "Do not proceed";
  policy: TrustPolicyId;
  policyName: string;
  amount: string | null;
  asset: string;
  context: string;
};

function normalizeRiskTier(value: string | null | undefined, riskScore: number | null): "Low" | "Medium" | "High" | "Unknown" {
  if (value === "Low" || value === "Medium" || value === "High") return value;
  if (typeof riskScore === "number") {
    if (riskScore <= 25) return "Low";
    if (riskScore <= 60) return "Medium";
    return "High";
  }
  return "Unknown";
}

function badgeToTrustSummary(badge: TrustBadgeSummary): InteractionTrustSummary {
  return {
    wallet: badge.wallet,
    decision: badge.decision,
    trustScore: badge.trustScore,
    riskScore: badge.riskScore,
    riskTier: normalizeRiskTier(badge.riskTier, badge.riskScore),
    estimatedIdentity: badge.estimatedIdentity,
    humanProbability: badge.humanProbability,
    updatedAt: badge.updatedAt,
    source: "latest_snapshot"
  };
}

async function evaluateWallet(wallet: string, policyId: TrustPolicyId): Promise<{
  summary: InteractionTrustSummary;
  reasons: string[];
  policyName: string;
}> {
  const badge = await getTrustBadgeSummary(wallet);
  if (badge.status !== "not_checked") {
    return {
      summary: badgeToTrustSummary(badge),
      reasons: [`Used latest KX Trust Snapshot for ${wallet}.`],
      policyName: "Latest Snapshot"
    };
  }

  const profile = await getCombinedRiskProfileAsync(wallet, { useIndexedData: true });
  const policy = evaluateTrustPolicyForProfile({ wallet, policyId }, profile, policyId);

  return {
    summary: {
      wallet: profile.wallet,
      decision: policy.decision,
      trustScore: profile.scores.trustScore ?? profile.scores.financialBehaviorScore ?? null,
      riskScore: profile.scores.riskScore,
      riskTier: normalizeRiskTier(profile.scores.riskTier, profile.scores.riskScore),
      estimatedIdentity: profile.identityEstimation?.estimatedUserType ?? "Unknown",
      humanProbability: profile.identityEstimation?.probability ?? null,
      updatedAt:
        profile.trustSnapshot?.createdAt ??
        profile.metadata?.lastIndexed ??
        profile.identityEstimation?.lastEstimatedAt ??
        null,
      source: "trust_engine"
    },
    reasons: policy.reasons,
    policyName: policy.policyName
  };
}

function getCombinedRiskTier(
  fromTrust: InteractionTrustSummary,
  toTrust: InteractionTrustSummary
): "Low" | "Medium" | "High" {
  const tiers = [fromTrust.riskTier, toTrust.riskTier];
  if (tiers.includes("High")) return "High";
  if (tiers.includes("Medium")) return "Medium";
  return "Low";
}

function getDecision(
  fromTrust: InteractionTrustSummary,
  toTrust: InteractionTrustSummary,
  riskTier: "Low" | "Medium" | "High"
): TrustPolicyDecision {
  if (fromTrust.decision === "BLOCK" || toTrust.decision === "BLOCK" || riskTier === "High") {
    return "BLOCK";
  }

  if (fromTrust.decision === "REVIEW" || toTrust.decision === "REVIEW" || riskTier === "Medium") {
    return "REVIEW";
  }

  return "ALLOW";
}

function getRecommendation(decision: TrustPolicyDecision): InteractionEvaluationResponse["recommendation"] {
  if (decision === "ALLOW") return "Proceed";
  if (decision === "BLOCK") return "Do not proceed";
  return "Review before continuing";
}

export async function evaluateInteractionTrust(
  input: EvaluateInteractionInput
): Promise<InteractionEvaluationResponse> {
  const from = input.from?.trim();
  const to = input.to?.trim();
  if (!isAddress(from) || !isAddress(to)) {
    throw new Error("INVALID_TRANSACTION_WALLETS");
  }

  const policyId = normalizeTrustPolicyId(input.policy);
  const context = input.context || "custom";
  const asset = input.asset || "USDC";
  const [fromResult, toResult] = await Promise.all([
    evaluateWallet(from, policyId),
    evaluateWallet(to, policyId)
  ]);
  const riskTier = getCombinedRiskTier(fromResult.summary, toResult.summary);
  const decision = getDecision(fromResult.summary, toResult.summary, riskTier);
  const reasons = [
    `Context: ${context}.`,
    `Asset: ${asset}${input.amount ? `, amount: ${input.amount}` : ""}.`,
    ...fromResult.reasons.slice(0, 2).map((reason) => `From wallet: ${reason}`),
    ...toResult.reasons.slice(0, 2).map((reason) => `To wallet: ${reason}`)
  ];

  if (decision === "BLOCK") {
    reasons.unshift("Transaction blocked because at least one wallet is BLOCK or High Risk.");
  } else if (decision === "REVIEW") {
    reasons.unshift("Transaction requires review because at least one wallet is REVIEW or Medium Risk.");
  } else {
    reasons.unshift("Both wallets currently satisfy the selected trust policy.");
  }

  return {
    allow: decision === "ALLOW",
    decision,
    fromTrust: fromResult.summary,
    toTrust: toResult.summary,
    riskTier,
    reasons,
    recommendation: getRecommendation(decision),
    policy: policyId,
    policyName: trustPolicies[policyId].name,
    amount: input.amount ?? null,
    asset,
    context
  };
}


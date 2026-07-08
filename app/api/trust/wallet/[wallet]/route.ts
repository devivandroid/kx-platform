import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import {
  getArcNetworkRiskProfileAsync,
  getCombinedRiskProfileAsync,
  getRiskProfileAsync
} from "@/lib/server/risk-intelligence/riskService";
import type { RiskProfile } from "@/lib/server/risk-intelligence/types";
import {
  evaluateTrustPolicyForProfile,
  normalizeTrustPolicyId
} from "@/lib/server/trust-policy/policyEngine";

type TrustWalletContext = {
  params: Promise<{ wallet: string }>;
};

type TrustWalletSource = "internal" | "arc_network" | "combined";

export const runtime = "nodejs";

function readSource(request: Request): TrustWalletSource {
  const value = new URL(request.url).searchParams.get("source");
  if (value === "internal" || value === "arc_network" || value === "combined") return value;
  return "combined";
}

function readUseIndexedData(request: Request): boolean {
  return new URL(request.url).searchParams.get("useIndexedData") !== "false";
}

async function getProfile(
  wallet: string,
  source: TrustWalletSource,
  useIndexedData: boolean
): Promise<RiskProfile> {
  if (source === "internal") {
    return getRiskProfileAsync(wallet);
  }

  if (source === "arc_network") {
    return getArcNetworkRiskProfileAsync(wallet, { useIndexedData });
  }

  return getCombinedRiskProfileAsync(wallet, { useIndexedData });
}

export async function GET(request: Request, context: TrustWalletContext) {
  const { wallet } = await context.params;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const source = readSource(request);
  const policyId = normalizeTrustPolicyId(searchParams.get("policyId"));
  const profile = await getProfile(wallet, source, readUseIndexedData(request));
  const policy = evaluateTrustPolicyForProfile({ wallet, policyId }, profile, policyId);
  const snapshot = profile.trustSnapshot;

  return NextResponse.json({
    wallet: profile.wallet,
    decision: policy.decision,
    allow: policy.decision === "ALLOW",
    review: policy.decision === "REVIEW",
    block: policy.decision === "BLOCK",
    trustScore: profile.scores.trustScore ?? profile.scores.financialBehaviorScore,
    riskScore: profile.scores.riskScore,
    riskTier: profile.scores.riskTier,
    policyId: policy.policyId,
    policyName: policy.policyName,
    reasons: policy.reasons,
    estimatedIdentity: profile.identityEstimation?.estimatedUserType ?? "Unknown",
    humanProbability: profile.identityEstimation?.probability ?? null,
    analysisConfidence: profile.scores.confidenceLevel,
    snapshotVerified: snapshot?.signatureStatus === "verified",
    reportHash: snapshot?.reportHash ?? null,
    signatureStatus: snapshot?.signatureStatus ?? null,
    attestationStatus: snapshot?.attestationStatus ?? "not_published",
    lastUpdated:
      snapshot?.createdAt ??
      profile.metadata?.lastIndexed ??
      profile.identityEstimation?.lastEstimatedAt ??
      null
  });
}

import { getCombinedRiskProfileAsync } from "@/lib/server/risk-intelligence/riskService";
import type {
  ConfidenceLevel,
  RiskProfile,
  RiskTier
} from "@/lib/server/risk-intelligence/types";

export type TrustPolicyDecision = "ALLOW" | "REVIEW" | "BLOCK";
export type TrustPolicyRiskTier = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export type TrustPolicyId =
  | "basic-safe"
  | "human-preferred"
  | "agent-safe"
  | "enterprise-strict";

export type TrustPolicyEvaluationInput = {
  wallet: string;
  policyId: TrustPolicyId;
  counterpartyWallet?: string;
  amountUSDC?: string;
  context?: string;
};

export type TrustPolicyEvaluation = {
  ok: true;
  wallet: string;
  counterpartyWallet?: string;
  amountUSDC?: string;
  context?: string;
  decision: TrustPolicyDecision;
  policyId: TrustPolicyId;
  policyName: string;
  reasons: string[];
  failedRules: string[];
  passedRules: string[];
  criticalSignals: string[];
  trustSnapshot: RiskProfile["trustSnapshot"];
  reportHash: string | null;
  signatureStatus: "verified" | "unsigned" | "not_configured" | "invalid" | null;
  profile: {
    rawRiskTier: RiskTier;
    policyRiskTier: TrustPolicyRiskTier;
    riskScore: number | null;
    confidence: ConfidenceLevel;
    estimatedIdentity: string;
    humanProbability: number | null;
    identityMatch: string;
  };
  limitations: string[];
};

type RuleSet = {
  passedRules: string[];
  failedRules: string[];
  criticalSignals: string[];
  reasons: string[];
  decision: TrustPolicyDecision;
};

export const trustPolicies: Record<TrustPolicyId, { id: TrustPolicyId; name: string }> = {
  "basic-safe": {
    id: "basic-safe",
    name: "Basic Safe"
  },
  "human-preferred": {
    id: "human-preferred",
    name: "Human Preferred"
  },
  "agent-safe": {
    id: "agent-safe",
    name: "Agent Safe"
  },
  "enterprise-strict": {
    id: "enterprise-strict",
    name: "Enterprise Strict"
  }
};

function isTrustPolicyId(value: string): value is TrustPolicyId {
  return value in trustPolicies;
}

export function normalizeTrustPolicyId(value: unknown): TrustPolicyId {
  const policyId = typeof value === "string" ? value : "";
  if (isTrustPolicyId(policyId)) return policyId;
  return "basic-safe";
}

function addRule(
  rules: RuleSet,
  passed: boolean,
  passedText: string,
  failedText: string
) {
  if (passed) {
    rules.passedRules.push(passedText);
  } else {
    rules.failedRules.push(failedText);
  }
}

function hasRecentSignedSnapshot(profile: RiskProfile): boolean {
  const snapshot = profile.trustSnapshot;
  if (!snapshot) return false;
  if (snapshot.signatureStatus !== "verified") return false;
  const expiresAt = new Date(snapshot.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function getPolicyRiskTier(profile: RiskProfile): TrustPolicyRiskTier {
  const riskScore = profile.scores.riskScore;
  if (typeof riskScore === "number") {
    if (riskScore <= 25) return "LOW";
    if (riskScore <= 60) return "MEDIUM";
    return "HIGH";
  }

  if (profile.scores.riskTier === "Low") return "LOW";
  if (profile.scores.riskTier === "Medium") return "MEDIUM";
  if (profile.scores.riskTier === "High") return "HIGH";
  return "UNKNOWN";
}

function isLowOrLowMedium(profile: RiskProfile, policyRiskTier: TrustPolicyRiskTier): boolean {
  if (policyRiskTier === "LOW") return true;
  return policyRiskTier === "MEDIUM" && typeof profile.scores.riskScore === "number" && profile.scores.riskScore <= 40;
}

function getCriticalRiskSignals(profile: RiskProfile): string[] {
  return (profile.riskSignals ?? [])
    .filter((signal) => signal.severity === "Elevated")
    .map((signal) => `${signal.label}: ${signal.description}`);
}

function hasInvalidSignedSnapshot(profile: RiskProfile): boolean {
  return profile.trustSnapshot?.signatureStatus === "invalid";
}

function getHumanProbability(profile: RiskProfile): number | null {
  return profile.identityEstimation?.probability ?? profile.trustSnapshot?.humanProbability ?? null;
}

function evaluateBasicSafe(profile: RiskProfile): RuleSet {
  const rules: RuleSet = { passedRules: [], failedRules: [], criticalSignals: [], reasons: [], decision: "REVIEW" };
  const policyRiskTier = getPolicyRiskTier(profile);
  const criticalSignals = getCriticalRiskSignals(profile);
  const hasCriticalSignal = criticalSignals.length > 0;
  const invalidSnapshot = hasInvalidSignedSnapshot(profile);
  addRule(
    rules,
    isLowOrLowMedium(profile, policyRiskTier),
    "Policy risk is Low or low Medium.",
    "Policy risk is above low Medium or unavailable."
  );
  addRule(
    rules,
    profile.scores.confidenceLevel !== "Low",
    "Confidence is Medium or High.",
    "Confidence is Low."
  );
  addRule(
    rules,
    !hasCriticalSignal,
    "No critical risk signals were found.",
    "A critical risk signal was found."
  );
  addRule(
    rules,
    !invalidSnapshot,
    "Signed snapshot is valid when present.",
    "Signed snapshot is invalid."
  );

  rules.criticalSignals = criticalSignals;

  if (policyRiskTier === "HIGH") {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because normalized risk is High.");
  } else if (hasCriticalSignal) {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because a critical risk signal was found.");
  } else if (invalidSnapshot) {
    rules.decision = "REVIEW";
    rules.reasons.push("Review recommended because signed snapshot evidence is invalid.");
  } else if (rules.failedRules.length === 0) {
    rules.decision = "ALLOW";
    rules.reasons.push("Allowed because normalized risk and confidence meet Basic Safe requirements.");
  } else {
    rules.reasons.push("Review recommended because risk, confidence or evidence is incomplete.");
  }
  return rules;
}

function evaluateHumanPreferred(profile: RiskProfile): RuleSet {
  const rules: RuleSet = { passedRules: [], failedRules: [], criticalSignals: [], reasons: [], decision: "REVIEW" };
  const estimatedIdentity = profile.identityEstimation?.estimatedUserType ?? "Unknown";
  const humanProbability = getHumanProbability(profile);
  const policyRiskTier = getPolicyRiskTier(profile);
  const criticalSignals = getCriticalRiskSignals(profile);
  const hasCriticalSignal = criticalSignals.length > 0;
  const invalidSnapshot = hasInvalidSignedSnapshot(profile);

  addRule(
    rules,
    estimatedIdentity === "Likely Human" || estimatedIdentity === "Leaning Human",
    "Estimated identity is human-leaning.",
    "Estimated identity is not human-leaning."
  );
  addRule(
    rules,
    humanProbability !== null && humanProbability >= 56,
    "Human probability is at least 56%.",
    "Human probability is below 56% or unavailable."
  );
  addRule(
    rules,
    isLowOrLowMedium(profile, policyRiskTier),
    "Policy risk is Low or low Medium.",
    "Policy risk is above low Medium or unavailable."
  );
  addRule(
    rules,
    profile.scores.confidenceLevel !== "Low",
    "Confidence is Medium or High.",
    "Confidence is Low."
  );
  addRule(
    rules,
    !hasCriticalSignal,
    "No critical risk signals were found.",
    "A critical risk signal was found."
  );
  addRule(
    rules,
    !invalidSnapshot,
    "Signed snapshot is valid when present.",
    "Signed snapshot is invalid."
  );

  rules.criticalSignals = criticalSignals;

  if (policyRiskTier === "HIGH") {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because normalized risk is High.");
  } else if (hasCriticalSignal) {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because a critical risk signal was found.");
  } else if (invalidSnapshot) {
    rules.decision = "REVIEW";
    rules.reasons.push("Review recommended because signed snapshot evidence is invalid.");
  } else if (rules.failedRules.length === 0) {
    rules.decision = "ALLOW";
    rules.reasons.push("Allowed because human estimation, risk and confidence meet policy requirements.");
  } else {
    rules.reasons.push("Review recommended because identity or probability evidence is incomplete.");
  }
  return rules;
}

function evaluateAgentSafe(profile: RiskProfile): RuleSet {
  const rules: RuleSet = { passedRules: [], failedRules: [], criticalSignals: [], reasons: [], decision: "REVIEW" };
  const estimatedIdentity = profile.identityEstimation?.estimatedUserType ?? "Unknown";
  const policyRiskTier = getPolicyRiskTier(profile);
  const criticalSignals = getCriticalRiskSignals(profile);
  const hasCriticalSignal = criticalSignals.length > 0;
  const invalidSnapshot = hasInvalidSignedSnapshot(profile);

  addRule(
    rules,
    estimatedIdentity === "Likely Agent" || estimatedIdentity === "Leaning Agent",
    "Estimated identity is agent-leaning.",
    "Estimated identity is not agent-leaning."
  );
  addRule(rules, policyRiskTier === "LOW", "Policy risk is Low.", "Policy risk is not Low.");
  addRule(
    rules,
    profile.scores.confidenceLevel === "High",
    "Confidence is High.",
    "Confidence is not High."
  );
  addRule(
    rules,
    !hasCriticalSignal,
    "No critical risk signals were found.",
    "A critical risk signal was found."
  );
  addRule(
    rules,
    !invalidSnapshot,
    "Signed snapshot is valid when present.",
    "Signed snapshot is invalid."
  );

  rules.criticalSignals = criticalSignals;

  if (policyRiskTier === "HIGH") {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because normalized risk is High.");
  } else if (hasCriticalSignal) {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because a critical risk signal was found.");
  } else if (invalidSnapshot) {
    rules.decision = "REVIEW";
    rules.reasons.push("Review recommended because signed snapshot evidence is invalid.");
  } else if (rules.failedRules.length === 0) {
    rules.decision = "ALLOW";
    rules.reasons.push("Agent Safe requirements passed.");
  } else {
    rules.reasons.push("Review recommended because this policy requires agent evidence, Low risk and High confidence.");
  }
  return rules;
}

function evaluateEnterpriseStrict(profile: RiskProfile): RuleSet {
  const rules: RuleSet = { passedRules: [], failedRules: [], criticalSignals: [], reasons: [], decision: "REVIEW" };
  const identityMatch = profile.identityEstimation?.identityMatch ?? "Not available";
  const recentSignedSnapshot = hasRecentSignedSnapshot(profile);
  const policyRiskTier = getPolicyRiskTier(profile);
  const criticalSignals = getCriticalRiskSignals(profile);
  const hasCriticalSignal = criticalSignals.length > 0;

  addRule(rules, policyRiskTier === "LOW", "Policy risk is Low.", "Policy risk is not Low.");
  addRule(
    rules,
    profile.scores.confidenceLevel === "High",
    "Confidence is High.",
    "Confidence is not High."
  );
  addRule(
    rules,
    recentSignedSnapshot,
    "Recent signed Trust Snapshot is available.",
    "Recent signed Trust Snapshot is missing."
  );
  addRule(
    rules,
    identityMatch !== "Mismatch",
    "Identity match is not a mismatch.",
    "Identity match is Mismatch."
  );
  addRule(
    rules,
    !hasCriticalSignal,
    "No critical risk signals were found.",
    "A critical risk signal was found."
  );

  rules.criticalSignals = criticalSignals;

  if (policyRiskTier === "HIGH" || hasCriticalSignal || identityMatch === "Mismatch") {
    rules.decision = "BLOCK";
    rules.reasons.push("Blocked because Enterprise Strict found high risk, critical signals or identity mismatch.");
  } else if (rules.failedRules.length === 0) {
    rules.decision = "ALLOW";
    rules.reasons.push("Enterprise Strict requirements passed.");
  } else {
    rules.reasons.push("Review required because one or more strict evidence requirements are missing.");
  }
  return rules;
}

function evaluatePolicyRules(profile: RiskProfile, policyId: TrustPolicyId): RuleSet {
  if (policyId === "human-preferred") return evaluateHumanPreferred(profile);
  if (policyId === "agent-safe") return evaluateAgentSafe(profile);
  if (policyId === "enterprise-strict") return evaluateEnterpriseStrict(profile);
  return evaluateBasicSafe(profile);
}

export async function evaluateTrustPolicy(
  input: TrustPolicyEvaluationInput
): Promise<TrustPolicyEvaluation> {
  const policyId = normalizeTrustPolicyId(input.policyId);
  const profile = await getCombinedRiskProfileAsync(input.wallet, { useIndexedData: true });
  return evaluateTrustPolicyForProfile(input, profile, policyId);
}

export function evaluateTrustPolicyForProfile(
  input: TrustPolicyEvaluationInput,
  profile: RiskProfile,
  normalizedPolicyId?: TrustPolicyId
): TrustPolicyEvaluation {
  const policyId = normalizedPolicyId ?? normalizeTrustPolicyId(input.policyId);
  const policyRiskTier = getPolicyRiskTier(profile);
  const ruleSet = evaluatePolicyRules(profile, policyId);

  return {
    ok: true,
    wallet: profile.wallet,
    counterpartyWallet: input.counterpartyWallet,
    amountUSDC: input.amountUSDC,
    context: input.context,
    decision: ruleSet.decision,
    policyId,
    policyName: trustPolicies[policyId].name,
    reasons: ruleSet.reasons,
    failedRules: ruleSet.failedRules,
    passedRules: ruleSet.passedRules,
    criticalSignals: ruleSet.criticalSignals,
    trustSnapshot: profile.trustSnapshot,
    reportHash: profile.trustSnapshot?.reportHash ?? null,
    signatureStatus: profile.trustSnapshot?.signatureStatus ?? null,
    profile: {
      rawRiskTier: profile.scores.riskTier,
      policyRiskTier,
      riskScore: profile.scores.riskScore,
      confidence: profile.scores.confidenceLevel,
      estimatedIdentity: profile.identityEstimation?.estimatedUserType ?? "Unknown",
      humanProbability: getHumanProbability(profile),
      identityMatch: profile.identityEstimation?.identityMatch ?? "Not available"
    },
    limitations: [
      "Policy decisions are explainable KX trust policy outputs, not KYC, AML or compliance approvals.",
      "Decisions depend on available KX and Arc Testnet evidence.",
      "No data is treated as neutral evidence and usually routes to review."
    ]
  };
}

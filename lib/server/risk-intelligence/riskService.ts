import { ARC_TESTNET_CHAIN_ID } from "@/lib/chains/arcTestnet";
import {
  readArcReputation,
  readArcValidations
} from "@/lib/server/arc/arcTrustRegistries";
import { getArcNetworkRiskProfile } from "@/lib/server/risk-intelligence/arcNetworkAdapter";
import { calculateRiskProfile, getUniqueRiskWallets } from "@/lib/server/risk-intelligence/calculateRiskProfile";
import { getEvents, getEventsAsync } from "@/lib/server/reputation/reputationEventStore";
import { toRiskProfileApiResponse } from "@/lib/server/risk-intelligence/riskProfileResponse";
import { getCachedRead } from "@/lib/server/risk-intelligence/requestCache";
import { createAndStoreTrustSnapshot } from "@/lib/server/risk-intelligence/trustSnapshots";
import type {
  ConfidenceLevel,
  IdentityMatchStatus,
  RiskDataSource,
  RiskGuardCheck,
  RiskGuardDecision,
  RiskGuardPolicy,
  RiskProfile,
  UnknownWalletBehavior
} from "@/lib/server/risk-intelligence/types";

export const riskServiceScope = "KX activity only";
export const riskServiceNetwork = "Arc Testnet";

export const riskServiceLimitations = [
  "Combined profiles use KX activity plus limited Arc Testnet RPC activity when available",
  "Not an official Arc or Circle score",
  "Preview risk model",
  "No authentication yet",
  "No production-grade compliance screening"
];

export const internalRiskServiceLimitations = [
  "Based only on KX activity",
  "Not an official Arc or Circle score",
  "Preview risk model",
  "No authentication yet",
  "No production-grade compliance screening"
];

export function getRiskProfile(wallet: string): RiskProfile {
  return {
    ...calculateRiskProfile(wallet, getEvents()),
    dataSource: "knowledge_exchange",
    limitations: internalRiskServiceLimitations
  };
}

function getCacheWallet(wallet: string): string {
  return wallet.toLowerCase();
}

function nowMs(): number {
  return Date.now();
}

function logTiming(label: string, timings: Record<string, number>) {
  if (process.env.NODE_ENV === "production") return;
  const rendered = Object.entries(timings)
    .map(([key, value]) => `${key}=${value}ms`)
    .join(" ");
  console.debug(`[KX Trust Engine timing] ${label} ${rendered}`);
}

async function getInternalRiskProfileRaw(wallet: string): Promise<RiskProfile> {
  return {
    ...calculateRiskProfile(wallet, await getEventsAsync()),
    dataSource: "knowledge_exchange",
    limitations: internalRiskServiceLimitations
  };
}

export type RiskProfileBuildOptions = {
  includeTrustSnapshot?: boolean;
};

export async function getRiskProfileAsync(
  wallet: string,
  options: RiskProfileBuildOptions = {}
): Promise<RiskProfile> {
  const includeTrustSnapshot = options.includeTrustSnapshot !== false;
  return getCachedRead(`risk:internal:${getCacheWallet(wallet)}:${includeTrustSnapshot}`, async () => {
    const totalStart = nowMs();
    const [profile, registries] = await Promise.all([
      getInternalRiskProfileRaw(wallet),
      readArcRegistries(wallet)
    ]);
    const snapshotStart = nowMs();
    const enriched = {
      ...profile,
      ...registries
    };
    const result = includeTrustSnapshot ? await attachTrustSnapshot(enriched) : enriched;
    logTiming("internal_profile", {
      total: nowMs() - totalStart,
      snapshot: nowMs() - snapshotStart
    });
    return result;
  });
}

async function readArcRegistries(wallet: string): Promise<Pick<RiskProfile, "arcReputation" | "arcValidations">> {
  const [arcReputation, arcValidations] = await Promise.all([
    readArcReputation(wallet),
    readArcValidations(wallet)
  ]);

  return {
    arcReputation,
    arcValidations
  };
}

async function attachTrustSnapshot(profile: RiskProfile): Promise<RiskProfile> {
  return {
    ...profile,
    trustSnapshot: await createAndStoreTrustSnapshot(profile)
  };
}

function rankConfidence(level: ConfidenceLevel): number {
  return confidenceRank[level];
}

function maxConfidence(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
  return rankConfidence(a) >= rankConfidence(b) ? a : b;
}

function resolveCombinedDataSource(
  internalProfile: RiskProfile,
  networkProfile: RiskProfile
): RiskDataSource {
  const hasInternal = internalProfile.profileStatus !== "no_data";
  const hasNetwork = networkProfile.profileStatus !== "no_data";
  if (hasInternal && hasNetwork) return "combined";
  if (hasInternal) return "knowledge_exchange";
  if (hasNetwork) return "arc_network";
  return "no_data";
}

function combineProfiles(internalProfile: RiskProfile, networkProfile: RiskProfile): RiskProfile {
  const dataSource = resolveCombinedDataSource(internalProfile, networkProfile);

  if (dataSource === "no_data") {
    return {
      ...internalProfile,
      dataSource,
      message: "No KX or Arc Testnet network activity was found for this wallet.",
      recommendation:
        "Missing data is not negative evidence. Apply your own policy or request additional verification before transacting.",
      riskSignals: [...internalProfile.riskSignals, ...networkProfile.riskSignals],
      limitations: riskServiceLimitations
    };
  }

  if (dataSource === "knowledge_exchange") {
    return { ...internalProfile, dataSource, limitations: riskServiceLimitations };
  }

  if (dataSource === "arc_network") {
    return { ...networkProfile, dataSource, limitations: riskServiceLimitations };
  }

  const internalScore = internalProfile.scores.financialBehaviorScore ?? 500;
  const networkScore = networkProfile.scores.financialBehaviorScore ?? 500;
  const financialBehaviorScore = Math.round(internalScore * 0.7 + networkScore * 0.3);
  const internalRiskScore = internalProfile.scores.riskScore;
  const networkRiskScore = networkProfile.scores.riskScore;
  const availableRiskScores = [internalRiskScore, networkRiskScore].filter(
    (value): value is number => typeof value === "number"
  );
  const riskScore =
    availableRiskScores.length === 0
      ? null
      : Math.max(
          5,
          Math.min(
            100,
            Math.round(
              availableRiskScores.reduce((sum, value) => sum + value, 0) /
                availableRiskScores.length
            )
          )
        );
  const riskTier = riskScore === null ? "Unknown" : riskScore <= 24 ? "Low" : riskScore <= 59 ? "Medium" : "High";
  const completedActions =
    internalProfile.activity.completedActions + networkProfile.activity.completedActions;
  const totalVolume =
    Number(internalProfile.activity.totalCompletedVolumeUSDC) +
    Number(networkProfile.activity.totalCompletedVolumeUSDC);
  const evidenceCount =
    internalProfile.activity.evidenceCount + networkProfile.activity.evidenceCount;

  return {
    wallet: internalProfile.wallet,
    dataSource,
    profileStatus: evidenceCount >= 5 ? "active" : "limited",
    message: "Combined profile using KX activity and Arc Testnet RPC activity.",
    recommendation:
      "Use the combined profile as a broader commerce context signal, not as compliance screening.",
    participant: internalProfile.participant,
    scores: {
      financialBehaviorScore,
      trustScore: Math.round(financialBehaviorScore / 10),
      riskScore,
      riskTier,
      confidenceLevel: maxConfidence(
        internalProfile.scores.confidenceLevel,
        networkProfile.scores.confidenceLevel
      )
    },
    activity: {
      ...internalProfile.activity,
      totalCompletedVolumeUSDC: totalVolume.toFixed(6),
      completedActions,
      successfulPayments:
        internalProfile.activity.successfulPayments + networkProfile.activity.successfulPayments,
      failedPayments: internalProfile.activity.failedPayments + networkProfile.activity.failedPayments,
      uniqueCounterparties: internalProfile.activity.uniqueCounterparties,
      averageTransactionAmountUSDC:
        completedActions > 0 ? (totalVolume / completedActions).toFixed(6) : "0.00",
      averageActionsPerDay: internalProfile.activity.averageActionsPerDay,
      activityLevel:
        networkProfile.activity.activityLevel === "High" ||
        internalProfile.activity.activityLevel === "High"
          ? "High"
          : internalProfile.activity.activityLevel !== "Unknown"
            ? internalProfile.activity.activityLevel
            : networkProfile.activity.activityLevel,
      evidenceCount
    },
    metadata: networkProfile.metadata,
    identityEstimation: networkProfile.identityEstimation
      ? {
          ...networkProfile.identityEstimation,
          kxDeclaredUserType: internalProfile.participant.kxDeclaredUserType ?? "unknown",
          arcDeclaredIdentity: internalProfile.participant.arcIdentityId ?? null,
          arcDeclaredUserType: "unknown" as const,
          declaredUserType: internalProfile.participant.kxDeclaredUserType ?? "unknown",
          identityMatch: getIdentityMatch(
            internalProfile.participant.kxDeclaredUserType,
            networkProfile.identityEstimation.estimatedUserType
          )
        }
      : undefined,
    behavioralSignals: [
      ...internalProfile.behavioralSignals,
      ...networkProfile.behavioralSignals.map((signal) => ({
        ...signal,
        label: `Arc Network: ${signal.label}`
      }))
    ],
    riskSignals: [
      ...internalProfile.riskSignals,
      ...networkProfile.riskSignals.map((signal) => ({
        ...signal,
        label: `Arc Network: ${signal.label}`
      }))
    ],
    limitations: riskServiceLimitations
  };
}

function getIdentityMatch(
  declaredUserType: RiskProfile["participant"]["userType"],
  estimatedUserType: NonNullable<RiskProfile["identityEstimation"]>["estimatedUserType"]
): IdentityMatchStatus {
  if (
    !declaredUserType ||
    declaredUserType === "unknown" ||
    estimatedUserType === "Unknown" ||
    estimatedUserType === "Mixed / Inconclusive"
  ) {
    return "Not available";
  }

  if (
    declaredUserType === "HUMAN" &&
    (estimatedUserType === "Likely Human" || estimatedUserType === "Leaning Human")
  ) {
    return "OK";
  }
  if (
    declaredUserType === "AGENT" &&
    (estimatedUserType === "Likely Agent" || estimatedUserType === "Leaning Agent")
  ) {
    return "OK";
  }
  return "Mismatch";
}

export type RiskProfileReadOptions = {
  useIndexedData?: boolean;
  includeTrustSnapshot?: boolean;
};

export async function getArcNetworkRiskProfileAsync(
  wallet: string,
  options: RiskProfileReadOptions = {}
): Promise<RiskProfile> {
  const includeTrustSnapshot = options.includeTrustSnapshot !== false;
  return getCachedRead(
    `risk:network:${getCacheWallet(wallet)}:${options.useIndexedData !== false}:${includeTrustSnapshot}`,
    async () => {
      const totalStart = nowMs();
      const [profile, registries] = await Promise.all([
        getArcNetworkRiskProfile(wallet, options),
        readArcRegistries(wallet)
      ]);
      const snapshotStart = nowMs();
      const enriched = {
        ...profile,
        ...registries
      };
      const result = includeTrustSnapshot ? await attachTrustSnapshot(enriched) : enriched;
      logTiming("network_profile", {
        total: nowMs() - totalStart,
        snapshot: nowMs() - snapshotStart
      });
      return result;
    }
  );
}

export async function getCombinedRiskProfileAsync(
  wallet: string,
  options: RiskProfileReadOptions = {}
): Promise<RiskProfile> {
  const includeTrustSnapshot = options.includeTrustSnapshot !== false;
  return getCachedRead(
    `risk:combined:${getCacheWallet(wallet)}:${options.useIndexedData !== false}:${includeTrustSnapshot}`,
    async () => {
      const totalStart = nowMs();
      const [internalProfile, networkProfile, registries] = await Promise.all([
        getInternalRiskProfileRaw(wallet),
        getArcNetworkRiskProfile(wallet, options),
        readArcRegistries(wallet)
      ]);

      const trustStart = nowMs();
      const combined = combineProfiles(
        {
          ...internalProfile,
          ...registries
        },
        {
          ...networkProfile,
          ...registries
        }
      );
      const snapshotStart = nowMs();
      const enrichedCombined = {
        ...combined,
        ...registries
      };
      const result = includeTrustSnapshot
        ? await attachTrustSnapshot(enrichedCombined)
        : enrichedCombined;
      logTiming("combined_profile", {
        total: nowMs() - totalStart,
        trustEngine: snapshotStart - trustStart,
        snapshot: nowMs() - snapshotStart
      });
      return result;
    }
  );
}

export function getRiskProfiles(limit = 50): RiskProfile[] {
  const events = getEvents();
  return getUniqueRiskWallets(events)
    .map((wallet) => calculateRiskProfile(wallet, events))
    .sort(
      (a, b) =>
        (b.scores.financialBehaviorScore ?? -1) - (a.scores.financialBehaviorScore ?? -1)
    )
    .slice(0, Math.max(1, Math.min(limit, 100)));
}

export async function getRiskProfilesAsync(limit = 50): Promise<RiskProfile[]> {
  const events = await getEventsAsync();
  return getUniqueRiskWallets(events)
    .map((wallet) => calculateRiskProfile(wallet, events))
    .sort(
      (a, b) =>
        (b.scores.financialBehaviorScore ?? -1) - (a.scores.financialBehaviorScore ?? -1)
    )
    .slice(0, Math.max(1, Math.min(limit, 100)));
}

export function toPublicRiskProfileResponse(profile: RiskProfile) {
  return {
    ...toRiskProfileApiResponse(profile),
    service: "KX Public Risk Intelligence Service"
  };
}

export function toRiskSummaryResponse(profile: RiskProfile) {
  return {
    ok: true,
    service: "KX Public Risk Intelligence Service",
    scope: riskServiceScope,
    network: riskServiceNetwork,
    chainId: ARC_TESTNET_CHAIN_ID,
    wallet: profile.wallet,
    dataSource: profile.dataSource ?? "knowledge_exchange",
    profileStatus: profile.profileStatus,
    message: profile.message,
    recommendation: profile.recommendation,
    participant: {
      type: profile.participant.type,
      userType: profile.participant.userType ?? "unknown",
      kxDeclaredUserType: profile.participant.kxDeclaredUserType ?? "unknown",
      entityType: profile.participant.entityType ?? "unknown",
      name: profile.participant.name ?? null,
      operatorAddress: profile.participant.operatorAddress ?? null,
      arcIdentityId: profile.participant.arcIdentityId ?? null,
      identitySource: profile.participant.identitySource ?? "self_declared"
    },
    summary: {
      financialBehaviorScore: profile.scores.financialBehaviorScore,
      trustScore: profile.scores.trustScore ?? profile.scores.financialBehaviorScore,
      riskScore: profile.scores.riskScore,
      riskTier: profile.scores.riskTier,
      confidenceLevel: profile.scores.confidenceLevel,
      activityLevel: profile.activity.activityLevel,
      totalCompletedVolumeUSDC: profile.activity.totalCompletedVolumeUSDC,
      completedActions: profile.activity.completedActions,
      lastActivity: profile.activity.lastActivity ?? null,
      evidenceCount: profile.activity.evidenceCount
    },
    identityEstimation: profile.identityEstimation,
    trustSnapshot: profile.trustSnapshot,
    arcReputation: profile.arcReputation,
    arcValidations: profile.arcValidations,
    limitations: riskServiceLimitations
  };
}

export function toRiskSignalsResponse(profile: RiskProfile) {
  return {
    ok: true,
    service: "KX Public Risk Intelligence Service",
    scope: riskServiceScope,
    network: riskServiceNetwork,
    chainId: ARC_TESTNET_CHAIN_ID,
    wallet: profile.wallet,
    dataSource: profile.dataSource ?? "knowledge_exchange",
    profileStatus: profile.profileStatus,
    message: profile.message,
    recommendation: profile.recommendation,
    identityEstimation: profile.identityEstimation,
    trustSnapshot: profile.trustSnapshot,
    arcReputation: profile.arcReputation,
    arcValidations: profile.arcValidations,
    behavioralSignals: profile.behavioralSignals,
    riskSignals: profile.riskSignals,
    limitations: riskServiceLimitations
  };
}

export function getRiskModelResponse() {
  return {
    ok: true,
    service: "KX Public Risk Intelligence Service",
    name: "KX Risk Intelligence Model",
    scope: riskServiceScope,
    network: riskServiceNetwork,
    chainId: ARC_TESTNET_CHAIN_ID,
    scoring: {
      financialBehaviorScore: {
        range: "0-1000",
        startingScore: 500,
        positiveSignals: [
          "successful payments",
          "verified payments",
          "resource downloads",
          "protected transaction funding",
          "delivery submission",
          "funds released",
          "counterparty diversity",
          "completed volume"
        ],
        negativeSignals: [
          "cancelled requests",
          "purchase starts without completion",
          "failed payments when observed"
        ]
      },
      riskScore: {
        range: "0-100",
        interpretation: "0 is lowest observed risk in this preview model; 100 is highest observed risk."
      },
      riskTiers: {
        Low: "risk score 0-24",
        Medium: "risk score 25-59",
        High: "risk score 60-100",
        Unknown: "insufficient KX evidence"
      },
      confidenceLevels: {
        Low: "fewer than 5 evidence events",
        Medium: "5-20 evidence events",
        High: "more than 20 evidence events"
      },
      activityLevels: {
        Dormant: "no activity or last activity more than 30 days ago",
        Low: "less than 1 action per day",
        Normal: "1-5 actions per day",
        High: "more than 5 actions per day",
        Unknown: "no observed activity"
      },
      profileStatuses: {
        active: "medium or high confidence KX evidence is available",
        limited: "some KX evidence is available, but confidence is low",
        no_data: "no KX activity was found for the wallet"
      },
      noDataHandling: {
        rule: "No data is not high risk.",
        riskTier: "Unknown",
        confidenceLevel: "Low",
        numericScores: "financialBehaviorScore and riskScore are null",
        riskGuardDefault: "review"
      }
    },
    dataSources: {
      knowledgeExchange: "Internal marketplace, request, delivery, payment and rating activity.",
      arcNetwork:
        "Limited Arc Testnet RPC adapter using transaction count, native USDC balance and account code.",
      combined: "Weighted profile using KX activity and Arc Network RPC signals."
    },
    limitations: riskServiceLimitations
  };
}

const confidenceRank: Record<ConfidenceLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3
};

const defaultRiskGuardPolicy: Required<RiskGuardPolicy> = {
  maxRiskScore: 100,
  allowedRiskTiers: ["Low", "Medium", "High", "Unknown"],
  minimumConfidenceLevel: "Low",
  allowUnknownParticipantType: true,
  unknownWalletBehavior: "review"
};

export function normalizeRiskGuardPolicy(policy: RiskGuardPolicy = {}): Required<RiskGuardPolicy> {
  return {
    maxRiskScore: policy.maxRiskScore ?? defaultRiskGuardPolicy.maxRiskScore,
    allowedRiskTiers: policy.allowedRiskTiers?.length
      ? policy.allowedRiskTiers
      : defaultRiskGuardPolicy.allowedRiskTiers,
    minimumConfidenceLevel:
      policy.minimumConfidenceLevel ?? defaultRiskGuardPolicy.minimumConfidenceLevel,
    allowUnknownParticipantType:
      policy.allowUnknownParticipantType ?? defaultRiskGuardPolicy.allowUnknownParticipantType,
    unknownWalletBehavior:
      policy.unknownWalletBehavior ?? defaultRiskGuardPolicy.unknownWalletBehavior
  };
}

function getRiskGuardReason(
  decision: RiskGuardDecision,
  profile: RiskProfile,
  unknownWalletBehavior: UnknownWalletBehavior
): string {
  if (profile.profileStatus === "no_data") {
    const suffix =
      unknownWalletBehavior === "allow"
        ? "Policy allows unknown wallets."
        : unknownWalletBehavior === "block"
          ? "Policy blocks unknown wallets."
          : "Policy requires review.";
    return `${profile.message} Missing data is not negative evidence. ${suffix}`;
  }
  if (decision === "allow") return "Risk score and confidence are within policy.";
  if (decision === "block") return "One or more blocking risk checks failed.";
  return "One or more risk checks require review before transacting.";
}

export function evaluateRiskGuard(wallet: string, policy: RiskGuardPolicy = {}) {
  const normalizedPolicy = normalizeRiskGuardPolicy(policy);
  const profile = getRiskProfile(wallet);
  const isNoDataProfile = profile.profileStatus === "no_data";

  const checks: RiskGuardCheck[] = [
    {
      label: "Risk score threshold",
      passed:
        profile.scores.riskScore === null
          ? true
          : profile.scores.riskScore <= normalizedPolicy.maxRiskScore,
      value: profile.scores.riskScore,
      expected:
        profile.scores.riskScore === null
          ? "not evaluated for no-data profiles"
          : `<= ${normalizedPolicy.maxRiskScore}`
    },
    {
      label: "Risk tier allowed",
      passed: normalizedPolicy.allowedRiskTiers.includes(profile.scores.riskTier),
      value: profile.scores.riskTier,
      expected: normalizedPolicy.allowedRiskTiers.join(", ")
    },
    {
      label: "Confidence level",
      passed:
        confidenceRank[profile.scores.confidenceLevel] >=
        confidenceRank[normalizedPolicy.minimumConfidenceLevel],
      value: profile.scores.confidenceLevel,
      expected: `>= ${normalizedPolicy.minimumConfidenceLevel}`
    },
    {
      label: "User type known",
      passed:
        normalizedPolicy.allowUnknownParticipantType || profile.participant.type !== "unknown",
      value: profile.participant.type,
      expected: normalizedPolicy.allowUnknownParticipantType ? "any" : "not unknown"
    }
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  const riskScoreFailed = !checks[0].passed;
  const riskTierFailed = !checks[1].passed;
  const highRiskTierBlocked =
    profile.scores.riskTier === "High" && !normalizedPolicy.allowedRiskTiers.includes("High");
  const unknownParticipantBlocked =
    !isNoDataProfile &&
    !normalizedPolicy.allowUnknownParticipantType &&
    profile.participant.type === "unknown";

  const decision: RiskGuardDecision = isNoDataProfile
    ? normalizedPolicy.unknownWalletBehavior
    : failedChecks.length === 0
      ? "allow"
      : riskScoreFailed ||
          highRiskTierBlocked ||
          (riskTierFailed && profile.scores.riskTier === "High") ||
          unknownParticipantBlocked
        ? "block"
        : "review";

  return {
    ok: true,
    service: "KX Risk Guard",
    scope: riskServiceScope,
    network: riskServiceNetwork,
    chainId: ARC_TESTNET_CHAIN_ID,
    wallet: profile.wallet,
    profileStatus: profile.profileStatus,
    decision,
    allowed: decision === "allow",
    reason: getRiskGuardReason(decision, profile, normalizedPolicy.unknownWalletBehavior),
    policy: normalizedPolicy,
    profile: {
      scores: profile.scores,
      participant: {
        type: profile.participant.type,
        userType: profile.participant.userType ?? "unknown",
        kxDeclaredUserType: profile.participant.kxDeclaredUserType ?? "unknown",
        entityType: profile.participant.entityType ?? "unknown",
        name: profile.participant.name ?? null,
        operatorAddress: profile.participant.operatorAddress ?? null,
        arcIdentityId: profile.participant.arcIdentityId ?? null,
        identitySource: profile.participant.identitySource ?? "self_declared"
      }
    },
    checks,
    limitations: riskServiceLimitations
  };
}

export async function evaluateRiskGuardAsync(wallet: string, policy: RiskGuardPolicy = {}) {
  const normalizedPolicy = normalizeRiskGuardPolicy(policy);
  const profile = await getRiskProfileAsync(wallet);
  const isNoDataProfile = profile.profileStatus === "no_data";

  const checks: RiskGuardCheck[] = [
    {
      label: "Risk score threshold",
      passed:
        profile.scores.riskScore === null
          ? true
          : profile.scores.riskScore <= normalizedPolicy.maxRiskScore,
      value: profile.scores.riskScore,
      expected:
        profile.scores.riskScore === null
          ? "not evaluated for no-data profiles"
          : `<= ${normalizedPolicy.maxRiskScore}`
    },
    {
      label: "Risk tier allowed",
      passed: normalizedPolicy.allowedRiskTiers.includes(profile.scores.riskTier),
      value: profile.scores.riskTier,
      expected: normalizedPolicy.allowedRiskTiers.join(", ")
    },
    {
      label: "Confidence level",
      passed:
        confidenceRank[profile.scores.confidenceLevel] >=
        confidenceRank[normalizedPolicy.minimumConfidenceLevel],
      value: profile.scores.confidenceLevel,
      expected: `>= ${normalizedPolicy.minimumConfidenceLevel}`
    },
    {
      label: "User type known",
      passed:
        normalizedPolicy.allowUnknownParticipantType || profile.participant.type !== "unknown",
      value: profile.participant.type,
      expected: normalizedPolicy.allowUnknownParticipantType ? "any" : "not unknown"
    }
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  const riskScoreFailed = !checks[0].passed;
  const riskTierFailed = !checks[1].passed;
  const highRiskTierBlocked =
    profile.scores.riskTier === "High" && !normalizedPolicy.allowedRiskTiers.includes("High");
  const unknownParticipantBlocked =
    !isNoDataProfile &&
    !normalizedPolicy.allowUnknownParticipantType &&
    profile.participant.type === "unknown";

  const decision: RiskGuardDecision = isNoDataProfile
    ? normalizedPolicy.unknownWalletBehavior
    : failedChecks.length === 0
      ? "allow"
      : riskScoreFailed ||
          highRiskTierBlocked ||
          (riskTierFailed && profile.scores.riskTier === "High") ||
          unknownParticipantBlocked
        ? "block"
        : "review";

  return {
    ok: true,
    service: "KX Risk Guard",
    scope: riskServiceScope,
    network: riskServiceNetwork,
    chainId: ARC_TESTNET_CHAIN_ID,
    wallet: profile.wallet,
    profileStatus: profile.profileStatus,
    decision,
    allowed: decision === "allow",
    reason: getRiskGuardReason(decision, profile, normalizedPolicy.unknownWalletBehavior),
    policy: normalizedPolicy,
    profile: {
      scores: profile.scores,
      participant: {
        type: profile.participant.type,
        userType: profile.participant.userType ?? "unknown",
        kxDeclaredUserType: profile.participant.kxDeclaredUserType ?? "unknown",
        entityType: profile.participant.entityType ?? "unknown",
        name: profile.participant.name ?? null,
        operatorAddress: profile.participant.operatorAddress ?? null,
        arcIdentityId: profile.participant.arcIdentityId ?? null,
        identitySource: profile.participant.identitySource ?? "self_declared"
      }
    },
    checks,
    limitations: riskServiceLimitations
  };
}

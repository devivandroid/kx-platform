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
import { getCachedCrossChainContext } from "@/lib/server/risk-intelligence/crossChainContext";
import type {
  ConfidenceLevel,
  IdentityMatchStatus,
  IdentitySignalResult,
  RiskDataSource,
  RiskGuardCheck,
  RiskGuardDecision,
  RiskGuardPolicy,
  RiskProfile,
  CrossChainContext,
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
    const withCrossChain = await attachCachedCrossChainContext(enriched);
    const result = includeTrustSnapshot ? await attachTrustSnapshot(withCrossChain) : withCrossChain;
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

async function attachCachedCrossChainContext(
  profile: RiskProfile,
  options: { allowBaseline?: boolean; allowIdentityEstimation?: boolean } = {}
): Promise<RiskProfile> {
  const crossChainContext = await getCachedCrossChainContext(profile.wallet);
  if (!crossChainContext) return profile;

  if (options.allowBaseline && profile.profileStatus === "no_data" && crossChainContext.summary.networksAnalyzed > 0) {
    return buildCrossChainBaselineProfile(profile, crossChainContext);
  }

  const identityEstimation =
    options.allowIdentityEstimation && crossChainContext.summary.networksAnalyzed > 0
      ? buildCrossChainIdentityEstimation(profile, crossChainContext)
      : profile.identityEstimation;

  const confidenceLevel = crossChainContext.confidenceBoost
    ? maxConfidence(profile.scores.confidenceLevel, crossChainContext.confidenceBoost)
    : profile.scores.confidenceLevel;

  return {
    ...profile,
    scores: {
      ...profile.scores,
      confidenceLevel
    },
    identityEstimation,
    crossChainContext
  };
}

function getRiskTierFromScore(riskScore: number): RiskProfile["scores"]["riskTier"] {
  if (riskScore <= 24) return "Low";
  if (riskScore <= 59) return "Medium";
  return "High";
}

function getDaysSince(value: string | null): number | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return undefined;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function buildCrossChainBaselineProfile(profile: RiskProfile, crossChainContext: CrossChainContext): RiskProfile {
  const summary = crossChainContext.summary;
  const walletAgeDays = summary.earliestActivity ? getDaysSince(summary.earliestActivity) : undefined;
  const daysSinceLastActivity = getDaysSince(summary.lastActivity);
  const txCount = summary.transactionCount ?? 0;
  const activeDays = summary.activeDays ?? 0;
  const contractInteractions = summary.contractInteractionCount ?? 0;
  const evidenceCount = summary.networksAnalyzed;
  const establishedHistory = (walletAgeDays ?? 0) >= 180;
  const activeHistory = activeDays >= 30 || txCount >= 100;
  const recentEnough = daysSinceLastActivity === undefined || daysSinceLastActivity <= 90;

  let trustScore = 50;
  if (establishedHistory) trustScore += 10;
  if (activeHistory) trustScore += 10;
  if (contractInteractions >= 20) trustScore += 4;
  if (recentEnough && summary.lastActivity) trustScore += 3;
  trustScore = Math.min(75, trustScore);

  let riskScore = 58;
  if (establishedHistory) riskScore -= 8;
  if (activeHistory) riskScore -= 6;
  if (contractInteractions >= 20) riskScore -= 2;
  if (!recentEnough) riskScore += 5;
  riskScore = Math.max(32, Math.min(59, riskScore));

  const financialBehaviorScore = Math.round(trustScore * 10);
  const behavioralSignals: RiskProfile["behavioralSignals"] = [
    {
      label: "Established wallet history",
      value: walletAgeDays !== undefined ? `${walletAgeDays} days` : "Unavailable",
      status: establishedHistory ? "Normal" : "Unknown",
      description: "External indexed history is used as supporting context only."
    },
    {
      label: "Active across observed days",
      value: activeDays > 0 ? `${activeDays} days` : "Unavailable",
      status: activeDays > 0 ? "Normal" : "Unknown",
      description: "Activity breadth is not proof of trust, but improves evidence quality."
    },
    {
      label: "Historical wallet activity",
      value: txCount > 0 ? String(txCount) : "Unavailable",
      status: txCount > 0 ? "Normal" : "Unknown",
      description: "KX uses indexed transaction counts without token history, logs or internals."
    },
    {
      label: "Cross-chain coverage",
      value: summary.coverage === "full" ? "High" : summary.coverage,
      status: summary.coverage === "full" ? "Normal" : "Watch",
      description: "Coverage is reported from the indexed provider and is not treated as KX or Arc activity."
    }
  ];

  const riskSignals: RiskProfile["riskSignals"] = [
    {
      label: "Established wallet history lowers baseline risk",
      severity: "Info",
      description: "Long-lived Ethereum activity provides external context, but does not prove commerce outcomes."
    },
    {
      label: "Activity breadth supports moderate trust",
      severity: "Info",
      description:
        activeDays > 0
          ? `The wallet is active across ${activeDays} observed external-chain days.`
          : "No active-day coverage was available from the indexed provider."
    },
    {
      label: "Limited evidence about transaction outcomes",
      severity: "Watch",
      description:
        "Cross-chain context does not prove successful commerce outcomes, counterparty satisfaction or dispute history."
    }
  ];

  return {
    ...profile,
    dataSource: "cross_chain",
    profileStatus: summary.networksAnalyzed > 0 ? "limited" : "no_data",
    message: "External cross-chain context found for this wallet.",
    recommendation:
      "Use this as a conservative baseline only. Review before transacting unless your policy explicitly allows cross-chain-only evidence.",
    scores: {
      financialBehaviorScore,
      trustScore,
      riskScore,
      riskTier: getRiskTierFromScore(riskScore),
      confidenceLevel: crossChainContext.confidenceBoost ?? "Medium"
    },
    activity: {
      ...profile.activity,
      completedActions: 0,
      successfulPayments: 0,
      failedPayments: 0,
      totalCompletedVolumeUSDC: "0.00",
      averageTransactionAmountUSDC: "0.00",
      averageActionsPerDay: "0.00",
      lastActivity: undefined,
      daysSinceLastActivity: undefined,
      activityLevel: "Unknown",
      evidenceCount
    },
    metadata: {
      ...profile.metadata,
      dataFreshness: "External context",
      lastIndexed: crossChainContext.refreshedAt ?? undefined,
      cacheSource: crossChainContext.cacheSource,
      coverage: {
        fullHistory: crossChainContext.summary.coverage === "full",
        description: `External indexed context from supported networks. Coverage: ${
          crossChainContext.summary.coverage === "full" ? "High" : crossChainContext.summary.coverage
        }.`
      }
    },
    identityEstimation: buildCrossChainIdentityEstimation(profile, crossChainContext),
    behavioralSignals,
    riskSignals,
    crossChainContext,
    limitations: [
      ...riskServiceLimitations,
      "Cross-chain-only profiles are conservative baseline assessments.",
      "External activity does not prove transaction outcomes, identity, intent, KYC, AML or compliance status."
    ]
  };
}

function identitySignal(
  label: string,
  result: IdentitySignalResult,
  explanation: string
): NonNullable<RiskProfile["identityEstimation"]>["signals"][number] {
  return { label, result, explanation };
}

function getCrossChainTimestampSample(context: CrossChainContext): string[] {
  return context.networks
    .filter((network) => network.status === "available")
    .flatMap((network) => network.timestampSample ?? [])
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .slice(-50);
}

type CircadianRestWindow = {
  offset: number;
  startHour: number;
  durationHours: number;
  activeHours: number;
  restShare: number;
  restFreeDayShare: number;
  continuousActivity: boolean;
  repetitiveTiming: boolean;
};

function getLocalHour(timestamp: number, offset: number): number {
  const hour = new Date(timestamp + offset * 3_600_000).getUTCHours();
  return ((hour % 24) + 24) % 24;
}

function getLocalDay(timestamp: number, offset: number): string {
  return new Date(timestamp + offset * 3_600_000).toISOString().slice(0, 10);
}

function isHourInWindow(hour: number, startHour: number, durationHours: number): boolean {
  const endHour = (startHour + durationHours) % 24;
  if (durationHours >= 24) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function getIntervalsMinutes(timestamps: number[]): number[] {
  const intervals: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    intervals.push((timestamps[index] - timestamps[index - 1]) / 60_000);
  }
  return intervals.filter((value) => value > 0);
}

function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function inferRestWindow(timestamps: number[]): CircadianRestWindow | null {
  if (timestamps.length < 8) return null;

  const intervals = getIntervalsMinutes(timestamps);
  const intervalCv = coefficientOfVariation(intervals);
  const repetitiveTiming = intervalCv !== null && intervals.length >= 8 && intervalCv <= 0.45;
  let bestWindow: CircadianRestWindow | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let offset = -12; offset <= 14; offset += 1) {
    const hours = timestamps.map((value) => getLocalHour(value, offset));
    const activeHours = new Set(hours).size;
    const days = new Map<string, { total: number; rest: number }>();
    for (const timestamp of timestamps) {
      const day = getLocalDay(timestamp, offset);
      const entry = days.get(day) ?? { total: 0, rest: 0 };
      entry.total += 1;
      days.set(day, entry);
    }

    for (let durationHours = 6; durationHours <= 10; durationHours += 1) {
      for (let startHour = 0; startHour < 24; startHour += 1) {
        let restCount = 0;
        const dayRestCounts = new Map(days);
        for (const timestamp of timestamps) {
          const localHour = getLocalHour(timestamp, offset);
          if (!isHourInWindow(localHour, startHour, durationHours)) continue;
          restCount += 1;
          const day = getLocalDay(timestamp, offset);
          const entry = dayRestCounts.get(day);
          if (entry) entry.rest += 1;
        }

        const restShare = restCount / timestamps.length;
        const daysObserved = dayRestCounts.size;
        const restFreeDays = [...dayRestCounts.values()].filter((entry) => entry.rest === 0).length;
        const restFreeDayShare = daysObserved > 0 ? restFreeDays / daysObserved : 0;
        const continuousActivity = activeHours >= 20;
        const score =
          restShare * 2.4 +
          (1 - restFreeDayShare) * 0.7 +
          (continuousActivity ? 0.3 : 0) -
          (durationHours / 10) * 0.08;

        if (score < bestScore) {
          bestScore = score;
          bestWindow = {
            offset,
            startHour,
            durationHours,
            activeHours,
            restShare,
            restFreeDayShare,
            continuousActivity,
            repetitiveTiming
          };
        }
      }
    }
  }

  return bestWindow;
}

function formatRestWindow(window: CircadianRestWindow): string {
  const endHour = (window.startHour + window.durationHours) % 24;
  const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  const offsetLabel = window.offset >= 0 ? `UTC+${window.offset}` : `UTC${window.offset}`;
  return `${formatHour(window.startHour)}-${formatHour(endHour)} (${offsetLabel})`;
}

function getCrossChainCircadianSignal(
  context: CrossChainContext
): NonNullable<RiskProfile["identityEstimation"]>["signals"][number] {
  const timestampSample = getCrossChainTimestampSample(context);
  const timestamps = timestampSample
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (timestamps.length < 8) {
    return identitySignal(
      "Circadian Activity Signal",
      "Unknown",
      "At least 8 timestamped transactions are needed for a basic circadian estimate."
    );
  }

  const restWindow = inferRestWindow(timestamps);
  if (!restWindow) {
    return identitySignal(
      "Circadian Activity Signal",
      "Unknown",
      "Insufficient cross-chain timing evidence to infer a recurring rest window."
    );
  }

  const occasionalActivityThreshold = Math.max(0.08, Math.min(0.18, 2 / timestamps.length));
  const frequentRestActivityThreshold = Math.max(0.2, occasionalActivityThreshold * 2);
  const hasClearRestWindow =
    restWindow.durationHours >= 6 &&
    restWindow.restFreeDayShare >= 0.45 &&
    restWindow.restShare <= 0.18;
  const hasStrongAgentEvidence =
    !hasClearRestWindow &&
    (restWindow.continuousActivity ||
      restWindow.restShare >= frequentRestActivityThreshold ||
      (restWindow.repetitiveTiming && restWindow.activeHours >= 16));
  const explanation =
    `Inferred rest window ${formatRestWindow(restWindow)} from cross-chain timestamps; ` +
    `${(restWindow.restShare * 100).toFixed(0)}% of activity falls inside it; ` +
    `continuous 24/7 behavior ${restWindow.continuousActivity ? "detected" : "not detected"}.`;

  if (hasStrongAgentEvidence) {
    return identitySignal("Circadian Activity Signal", "Agent-like", explanation);
  }

  if (hasClearRestWindow && restWindow.restShare <= occasionalActivityThreshold) {
    return identitySignal("Circadian Activity Signal", "Human", explanation);
  }

  return identitySignal("Circadian Activity Signal", "Unknown", explanation);
}

function getCrossChainCoverageSignalResult(
  coverage: CrossChainContext["summary"]["coverage"] | "partial"
): IdentitySignalResult {
  if (coverage === "full") return "Positive signal";
  if (coverage === "partial") return "Weak positive signal";
  if (coverage === "limited") return "Limited evidence";
  return "Unknown";
}

function getCrossChainIdentityConfidence(input: {
  networksAnalyzed: number;
  coverage: CrossChainContext["summary"]["coverage"];
  txCount: number;
  activeDays: number;
  walletAgeDays?: number;
  knownSignals: number;
}): ConfidenceLevel {
  if (input.networksAnalyzed === 0 || input.knownSignals < 3) return "Low";
  if (
    input.coverage === "full" &&
    input.txCount >= 50 &&
    input.activeDays >= 20 &&
    (input.walletAgeDays ?? 0) >= 180
  ) {
    return "High";
  }
  if (input.txCount >= 10 || input.activeDays >= 5) return "Medium";
  return "Low";
}

function getCrossChainEstimatedIdentity(input: {
  humanPoints: number;
  agentPoints: number;
  criticalAgentSignals: number;
  knownSignals: number;
}): Pick<NonNullable<RiskProfile["identityEstimation"]>, "estimatedUserType" | "probability"> {
  if (input.knownSignals < 3) return { estimatedUserType: "Unknown", probability: 50 };

  if (input.criticalAgentSignals >= 2 || input.agentPoints - input.humanPoints >= 30) {
    const probability = Math.max(10, Math.min(40, 45 - Math.floor((input.agentPoints - input.humanPoints) / 4)));
    return {
      estimatedUserType: probability <= 30 ? "Likely Agent" : "Leaning Agent",
      probability
    };
  }

  if (input.humanPoints - input.agentPoints >= 90 && input.criticalAgentSignals === 0) {
    return {
      estimatedUserType: "Likely Human",
      probability: Math.min(88, 80 + Math.floor((input.humanPoints - input.agentPoints - 90) / 5))
    };
  }

  if (input.humanPoints > input.agentPoints) {
    return {
      estimatedUserType: "Leaning Human",
      probability: Math.max(56, Math.min(78, 55 + Math.floor((input.humanPoints - input.agentPoints) / 3)))
    };
  }

  if (input.agentPoints > input.humanPoints) {
    return {
      estimatedUserType: "Leaning Agent",
      probability: Math.max(35, Math.min(44, 45 - Math.floor((input.agentPoints - input.humanPoints) / 6)))
    };
  }

  return { estimatedUserType: "Mixed / Inconclusive", probability: 55 };
}

function buildCrossChainIdentityEstimation(
  profile: RiskProfile,
  crossChainContext: CrossChainContext
): NonNullable<RiskProfile["identityEstimation"]> {
  const summary = crossChainContext.summary;
  const walletAgeDays = summary.earliestActivity ? getDaysSince(summary.earliestActivity) : undefined;
  const daysSinceLastActivity = getDaysSince(summary.lastActivity);
  const txCount = summary.transactionCount ?? 0;
  const outboundTxCount = summary.outboundTransactionCount ?? 0;
  const activeDays = summary.activeDays ?? 0;
  const contractInteractions = summary.contractInteractionCount ?? 0;
  const interactionRatio = txCount > 0 ? contractInteractions / txCount : 0;

  let humanPoints = 0;
  let agentPoints = 0;
  let criticalAgentSignals = 0;
  const signals: NonNullable<RiskProfile["identityEstimation"]>["signals"] = [];

  if (outboundTxCount > 0) {
    humanPoints += 18;
    signals.push(
      identitySignal(
        "EOA detected",
        "Human",
        `${outboundTxCount} outbound normal transactions were observed. This is one signal only and does not prove the wallet belongs to a human.`
      )
    );
  } else {
    signals.push(
      identitySignal("EOA detected", "Unknown", "No outbound normal transactions were available in the indexed context.")
    );
  }

  signals.push(getCrossChainCircadianSignal(crossChainContext));

  if (walletAgeDays === undefined) {
    signals.push(identitySignal("Wallet age", "Unknown", "Wallet age was not available from indexed context."));
  } else if (walletAgeDays < 7) {
    agentPoints += 18;
    criticalAgentSignals += 1;
    signals.push(identitySignal("Wallet age", "Agent-like", `Very recent wallet: ${walletAgeDays} days old.`));
  } else if (walletAgeDays >= 180) {
    humanPoints += 22;
    signals.push(identitySignal("Wallet age", "Human", `Long-lived wallet history: ${walletAgeDays} days.`));
  } else {
    humanPoints += 8;
    signals.push(identitySignal("Wallet age", "Human", `Established wallet history: ${walletAgeDays} days.`));
  }

  if (activeDays >= 30) {
    humanPoints += 18;
    signals.push(identitySignal("Active days", "Human", `Activity spans ${activeDays} observed days.`));
  } else if (activeDays > 0 && txCount >= 30 && activeDays <= 2) {
    agentPoints += 18;
    criticalAgentSignals += 1;
    signals.push(
      identitySignal("Active days", "Agent-like", `${txCount} transactions are concentrated into only ${activeDays} active day(s).`)
    );
  } else if (activeDays > 0) {
    humanPoints += 6;
    signals.push(identitySignal("Active days", "Human", `Limited but observable activity across ${activeDays} days.`));
  } else {
    signals.push(identitySignal("Active days", "Unknown", "Active-day coverage was not available."));
  }

  if (txCount >= 50 && txCount <= 1_000) {
    humanPoints += 12;
    signals.push(identitySignal("Transaction count", "Human", `${txCount} indexed transactions were observed.`));
  } else if (txCount > 1_000 && activeDays < 20) {
    agentPoints += 16;
    criticalAgentSignals += 1;
    signals.push(identitySignal("Transaction count", "Agent-like", `${txCount} transactions over a short active window is automation-like.`));
  } else if (txCount > 0) {
    humanPoints += 4;
    signals.push(identitySignal("Transaction count", "Human", `${txCount} indexed transactions were observed.`));
  } else {
    signals.push(identitySignal("Transaction count", "Unknown", "Transaction count was not available."));
  }

  if (contractInteractions >= 10 && interactionRatio < 0.85) {
    humanPoints += 8;
    signals.push(
      identitySignal(
        "Contract interaction diversity",
        "Human",
        `${contractInteractions} contract interactions were observed without extreme concentration.`
      )
    );
  } else if (txCount >= 30 && interactionRatio >= 0.95) {
    agentPoints += 12;
    signals.push(
      identitySignal(
        "Contract interaction diversity",
        "Agent-like",
        "Nearly all indexed transactions are contract interactions, which can indicate automation."
      )
    );
  } else if (contractInteractions > 0) {
    signals.push(
      identitySignal(
        "Contract interaction diversity",
        "Unknown",
        `${contractInteractions} contract interactions were observed, but diversity is not conclusive.`
      )
    );
  } else {
    signals.push(identitySignal("Contract interaction diversity", "Unknown", "No contract interaction coverage was available."));
  }

  if (daysSinceLastActivity === undefined) {
    signals.push(identitySignal("Activity recency", "Unknown", "Last activity was not available."));
  } else if (daysSinceLastActivity <= 365) {
    humanPoints += 6;
    signals.push(identitySignal("Activity recency", "Human", `Last indexed activity was ${daysSinceLastActivity} days ago.`));
  } else {
    signals.push(identitySignal("Activity recency", "Unknown", `Last indexed activity was ${daysSinceLastActivity} days ago.`));
  }

  signals.push(
    identitySignal(
      "Cross-chain coverage",
      getCrossChainCoverageSignalResult(summary.coverage),
      `Coverage is ${summary.coverage === "full" ? "High" : summary.coverage} across ${
        summary.networksAnalyzed
      } analyzed network(s). Coverage improves evidence quality but does not prove identity.`
    )
  );

  const scoredSignals = signals.filter((signalItem) => signalItem.label !== "Cross-chain coverage");
  const knownSignals = scoredSignals.filter((signalItem) => signalItem.result !== "Unknown").length;
  const { estimatedUserType, probability } = getCrossChainEstimatedIdentity({
    humanPoints,
    agentPoints,
    criticalAgentSignals,
    knownSignals
  });
  const confidence = getCrossChainIdentityConfidence({
    networksAnalyzed: summary.networksAnalyzed,
    coverage: summary.coverage,
    txCount,
    activeDays,
    walletAgeDays,
    knownSignals
  });
  const comparableDeclaredUserType =
    profile.participant.kxDeclaredUserType && profile.participant.kxDeclaredUserType !== "unknown"
      ? profile.participant.kxDeclaredUserType
      : "unknown";

  return {
    estimatedUserType,
    probability,
    confidence,
    evidenceSource: "Cross-Chain Context",
    kxDeclaredUserType: profile.participant.kxDeclaredUserType ?? "unknown",
    arcDeclaredIdentity: profile.participant.arcIdentityId ?? null,
    arcDeclaredUserType: "unknown",
    declaredUserType: profile.participant.kxDeclaredUserType ?? "unknown",
    identityMatch: getIdentityMatch(comparableDeclaredUserType, estimatedUserType),
    cacheSource: "live_estimation",
    lastEstimatedAt: crossChainContext.refreshedAt ?? new Date().toISOString(),
    signals,
    limitations: [
      "This is behavioral estimation, not identity verification.",
      "Uses real indexed cross-chain context when KX and Arc evidence are unavailable.",
      "Does not use self-declared userType as model input.",
      "Not KYC, AML, sanctions, compliance screening or bot detection certainty."
    ]
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
      const withCrossChain = await attachCachedCrossChainContext(enriched);
      const result = includeTrustSnapshot ? await attachTrustSnapshot(withCrossChain) : withCrossChain;
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
      const withCrossChain = await attachCachedCrossChainContext(enrichedCombined, {
        allowBaseline: true,
        allowIdentityEstimation: true
      });
      const result = includeTrustSnapshot
        ? await attachTrustSnapshot(withCrossChain)
        : withCrossChain;
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
    crossChainContext: profile.crossChainContext,
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
    crossChainContext: profile.crossChainContext,
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
          "repeated purchase starts without completion",
          "completed work not released after expected window",
          "assigned job missed deadline without submission",
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
      crossChain:
        "Conservative fallback baseline using real indexed Ethereum/Base/BNB context when KX and Arc data are unavailable.",
      combined: "Weighted profile using KX activity, Arc Network RPC signals and optional external context."
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

import {
  getEntityTypeFromLegacy,
  isEntityType,
  isParticipantType,
  isUserType
} from "@/lib/participants";
import { getIdentitySource, type ArcIdentitySource } from "@/lib/arcNative";
import type {
  ActivityLevel,
  BehavioralSignalStatus,
  ReputationEvent,
  ReputationSummary,
  RiskSignalSeverity,
  RiskTier
} from "@/types/reputation";

const positiveEvents = new Set([
  "RESOURCE_PURCHASED",
  "RESOURCE_SOLD",
  "PAYMENT_VERIFIED",
  "RESOURCE_DOWNLOADED",
  "ESCROW_FUNDED",
  "DELIVERY_SUBMITTED",
  "FUNDS_RELEASED",
  "API_UNLOCK_SUCCESS"
]);

const negativeEvents = new Set(["REQUEST_CANCELLED"]);

function toNumber(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRiskTier(riskScore: number, evidenceCount: number): RiskTier {
  if (evidenceCount === 0) return "Unknown";
  if (riskScore <= 24) return "Low";
  if (riskScore <= 59) return "Medium";
  return "High";
}

function getConfidence(evidenceCount: number): "Low" | "Medium" | "High" {
  if (evidenceCount > 20) return "High";
  if (evidenceCount >= 5) return "Medium";
  return "Low";
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getSignalStatus(value: number, watchAt: number, elevatedAt: number): BehavioralSignalStatus {
  if (!Number.isFinite(value)) return "Unknown";
  if (value >= elevatedAt) return "Elevated";
  if (value >= watchAt) return "Watch";
  return "Normal";
}

function getActivityLevel({
  evidenceCount,
  averageActionsPerDay,
  daysSinceLastActivity
}: {
  evidenceCount: number;
  averageActionsPerDay: number;
  daysSinceLastActivity: number | null;
}): ActivityLevel {
  if (evidenceCount === 0 || (daysSinceLastActivity !== null && daysSinceLastActivity > 30)) {
    return "Dormant";
  }
  if (averageActionsPerDay > 5) return "High";
  if (averageActionsPerDay >= 1) return "Normal";
  return "Low";
}

function buildEmptySummary(
  wallet: string,
  participant: Pick<
    ReputationSummary,
    "userType" | "kxDeclaredUserType" | "entityType" | "participantType" | "participantName"
    | "operatorAddress" | "arcIdentityId" | "identitySource"
  >
): ReputationSummary {
  return {
    wallet,
    ...participant,
    reputationScore: 0,
    financialRiskScore: 0,
    riskTier: "Unknown",
    confidenceLevel: "Low",
    paymentSuccessRate: 0,
    totalVolumeUSDC: "0.00",
    successfulPayments: 0,
    failedPayments: 0,
    resourcesPurchased: 0,
    resourcesDownloaded: 0,
    requestsCreated: 0,
    escrowsFunded: 0,
    deliveriesSubmitted: 0,
    fundsReleased: 0,
    disputeRate: 0,
    refundRate: 0,
    lastActivity: null,
    evidenceCount: 0,
    completedActions: 0,
    totalCompletedVolumeUSDC: "0.00",
    uniqueCounterparties: 0,
    averageTransactionAmountUSDC: "0.00",
    averageActionsPerDay: "0.0",
    daysSinceLastActivity: null,
    activityLevel: "Dormant",
    purchaseStartAbandonmentRate: 0,
    escrowCompletionRate: 0,
    downloadAfterPurchaseRate: 0,
    volumeConcentrationRate: 0,
    behavioralSignals: [
      { label: "Evidence count", value: "0 events", status: "Unknown" },
      { label: "Activity recency", value: "No activity", status: "Unknown" }
    ],
    riskSignals: [
      {
        label: "Limited evidence",
        severity: "Low confidence",
        description: "Risk profile has no KX activity yet."
      }
    ]
  };
}

function isExplicitKxUserType(metadata?: ReputationEvent["metadata"]): boolean {
  return metadata?.userTypeExplicit === true || metadata?.userTypeSource === "explicit";
}

export function calculateReputation(wallet: string, events: ReputationEvent[]): ReputationSummary {
  const walletEvents = events.filter(
    (event) => event.walletAddress.toLowerCase() === wallet.toLowerCase()
  );
  const participantMetadata = walletEvents.find((event) =>
    isUserType(event.metadata?.userType) ||
    isParticipantType(event.metadata?.participantType) ||
    typeof event.metadata?.arcIdentityId === "string"
  )?.metadata;
  const participantType = isParticipantType(participantMetadata?.participantType)
    ? participantMetadata.participantType
    : undefined;
  const kxDeclaredUserType =
    isUserType(participantMetadata?.userType) && isExplicitKxUserType(participantMetadata)
      ? participantMetadata.userType
      : undefined;
  const userType = kxDeclaredUserType;
  const entityType = isEntityType(participantMetadata?.entityType)
    ? participantMetadata.entityType
    : getEntityTypeFromLegacy(participantType);
  const participantName =
    typeof participantMetadata?.participantName === "string"
      ? participantMetadata.participantName
      : undefined;
  const operatorAddress =
    typeof participantMetadata?.operatorAddress === "string"
      ? participantMetadata.operatorAddress
      : undefined;
  const arcIdentityId =
    typeof participantMetadata?.arcIdentityId === "string"
      ? participantMetadata.arcIdentityId
      : undefined;
  const identitySource =
    participantMetadata?.identitySource === "arc_identity" ||
    participantMetadata?.identitySource === "self_declared"
      ? (participantMetadata.identitySource as ArcIdentitySource)
      : getIdentitySource(arcIdentityId);
  const evidenceCount = walletEvents.length;
  const successfulPayments = walletEvents.filter((event) =>
    ["RESOURCE_PURCHASED", "RESOURCE_SOLD", "PAYMENT_VERIFIED", "FUNDS_RELEASED"].includes(event.eventType)
  ).length;
  const failedPayments = walletEvents.filter(
    (event) => event.eventType === "REQUEST_CANCELLED" || event.eventType === "RESOURCE_PURCHASE_STARTED"
  ).length;
  const startedPurchases = walletEvents.filter(
    (event) => event.eventType === "RESOURCE_PURCHASE_STARTED"
  ).length;
  const completedPurchases = walletEvents.filter(
    (event) => event.eventType === "RESOURCE_PURCHASED"
  ).length;
  const incompletePurchases = Math.max(0, startedPurchases - completedPurchases);
  const completedVolumeEvents = walletEvents.filter((event) =>
    ["RESOURCE_PURCHASED", "RESOURCE_SOLD", "FUNDS_RELEASED"].includes(event.eventType)
  );
  const totalCompletedVolume = completedVolumeEvents.reduce(
    (sum, event) => sum + toNumber(event.amountUSDC),
    0
  );
  const totalVolume = totalCompletedVolume;
  const resourcesPurchased = completedPurchases;
  const resourcesDownloaded = walletEvents.filter(
    (event) => event.eventType === "RESOURCE_DOWNLOADED"
  ).length;
  const requestsCreated = walletEvents.filter((event) => event.eventType === "REQUEST_CREATED").length;
  const escrowsFunded = walletEvents.filter((event) => event.eventType === "ESCROW_FUNDED").length;
  const deliveriesSubmitted = walletEvents.filter(
    (event) => event.eventType === "DELIVERY_SUBMITTED"
  ).length;
  const fundsReleased = walletEvents.filter((event) => event.eventType === "FUNDS_RELEASED").length;
  const completedActions = walletEvents.filter((event) => positiveEvents.has(event.eventType)).length;
  const uniqueCounterparties = new Set(
    walletEvents
      .map((event) => event.counterpartyAddress?.toLowerCase())
      .filter((value): value is string => Boolean(value))
  ).size;
  const counterpartyVolumes = new Map<string, number>();
  for (const event of completedVolumeEvents) {
    const counterparty = event.counterpartyAddress?.toLowerCase();
    if (counterparty) {
      counterpartyVolumes.set(counterparty, (counterpartyVolumes.get(counterparty) ?? 0) + toNumber(event.amountUSDC));
    }
  }
  const largestCounterpartyVolume = Math.max(0, ...counterpartyVolumes.values());
  const volumeConcentrationRate =
    totalCompletedVolume > 0 ? largestCounterpartyVolume / totalCompletedVolume : 0;

  if (evidenceCount === 0) {
    return buildEmptySummary(wallet, {
      userType,
      kxDeclaredUserType,
      entityType,
      participantType,
      participantName,
      operatorAddress,
      arcIdentityId,
      identitySource
    });
  }

  let score = 500;
  score += walletEvents.filter((event) => positiveEvents.has(event.eventType)).length * 35;
  score -= walletEvents.filter((event) => negativeEvents.has(event.eventType)).length * 85;
  score -= incompletePurchases * 45;
  score += Math.min(totalVolume * 1.4, 180);
  score += Math.min(resourcesDownloaded * 18, 90);
  score += Math.min(fundsReleased * 40, 120);
  score += Math.min(uniqueCounterparties * 18, 72);
  if (evidenceCount < 5) score -= 35;
  score = Math.max(0, Math.min(1000, Math.round(score)));

  const confidenceLevel = getConfidence(evidenceCount);
  const purchaseStartAbandonmentRate =
    startedPurchases > 0 ? incompletePurchases / startedPurchases : 0;
  const escrowCompletionRate = escrowsFunded > 0 ? fundsReleased / escrowsFunded : 0;
  const downloadAfterPurchaseRate =
    completedPurchases > 0 ? Math.min(resourcesDownloaded / completedPurchases, 1) : 0;
  const paymentAttempts = successfulPayments + failedPayments;
  const paymentSuccessRate = paymentAttempts > 0 ? successfulPayments / paymentAttempts : 0;
  const lastActivity = walletEvents
    .map((event) => event.timestamp)
    .sort()
    .at(-1) ?? null;
  const firstActivity = walletEvents
    .map((event) => event.timestamp)
    .sort()
    .at(0) ?? null;
  const daysSinceLastActivity = lastActivity
    ? Math.max(0, Math.floor((Date.now() - Date.parse(lastActivity)) / 86_400_000))
    : null;
  const observedDays =
    firstActivity && lastActivity
      ? Math.max(1, Math.ceil((Date.parse(lastActivity) - Date.parse(firstActivity)) / 86_400_000) + 1)
      : 1;
  const averageActionsPerDay = evidenceCount / observedDays;
  const averageTransactionAmount =
    completedVolumeEvents.length > 0 ? totalCompletedVolume / completedVolumeEvents.length : 0;
  const behavioralRisk =
    purchaseStartAbandonmentRate * 24 +
    (paymentAttempts > 0 ? (1 - paymentSuccessRate) * 22 : 0) +
    (escrowsFunded > 0 ? (1 - Math.min(escrowCompletionRate, 1)) * 14 : 0) +
    (downloadAfterPurchaseRate === 0 && completedPurchases > 0 ? 8 : 0) +
    (volumeConcentrationRate > 0.85 ? 18 : volumeConcentrationRate > 0.65 ? 8 : 0) +
    (daysSinceLastActivity !== null && daysSinceLastActivity > 30 ? 10 : 0) +
    (averageActionsPerDay > 5 ? 8 : 0) +
    (evidenceCount < 5 ? 14 : 0);
  const positiveEvidenceDiscount =
    Math.min(uniqueCounterparties * 2, 8) +
    Math.min(completedActions * 0.6, 8) +
    Math.min(totalCompletedVolume * 0.08, 6);
  const financialRiskScore = Math.max(
    5,
    Math.min(100, Math.round(behavioralRisk - positiveEvidenceDiscount + 10))
  );
  const riskTier = getRiskTier(financialRiskScore, evidenceCount);
  const activityLevel = getActivityLevel({
    evidenceCount,
    averageActionsPerDay,
    daysSinceLastActivity
  });
  const behavioralSignals: ReputationSummary["behavioralSignals"] = [
    {
      label: "Payment completion rate",
      value: paymentAttempts > 0 ? formatPercent(paymentSuccessRate) : "Unknown",
      status:
        paymentAttempts === 0
          ? "Unknown"
          : paymentSuccessRate >= 0.9
            ? "Normal"
            : paymentSuccessRate >= 0.7
              ? "Watch"
              : "Elevated"
    },
    {
      label: "Purchase abandonment",
      value: startedPurchases > 0 ? formatPercent(purchaseStartAbandonmentRate) : "0%",
      status: getSignalStatus(purchaseStartAbandonmentRate, 0.2, 0.5)
    },
    {
      label: "Escrow completion rate",
      value: escrowsFunded > 0 ? formatPercent(escrowCompletionRate) : "No escrow history",
      status:
        escrowsFunded === 0 ? "Unknown" : escrowCompletionRate >= 0.8 ? "Normal" : "Watch"
    },
    {
      label: "Download-after-purchase rate",
      value: completedPurchases > 0 ? formatPercent(downloadAfterPurchaseRate) : "No purchases",
      status:
        completedPurchases === 0
          ? "Unknown"
          : downloadAfterPurchaseRate >= 0.5
            ? "Normal"
            : "Watch"
    },
    {
      label: "Counterparty diversity",
      value: `${uniqueCounterparties} counterpart${uniqueCounterparties === 1 ? "y" : "ies"}`,
      status: uniqueCounterparties >= 3 ? "Normal" : uniqueCounterparties > 0 ? "Watch" : "Unknown"
    },
    {
      label: "Activity recency",
      value:
        daysSinceLastActivity === null
          ? "No activity"
          : daysSinceLastActivity === 0
            ? "Active today"
            : `${daysSinceLastActivity} days ago`,
      status:
        daysSinceLastActivity === null
          ? "Unknown"
          : daysSinceLastActivity <= 7
            ? "Normal"
            : daysSinceLastActivity <= 30
              ? "Watch"
              : "Elevated"
    },
    {
      label: "Activity velocity",
      value: `${averageActionsPerDay.toFixed(1)} actions/day`,
      status: averageActionsPerDay > 5 ? "Watch" : averageActionsPerDay >= 1 ? "Normal" : "Watch"
    },
    {
      label: "Volume concentration",
      value: totalCompletedVolume > 0 ? formatPercent(volumeConcentrationRate) : "Unknown",
      status: getSignalStatus(volumeConcentrationRate, 0.65, 0.85)
    },
    {
      label: "Evidence count",
      value: `${evidenceCount} events`,
      status: evidenceCount >= 5 ? "Normal" : "Watch"
    }
  ];
  const riskSignals: ReputationSummary["riskSignals"] = [];
  const pushRisk = (label: string, severity: RiskSignalSeverity, description: string) => {
    riskSignals.push({ label, severity, description });
  };

  if (!participantType) {
    pushRisk(
      "Unknown user type",
      "Monitor",
      "Participant metadata is unavailable for this wallet."
    );
  }
  if (evidenceCount < 5) {
    pushRisk(
      "Limited evidence",
      "Low confidence",
      "Risk profile is based on fewer than 5 KX events."
    );
  }
  if (purchaseStartAbandonmentRate >= 0.5) {
    pushRisk(
      "Purchase starts without completion",
      "Elevated",
      "Several purchase attempts started without corresponding completion events."
    );
  } else if (purchaseStartAbandonmentRate >= 0.2) {
    pushRisk(
      "Purchase starts without completion",
      "Watch",
      "Some purchase attempts started without corresponding completion events."
    );
  }
  if (walletEvents.some((event) => event.eventType === "REQUEST_CANCELLED")) {
    pushRisk(
      "Cancellation history",
      "Watch",
      "At least one request cancellation is present in the activity history."
    );
  }
  if (escrowsFunded > 0 && fundsReleased === 0) {
    pushRisk(
      "No completed escrow history",
      "Monitor",
      "Escrow funding exists, but no released funds event is present yet."
    );
  }
  if (activityLevel === "Dormant") {
    pushRisk(
      "Dormant participant",
      "Monitor",
      "No recent KX activity is available for this wallet."
    );
  }
  if (averageActionsPerDay > 5) {
    pushRisk(
      "Recent activity spike",
      "Monitor",
      "Activity velocity is higher than the normal preview range."
    );
  }
  if (volumeConcentrationRate > 0.75) {
    pushRisk(
      "Counterparty concentration",
      "Watch",
      "Most completed volume is concentrated with one counterparty."
    );
  }
  if (riskSignals.length === 0) {
    pushRisk(
      "No elevated review signals",
      "Monitor",
      "No elevated review signals were detected in the current KX history."
    );
  }

  return {
    wallet,
    userType,
    kxDeclaredUserType,
    entityType,
    participantType,
    participantName,
    operatorAddress,
    arcIdentityId,
    identitySource,
    reputationScore: score,
    financialRiskScore,
    riskTier,
    confidenceLevel,
    paymentSuccessRate,
    totalVolumeUSDC: totalVolume.toFixed(2),
    successfulPayments,
    failedPayments,
    resourcesPurchased,
    resourcesDownloaded,
    requestsCreated,
    escrowsFunded,
    deliveriesSubmitted,
    fundsReleased,
    disputeRate: 0,
    refundRate: 0,
    lastActivity,
    evidenceCount,
    completedActions,
    totalCompletedVolumeUSDC: totalCompletedVolume.toFixed(2),
    uniqueCounterparties,
    averageTransactionAmountUSDC: averageTransactionAmount.toFixed(2),
    averageActionsPerDay: averageActionsPerDay.toFixed(1),
    daysSinceLastActivity,
    activityLevel,
    purchaseStartAbandonmentRate,
    escrowCompletionRate,
    downloadAfterPurchaseRate,
    volumeConcentrationRate,
    behavioralSignals,
    riskSignals
  };
}

export function getUniqueWallets(events: ReputationEvent[]): string[] {
  return [...new Set(events.map((event) => event.walletAddress))];
}

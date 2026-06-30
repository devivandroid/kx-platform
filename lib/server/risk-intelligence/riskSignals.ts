import type { ReputationSummary } from "@/types/reputation";
import type {
  RiskProfile,
  RiskProfileStatus,
  RiskSignalSeverity
} from "@/lib/server/risk-intelligence/types";

export const riskIntelligenceLimitations = [
  "Based only on KX events",
  "Not an official Arc or Circle score",
  "Preview Risk Intelligence model",
  "Does not score all Arc wallets globally",
  "Preview storage is local/ephemeral",
  "Future Arc-wide indexing is roadmap only"
];

export function normalizeRiskSeverity(severity: string): RiskSignalSeverity {
  if (severity === "Elevated") return "Elevated";
  if (severity === "Watch" || severity === "Low confidence") return "Watch";
  return "Info";
}

export function describeBehaviorSignal(label: string): string {
  const descriptions: Record<string, string> = {
    "Payment completion rate": "Share of observed payment attempts that completed successfully.",
    "Purchase abandonment": "Share of purchase starts without a matching completion event.",
    "Escrow completion rate": "Share of funded protected transactions that reached funds released.",
    "Download-after-purchase rate": "Share of purchased resources followed by a download event.",
    "Counterparty diversity": "Number of unique counterparties observed in KX events.",
    "Activity recency": "How recently this participant generated KX activity.",
    "Activity velocity": "Observed event frequency over the active window.",
    "Volume concentration": "Share of completed volume concentrated with the largest counterparty.",
    "Evidence count": "Number of events supporting this preview profile."
  };

  return descriptions[label] ?? "Derived from KX preview events.";
}

export function toRiskProfile(summary: ReputationSummary): RiskProfile {
  const participantType = summary.participantType ?? "unknown";
  const profileStatus: RiskProfileStatus =
    summary.evidenceCount === 0
      ? "no_data"
      : summary.confidenceLevel === "Low"
        ? "limited"
        : "active";
  const noDataMessage = "No KX activity was found for this wallet.";
  const noDataRecommendation =
    "Missing data is not negative evidence. Apply your own policy or request additional verification before transacting.";
  const isNoData = profileStatus === "no_data";

  return {
    wallet: summary.wallet,
    profileStatus,
    message: isNoData ? noDataMessage : undefined,
    recommendation: isNoData ? noDataRecommendation : undefined,
    participant: {
      type: participantType,
      userType: summary.userType ?? "unknown",
      entityType: summary.entityType ?? "unknown",
      name: summary.participantName || undefined,
      operatorAddress: summary.operatorAddress || undefined,
      arcIdentityId: summary.arcIdentityId || undefined,
      identitySource: summary.identitySource ?? "self_declared"
    },
    scores: {
      financialBehaviorScore: isNoData ? null : summary.reputationScore,
      riskScore: isNoData ? null : summary.financialRiskScore,
      riskTier: isNoData ? "Unknown" : summary.riskTier,
      confidenceLevel: isNoData ? "Low" : summary.confidenceLevel
    },
    activity: {
      totalCompletedVolumeUSDC: summary.totalCompletedVolumeUSDC,
      completedActions: summary.completedActions,
      successfulPayments: summary.successfulPayments,
      failedPayments: summary.failedPayments,
      resourcesPurchased: summary.resourcesPurchased,
      resourcesDownloaded: summary.resourcesDownloaded,
      requestsCreated: summary.requestsCreated,
      protectedTransactionsFunded: summary.escrowsFunded,
      deliveriesSubmitted: summary.deliveriesSubmitted,
      fundsReleased: summary.fundsReleased,
      uniqueCounterparties: summary.uniqueCounterparties,
      averageTransactionAmountUSDC: summary.averageTransactionAmountUSDC,
      averageActionsPerDay: summary.averageActionsPerDay,
      lastActivity: summary.lastActivity ?? undefined,
      daysSinceLastActivity: summary.daysSinceLastActivity ?? undefined,
      activityLevel: isNoData ? "Unknown" : summary.activityLevel,
      evidenceCount: summary.evidenceCount
    },
    behavioralSignals: isNoData
      ? []
      : summary.behavioralSignals.map((signal) => ({
          ...signal,
          description: describeBehaviorSignal(signal.label)
        })),
    riskSignals: isNoData
      ? [
          {
            label: "No KX activity",
            severity: "Info",
            description: "Missing data is not negative evidence."
          }
        ]
      : summary.riskSignals.map((signal) => ({
          label: signal.label,
          severity: normalizeRiskSeverity(signal.severity),
          description: signal.description
        })),
    limitations: riskIntelligenceLimitations
  };
}

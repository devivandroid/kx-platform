import { ARC_TESTNET_CHAIN_ID } from "@/lib/chains/arcTestnet";
import type { RiskProfile } from "@/lib/server/risk-intelligence/types";

function getScope(profile: RiskProfile): string {
  if (profile.dataSource === "arc_network") return "Arc Testnet RPC activity only";
  if (profile.dataSource === "combined") {
    return "KX activity and limited Arc Testnet RPC activity";
  }
  if (profile.dataSource === "no_data") return "No KX or Arc Network data";
  return "KX activity only";
}

export function toRiskProfileApiResponse(profile: RiskProfile) {
  return {
    ok: true,
    wallet: profile.wallet,
    dataSource: profile.dataSource ?? "knowledge_exchange",
    profileStatus: profile.profileStatus,
    message: profile.message,
    recommendation: profile.recommendation,
    scope: getScope(profile),
    network: "Arc Testnet",
    chainId: ARC_TESTNET_CHAIN_ID,
    participant: {
      type: profile.participant.type,
      userType: profile.participant.userType ?? "unknown",
      entityType: profile.participant.entityType ?? "unknown",
      name: profile.participant.name ?? null,
      operatorAddress: profile.participant.operatorAddress ?? null,
      arcIdentityId: profile.participant.arcIdentityId ?? null,
      identitySource: profile.participant.identitySource ?? "self_declared"
    },
    userType: profile.participant.userType ?? null,
    entityType: profile.participant.entityType ?? null,
    participantType: profile.participant.type,
    participantName: profile.participant.name ?? null,
    operatorAddress: profile.participant.operatorAddress ?? null,
    arcIdentityId: profile.participant.arcIdentityId ?? null,
    identitySource: profile.participant.identitySource ?? "self_declared",
    scores: profile.scores,
    reputationScore: profile.scores.financialBehaviorScore,
    financialRiskScore: profile.scores.riskScore,
    riskTier: profile.scores.riskTier,
    confidenceLevel: profile.scores.confidenceLevel,
    activity: profile.activity,
    metadata: profile.metadata,
    identityEstimation: profile.identityEstimation,
    arcReputation: profile.arcReputation,
    arcValidations: profile.arcValidations,
    metrics: {
      totalVolumeUSDC: profile.activity.totalCompletedVolumeUSDC,
      totalCompletedVolumeUSDC: profile.activity.totalCompletedVolumeUSDC,
      completedActions: profile.activity.completedActions,
      successfulPayments: profile.activity.successfulPayments,
      failedPayments: profile.activity.failedPayments,
      resourcesPurchased: profile.activity.resourcesPurchased,
      resourcesDownloaded: profile.activity.resourcesDownloaded,
      requestsCreated: profile.activity.requestsCreated,
      escrowsFunded: profile.activity.protectedTransactionsFunded,
      protectedTransactionsFunded: profile.activity.protectedTransactionsFunded,
      deliveriesSubmitted: profile.activity.deliveriesSubmitted,
      fundsReleased: profile.activity.fundsReleased,
      uniqueCounterparties: profile.activity.uniqueCounterparties,
      averageTransactionAmountUSDC: profile.activity.averageTransactionAmountUSDC,
      averageActionsPerDay: profile.activity.averageActionsPerDay,
      daysSinceLastActivity: profile.activity.daysSinceLastActivity ?? null,
      activityLevel: profile.activity.activityLevel,
      evidenceCount: profile.activity.evidenceCount
    },
    behavioralSignals: profile.behavioralSignals,
    riskSignals: profile.riskSignals,
    lastActivity: profile.activity.lastActivity ?? null,
    limitations: profile.limitations
  };
}

import type { EntityType, ParticipantType, UserType } from "@/types/resource";

export type ReputationEventType =
  | "RESOURCE_VIEWED"
  | "RESOURCE_PURCHASE_STARTED"
  | "RESOURCE_PURCHASED"
  | "RESOURCE_SOLD"
  | "PAYMENT_VERIFIED"
  | "RESOURCE_DOWNLOADED"
  | "REQUEST_CREATED"
  | "ESCROW_FUNDED"
  | "DELIVERY_SUBMITTED"
  | "FUNDS_RELEASED"
  | "REQUEST_CANCELLED"
  | "API_RESOURCE_QUERIED"
  | "API_402_RETURNED"
  | "API_UNLOCK_SUCCESS";

export type RiskTier = "Low" | "Medium" | "High" | "Unknown";
export type ConfidenceLevel = "Low" | "Medium" | "High";
export type ActivityLevel = "Dormant" | "Low" | "Normal" | "High";
export type BehavioralSignalStatus = "Normal" | "Watch" | "Elevated" | "Unknown";
export type RiskSignalSeverity = "Monitor" | "Watch" | "Elevated" | "Low confidence";

export type ReputationEvent = {
  id: string;
  timestamp: string;
  walletAddress: string;
  counterpartyAddress?: string;
  eventType: ReputationEventType;
  resourceId?: string;
  requestId?: string;
  txHash?: string;
  amountUSDC?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ReputationSummary = {
  wallet: string;
  userType?: UserType;
  kxDeclaredUserType?: UserType;
  entityType?: EntityType;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  arcIdentityId?: string;
  identitySource?: "arc_identity" | "self_declared";
  reputationScore: number;
  financialRiskScore: number;
  riskTier: RiskTier;
  confidenceLevel: ConfidenceLevel;
  paymentSuccessRate: number;
  totalVolumeUSDC: string;
  successfulPayments: number;
  failedPayments: number;
  resourcesPurchased: number;
  resourcesDownloaded: number;
  requestsCreated: number;
  escrowsFunded: number;
  deliveriesSubmitted: number;
  fundsReleased: number;
  disputeRate: number;
  refundRate: number;
  lastActivity: string | null;
  evidenceCount: number;
  completedActions: number;
  totalCompletedVolumeUSDC: string;
  uniqueCounterparties: number;
  averageTransactionAmountUSDC: string;
  averageActionsPerDay: string;
  daysSinceLastActivity: number | null;
  activityLevel: ActivityLevel;
  purchaseStartAbandonmentRate: number;
  escrowCompletionRate: number;
  downloadAfterPurchaseRate: number;
  volumeConcentrationRate: number;
  behavioralSignals: Array<{
    label: string;
    value: string;
    status: BehavioralSignalStatus;
  }>;
  riskSignals: Array<{
    label: string;
    severity: RiskSignalSeverity;
    description: string;
  }>;
};

export type RiskParticipantType = "human" | "agent" | "organization" | "unknown";
export type RiskTier = "Low" | "Medium" | "High" | "Unknown";
export type ConfidenceLevel = "Low" | "Medium" | "High";
export type ActivityLevel = "Dormant" | "Low" | "Normal" | "High" | "Unknown";
export type BehavioralSignalStatus = "Normal" | "Watch" | "Elevated" | "Unknown";
export type RiskSignalSeverity = "Info" | "Watch" | "Elevated";
export type RiskGuardDecision = "allow" | "review" | "block";
export type RiskProfileStatus = "active" | "limited" | "no_data";
export type UnknownWalletBehavior = "allow" | "review" | "block";
export type RiskDataSource = "knowledge_exchange" | "arc_network" | "combined" | "no_data";
export type EstimatedUserType =
  | "Likely Human"
  | "Leaning Human"
  | "Likely Agent"
  | "Leaning Agent"
  | "Mixed / Inconclusive"
  | "Unknown";
export type IdentitySignalResult = "Human" | "Agent-like" | "Unknown";
export type IdentityMatchStatus = "OK" | "Mismatch" | "Not available";
export type ArcRegistryStatus =
  | "found"
  | "not_configured"
  | "abi_unavailable"
  | "method_unavailable"
  | "not_found"
  | "unavailable";
export type TrustAttestationStatus = "not_published" | "eligible" | "published" | "skipped";

export type TrustSnapshot = {
  id: string;
  wallet: string;
  riskScore: number | null;
  trustScore?: number | null;
  riskTier: RiskTier;
  humanAgentEstimation?: EstimatedUserType;
  humanProbability?: number | null;
  confidence: ConfidenceLevel;
  publicationEligibilityReason?: string;
  evidenceSource: string;
  signalsSummary: string[];
  schemaVersion: string;
  engineVersion: string;
  createdAt: string;
  expiresAt: string;
  reportHash: string;
  signedPayload?: string | null;
  signature?: string | null;
  signerAddress?: string | null;
  signingAlgorithm?: string | null;
  signedAt?: string | null;
  signatureStatus?: "verified" | "unsigned" | "not_configured" | "invalid";
  arcIdentityId?: string | null;
  arcJobId?: string | null;
  attestationTxHash?: string | null;
  attestationRegistryAddress?: string | null;
  attestationStatus: TrustAttestationStatus;
  publishedAt?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  onChainAttestation?: OnChainTrustAttestation | null;
};

export type OnChainTrustAttestation = {
  id: string;
  wallet: string;
  reportHash: string;
  riskTier: string;
  humanProbability: number;
  confidence: string;
  engineVersion: string;
  evidenceURI: string;
  timestamp: string;
  isEmpty?: boolean;
};

export type ArcRegistrySignal = {
  source: "Arc Reputation" | "Arc Validations";
  status: ArcRegistryStatus;
  registryAddress?: string;
  method?: string;
  entries: Array<{
    label?: string;
    status?: string;
    value?: string;
    tag?: string;
    issuer?: string;
    txHash?: string;
    raw?: string;
  }>;
  message?: string;
};

export interface RiskGuardPolicy {
  maxRiskScore?: number;
  allowedRiskTiers?: RiskTier[];
  minimumConfidenceLevel?: ConfidenceLevel;
  allowUnknownParticipantType?: boolean;
  unknownWalletBehavior?: UnknownWalletBehavior;
}

export type RiskGuardCheck = {
  label: string;
  passed: boolean;
  value: string | number | boolean | null;
  expected: string;
};

export interface RiskProfile {
  wallet: string;
  dataSource?: RiskDataSource;
  profileStatus: RiskProfileStatus;
  message?: string;
  recommendation?: string;
  participant: {
    type: RiskParticipantType;
    userType?: "HUMAN" | "AGENT" | "unknown";
    kxDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    entityType?: "INDIVIDUAL" | "BUSINESS" | "ORGANIZATION" | "unknown";
    name?: string;
    operatorAddress?: string;
    arcIdentityId?: string;
    identitySource?: "arc_identity" | "self_declared";
  };
  scores: {
    financialBehaviorScore: number | null;
    trustScore?: number | null;
    riskScore: number | null;
    riskTier: RiskTier;
    confidenceLevel: ConfidenceLevel;
  };
  activity: {
    totalCompletedVolumeUSDC: string;
    completedActions: number;
    successfulPayments: number;
    failedPayments: number;
    resourcesPurchased: number;
    resourcesDownloaded: number;
    requestsCreated: number;
    protectedTransactionsFunded: number;
    deliveriesSubmitted: number;
    fundsReleased: number;
    uniqueCounterparties: number;
    averageTransactionAmountUSDC: string;
    averageActionsPerDay: string;
    lastActivity?: string;
    daysSinceLastActivity?: number;
    activityLevel: ActivityLevel;
    evidenceCount: number;
  };
  metadata?: {
    dataFreshness?: string;
    lastIndexed?: string;
    cacheSource?: string;
    coverage?: {
      fromBlock?: number;
      toBlock?: number;
      blocksAnalyzed?: number;
      fullHistory?: boolean;
      description?: string;
    };
  };
  identityEstimation?: {
    estimatedUserType: EstimatedUserType;
    probability: number;
    confidence: ConfidenceLevel;
    evidenceSource: "Arc Network";
    kxDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    arcDeclaredIdentity?: string | null;
    arcDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    declaredUserType?: "HUMAN" | "AGENT" | "unknown";
    identityMatch: IdentityMatchStatus;
    cacheSource?: "live_estimation" | "postgres_cache";
    lastEstimatedAt?: string;
    signals: Array<{
      label: string;
      result: IdentitySignalResult;
      explanation: string;
    }>;
    limitations: string[];
  };
  trustSnapshot?: TrustSnapshot;
  arcReputation?: ArcRegistrySignal;
  arcValidations?: ArcRegistrySignal;
  behavioralSignals: Array<{
    label: string;
    value: string;
    status: BehavioralSignalStatus;
    description?: string;
  }>;
  riskSignals: Array<{
    label: string;
    severity: RiskSignalSeverity;
    description: string;
  }>;
  limitations: string[];
}

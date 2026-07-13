"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type ReputationLookupResult = {
  ok: boolean;
  wallet: string;
  dataSource?: "knowledge_exchange" | "arc_network" | "cross_chain" | "combined" | "no_data";
  profileStatus?: "active" | "limited" | "no_data";
  message?: string;
  recommendation?: string;
  participant?: {
    type: string;
    userType?: string;
    kxDeclaredUserType?: string;
    entityType?: string;
    name: string | null;
    operatorAddress: string | null;
    arcIdentityId?: string | null;
    identitySource?: "arc_identity" | "self_declared";
  };
  scores?: {
    financialBehaviorScore: number | null;
    trustScore?: number | null;
    riskScore: number | null;
    riskTier: string;
    confidenceLevel: string;
  };
  activity?: {
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
    lastActivity: string | null;
    daysSinceLastActivity: number | null;
    evidenceCount: number;
    activityLevel: string;
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
  crossChainContext?: {
    schemaVersion?: string;
    wallet: string;
    status: "available" | "partial" | "not_configured" | "unavailable";
    cacheSource: "postgres_cache" | "fresh" | "none";
    refreshedAt: string | null;
    expiresAt: string | null;
    networks: Array<{
      network: "ethereum" | "base" | "bnb";
      schemaVersion?: string;
      label: string;
      status: "available" | "not_configured" | "unavailable";
      walletAgeDays: number | null;
      transactionCount: number | null;
      outboundTransactionCount?: number | null;
      activeDays: number | null;
      contractInteractionCount: number | null;
      firstActivity: string | null;
      lastActivity: string | null;
      source: string | null;
      indexedAt: string | null;
      coverage: "full" | "limited" | "unavailable";
      providerErrors?: string[];
      blockRange?: {
        fromBlock: number;
        toBlock: number;
        blocksAnalyzed: number;
      };
      message?: string;
    }>;
    summary: {
      networksAnalyzed: number;
      transactionCount: number | null;
      outboundTransactionCount?: number | null;
      activeDays: number | null;
      contractInteractionCount: number | null;
      earliestActivity: string | null;
      lastActivity: string | null;
      coverage: "full" | "limited" | "unavailable";
    };
    confidenceBoost: string | null;
    limitations: string[];
  };
  identityEstimation?: {
    estimatedUserType:
      | "Likely Human"
      | "Leaning Human"
      | "Likely Agent"
      | "Leaning Agent"
      | "Mixed / Inconclusive"
      | "Unknown";
    probability: number;
    confidence: string;
    evidenceSource: "Arc Network" | "Cross-Chain Context" | "Arc Network + Cross-Chain Context";
    kxDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    arcDeclaredIdentity?: string | null;
    arcDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    declaredUserType?: "HUMAN" | "AGENT" | "unknown";
    identityMatch: "OK" | "Mismatch" | "Not available";
    cacheSource?: "live_estimation" | "postgres_cache";
    lastEstimatedAt?: string;
    signals: Array<{
      label: string;
      result:
        | "Human"
        | "Agent-like"
        | "Positive signal"
        | "Weak positive signal"
        | "Limited evidence"
        | "Unknown";
      explanation: string;
    }>;
    limitations: string[];
  };
  trustSnapshot?: {
    id: string;
    wallet: string;
    riskScore: number | null;
    trustScore?: number | null;
    riskTier: string;
    humanAgentEstimation?: string;
    confidence: string;
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
    attestationStatus: "not_published" | "eligible" | "published" | "skipped";
    publishedAt?: string | null;
    revokedAt?: string | null;
    revocationReason?: string | null;
    onChainAttestation?: {
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
    } | null;
  };
  arcReputation?: ArcRegistrySignal;
  arcValidations?: ArcRegistrySignal;
  behavioralSignals?: Array<{
    label: string;
    value: string;
    status: string;
  }>;
  riskSignals?: Array<{
    label: string;
    severity: string;
    description: string;
  }>;
  reputationScore: number | null;
  financialRiskScore: number | null;
  riskTier: string;
  confidenceLevel: string;
  metrics: {
    totalVolumeUSDC: string;
    successfulPayments: number;
    resourcesPurchased: number;
    resourcesDownloaded: number;
    escrowsFunded: number;
    protectedTransactionsFunded?: number;
    fundsReleased: number;
    paymentSuccessRate: number;
    evidenceCount: number;
  };
  lastActivity: string | null;
  limitations: string[];
};

type ArcRegistrySignal = {
  source: "Arc Reputation" | "Arc Validations";
  status:
    | "found"
    | "not_configured"
    | "abi_unavailable"
    | "method_unavailable"
    | "not_found"
    | "unavailable";
  registryAddress?: string;
  method?: string;
  entries: Array<{
    label?: string;
    status?: string;
    value?: string;
    tag?: string;
    issuer?: string;
    txHash?: string;
  }>;
  message?: string;
};

type RiskSource = "internal" | "arc_network" | "combined";

type RiskBreakdown = {
  internal: ReputationLookupResult | null;
  network: ReputationLookupResult | null;
};

type TrustPolicyId = "basic-safe" | "human-preferred" | "agent-safe" | "enterprise-strict";
type TrustPolicyRiskTier = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

type TrustPolicyEvaluationResult = {
  ok: true;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  policyId: TrustPolicyId;
  policyName: string;
  reasons: string[];
  failedRules: string[];
  passedRules: string[];
  criticalSignals: string[];
  trustSnapshot?: ReputationLookupResult["trustSnapshot"];
  reportHash: string | null;
  signatureStatus: "verified" | "unsigned" | "not_configured" | "invalid" | null;
  profile: {
    rawRiskTier: ReputationLookupResult["riskTier"];
    policyRiskTier: TrustPolicyRiskTier;
    riskScore: number | null;
    confidence: string;
    estimatedIdentity: string;
    humanProbability: number | null;
    identityMatch: string;
  };
};

const sourceOptions: Array<{ value: RiskSource; label: string; description: string }> = [
  {
    value: "internal",
    label: "Internal",
    description: "KX activity"
  },
  {
    value: "arc_network",
    label: "Arc Network",
    description: "Arc Testnet RPC signals"
  },
  {
    value: "combined",
    label: "Combined",
    description: "Internal + network context"
  }
];

const trustPolicyOptions: Array<{ value: TrustPolicyId; label: string; description: string }> = [
  {
    value: "basic-safe",
    label: "Basic Safe",
    description: "Low risk and confidence above Low."
  },
  {
    value: "human-preferred",
    label: "Human Preferred",
    description: "Human-like behavior with acceptable risk."
  },
  {
    value: "agent-safe",
    label: "Agent Safe",
    description: "Agent-like behavior, Low risk and High confidence."
  },
  {
    value: "enterprise-strict",
    label: "Enterprise Strict",
    description: "Low risk, High confidence and signed snapshot evidence."
  }
];

const riskLookupLoadingSteps = [
  "Checking Arc humanity",
  "Estimating humanity",
  "Checking Risk",
  "Reading KX data",
  "Preparing decision"
];

function getRiskAccent(tier: string): string {
  if (tier === "Low") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (tier === "Medium") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  if (tier === "High") return "border-red-300/40 bg-red-300/10 text-red-100";
  return "border-slate-400/30 bg-slate-400/10 text-slate-300";
}

function getDecisionAccent(decision: TrustPolicyEvaluationResult["decision"]): string {
  if (decision === "ALLOW") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (decision === "BLOCK") return "border-red-300/40 bg-red-300/10 text-red-100";
  return "border-amber-300/40 bg-amber-300/10 text-amber-100";
}

function formatNullableScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not assessed" : String(value);
}

function getStatusAccent(status: string): string {
  if (status === "Normal") return "text-emerald-200";
  if (status === "Watch" || status === "Monitor") return "text-amber-200";
  if (status === "Elevated") return "text-red-200";
  return "text-slate-400";
}

function getIdentitySignalDisplayLabel(signal: { label: string; result: string }): string {
  if (signal.label === "Cross-chain coverage" || signal.label === "Network Coverage") {
    if (signal.result === "Positive signal") return "Supporting evidence";
    if (signal.result === "Weak positive signal" || signal.result === "Limited evidence") {
      return "Limited supporting evidence";
    }
    return "Unknown";
  }

  if (signal.result === "Unknown") return "Neutral";

  if (signal.result === "Human") {
    if (signal.label === "EOA detected" || signal.label === "Wallet age") {
      return "Likely Human";
    }
    return "Leaning Human";
  }

  if (signal.result === "Agent-like") {
    if (signal.label === "Account Type" || signal.label === "EOA detected") {
      return "Likely Agent";
    }
    return "Leaning Agent";
  }

  return signal.result;
}

function getIdentitySignalAccent(result: string): string {
  if (result === "Likely Human" || result === "Leaning Human") {
    return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  }
  if (result === "Supporting evidence") {
    return "border-sky-300/40 bg-sky-300/10 text-sky-100";
  }
  if (result === "Limited supporting evidence") {
    return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  }
  if (result === "Likely Agent" || result === "Leaning Agent") {
    return "border-red-300/40 bg-red-300/10 text-red-100";
  }
  return "border-slate-500/40 bg-slate-500/10 text-slate-300";
}

function getArcRegistryStatusLabel(status: ArcRegistrySignal["status"]): string {
  if (status === "found") return "Available";
  if (status === "not_configured") return "Not configured";
  if (status === "abi_unavailable") return "Official ABI not configured";
  if (status === "method_unavailable") return "Official read method not configured";
  if (status === "not_found") return "No record found";
  return "Unavailable";
}

function getIdentityEstimationSummary(
  identityEstimation?: ReputationLookupResult["identityEstimation"]
) {
  if (!identityEstimation || identityEstimation.estimatedUserType === "Unknown") {
    return "Insufficient evidence";
  }
  return `${identityEstimation.estimatedUserType} ${identityEstimation.probability}%`;
}

function getTrustSnapshotStatusLabel(status: NonNullable<ReputationLookupResult["trustSnapshot"]>["attestationStatus"]) {
  if (status === "eligible") return "Eligible";
  if (status === "published") return "Published on Arc Testnet";
  if (status === "skipped") return "Skipped";
  return "Not published";
}

function getTrustSnapshotSignatureStatusLabel(
  status?: NonNullable<ReputationLookupResult["trustSnapshot"]>["signatureStatus"] | null
) {
  if (status === "verified") return "Verified";
  if (status === "not_configured") return "Backend signer not configured";
  if (status === "invalid") return "Invalid";
  if (status === "unsigned") return "Unsigned";
  return "Unavailable";
}

function getAttestationTxUrl(txHash?: string | null) {
  const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL?.replace(/\/+$/, "");
  return explorerUrl && txHash ? `${explorerUrl}/tx/${txHash}` : null;
}

function getAttestationPublicationMessage(snapshot?: ReputationLookupResult["trustSnapshot"]) {
  if (!snapshot) return "No Trust Snapshot has been generated yet.";
  if (snapshot.attestationStatus === "published") {
    if (snapshot.onChainAttestation?.engineVersion === "Test Attestation - Arc Testnet") {
      return "Published as a test attestation on Arc Testnet.";
    }
    return "Published automatically because publication eligibility was met.";
  }
  if (snapshot.attestationStatus === "eligible") {
    return "Eligible for publication. Production publishing remains manual in this testnet MVP.";
  }
  return (
    snapshot.publicationEligibilityReason ??
    "Not published automatically because publication eligibility was not met."
  );
}

function MetricCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-arc-border bg-white/[0.03] p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">
        {typeof value === "number" || value === null || value === undefined
          ? formatNullableScore(value)
          : value}
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  description,
  children,
  defaultOpen = false
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-lg border border-arc-border bg-white/[0.03] p-4"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
          <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
            Show details
          </span>
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function ArcRegistryPanel({ signal }: { signal?: ArcRegistrySignal }) {
  if (!signal) return null;

  return (
    <div className="rounded-lg border border-arc-border bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{signal.source}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Source of truth: Arc registry when configured. KX does not infer KYC, AML or
            compliance status from this data.
          </p>
        </div>
        <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
          {getArcRegistryStatusLabel(signal.status)}
        </span>
      </div>

      {signal.registryAddress ? (
        <p className="mt-3 break-all text-xs text-slate-500">
          Registry: <span className="text-slate-300">{signal.registryAddress}</span>
        </p>
      ) : null}
      {signal.method ? (
        <p className="mt-1 text-xs text-slate-500">
          Read method: <span className="text-slate-300">{signal.method}</span>
        </p>
      ) : null}
      {signal.message ? <p className="mt-3 text-xs leading-5 text-slate-400">{signal.message}</p> : null}

      {signal.entries.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {signal.entries.map((entry, index) => (
            <div key={`${entry.label ?? entry.tag ?? index}`} className="rounded-lg border border-arc-border bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">
                  {entry.label ?? entry.tag ?? `${signal.source} entry ${index + 1}`}
                </p>
                {entry.status ? (
                  <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
                    {entry.status}
                  </span>
                ) : null}
              </div>
              {entry.value ? <p className="mt-2 text-xs text-slate-400">{entry.value}</p> : null}
              {entry.issuer ? <p className="mt-1 text-xs text-slate-500">Issuer: {entry.issuer}</p> : null}
              {entry.txHash ? <p className="mt-1 break-all text-xs text-slate-500">Evidence tx: {entry.txHash}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

function getCrossChainStatusLabel(network: { status: string }): string {
  return network.status === "available"
    ? "✅ Available"
    : "⏳ Additional network support coming soon.";
}

function formatKXLastActivity(value: string | null | undefined): string {
  return value ? formatDate(value) : "No KX activity yet";
}

function formatUSDC(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0.00 USDC";

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: amount < 1 ? 6 : 2,
    minimumFractionDigits: 2
  }).format(amount)} USDC`;
}

function formatDaysSinceLastActivity(value: number | null | undefined): string {
  if (typeof value !== "number") return "Unavailable";
  if (value === 0) return "Today";
  if (value === 1) return "1 day";
  return `${value} days`;
}

function getBehavioralSignalValue(
  profile: ReputationLookupResult | null,
  label: string
): string {
  return profile?.behavioralSignals?.find((signal) => signal.label === label)?.value ?? "Unavailable";
}

function getFirstNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBehavioralSignalStrength(signal: { label: string; value: string | number; status: string }): string {
  const label = signal.label.replace(/^Arc Network: /, "");
  const value = getFirstNumber(signal.value);
  const normalizedValue = String(signal.value).toLowerCase();

  if (label === "Established wallet history") {
    if (value === null) return "Unknown";
    if (value > 1000) return "Strong";
    if (value >= 365) return "Positive";
    return "Neutral";
  }
  if (label === "Active across observed days" || label === "Active days") {
    if (value === null) return "Unknown";
    if (value > 50) return "Strong";
    if (value >= 15) return "Positive";
    return "Neutral";
  }
  if (label === "Historical wallet activity") {
    if (value === null) return "Unknown";
    if (value > 100) return "Strong";
    if (value >= 25) return "Positive";
    return "Neutral";
  }
  if (label === "Contract interactions" || label === "Contract interaction diversity") {
    if (value === null) return "Unknown";
    if (value > 75) return "Strong";
    if (value >= 20) return "Positive";
    return "Neutral";
  }
  if (label === "Cross-chain coverage") {
    if (normalizedValue.includes("full")) return "Strong";
    if (normalizedValue.includes("partial")) return "Positive";
    if (normalizedValue.includes("limited")) return "Neutral";
    return "Unknown";
  }

  if (signal.status === "Elevated") return "Elevated";
  if (signal.status === "Watch" || signal.status === "Monitor") return "Watch";
  if (signal.status === "Normal") return "Positive";
  return "Unknown";
}

function getAssessmentSourceLabel(source: ReputationLookupResult["dataSource"] | undefined): string {
  if (source === "knowledge_exchange") return "KX";
  if (source === "arc_network") return "Arc Network";
  if (source === "cross_chain") return "Cross-Chain Context";
  if (source === "combined") return "KX + Arc Network";
  if (source === "no_data") return "No data";
  return "KX";
}

function formatCoverage(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  if (value === "full") return "High";
  if (value === "limited") return "Limited";
  if (value === "unavailable") return "Unavailable";
  return value;
}

function getEvidenceStrengthAccent(strength: string): string {
  if (strength === "Strong" || strength === "Positive") return "text-emerald-200";
  if (strength === "Watch") return "text-amber-200";
  if (strength === "Elevated") return "text-red-200";
  return "text-slate-400";
}

function getVisibleBehavioralSignals(result: ReputationLookupResult) {
  return (result.behavioralSignals ?? []).filter(
    (signal) =>
      signal.label !== "RPC account nonce" &&
      signal.label !== "Arc Network: RPC account nonce" &&
      signal.label !== "Network Coverage" &&
      signal.label !== "Arc Network: Network Coverage"
  );
}

function getVisibleIdentitySignals(result: ReputationLookupResult) {
  return (result.identityEstimation?.signals ?? []).filter(
    (signal) => signal.label !== "Network Coverage"
  );
}

function getParticipantDisplay(result: ReputationLookupResult): string {
  const userType = result.participant?.kxDeclaredUserType ?? "unknown";
  const entityType = result.participant?.entityType ?? "unknown";
  const participantLabel = `${userType === "unknown" ? "Not declared" : userType} / ${entityType}`;

  if (result.participant?.name) {
    return `${result.participant.name} - ${participantLabel}`;
  }

  return userType === "unknown" && entityType === "unknown" ? "Unknown user and entity type" : participantLabel;
}

function getTrustScoreLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not assessed";
  if (value >= 80) return `${value} / Strong`;
  if (value >= 60) return `${value} / Moderate`;
  if (value >= 40) return `${value} / Limited`;
  return `${value} / Weak`;
}

export function ReputationLookup() {
  const [wallet, setWallet] = useState("");
  const [source, setSource] = useState<RiskSource>("combined");
  const [useIndexedData, setUseIndexedData] = useState(true);
  const [showIdentityEstimation, setShowIdentityEstimation] = useState(true);
  const [result, setResult] = useState<ReputationLookupResult | null>(null);
  const [breakdown, setBreakdown] = useState<RiskBreakdown>({ internal: null, network: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [refreshingCrossChain, setRefreshingCrossChain] = useState(false);
  const [publishingSnapshot, setPublishingSnapshot] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<TrustPolicyId>("basic-safe");
  const [evaluatingPolicy, setEvaluatingPolicy] = useState(false);
  const [policyEvaluation, setPolicyEvaluation] = useState<TrustPolicyEvaluationResult | null>(null);
  const evaluatePolicyForProfile = async (
    profile: ReputationLookupResult,
    policyId: TrustPolicyId
  ) => {
    const response = await fetch("/api/trust/policy/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        wallet: profile.wallet,
        policyId,
        profile
      })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message || body.error || "Trust policy evaluation failed.");
    }
    return body as TrustPolicyEvaluationResult;
  };

  const refreshCrossChainContext = async (targetWallet: string) => {
    setRefreshingCrossChain(true);
    try {
      const response = await fetch(`/api/risk/cross-chain/${targetWallet}?force=true`);
      const body = await response.json();
      if (!response.ok || !body.crossChainContext) return;
      setResult((current) =>
        current?.wallet?.toLowerCase() === targetWallet.toLowerCase()
          ? { ...current, crossChainContext: body.crossChainContext }
          : current
      );
    } catch {
      // Cross-chain context is optional and must not block Trust Engine results.
    } finally {
      setRefreshingCrossChain(false);
    }
  };

  const lookup = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setBreakdown({ internal: null, network: null });
    setPolicyEvaluation(null);

    try {
      const endpoint =
        source === "arc_network"
          ? `/api/risk/network/${wallet}?useIndexedData=${useIndexedData}`
          : `/api/risk/profile/${wallet}?source=${source}&useIndexedData=${useIndexedData}`;
      const response = await fetch(endpoint);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || body.error || "Lookup failed.");
      }
      const policyPromise = evaluatePolicyForProfile(body, selectedPolicyId);
      const policyBody = await policyPromise;
      setPolicyEvaluation(policyBody);
      setResult(body);
      void refreshCrossChainContext(body.wallet);

      const networkBreakdown =
        source === "arc_network"
          ? body
          : await fetch(
              `/api/risk/network/${wallet}?useIndexedData=true&includeTrustSnapshot=false`
            ).then((networkResponse) =>
              networkResponse.ok ? networkResponse.json() : null
            );
      const [internalBody, networkBody] = await Promise.all([
        fetch(`/api/risk/profile/${wallet}?source=internal&includeTrustSnapshot=false`).then(
          (internalResponse) => (internalResponse.ok ? internalResponse.json() : null)
        ),
        Promise.resolve(networkBreakdown)
      ]);

      setBreakdown({
        internal: internalBody,
        network: networkBody
      });
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };
  const evaluateSelectedPolicy = async () => {
    if (!result?.wallet) return;

    setEvaluatingPolicy(true);
    setError("");

    try {
      const body = await evaluatePolicyForProfile(result, selectedPolicyId);
      setPolicyEvaluation(body);
    } catch (policyError) {
      setError(
        policyError instanceof Error
          ? policyError.message
          : "Trust policy evaluation failed."
      );
    } finally {
      setEvaluatingPolicy(false);
    }
  };
  const publishTrustSnapshot = async (mode: "eligible" | "test") => {
    if (!result?.wallet || !result.trustSnapshot) return;

    setPublishingSnapshot(true);
    setError("");

    try {
      const response = await fetch(`/api/risk/snapshots/${result.wallet}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ snapshotId: result.trustSnapshot.id, mode })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || body.error || "Trust Attestation publish failed.");
      }

      setResult((current) =>
        current
          ? {
              ...current,
              trustSnapshot: body.snapshot
            }
          : current
      );
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Trust Attestation publish failed."
      );
    } finally {
      setPublishingSnapshot(false);
    }
  };
  const identityEstimation = result?.identityEstimation ?? breakdown.network?.identityEstimation;

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingStepIndex((current) =>
        Math.min(current + 1, riskLookupLoadingSteps.length - 1)
      );
    }, 1300);

    return () => window.clearInterval(interval);
  }, [loading]);

  return (
    <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
      <h2 className="text-xl font-semibold text-white">Wallet lookup</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Analyze wallet trust using KX activity, Arc Testnet signals, or a combined view.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {sourceOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSource(option.value)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              source === option.value
                ? "border-arc-blue bg-arc-blue/15 text-white"
                : "border-arc-border bg-black/20 text-slate-400 hover:border-slate-500"
            }`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs">{option.description}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          placeholder="0x..."
          className="min-w-0 flex-1 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading || !wallet.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-arc-blue px-5 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoadingSpinner /> : null}
          {loading ? riskLookupLoadingSteps[loadingStepIndex] : "Analyze Trust"}
        </button>
      </div>
      <label className="mt-3 flex max-w-max items-start gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={useIndexedData}
          onChange={(event) => setUseIndexedData(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-arc-border bg-black/30 accent-arc-blue"
        />
        <span>
          <span className="font-semibold text-slate-200">Use indexed data</span>
          <span className="block">
            Uses a stored Arc Network snapshot if it is less than 1 day old in this demo. Uncheck to refresh from Arc.
          </span>
        </span>
      </label>
      <label className="mt-3 flex max-w-max items-start gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={showIdentityEstimation}
          onChange={(event) => setShowIdentityEstimation(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-arc-border bg-black/30 accent-arc-blue"
        />
        <span>
          <span className="font-semibold text-slate-200">Human / Agent Estimation</span>
          <span className="block">
            Optional Arc Network behavior estimation. It does not use declared user type as model input.
          </span>
        </span>
      </label>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="mt-4 grid gap-5 rounded-lg border border-arc-border bg-black/20 p-4 text-sm">
          <section className="rounded-lg border border-arc-border bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Overall Result</p>
                <p className="mt-1 text-base font-semibold text-white">
                  {getParticipantDisplay(result)}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">{result.wallet}</p>
                <p className="mt-1 text-xs uppercase tracking-normal text-slate-500">
                  Assessment source: {getAssessmentSourceLabel(result.dataSource)}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskAccent(
                  result.riskTier
                )}`}
              >
                {result.riskTier} risk
              </span>
            </div>

            {result.profileStatus === "no_data" ? (
              <p className="mt-4 rounded-lg border border-sky-300/25 bg-sky-300/10 p-3 text-sm font-medium text-sky-100">
                No KX activity found. Missing data is neutral, not high risk.
              </p>
            ) : null}
            {breakdown.internal?.profileStatus === "no_data" &&
            breakdown.network?.profileStatus !== "no_data" ? (
              <p className="mt-3 rounded-lg border border-sky-300/25 bg-sky-300/10 p-3 text-sm font-medium text-sky-100">
                Arc Network Data only. No KX marketplace activity found.
              </p>
            ) : null}

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Trust Score",
                  getTrustScoreLabel(result.scores?.trustScore ?? result.scores?.financialBehaviorScore)
                ],
                [
                  "Risk Score",
                  `${formatNullableScore(result.scores?.riskScore ?? result.financialRiskScore)} / ${
                    result.scores?.riskTier ?? result.riskTier
                  }`
                ],
                ["Policy Decision", policyEvaluation?.decision ?? "Run policy"],
                ["Analysis Confidence", result.scores?.confidenceLevel ?? result.confidenceLevel]
              ].map(([label, value]) => (
                <MetricCard key={String(label)} label={String(label)} value={value} />
              ))}
              <div className="rounded-lg border border-arc-border bg-black/20 p-3">
                <dt className="text-xs uppercase tracking-normal text-slate-500">Estimated Identity</dt>
                <dd className="mt-2 text-lg font-semibold text-white">
                  {getIdentityEstimationSummary(identityEstimation)}
                </dd>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Behavior estimate based on observable signals.
                  <br />
                  Not identity verification.
                </p>
              </div>
              {[
                ["Signature Status", getTrustSnapshotSignatureStatusLabel(result.trustSnapshot?.signatureStatus)],
                [
                  "Latest Attestation Status",
                  result.trustSnapshot
                    ? getTrustSnapshotStatusLabel(result.trustSnapshot.attestationStatus)
                    : "No snapshot"
                ]
              ].map(([label, value]) => (
                <MetricCard key={String(label)} label={String(label)} value={value} />
              ))}
            </dl>
          </section>

          <section className="rounded-lg border border-arc-border bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Trust Policy Engine</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  Decision layer over Arc and KX Trust Engine evidence. This is not KYC, AML or
                  compliance approval.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedPolicyId}
                  onChange={(event) => setSelectedPolicyId(event.target.value as TrustPolicyId)}
                  className="rounded-lg border border-arc-border bg-black/30 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-arc-blue"
                >
                  {trustPolicyOptions.map((policy) => (
                    <option key={policy.value} value={policy.value}>
                      {policy.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={evaluateSelectedPolicy}
                  disabled={evaluatingPolicy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-arc-blue/40 bg-arc-blue/15 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {evaluatingPolicy ? <LoadingSpinner /> : null}
                  {evaluatingPolicy ? "Evaluating..." : "Evaluate Policy"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {trustPolicyOptions.find((policy) => policy.value === selectedPolicyId)?.description}
            </p>

            {policyEvaluation ? (
              <div className="mt-4 grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDecisionAccent(
                      policyEvaluation.decision
                    )}`}
                  >
                    {policyEvaluation.decision}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {policyEvaluation.policyName}
                  </span>
                  <span className="break-all text-xs text-slate-500">
                    Report hash: {policyEvaluation.reportHash ?? "Unavailable"}
                  </span>
                  <span className="text-xs text-slate-500">
                    Signature:{" "}
                    {getTrustSnapshotSignatureStatusLabel(policyEvaluation.signatureStatus)}
                  </span>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Policy risk tier", policyEvaluation.profile.policyRiskTier],
                    ["Raw risk tier", policyEvaluation.profile.rawRiskTier],
                    ["Risk score", policyEvaluation.profile.riskScore],
                    ["Analysis Confidence", policyEvaluation.profile.confidence]
                  ].map(([label, value]) => (
                    <MetricCard key={String(label)} label={String(label)} value={value} />
                  ))}
                </dl>

                {policyEvaluation.reasons.length > 0 ? (
                  <div className="rounded-lg border border-arc-border bg-black/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                      Reasons
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm text-slate-300">
                      {policyEvaluation.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {policyEvaluation.criticalSignals.length > 0 ? (
                  <div className="rounded-lg border border-red-300/30 bg-red-300/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-red-100">
                      Critical signals
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm text-red-100">
                      {policyEvaluation.criticalSignals.map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-emerald-100">
                      Passed rules
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm text-slate-300">
                      {policyEvaluation.passedRules.length > 0 ? (
                        policyEvaluation.passedRules.map((rule) => <li key={rule}>{rule}</li>)
                      ) : (
                        <li>No passed rules.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-red-300/20 bg-red-300/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-red-100">
                      Failed rules
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm text-slate-300">
                      {policyEvaluation.failedRules.length > 0 ? (
                        policyEvaluation.failedRules.map((rule) => <li key={rule}>{rule}</li>)
                      ) : (
                        <li>No failed rules.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-arc-border bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Arc Testnet Attestation</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  Trust Snapshots are signed automatically off-chain. Selected snapshots may be
                  published as minimal attestations on Arc Testnet.
                </p>
              </div>
              <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
                {result.trustSnapshot
                  ? getTrustSnapshotStatusLabel(result.trustSnapshot.attestationStatus)
                  : "No snapshot"}
              </span>
            </div>
            <p className="mt-3 rounded-lg border border-arc-border bg-black/20 p-3 text-sm text-slate-300">
              {getAttestationPublicationMessage(result.trustSnapshot)}
            </p>

            {result.trustSnapshot?.attestationTxHash ? (
              <a
                href={getAttestationTxUrl(result.trustSnapshot.attestationTxHash) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex break-all text-sm font-semibold text-arc-blue hover:text-cyan-200"
              >
                View Trust Attestation on Arcscan
              </a>
            ) : null}

            {result.trustSnapshot?.onChainAttestation &&
            !result.trustSnapshot.onChainAttestation.isEmpty ? (
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Attestation ID", `#${result.trustSnapshot.onChainAttestation.id}`],
                  ["Risk tier", result.trustSnapshot.onChainAttestation.riskTier],
                  [
                    "Human probability",
                    `${result.trustSnapshot.onChainAttestation.humanProbability}%`
                  ],
                  ["Timestamp", formatDate(result.trustSnapshot.onChainAttestation.timestamp)]
                ].map(([label, value]) => (
                  <MetricCard key={label} label={label} value={value} />
                ))}
              </dl>
            ) : null}

            {result.trustSnapshot?.attestationStatus === "eligible" ? (
              <button
                type="button"
                onClick={() => publishTrustSnapshot("eligible")}
                disabled={publishingSnapshot}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-arc-blue/40 bg-arc-blue/15 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishingSnapshot ? <LoadingSpinner /> : null}
                {publishingSnapshot ? "Publishing..." : "Publish Trust Attestation"}
              </button>
            ) : null}
            {result.trustSnapshot ? (
              <button
                type="button"
                onClick={() => publishTrustSnapshot("test")}
                disabled={publishingSnapshot}
                className="ml-0 mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-3"
              >
                {publishingSnapshot ? <LoadingSpinner /> : null}
                {publishingSnapshot ? "Publishing test..." : "Publish TEST Attestation"}
              </button>
            ) : null}
          </section>

          <section className="rounded-lg border border-arc-border bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">Wallet Data Summary</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-arc-border bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">KX Data</p>
                  <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
                    {breakdown.internal?.profileStatus ?? "no_data"}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2">
                  {[
                    ["Completed volume", formatUSDC(breakdown.internal?.activity?.totalCompletedVolumeUSDC)],
                    ["Completed actions", breakdown.internal?.activity?.completedActions ?? 0],
                    ["Counterparties", breakdown.internal?.activity?.uniqueCounterparties ?? 0],
                    ["Last activity", formatKXLastActivity(breakdown.internal?.activity?.lastActivity)],
                    ["Cache source", breakdown.internal?.metadata?.cacheSource ?? "KX database"]
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-arc-border/60 py-2 last:border-b-0">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-lg border border-arc-border bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Arc Network</p>
                  <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
                    {breakdown.network?.profileStatus ?? "no_data"}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2">
                  {[
                    ["Native USDC balance", getBehavioralSignalValue(breakdown.network, "Native USDC balance")],
                    ["USDC volume", formatUSDC(breakdown.network?.activity?.totalCompletedVolumeUSDC)],
                    ["Transactions", getBehavioralSignalValue(breakdown.network, "Transactions indexed")],
                    ["Transfers", getBehavioralSignalValue(breakdown.network, "Transfers indexed")],
                    ["Counterparties", breakdown.network?.activity?.uniqueCounterparties ?? 0],
                    ["Last activity", formatDate(breakdown.network?.activity?.lastActivity)],
                    ["Last indexed", formatDate(breakdown.network?.metadata?.lastIndexed)],
                    ["Cache source", breakdown.network?.metadata?.cacheSource ?? "Unavailable"]
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-arc-border/60 py-2 last:border-b-0">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-arc-border bg-black/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Cross-Chain Context</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Optional Ethereum, Base and BNB Chain evidence. When KX and Arc data are unavailable,
                    KX uses real cross-chain context for a conservative baseline Trust/Risk assessment.
                  </p>
                </div>
                <span className="rounded-full border border-slate-500/40 px-2 py-1 text-xs text-slate-300">
                  {refreshingCrossChain
                    ? "Refreshing"
                    : result.crossChainContext?.cacheSource ?? "No cache"}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  [
                    "Networks analyzed",
                    result.crossChainContext?.summary.networksAnalyzed ?? 0
                  ],
                  [
                    "Wallet age",
                    result.crossChainContext?.summary.earliestActivity
                      ? `${Math.max(
                          0,
                          Math.floor(
                            (Date.now() -
                              new Date(result.crossChainContext.summary.earliestActivity).getTime()) /
                              86_400_000
                          )
                        )} days`
                      : "Unavailable"
                  ],
                  [
                    "Transactions",
                    result.crossChainContext?.summary.transactionCount ?? "Unavailable"
                  ],
                  [
                    "Active days",
                    result.crossChainContext?.summary.activeDays ?? "Unavailable"
                  ],
                  [
                    "Contract interactions",
                    result.crossChainContext?.summary.contractInteractionCount ?? "Unavailable"
                  ],
                  [
                    "Coverage",
                    formatCoverage(result.crossChainContext?.summary.coverage)
                  ]
                ].map(([label, value]) => (
                  <MetricCard key={String(label)} label={String(label)} value={value} />
                ))}
              </dl>

              <div className="mt-4 grid gap-2 lg:grid-cols-3">
                {(result.crossChainContext?.networks ?? []).map((network) => (
                  <div key={network.network} className="rounded-lg border border-arc-border bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{network.label}</p>
                      <span className="rounded-full border border-slate-500/40 px-2 py-1 text-[11px] text-slate-300">
                        {getCrossChainStatusLabel(network)}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-1 text-xs">
                      {[
                        ["Transactions", network.transactionCount ?? "Unavailable"],
                        ["Active days", network.activeDays ?? "Unavailable"],
                        ["Contract calls", network.contractInteractionCount ?? "Unavailable"],
                        ["Last activity", formatDate(network.lastActivity)],
                        ["Indexed", formatDate(network.indexedAt)]
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex justify-between gap-3">
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="text-slate-300">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {network.status !== "available" ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        This network will be expanded as indexed support becomes available.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {!result.crossChainContext ? (
                <p className="mt-3 rounded-lg border border-sky-300/20 bg-sky-300/10 p-3 text-xs leading-5 text-sky-100">
                  No cached cross-chain context yet. KX refreshes this after Trust analysis when
                  indexed explorer providers are configured.
                </p>
              ) : null}
            </div>

            {(result.arcReputation || result.arcValidations) ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ArcRegistryPanel signal={result.arcReputation} />
                <ArcRegistryPanel signal={result.arcValidations} />
              </div>
            ) : null}
          </section>

          <section className="grid gap-3">
            <p className="text-sm font-semibold text-white">Detailed Breakdown</p>
            <DetailSection title="Behavioral signals">
              <div className="grid gap-2 lg:grid-cols-2">
                {getVisibleBehavioralSignals(result).map((signal) => {
                  const strength = getBehavioralSignalStrength(signal);
                  return (
                    <div
                      key={signal.label}
                      className="rounded-lg border border-arc-border bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{signal.label}</p>
                        <span className={`text-xs font-semibold ${getEvidenceStrengthAccent(strength)}`}>
                          {strength}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400">{signal.value}</p>
                    </div>
                  );
                })}
              </div>
            </DetailSection>

            <DetailSection title="Risk signals">
              <div className="grid gap-2">
                {(result.riskSignals ?? []).map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-lg border border-arc-border bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{signal.label}</p>
                      <span className={`text-xs font-semibold ${getStatusAccent(signal.severity)}`}>
                        {signal.severity}
                      </span>
                    </div>
                    <p className="mt-1 leading-5 text-slate-400">{signal.description}</p>
                  </div>
                ))}
              </div>
            </DetailSection>

            <DetailSection
              title="Human / Agent signal breakdown"
              description="Explainable estimation signals. This is not identity verification."
            >
              {showIdentityEstimation && identityEstimation ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {getVisibleIdentitySignals(result).map((signal) => {
                    const signalLabel = getIdentitySignalDisplayLabel(signal);
                    return (
                      <div
                        key={signal.label}
                        className="rounded-lg border border-arc-border bg-black/20 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{signal.label}</p>
                          <span className={`rounded-full border px-2 py-1 text-xs ${getIdentitySignalAccent(signalLabel)}`}>
                            {signalLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{signal.explanation}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-500/30 bg-black/20 p-3 text-sm text-slate-400">
                  Human / Agent Estimation is not available for this wallet.
                </p>
              )}
            </DetailSection>

            {result.trustSnapshot ? (
              <DetailSection
                title="Trust Snapshot details"
                description="Signed off-chain snapshot generated automatically during wallet lookup."
              >
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Snapshot ID", result.trustSnapshot.id],
                    ["Trust score", result.trustSnapshot.trustScore ?? "Unavailable"],
                    ["Analysis Confidence", result.trustSnapshot.confidence],
                    [
                      "Publication Eligibility",
                      result.trustSnapshot.publicationEligibilityReason ?? "Unavailable"
                    ],
                    ["Signature status", getTrustSnapshotSignatureStatusLabel(result.trustSnapshot.signatureStatus)],
                    ["Signer", result.trustSnapshot.signerAddress ?? "Unavailable"],
                    ["Schema version", result.trustSnapshot.schemaVersion ?? "Unavailable"],
                    ["Engine", result.trustSnapshot.engineVersion],
                    ["Created", formatDate(result.trustSnapshot.createdAt)],
                    ["Expires", formatDate(result.trustSnapshot.expiresAt)],
                    ["Evidence source", result.trustSnapshot.evidenceSource],
                    ["Published", result.trustSnapshot.publishedAt ? formatDate(result.trustSnapshot.publishedAt) : "Not published"]
                  ].map(([label, value]) => (
                    <MetricCard key={String(label)} label={String(label)} value={value} />
                  ))}
                </dl>
                <details className="mt-3 rounded-lg border border-arc-border bg-black/20 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                    Signed payload / technical signature data
                  </summary>
                  <p className="mt-3 break-all text-xs text-slate-400">
                    Report hash: <span className="text-slate-200">{result.trustSnapshot.reportHash}</span>
                  </p>
                  <p className="mt-3 break-all text-xs text-slate-400">
                    Signature: <span className="text-slate-200">{result.trustSnapshot.signature ?? "Unavailable"}</span>
                  </p>
                  <p className="mt-3 break-all text-xs text-slate-400">
                    Signed payload:{" "}
                    <span className="text-slate-200">{result.trustSnapshot.signedPayload ?? "Unavailable"}</span>
                  </p>
                </details>
              </DetailSection>
            ) : null}

            <DetailSection title="Activity and API / SDK details">
              {breakdown.internal?.profileStatus === "no_data" ? (
                <p className="rounded-lg border border-sky-300/25 bg-sky-300/10 p-3 text-sm font-medium text-sky-100">
                  No KX activity available. Cross-chain evidence was used for this assessment.
                </p>
              ) : (
                <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Network transactions", result.activity?.successfulPayments ?? result.metrics.successfulPayments],
                    ["Failed payments", result.activity?.failedPayments ?? 0],
                    ["Products purchased", result.activity?.resourcesPurchased ?? result.metrics.resourcesPurchased],
                    ["Products downloaded", result.activity?.resourcesDownloaded ?? result.metrics.resourcesDownloaded],
                    ["Jobs created", result.activity?.requestsCreated ?? 0],
                    [
                      "Protected transactions funded",
                      result.activity?.protectedTransactionsFunded ??
                        result.metrics.protectedTransactionsFunded ??
                        result.metrics.escrowsFunded
                    ],
                    ["Deliverables submitted", result.activity?.deliveriesSubmitted ?? 0],
                    ["Funds released", result.activity?.fundsReleased ?? result.metrics.fundsReleased],
                    ["Unique counterparties", result.activity?.uniqueCounterparties ?? 0],
                    ["Average transaction", formatUSDC(result.activity?.averageTransactionAmountUSDC)],
                    ["Average actions/day", result.activity?.averageActionsPerDay ?? "0.0"],
                    ["Days since last activity", formatDaysSinceLastActivity(result.activity?.daysSinceLastActivity)]
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-arc-border/60 py-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </DetailSection>
          </section>
        </div>
      ) : null}
    </div>
  );
}

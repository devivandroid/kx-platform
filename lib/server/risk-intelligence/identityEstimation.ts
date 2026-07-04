import { isPostgresEnabled, pgQuery } from "@/lib/server/postgres";
import {
  getArcscanWalletTransactionSample,
  type ArcscanWalletTransactionSample
} from "@/lib/server/risk-intelligence/arcscanAdapter";
import {
  indexArcNetworkSnapshot,
  type ArcNetworkIndexOptions,
  type ArcNetworkSnapshot
} from "@/lib/server/risk-intelligence/arcNetworkIndexer";
import type {
  ConfidenceLevel,
  IdentityMatchStatus,
  IdentitySignalResult,
  RiskProfile
} from "@/lib/server/risk-intelligence/types";

const cacheTtlSeconds = Number(process.env.IDENTITY_ESTIMATION_CACHE_SECONDS ?? 60);

type IdentityEstimation = NonNullable<RiskProfile["identityEstimation"]>;

type IdentityEstimationRow = {
  data: IdentityEstimation;
  updated_at: Date;
};

type TxSampleRow = {
  data: ArcscanWalletTransactionSample[];
  updated_at: Date;
};

function signal(
  label: string,
  result: IdentitySignalResult,
  explanation: string
): IdentityEstimation["signals"][number] {
  return { label, result, explanation };
}

async function ensureIdentityEstimationTable() {
  if (!isPostgresEnabled()) return;

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS wallet_identity_estimations (
      wallet_address TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallet_transaction_samples (
      wallet_address TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS wallet_identity_estimations_updated_idx
      ON wallet_identity_estimations (updated_at DESC);

    CREATE INDEX IF NOT EXISTS wallet_transaction_samples_updated_idx
      ON wallet_transaction_samples (updated_at DESC);
  `);
}

async function getCachedIdentityEstimation(
  wallet: string,
  options: ArcNetworkIndexOptions = {}
): Promise<IdentityEstimation | null> {
  if (!isPostgresEnabled() || options.useIndexedData === false) return null;

  try {
    await ensureIdentityEstimationTable();
    const rows = await pgQuery<IdentityEstimationRow>(
      `
        SELECT data, updated_at
        FROM wallet_identity_estimations
        WHERE LOWER(wallet_address) = LOWER($1)
        LIMIT 1
      `,
      [wallet]
    );
    const row = rows[0];
    if (!row) return null;

    const ageSeconds = (Date.now() - new Date(row.updated_at).getTime()) / 1000;
    return ageSeconds <= cacheTtlSeconds
      ? { ...row.data, cacheSource: "postgres_cache" }
      : null;
  } catch {
    return null;
  }
}

async function saveIdentityEstimation(wallet: string, estimation: IdentityEstimation) {
  if (!isPostgresEnabled()) return;

  try {
    await ensureIdentityEstimationTable();
    await pgQuery(
      `
        INSERT INTO wallet_identity_estimations (wallet_address, data, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (wallet_address) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
      `,
      [wallet, JSON.stringify(estimation)]
    );
  } catch {
    // Best-effort cache only. The estimation can still be returned live.
  }
}

async function getStoredTransactionSample(
  wallet: string
): Promise<ArcscanWalletTransactionSample[]> {
  if (!isPostgresEnabled()) return [];

  try {
    await ensureIdentityEstimationTable();
    const rows = await pgQuery<TxSampleRow>(
      `
        SELECT data, updated_at
        FROM wallet_transaction_samples
        WHERE LOWER(wallet_address) = LOWER($1)
        LIMIT 1
      `,
      [wallet]
    );
    return rows[0]?.data ?? [];
  } catch {
    return [];
  }
}

async function replaceTransactionSample(
  wallet: string,
  sample: ArcscanWalletTransactionSample[]
) {
  if (!isPostgresEnabled()) return;

  try {
    await ensureIdentityEstimationTable();
    await pgQuery(
      `
        DELETE FROM wallet_transaction_samples
        WHERE LOWER(wallet_address) = LOWER($1)
      `,
      [wallet]
    );
    await pgQuery(
      `
        INSERT INTO wallet_transaction_samples (wallet_address, data, updated_at)
        VALUES ($1, $2::jsonb, NOW())
      `,
      [wallet, JSON.stringify(sample.slice(0, 50))]
    );
  } catch {
    // Transaction samples are best-effort. Estimation can still return Unknown signals.
  }
}

function getConfidence(input: {
  totalSignals: number;
  knownSignals: number;
  timestampedTxCount: number;
  accountTypeKnown: boolean;
  strongSignalCount: number;
}): ConfidenceLevel {
  if (input.timestampedTxCount < 8) return "Low";
  if (!input.accountTypeKnown && input.strongSignalCount === 0) return "Low";
  if (input.knownSignals >= Math.ceil(input.totalSignals * 0.7)) {
    return input.accountTypeKnown ? "High" : "Medium";
  }
  if (input.knownSignals >= Math.ceil(input.totalSignals * 0.4)) return "Medium";
  return "Low";
}

function getEstimatedIdentity(input: {
  humanVotes: number;
  agentVotes: number;
  strongHumanSignals: number;
  strongAgentSignals: number;
  unknownSignals: number;
  totalSignals: number;
  knownSignals: number;
}): { estimatedUserType: IdentityEstimation["estimatedUserType"]; probability: number } {
  if (
    input.knownSignals === 0 ||
    input.unknownSignals > input.totalSignals * 0.5
  ) {
    return { estimatedUserType: "Unknown", probability: 50 };
  }

  if (input.strongAgentSignals >= 2 && input.strongHumanSignals >= 2) {
    return { estimatedUserType: "Leaning Human", probability: 60 };
  }

  if (input.strongAgentSignals > 0 && input.strongHumanSignals > 0) {
    return { estimatedUserType: "Mixed / Inconclusive", probability: 55 };
  }

  if (input.strongAgentSignals >= 2) {
    const probability = Math.max(10, 40 - input.strongAgentSignals * 5);
    return {
      estimatedUserType: probability <= 30 ? "Likely Agent" : "Leaning Agent",
      probability
    };
  }

  if (input.strongAgentSignals === 1 && input.agentVotes >= 2) {
    return { estimatedUserType: "Leaning Agent", probability: 40 };
  }

  if (input.humanVotes === input.agentVotes) {
    return { estimatedUserType: "Mixed / Inconclusive", probability: 55 };
  }

  if (input.humanVotes > input.agentVotes) {
    if (input.strongAgentSignals > 0) {
      return { estimatedUserType: "Leaning Human", probability: 60 };
    }
    if (input.humanVotes < 2) return { estimatedUserType: "Unknown", probability: 50 };
    if (input.strongHumanSignals >= 2 && input.humanVotes >= 3) {
      return { estimatedUserType: "Likely Human", probability: Math.min(90, 70 + input.strongHumanSignals * 5) };
    }
    if (input.humanVotes >= 2) {
      return {
        estimatedUserType: "Leaning Human",
        probability: Math.min(69, 56 + Math.max(0, input.humanVotes - input.agentVotes) * 5)
      };
    }
    return {
      estimatedUserType: "Mixed / Inconclusive",
      probability: Math.min(65, 55 + Math.max(0, input.humanVotes - input.agentVotes) * 5)
    };
  }

  if (input.agentVotes < 2) return { estimatedUserType: "Mixed / Inconclusive", probability: 50 };
  const probability = Math.max(35, 45 - Math.max(0, input.agentVotes - input.humanVotes) * 5);
  return {
    estimatedUserType: probability <= 30 ? "Likely Agent" : "Leaning Agent",
    probability
  };
}

function getIdentityMatch(
  declaredUserType: "HUMAN" | "AGENT" | "unknown" | undefined,
  estimatedUserType: IdentityEstimation["estimatedUserType"]
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

function getNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function getSortedTimestamps(sample: ArcscanWalletTransactionSample[]): number[] {
  return sample
    .map((tx) => new Date(tx.timestamp).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function getIntervalsMinutes(timestamps: number[]): number[] {
  const intervals: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    intervals.push((timestamps[index] - timestamps[index - 1]) / 60_000);
  }
  return intervals.filter((value) => value > 0);
}

function getActivityDays(timestamps: number[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const timestamp of timestamps) {
    const day = new Date(timestamp).toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  return days;
}

function getCircadianSignal(sample: ArcscanWalletTransactionSample[]) {
  const timestamps = getSortedTimestamps(sample);
  if (timestamps.length < 8) {
    return signal(
      "Circadian Activity Signal",
      "Unknown",
      "At least 8 timestamped transactions are needed for a basic circadian estimate."
    );
  }

  const hours = timestamps.map((value) => new Date(value).getUTCHours());
  const activeHours = new Set(hours).size;
  const nightShare =
    hours.filter((hour) => hour <= 5 || hour >= 23).length / Math.max(1, hours.length);

  if (activeHours >= 12 || nightShare >= 0.35) {
    return signal(
      "Circadian Activity Signal",
      "Agent-like",
      `${activeHours} UTC hours represented; ${(nightShare * 100).toFixed(0)}% of activity is late-night UTC.`
    );
  }

  return signal(
    "Circadian Activity Signal",
    "Human",
    `${activeHours} UTC hours represented with limited late-night UTC activity.`
  );
}

function getTimingVarianceSignal(sample: ArcscanWalletTransactionSample[]) {
  const intervals = getIntervalsMinutes(getSortedTimestamps(sample));
  const cv = coefficientOfVariation(intervals);

  if (cv === null || intervals.length < 5) {
    return signal(
      "Transaction Timing Variance",
      "Unknown",
      "At least 6 timestamped transactions are needed to estimate timing variance."
    );
  }

  if (cv <= 0.5) {
    return signal(
      "Transaction Timing Variance",
      "Agent-like",
      `Inter-transaction timing is relatively regular (CV ${cv.toFixed(2)}).`
    );
  }

  return signal(
    "Transaction Timing Variance",
    "Human",
    `Inter-transaction timing is irregular (CV ${cv.toFixed(2)}).`
  );
}

function getActivityConsistencySignal(sample: ArcscanWalletTransactionSample[]) {
  const days = getActivityDays(getSortedTimestamps(sample));
  const counts = [...days.values()];
  const cv = coefficientOfVariation(counts);

  if (cv === null || days.size < 3) {
    return signal(
      "Activity Consistency",
      "Unknown",
      "At least 3 active days are needed to estimate activity consistency."
    );
  }

  if (cv <= 0.6) {
    return signal(
      "Activity Consistency",
      "Agent-like",
      `Activity is distributed consistently across ${days.size} active days (daily CV ${cv.toFixed(2)}).`
    );
  }

  return signal(
    "Activity Consistency",
    "Human",
    `Activity is uneven across ${days.size} active days (daily CV ${cv.toFixed(2)}).`
  );
}

function getGasFeePatternSignal(sample: ArcscanWalletTransactionSample[]) {
  const fees = sample
    .map((tx) => getNumber(tx.maxFeePerGas) ?? getNumber(tx.gasPrice))
    .filter((value): value is number => value !== null && value > 0);
  const cv = coefficientOfVariation(fees);

  if (cv === null || fees.length < 5) {
    return signal(
      "Gas Fee Pattern",
      "Unknown",
      "At least 5 transactions with fee fields are needed to compare fee regularity."
    );
  }

  if (cv <= 0.15) {
    return signal(
      "Gas Fee Pattern",
      "Agent-like",
      `Fee values are highly regular across ${fees.length} transactions (CV ${cv.toFixed(2)}).`
    );
  }

  return signal(
    "Gas Fee Pattern",
    "Human",
    `Fee values vary across ${fees.length} transactions (CV ${cv.toFixed(2)}).`
  );
}

function getBehaviorStabilitySignal(
  currentSample: ArcscanWalletTransactionSample[],
  previousSample: ArcscanWalletTransactionSample[]
) {
  if (currentSample.length < 8 || previousSample.length < 8) {
    return signal(
      "Behavior Stability",
      "Unknown",
      "A previous and current transaction sample are required for behavior stability comparison."
    );
  }

  const currentIntervals = getIntervalsMinutes(getSortedTimestamps(currentSample));
  const previousIntervals = getIntervalsMinutes(getSortedTimestamps(previousSample));
  const currentFees = currentSample
    .map((tx) => getNumber(tx.maxFeePerGas) ?? getNumber(tx.gasPrice))
    .filter((value): value is number => value !== null && value > 0);
  const previousFees = previousSample
    .map((tx) => getNumber(tx.maxFeePerGas) ?? getNumber(tx.gasPrice))
    .filter((value): value is number => value !== null && value > 0);
  const currentIntervalCv = coefficientOfVariation(currentIntervals);
  const previousIntervalCv = coefficientOfVariation(previousIntervals);
  const currentFeeCv = coefficientOfVariation(currentFees);
  const previousFeeCv = coefficientOfVariation(previousFees);

  if (
    currentIntervalCv === null ||
    previousIntervalCv === null ||
    currentFeeCv === null ||
    previousFeeCv === null
  ) {
    return signal(
      "Behavior Stability",
      "Unknown",
      "The previous/current samples do not have enough timing and fee evidence for comparison."
    );
  }

  const intervalDelta = Math.abs(currentIntervalCv - previousIntervalCv);
  const feeDelta = Math.abs(currentFeeCv - previousFeeCv);

  if (intervalDelta <= 0.2 && feeDelta <= 0.1) {
    return signal(
      "Behavior Stability",
      "Agent-like",
      `Current behavior is close to previous behavior (timing delta ${intervalDelta.toFixed(2)}, fee delta ${feeDelta.toFixed(2)}).`
    );
  }

  return signal(
    "Behavior Stability",
    "Human",
    `Current behavior differs from previous behavior (timing delta ${intervalDelta.toFixed(2)}, fee delta ${feeDelta.toFixed(2)}).`
  );
}

function buildSignals(
  snapshot: ArcNetworkSnapshot,
  currentSample: ArcscanWalletTransactionSample[],
  previousSample: ArcscanWalletTransactionSample[]
): IdentityEstimation["signals"] {
  const transfers = snapshot.arcscanStats?.transfersCount ?? snapshot.usdcTransfers;
  const transactions = snapshot.arcscanStats?.transactionsCount ?? snapshot.usdcTransferTransactions;
  const counterparties = snapshot.uniqueCounterparties;
  const blocksAnalyzed = snapshot.toBlock - snapshot.fromBlock + 1;

  return [
    snapshot.isContractAccount === undefined
      ? signal(
          "Account Type",
          "Unknown",
          "Arc RPC account code was not available for this estimate."
        )
      : signal(
          "Account Type",
          snapshot.isContractAccount ? "Agent-like" : "Human",
          snapshot.isContractAccount
            ? "Arc RPC returned account code for this wallet."
            : "Arc RPC returned no account code for this wallet."
        ),
    getCircadianSignal(currentSample),
    signal(
      "Transaction Frequency",
      transactions >= 100 ? "Agent-like" : transactions > 0 ? "Human" : "Unknown",
      `${transactions} Arc Network transactions were observed by available counters/indexing.`
    ),
    getGasFeePatternSignal(currentSample),
    signal(
      "Destination Concentration",
      transfers >= 10 && counterparties <= 2 ? "Agent-like" : counterparties >= 3 ? "Human" : "Unknown",
      `${counterparties} unique counterparties were found in indexed transfer evidence.`
    ),
    signal(
      "Counterparty Diversity",
      counterparties >= 5 ? "Human" : transfers >= 10 && counterparties <= 2 ? "Agent-like" : "Unknown",
      `${counterparties} unique counterparties were observed.`
    ),
    getActivityConsistencySignal(currentSample),
    getTimingVarianceSignal(currentSample),
    getBehaviorStabilitySignal(currentSample, previousSample),
    signal(
      "Network Coverage",
      "Unknown",
      `${blocksAnalyzed} Arc blocks were analyzed. This is coverage evidence, not identity proof.`
    )
  ];
}

function getScoredSignals(signals: IdentityEstimation["signals"]) {
  return signals.filter((item) => item.label !== "Network Coverage");
}

function isStrongHumanSignal(signalItem: IdentityEstimation["signals"][number]): boolean {
  if (signalItem.result !== "Human") return false;
  return [
    "Destination Concentration",
    "Counterparty Diversity",
    "Transaction Timing Variance",
    "Activity Consistency"
  ].includes(signalItem.label);
}

function isStrongAgentSignal(
  signalItem: IdentityEstimation["signals"][number],
  currentSample: ArcscanWalletTransactionSample[]
): boolean {
  if (signalItem.result !== "Agent-like") return false;
  if (signalItem.label === "Gas Fee Pattern" && currentSample.length >= 30) return true;
  return [
    "Transaction Frequency",
    "Destination Concentration",
    "Counterparty Diversity",
    "Transaction Timing Variance",
    "Activity Consistency",
    "Behavior Stability"
  ].includes(signalItem.label);
}

export async function estimateWalletIdentityFromArcNetwork(
  wallet: string,
  options: ArcNetworkIndexOptions & {
    snapshot?: ArcNetworkSnapshot;
    kxDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    arcDeclaredIdentity?: string | null;
    arcDeclaredUserType?: "HUMAN" | "AGENT" | "unknown";
    declaredUserType?: "HUMAN" | "AGENT" | "unknown";
  } = {}
): Promise<IdentityEstimation> {
  const kxDeclaredUserType =
    options.kxDeclaredUserType ?? options.declaredUserType ?? "unknown";
  const arcDeclaredUserType = options.arcDeclaredUserType ?? "unknown";
  const comparableDeclaredUserType =
    kxDeclaredUserType !== "unknown" ? kxDeclaredUserType : arcDeclaredUserType;
  const cached = await getCachedIdentityEstimation(wallet, options);
  if (cached) {
    return {
      ...cached,
      kxDeclaredUserType,
      arcDeclaredIdentity: options.arcDeclaredIdentity ?? cached.arcDeclaredIdentity ?? null,
      arcDeclaredUserType,
      declaredUserType: kxDeclaredUserType,
      identityMatch: getIdentityMatch(comparableDeclaredUserType, cached.estimatedUserType)
    };
  }

  const snapshot = options.snapshot ?? await indexArcNetworkSnapshot(wallet, options);
  const previousSample = await getStoredTransactionSample(snapshot.wallet);
  const currentSample = await getArcscanWalletTransactionSample(snapshot.wallet, 50);
  await replaceTransactionSample(snapshot.wallet, currentSample);
  const signals = buildSignals(snapshot, currentSample, previousSample);
  const scoredSignals = getScoredSignals(signals);
  const humanVotes = scoredSignals.filter((item) => item.result === "Human").length;
  const agentVotes = scoredSignals.filter((item) => item.result === "Agent-like").length;
  const unknownSignals = scoredSignals.filter((item) => item.result === "Unknown").length;
  const knownSignals = humanVotes + agentVotes;
  const strongHumanSignals = scoredSignals.filter((item) => isStrongHumanSignal(item)).length;
  const strongAgentSignals = scoredSignals.filter((item) =>
    isStrongAgentSignal(item, currentSample)
  ).length;
  const { estimatedUserType, probability } = getEstimatedIdentity({
    humanVotes,
    agentVotes,
    strongHumanSignals,
    strongAgentSignals,
    unknownSignals,
    totalSignals: scoredSignals.length,
    knownSignals
  });
  const timestampedTxCount = getSortedTimestamps(currentSample).length;
  const confidence = getConfidence({
    totalSignals: scoredSignals.length,
    knownSignals,
    timestampedTxCount,
    accountTypeKnown: signals.find((item) => item.label === "Account Type")?.result !== "Unknown",
    strongSignalCount: strongHumanSignals + strongAgentSignals
  });
  const estimation: IdentityEstimation = {
    estimatedUserType,
    probability,
    confidence,
    evidenceSource: "Arc Network",
    kxDeclaredUserType,
    arcDeclaredIdentity: options.arcDeclaredIdentity ?? null,
    arcDeclaredUserType,
    declaredUserType: kxDeclaredUserType,
    identityMatch: getIdentityMatch(comparableDeclaredUserType, estimatedUserType),
    cacheSource: "live_estimation",
    lastEstimatedAt: new Date().toISOString(),
    signals,
    limitations: [
      "This is behavioral estimation, not identity verification.",
      "Uses Arc Network behavior only.",
      "Does not use self-declared userType as model input.",
      "Not KYC, AML, sanctions, compliance screening or bot detection certainty."
    ]
  };

  await saveIdentityEstimation(snapshot.wallet, estimation);
  return estimation;
}

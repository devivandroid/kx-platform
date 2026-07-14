import { formatUnits, JsonRpcProvider } from "ethers";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_NATIVE_CURRENCY,
  ARC_TESTNET_RPC_URL
} from "@/lib/chains/arcTestnet";
import {
  indexArcNetworkSnapshot,
  type ArcNetworkIndexOptions
} from "@/lib/server/risk-intelligence/arcNetworkIndexer";
import { estimateWalletIdentityFromArcNetwork } from "@/lib/server/risk-intelligence/identityEstimation";
import type { RiskProfile } from "@/lib/server/risk-intelligence/types";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || ARC_TESTNET_RPC_URL;
const nativeRpcDecimals = 18;

const networkLimitations = [
  "Arc Network Activity Adapter indexes USDC Transfer logs on demand for the requested wallet",
  "Indexed metrics are limited to the configured block window, not the entire Arc history",
  "Gas used only includes outgoing USDC transfer transactions found by this adapter",
  "Not an official Arc or Circle score",
  "Preview risk model",
  "No AML, KYC, sanctions, fraud or compliance screening"
];

function emptyActivity(): RiskProfile["activity"] {
  return {
    totalCompletedVolumeUSDC: "0.00",
    completedActions: 0,
    successfulPayments: 0,
    failedPayments: 0,
    resourcesPurchased: 0,
    resourcesDownloaded: 0,
    requestsCreated: 0,
    protectedTransactionsFunded: 0,
    deliveriesSubmitted: 0,
    fundsReleased: 0,
    uniqueCounterparties: 0,
    averageTransactionAmountUSDC: "0.00",
    averageActionsPerDay: "0.0",
    activityLevel: "Unknown",
    evidenceCount: 0
  };
}

function getActivityLevel(transactionCount: number): RiskProfile["activity"]["activityLevel"] {
  if (transactionCount === 0) return "Unknown";
  if (transactionCount < 3) return "Low";
  if (transactionCount <= 25) return "Normal";
  return "High";
}

function getConfidenceLevel(evidenceCount: number): RiskProfile["scores"]["confidenceLevel"] {
  if (evidenceCount >= 20) return "High";
  if (evidenceCount >= 5) return "Medium";
  return "Low";
}

function getEvidenceQualityConfidence(input: {
  volumeUSDC: number;
  counterparties: number;
  transactions: number;
  transfers: number;
  hasBalance: boolean;
  hasRecentActivity: boolean;
}): RiskProfile["scores"]["confidenceLevel"] {
  const quality =
    (input.volumeUSDC >= 1 ? 2 : input.volumeUSDC > 0 ? 1 : 0) +
    (input.counterparties >= 3 ? 2 : input.counterparties > 0 ? 1 : 0) +
    (input.transactions >= 10 ? 2 : input.transactions > 0 ? 1 : 0) +
    (input.transfers >= 10 ? 2 : input.transfers > 0 ? 1 : 0) +
    (input.hasBalance ? 1 : 0) +
    (input.hasRecentActivity ? 1 : 0);

  if (quality >= 8) return "High";
  if (quality >= 4) return "Medium";
  return "Low";
}

function getRiskTier(riskScore: number): RiskProfile["scores"]["riskTier"] {
  if (riskScore <= 24) return "Low";
  if (riskScore <= 59) return "Medium";
  return "High";
}

export async function getArcNetworkRiskProfile(
  wallet: string,
  options: ArcNetworkIndexOptions = {}
): Promise<RiskProfile> {
  try {
    const snapshot = await indexArcNetworkSnapshot(wallet, options);
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[KX Arc->HumanEstimator] wallet=${snapshot.wallet} snapshotFields=${Object.keys(snapshot).join(",")} ` +
        `txCount=${snapshot.arcscanStats?.transactionsCount ?? snapshot.usdcTransferTransactions} ` +
        `transfers=${snapshot.arcscanStats?.transfersCount ?? snapshot.usdcTransfers} ` +
        `counterparties=${snapshot.uniqueCounterparties} lastActivity=${snapshot.lastTransferAt ?? "null"} ` +
        `arcscanSample=${snapshot.arcscanTransactionSample?.length ?? 0}`
      );
    }
    const identityEstimation = await estimateWalletIdentityFromArcNetwork(snapshot.wallet, {
      ...options,
      snapshot,
      arcTransactionSample: snapshot.arcscanTransactionSample,
      useIndexedData: true,
      declaredUserType: "unknown"
    });
    const arcscanStats = snapshot.arcscanStats ?? null;
    const networkTransactions =
      arcscanStats?.transactionsCount ?? snapshot.usdcTransferTransactions;
    const networkTransfers = arcscanStats?.transfersCount ?? snapshot.usdcTransfers;
    const gasUsed = arcscanStats?.gasUsed ?? snapshot.outgoingGasUsed;
    const nativeBalance = arcscanStats?.nativeBalanceUSDC ?? snapshot.nativeBalanceUSDC;
    const evidenceCount =
      networkTransfers + networkTransactions + (Number(nativeBalance) > 0 ? 1 : 0);

    if (evidenceCount > 0) {
      const behaviorScore = Math.min(
        1000,
        500 +
          Math.min(networkTransfers * 4, 220) +
          Math.min(networkTransactions * 2, 180) +
          Math.min(snapshot.uniqueCounterparties * 8, 160) +
          Math.min(Number(snapshot.usdcVolumeTotal) * 18, 120) +
          (Number(nativeBalance) > 0 ? 40 : 0) +
          (snapshot.lastTransferAt ? 30 : 0)
      );
      const lowVolumeMinimumRisk = Number(snapshot.usdcVolumeTotal) > 0 && Number(snapshot.usdcVolumeTotal) < 1 ? 20 : 0;
      const riskScore = Math.max(
        lowVolumeMinimumRisk,
        Math.max(5, Math.min(100, Math.round((1000 - behaviorScore) / 10)))
      );
      const adjustedBehaviorScore = Math.max(0, Math.min(1000, 1000 - riskScore * 10));
      const coverage = {
        fromBlock: snapshot.fromBlock,
        toBlock: snapshot.toBlock,
        blocksAnalyzed: snapshot.toBlock - snapshot.fromBlock + 1,
        fullHistory: false,
        description:
          "Windowed on-demand index. This is not full Arc Testnet historical coverage yet."
      };

      return {
        wallet: snapshot.wallet,
        dataSource: "arc_network",
        profileStatus: evidenceCount >= 5 ? "active" : "limited",
        message: "Arc Network USDC transfer activity was indexed on demand.",
        recommendation:
          "Use this as network activity context alongside KX activity, not as compliance screening.",
        participant: { type: "unknown" },
        scores: {
          financialBehaviorScore: adjustedBehaviorScore,
          trustScore: Math.round(adjustedBehaviorScore / 10),
          riskScore,
          riskTier: getRiskTier(riskScore),
          confidenceLevel: getEvidenceQualityConfidence({
            volumeUSDC: Number(snapshot.usdcVolumeTotal),
            counterparties: snapshot.uniqueCounterparties,
            transactions: networkTransactions,
            transfers: networkTransfers,
            hasBalance: Number(nativeBalance) > 0,
            hasRecentActivity: Boolean(snapshot.lastTransferAt)
          })
        },
        activity: {
          ...emptyActivity(),
          totalCompletedVolumeUSDC: snapshot.usdcVolumeTotal,
          completedActions: networkTransactions,
          successfulPayments: networkTransactions,
          uniqueCounterparties: snapshot.uniqueCounterparties,
          averageTransactionAmountUSDC:
            snapshot.usdcTransferTransactions > 0
              ? (Number(snapshot.usdcVolumeTotal) / snapshot.usdcTransferTransactions).toFixed(6)
              : "0.00",
          lastActivity: snapshot.lastTransferAt ?? undefined,
          daysSinceLastActivity: snapshot.lastTransferAt
            ? Math.floor((Date.now() - new Date(snapshot.lastTransferAt).getTime()) / 86_400_000)
            : undefined,
          activityLevel: getActivityLevel(snapshot.usdcTransfers),
          evidenceCount
        },
        metadata: {
          dataFreshness:
            snapshot.cacheSource === "postgres_cache" ? "Cached snapshot" : "Live indexed",
          lastIndexed: snapshot.indexedAt,
          cacheSource: snapshot.cacheSource,
          coverage
        },
        identityEstimation,
        behavioralSignals: [
          {
            label: "Data freshness",
            value: snapshot.cacheSource === "postgres_cache" ? "Cached snapshot" : "Live indexed",
            status: "Normal",
            description: "Indicates whether this profile came from cache or a fresh index run."
          },
          {
            label: "Last indexed",
            value: snapshot.indexedAt,
            status: "Normal",
            description: "Timestamp when this Arc Network snapshot was produced."
          },
          {
            label: "Cache source",
            value: snapshot.cacheSource,
            status: "Normal",
            description: "PostgreSQL cache is used when available and fresh."
          },
          {
            label: "Coverage",
            value: `${coverage.blocksAnalyzed} blocks analyzed; full history: no`,
            status: "Watch",
            description: coverage.description
          },
          {
            label: "Native USDC balance",
            value: `${nativeBalance} ${ARC_TESTNET_NATIVE_CURRENCY.symbol}`,
            status: Number(nativeBalance) > 0 ? "Normal" : "Unknown",
            description:
              arcscanStats === null
                ? "Current native gas-token balance returned by Arc Testnet RPC."
                : "Current native gas-token balance returned by Arcscan indexed address data."
          },
          {
            label: "Transfers indexed",
            value: String(networkTransfers),
            status: networkTransfers > 0 ? "Normal" : "Unknown",
            description:
              arcscanStats === null
                ? "ERC-20 USDC Transfer logs involving this wallet in the analyzed block range."
                : "Transfer count returned by Arcscan indexed address counters."
          },
          {
            label: "Transactions indexed",
            value: String(networkTransactions),
            status: networkTransactions > 0 ? "Normal" : "Unknown",
            description:
              arcscanStats === null
                ? "Unique transaction hashes represented by indexed USDC Transfer logs."
                : "Transaction count returned by Arcscan indexed address counters."
          },
          {
            label: "USDC volume sent",
            value: `${snapshot.usdcVolumeSent} USDC`,
            status: Number(snapshot.usdcVolumeSent) > 0 ? "Normal" : "Unknown",
            description: "Outgoing USDC volume found in indexed Transfer logs."
          },
          {
            label: "USDC volume received",
            value:
              Number(snapshot.usdcVolumeReceived) > 0
                ? `${snapshot.usdcVolumeReceived} USDC`
                : "No received transfers found in analyzed window",
            status: Number(snapshot.usdcVolumeReceived) > 0 ? "Normal" : "Unknown",
            description: "Incoming USDC volume found in indexed Transfer logs."
          },
          {
            label: "Gas used",
            value: gasUsed,
            status: Number(gasUsed) > 0 ? "Normal" : "Unknown",
            description:
              arcscanStats === null
                ? "Gas used by outgoing USDC transfer transactions indexed by this adapter."
                : "Gas usage returned by Arcscan indexed address counters."
          },
          {
            label: "Block range analyzed",
            value: `${snapshot.fromBlock} - ${snapshot.toBlock}`,
            status: "Normal",
            description: "Arc Testnet block range scanned for USDC Transfer logs."
          }
        ],
        riskSignals: [
          {
            label: "On-demand network index",
            severity: "Info",
            description:
              "Network metrics are indexed when a wallet is requested and cached in PostgreSQL when DATABASE_URL is configured."
          },
          {
            label: "Windowed USDC view",
            severity: "Info",
            description:
              "This adapter indexes USDC Transfer logs in a configured recent block window. It is not full-chain historical indexing yet."
          }
        ],
        limitations: networkLimitations
      };
    }

    return {
      wallet: snapshot.wallet,
      dataSource: "no_data",
      profileStatus: "no_data",
      message: "No Arc Network activity was found in the analyzed window.",
      recommendation:
        "No data is neutral. Apply your own review policy before transacting.",
      participant: { type: "unknown" },
      scores: {
        financialBehaviorScore: null,
        riskScore: null,
        riskTier: "Unknown",
        confidenceLevel: "Low"
      },
      activity: emptyActivity(),
      metadata: {
        dataFreshness:
          snapshot.cacheSource === "postgres_cache" ? "Cached snapshot" : "Live indexed",
        lastIndexed: snapshot.indexedAt,
        cacheSource: snapshot.cacheSource,
        coverage: {
          fromBlock: snapshot.fromBlock,
          toBlock: snapshot.toBlock,
          blocksAnalyzed: snapshot.toBlock - snapshot.fromBlock + 1,
          fullHistory: false,
          description:
            "Windowed on-demand index. This is not full Arc Testnet historical coverage yet."
        }
      },
      identityEstimation,
      behavioralSignals: [],
      riskSignals: [
        {
          label: "No Arc Network activity in window",
          severity: "Info",
          description: "No indexed activity was found in the configured block window."
        }
      ],
      limitations: networkLimitations
    };
  } catch {
    return {
      wallet,
      dataSource: "no_data",
      profileStatus: "no_data",
      message: "Arc Network activity could not be indexed for this wallet.",
      recommendation:
        "Treat missing network data as neutral until Arcscan counters or the on-demand indexer are available.",
      participant: { type: "unknown" },
      scores: {
        financialBehaviorScore: null,
        riskScore: null,
        riskTier: "Unknown",
        confidenceLevel: "Low"
      },
      activity: emptyActivity(),
      behavioralSignals: [],
      riskSignals: [
        {
          label: "Arc Network index unavailable",
          severity: "Info",
          description:
            "The adapter could not read Arcscan counters or index USDC Transfer logs during this request."
        }
      ],
      limitations: networkLimitations
    };
  }

  const provider = new JsonRpcProvider(rpcUrl, ARC_TESTNET_CHAIN_ID);
  let transactionCount: number;
  let balance: bigint;
  let code: string;
  let blockNumber: number;

  try {
    [transactionCount, balance, code, blockNumber] = await Promise.all([
      provider.getTransactionCount(wallet),
      provider.getBalance(wallet),
      provider.getCode(wallet),
      provider.getBlockNumber()
    ]);
  } catch {
    return {
      wallet,
      dataSource: "no_data",
      profileStatus: "no_data",
      message: "Arc Testnet RPC activity could not be read for this wallet.",
      recommendation:
        "Treat missing network data as neutral and apply your own review policy before transacting.",
      participant: { type: "unknown" },
      scores: {
        financialBehaviorScore: null,
        riskScore: null,
        riskTier: "Unknown",
        confidenceLevel: "Low"
      },
      activity: emptyActivity(),
      behavioralSignals: [],
      riskSignals: [
        {
          label: "Arc Testnet RPC unavailable",
          severity: "Info",
          description:
            "The network adapter could not read Arc Testnet RPC data during this request."
        }
      ],
      limitations: networkLimitations
    };
  }

  const nativeBalanceUSDC = Number(formatUnits(balance, nativeRpcDecimals));
  const hasBalance = balance > 0n;
  const isContract = code !== "0x";
  const evidenceCount = transactionCount + (hasBalance ? 1 : 0) + (isContract ? 1 : 0);

  if (evidenceCount === 0) {
    return {
      wallet,
      dataSource: "no_data",
      profileStatus: "no_data",
      message: "No Arc Testnet network activity was found for this wallet through the RPC adapter.",
      recommendation:
        "Missing network data is not negative evidence. Apply your own policy or request additional verification before transacting.",
      participant: { type: "unknown" },
      scores: {
        financialBehaviorScore: null,
        riskScore: null,
        riskTier: "Unknown",
        confidenceLevel: "Low"
      },
      activity: emptyActivity(),
      behavioralSignals: [],
      riskSignals: [
        {
          label: "No Arc Testnet RPC activity",
          severity: "Info",
          description:
            "The adapter found no nonce, native USDC balance or contract code for this wallet."
        }
      ],
      limitations: networkLimitations
    };
  }

  const behaviorScore = Math.min(
    1000,
    500 + Math.min(transactionCount * 8, 260) + (hasBalance ? 40 : 0) + (isContract ? 20 : 0)
  );
  const riskScore = Math.max(5, Math.min(100, Math.round((1000 - behaviorScore) / 10)));

  return {
    wallet,
    dataSource: "arc_network",
    profileStatus: evidenceCount >= 5 ? "active" : "limited",
    message: "Arc Testnet network activity was found through the RPC adapter.",
    recommendation:
      "Use this as a lightweight network context signal alongside KX activity.",
    participant: { type: "unknown" },
    scores: {
      financialBehaviorScore: behaviorScore,
      trustScore: Math.round(behaviorScore / 10),
      riskScore,
      riskTier: getRiskTier(riskScore),
      confidenceLevel: getConfidenceLevel(evidenceCount)
    },
    activity: {
      ...emptyActivity(),
      activityLevel: getActivityLevel(transactionCount),
      evidenceCount
    },
    behavioralSignals: [
      {
        label: "RPC account nonce",
        value: String(transactionCount),
        status: transactionCount > 0 ? "Normal" : "Unknown",
        description:
          "Current account nonce reported by Arc Testnet RPC. This may differ from explorer-indexed transactions and transfers."
      },
      {
        label: "Native USDC balance",
        value: `${nativeBalanceUSDC.toFixed(6)} ${ARC_TESTNET_NATIVE_CURRENCY.symbol}`,
        status: hasBalance ? "Normal" : "Unknown",
        description:
          "Current native gas-token balance returned by Arc Testnet RPC. This is not counted as completed commerce volume."
      },
      {
        label: "Account code",
        value: isContract ? "Contract account" : "Externally owned account or no code",
        status: isContract ? "Watch" : "Normal",
        description: "RPC code check. Contract accounts may require additional integration review."
      }
    ],
    riskSignals: [
      {
        label: "Explorer indexed data",
        severity: "Info",
        description:
          "Explorer-indexed transactions, transfers, gas used and USDC transfer volume are not connected yet."
      },
      {
        label: "RPC-only network view",
        severity: "Info",
        description:
          "This adapter does not yet include indexed transfers, counterparties, wallet age or historical contract interactions."
      },
      {
        label: "Latest observed block",
        severity: "Info",
        description: `Network snapshot was read near Arc Testnet block ${blockNumber}.`
      }
    ],
    limitations: networkLimitations
  };
}

export const arcNetworkRiskLimitations = networkLimitations;

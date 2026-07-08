import {
  formatUnits,
  getAddress,
  id,
  JsonRpcProvider,
  zeroPadValue,
  type Log
} from "ethers";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC
} from "@/lib/chains/arcTestnet";
import {
  getArcscanAddressStats,
  type ArcscanAddressStats
} from "@/lib/server/risk-intelligence/arcscanAdapter";
import { isPostgresEnabled, pgQuery } from "@/lib/server/postgres";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || ARC_TESTNET_RPC_URL;
const nativeRpcDecimals = 18;
const transferTopic = id("Transfer(address,address,uint256)");
const defaultBlockWindow = Number(process.env.ARC_NETWORK_INDEXER_BLOCK_WINDOW ?? 250_000);
const defaultChunkSize = Number(process.env.ARC_NETWORK_INDEXER_CHUNK_SIZE ?? 9_000);
const cacheTtlSeconds = Number(process.env.ARC_NETWORK_INDEXER_CACHE_SECONDS ?? 86_400);

export type ArcNetworkSnapshot = {
  wallet: string;
  nativeBalanceUSDC: string;
  usdcTransfers: number;
  usdcTransferTransactions: number;
  usdcVolumeSent: string;
  usdcVolumeReceived: string;
  usdcVolumeTotal: string;
  uniqueCounterparties: number;
  outgoingGasUsed: string;
  lastTransferAt: string | null;
  lastTransferBlock: number | null;
  fromBlock: number;
  toBlock: number;
  indexedAt: string;
  cacheSource: "live_index" | "postgres_cache";
  accountCode?: string;
  isContractAccount?: boolean;
  arcscanStats?: ArcscanAddressStats | null;
};

type SnapshotRow = {
  data: ArcNetworkSnapshot;
  to_block: string;
  updated_at: Date;
};

export type ArcNetworkIndexOptions = {
  useIndexedData?: boolean;
};

async function ensureArcNetworkSnapshotTable(): Promise<void> {
  if (!isPostgresEnabled()) return;

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS arc_network_snapshots (
      wallet_address TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      from_block BIGINT NOT NULL,
      to_block BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS arc_network_snapshots_updated_idx
      ON arc_network_snapshots (updated_at DESC);
  `);
}

function formatUSDC(value: bigint): string {
  return Number(formatUnits(value, ARC_TESTNET_USDC.decimals)).toFixed(6);
}

function getTopicAddress(topic: string): string {
  return getAddress(`0x${topic.slice(-40)}`);
}

function getPaddedAddressTopic(address: string): string {
  return zeroPadValue(getAddress(address), 32);
}

async function getCachedSnapshot(
  wallet: string,
  options: ArcNetworkIndexOptions = {}
): Promise<ArcNetworkSnapshot | null> {
  if (!isPostgresEnabled()) return null;

  let rows: SnapshotRow[];
  try {
    await ensureArcNetworkSnapshotTable();
    rows = await pgQuery<SnapshotRow>(
      `
        SELECT data, to_block, updated_at
        FROM arc_network_snapshots
        WHERE LOWER(wallet_address) = LOWER($1)
        LIMIT 1
      `,
      [wallet]
    );
  } catch {
    return null;
  }

  const row = rows[0];
  if (!row) return null;
  const ageSeconds = (Date.now() - new Date(row.updated_at).getTime()) / 1000;
  const useIndexedData = options.useIndexedData ?? true;
  return useIndexedData && ageSeconds <= cacheTtlSeconds
    ? { ...row.data, cacheSource: "postgres_cache" }
    : null;
}

async function saveSnapshot(snapshot: ArcNetworkSnapshot): Promise<void> {
  if (!isPostgresEnabled()) return;

  try {
    await ensureArcNetworkSnapshotTable();
    await pgQuery(
      `
        INSERT INTO arc_network_snapshots (
          wallet_address,
          data,
          from_block,
          to_block,
          updated_at
        )
        VALUES ($1, $2::jsonb, $3, $4, NOW())
        ON CONFLICT (wallet_address) DO UPDATE SET
          data = EXCLUDED.data,
          from_block = EXCLUDED.from_block,
          to_block = EXCLUDED.to_block,
          updated_at = NOW()
      `,
      [snapshot.wallet, JSON.stringify(snapshot), snapshot.fromBlock, snapshot.toBlock]
    );
  } catch {
    // Cache is best-effort. Risk profiles should still work without PostgreSQL.
  }
}

async function getTransferLogs(
  provider: JsonRpcProvider,
  walletTopic: string,
  fromBlock: number,
  toBlock: number
): Promise<{ sent: Log[]; received: Log[] }> {
  const sent: Log[] = [];
  const received: Log[] = [];
  const chunkSize = Math.min(9_000, Math.max(1_000, defaultChunkSize));

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    const [sentChunk, receivedChunk] = await Promise.all([
      provider.getLogs({
        address: ARC_TESTNET_USDC.address,
        fromBlock: start,
        toBlock: end,
        topics: [transferTopic, walletTopic]
      }),
      provider.getLogs({
        address: ARC_TESTNET_USDC.address,
        fromBlock: start,
        toBlock: end,
        topics: [transferTopic, null, walletTopic]
      })
    ]);

    sent.push(...sentChunk);
    received.push(...receivedChunk);
  }

  return { sent, received };
}

export async function indexArcNetworkSnapshot(
  wallet: string,
  options: ArcNetworkIndexOptions = {}
): Promise<ArcNetworkSnapshot> {
  const normalizedWallet = getAddress(wallet);
  const cached =
    options.useIndexedData === false
      ? null
      : await getCachedSnapshot(normalizedWallet, options);

  if (cached) return cached;

  const provider = new JsonRpcProvider(rpcUrl, ARC_TESTNET_CHAIN_ID);
  const [latestBlock, balance, accountCode, arcscanStats] = await Promise.all([
    provider.getBlockNumber(),
    provider.getBalance(normalizedWallet),
    provider.getCode(normalizedWallet),
    getArcscanAddressStats(normalizedWallet)
  ]);
  const fromBlock = Math.max(0, latestBlock - Math.max(1, defaultBlockWindow));
  const walletTopic = getPaddedAddressTopic(normalizedWallet);
  const { sent, received } = await getTransferLogs(provider, walletTopic, fromBlock, latestBlock);
  const txHashes = new Set<string>();
  const outgoingTxHashes = new Set<string>();
  const counterparties = new Set<string>();
  let sentValue = 0n;
  let receivedValue = 0n;
  let lastTransferBlock: number | null = null;

  for (const log of sent) {
    sentValue += BigInt(log.data);
    txHashes.add(log.transactionHash);
    outgoingTxHashes.add(log.transactionHash);
    counterparties.add(getTopicAddress(log.topics[2]).toLowerCase());
    lastTransferBlock = Math.max(lastTransferBlock ?? 0, log.blockNumber);
  }

  for (const log of received) {
    receivedValue += BigInt(log.data);
    txHashes.add(log.transactionHash);
    counterparties.add(getTopicAddress(log.topics[1]).toLowerCase());
    lastTransferBlock = Math.max(lastTransferBlock ?? 0, log.blockNumber);
  }

  let outgoingGasUsed = 0n;
  await Promise.all(
    [...outgoingTxHashes].map(async (txHash) => {
      const receipt = await provider.getTransactionReceipt(txHash);
      outgoingGasUsed += receipt?.gasUsed ?? 0n;
    })
  );

  const lastBlock = lastTransferBlock === null ? null : await provider.getBlock(lastTransferBlock);
  const snapshot: ArcNetworkSnapshot = {
    wallet: normalizedWallet,
    nativeBalanceUSDC: Number(formatUnits(balance, nativeRpcDecimals)).toFixed(6),
    usdcTransfers: sent.length + received.length,
    usdcTransferTransactions: txHashes.size,
    usdcVolumeSent: formatUSDC(sentValue),
    usdcVolumeReceived: formatUSDC(receivedValue),
    usdcVolumeTotal: formatUSDC(sentValue + receivedValue),
    uniqueCounterparties: counterparties.size,
    outgoingGasUsed: outgoingGasUsed.toString(),
    lastTransferAt: lastBlock?.timestamp
      ? new Date(lastBlock.timestamp * 1000).toISOString()
      : null,
    lastTransferBlock,
    fromBlock,
    toBlock: latestBlock,
    indexedAt: new Date().toISOString(),
    cacheSource: "live_index",
    accountCode,
    isContractAccount: accountCode !== "0x",
    arcscanStats
  };

  await saveSnapshot(snapshot);
  return snapshot;
}

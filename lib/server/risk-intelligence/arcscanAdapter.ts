import { ARC_TESTNET_EXPLORER_URL } from "@/lib/chains/arcTestnet";

type ArcscanAddressResponse = {
  coin_balance?: string;
};

type ArcscanCountersResponse = {
  transactions_count?: string | number;
  token_transfers_count?: string | number;
  gas_usage_count?: string | number;
};

type ArcscanTransactionItem = {
  hash?: string;
  timestamp?: string;
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  gas_price?: string | number | null;
  max_fee_per_gas?: string | number | null;
  gas_used?: string | number | null;
  status?: string | null;
  result?: string | null;
  block_number?: string | number | null;
};

type ArcscanTransactionsResponse = {
  items?: ArcscanTransactionItem[];
};

export type ArcscanAddressStats = {
  nativeBalanceUSDC: string;
  transactionsCount: number;
  transfersCount: number;
  gasUsed: string;
};

export type ArcscanWalletTransactionSample = {
  hash: string;
  timestamp: string;
  from: string | null;
  to: string | null;
  gasPrice: string | null;
  maxFeePerGas: string | null;
  gasUsed: string | null;
  status: string | null;
  blockNumber: number | null;
};

const arcscanApiBaseUrl =
  process.env.ARCSCAN_API_BASE_URL ||
  `${(process.env.NEXT_PUBLIC_EXPLORER_URL || ARC_TESTNET_EXPLORER_URL).replace(/\/+$/, "")}/api/v2`;

function toNumber(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNativeUSDC(balance: string | undefined): string {
  if (!balance) return "0.000000";

  const value = BigInt(balance);
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fraction}`;
}

export async function getArcscanAddressStats(
  wallet: string
): Promise<ArcscanAddressStats | null> {
  const addressUrl = `${arcscanApiBaseUrl}/addresses/${wallet}`;
  const countersUrl = `${addressUrl}/counters`;

  try {
    const [addressResponse, countersResponse] = await Promise.all([
      fetch(addressUrl, { headers: { Accept: "application/json" } }),
      fetch(countersUrl, { headers: { Accept: "application/json" } })
    ]);

    if (!addressResponse.ok || !countersResponse.ok) return null;

    const [address, counters] = (await Promise.all([
      addressResponse.json(),
      countersResponse.json()
    ])) as [ArcscanAddressResponse, ArcscanCountersResponse];

    return {
      nativeBalanceUSDC: formatNativeUSDC(address.coin_balance),
      transactionsCount: toNumber(counters.transactions_count),
      transfersCount: toNumber(counters.token_transfers_count),
      gasUsed: String(counters.gas_usage_count ?? "0")
    };
  } catch {
    return null;
  }
}

export async function getArcscanWalletTransactionSample(
  wallet: string,
  limit = 50
): Promise<ArcscanWalletTransactionSample[]> {
  const transactionsUrl = `${arcscanApiBaseUrl}/addresses/${wallet}/transactions`;

  try {
    const response = await fetch(transactionsUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) return [];

    const body = (await response.json()) as ArcscanTransactionsResponse;
    return (body.items ?? [])
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map((item) => ({
        hash: String(item.hash ?? ""),
        timestamp: String(item.timestamp ?? ""),
        from: item.from?.hash ?? null,
        to: item.to?.hash ?? null,
        gasPrice: item.gas_price === undefined || item.gas_price === null ? null : String(item.gas_price),
        maxFeePerGas:
          item.max_fee_per_gas === undefined || item.max_fee_per_gas === null
            ? null
            : String(item.max_fee_per_gas),
        gasUsed: item.gas_used === undefined || item.gas_used === null ? null : String(item.gas_used),
        status: item.status ?? item.result ?? null,
        blockNumber: item.block_number === undefined || item.block_number === null
          ? null
          : toNumber(item.block_number)
      }))
      .filter((item) => item.hash && item.timestamp);
  } catch {
    return [];
  }
}

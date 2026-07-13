import { lookup } from "node:dns/promises";
import { isPostgresEnabled, pgQuery } from "@/lib/server/postgres";
import type {
  ConfidenceLevel,
  CrossChainContext,
  CrossChainNetworkContext,
  CrossChainNetworkId
} from "@/lib/server/risk-intelligence/types";

const crossChainCacheTtlMs = 24 * 60 * 60 * 1000;
const crossChainFailureTtlMs = 2 * 60 * 1000;
const maxExplorerRecords = 1_000;
const crossChainContextSchemaVersion = "kx.cross-chain-context.v3";
const supportedNetworkIds: CrossChainNetworkId[] = ["ethereum", "base", "bnb"];
const providerTimeoutMs = 12_000;

type ChainConfig = {
  id: CrossChainNetworkId;
  label: string;
  chainId: string;
  blockscoutApiUrl?: string;
  explorerApiUrl?: string;
  explorerApiKey?: string;
  explorerFlavor: "etherscan-v2" | "etherscan-legacy";
};

type CrossChainContextRow = {
  data: CrossChainContext;
  refreshed_at: Date;
  expires_at: Date;
};

type IndexedTransaction = {
  timestamp: number | null;
  from: string | null;
  to: string | null;
  input: string | null;
};

type ProviderResult = {
  source: string;
  txCount: number | null;
  outboundTransactionCount: number | null;
  activeDays: number | null;
  contractInteractions: number | null;
  firstActivity: string | null;
  lastActivity: string | null;
  timestampSample: string[];
  coverage: "full" | "limited" | "unavailable";
  message?: string;
  providerErrors?: string[];
};

export type CrossChainProviderHealth = {
  network: CrossChainNetworkId;
  label: string;
  configured: boolean;
  primaryProvider: string | null;
  missingEnvVars: string[];
  providers: Array<{
    name: string;
    configured: boolean;
    priority: "primary" | "fallback";
    url: string | null;
    missingEnvVars: string[];
  }>;
};

export type RuntimeNetworkDiagnostics = {
  proxy: Record<string, string>;
  providers: Array<{
    network: CrossChainNetworkId;
    label: string;
    provider: string;
    priority: "primary" | "fallback";
    configured: boolean;
    safeUrl: string | null;
    hostname: string | null;
    resolvedIps: string[];
    httpStatus: number | null;
    responseSummary: string | null;
    error: string | null;
  }>;
};

export type CrossChainApiKeyStatus = {
  ETHERSCAN_API_KEY: boolean;
  BASESCAN_API_KEY: boolean;
  BSCSCAN_API_KEY: boolean;
  BSCSAN_API_KEY_ALIAS: boolean;
};

interface CrossChainContextProvider {
  readonly source: string;
  fetchWalletContext(config: ChainConfig, wallet: string): Promise<ProviderResult | null>;
}

const refreshLocks = new Map<string, Promise<CrossChainContext>>();

function getChainConfigs(): ChainConfig[] {
  const etherscanApiKey = getConfiguredEnvValue("ETHERSCAN_API_KEY");
  const basescanApiKey = getConfiguredEnvValue("BASESCAN_API_KEY");
  const bscScanApiKey = getBscScanApiKey();
  const bnbUsesBscScan = Boolean(bscScanApiKey && !etherscanApiKey);
  return [
    {
      id: "ethereum",
      label: "Ethereum",
      chainId: "1",
      blockscoutApiUrl: getConfiguredEnvValue("ETHEREUM_BLOCKSCOUT_API_URL") ?? "https://eth.blockscout.com/api/v2",
      explorerApiUrl: getConfiguredEnvValue("ETHERSCAN_API_URL") ?? "https://api.etherscan.io/v2/api",
      explorerApiKey: etherscanApiKey,
      explorerFlavor: "etherscan-v2"
    },
    {
      id: "base",
      label: "Base",
      chainId: "8453",
      blockscoutApiUrl: getConfiguredEnvValue("BASE_BLOCKSCOUT_API_URL") ?? "https://base.blockscout.com/api/v2",
      explorerApiUrl: getConfiguredEnvValue("BASESCAN_API_URL") ?? "https://api.etherscan.io/v2/api",
      explorerApiKey: basescanApiKey ?? etherscanApiKey,
      explorerFlavor: "etherscan-v2"
    },
    {
      id: "bnb",
      label: "BNB Chain",
      chainId: "56",
      blockscoutApiUrl: getConfiguredEnvValue("BNB_BLOCKSCOUT_API_URL"),
      explorerApiUrl: bnbUsesBscScan
        ? (getConfiguredEnvValue("BSCSCAN_API_URL") ?? "https://api.bscscan.com/api")
        : (getConfiguredEnvValue("BNB_ETHERSCAN_API_URL") ?? "https://api.etherscan.io/v2/api"),
      explorerApiKey: bnbUsesBscScan ? bscScanApiKey : etherscanApiKey,
      explorerFlavor: bnbUsesBscScan ? "etherscan-legacy" : "etherscan-v2"
    }
  ];
}

function getConfiguredProviders(config: ChainConfig): CrossChainProviderHealth["providers"] {
  return [
    {
      name: config.explorerFlavor === "etherscan-legacy" ? "BscScan API" : "Etherscan API v2",
      configured: Boolean(config.explorerApiUrl && config.explorerApiKey),
      priority: "primary",
      url: config.explorerApiUrl ? sanitizeUrl(new URL(config.explorerApiUrl)) : null,
      missingEnvVars:
        config.explorerApiUrl && config.explorerApiKey
          ? []
          : [
              ...(config.explorerApiUrl ? [] : [getExplorerUrlEnvName(config.id)]),
              ...(config.explorerApiKey ? [] : [getExplorerKeyEnvName(config.id)])
            ]
    },
    {
      name: "Blockscout",
      configured: Boolean(config.blockscoutApiUrl),
      priority: "fallback",
      url: config.blockscoutApiUrl ?? null,
      missingEnvVars: config.blockscoutApiUrl ? [] : [getBlockscoutEnvName(config.id)]
    }
  ];
}

export function getCrossChainProviderHealth(): CrossChainProviderHealth[] {
  return getChainConfigs().map((config) => {
    const providers = getConfiguredProviders(config);
    const primaryProvider = providers.find((provider) => provider.priority === "primary" && provider.configured);
    const missingEnvVars = Array.from(new Set(providers.flatMap((provider) => provider.missingEnvVars)));
    return {
      network: config.id,
      label: config.label,
      configured: providers.some((provider) => provider.configured),
      primaryProvider: primaryProvider?.name ?? null,
      missingEnvVars,
      providers
    };
  });
}

export function getCrossChainApiKeyStatus(): CrossChainApiKeyStatus {
  return {
    ETHERSCAN_API_KEY: Boolean(getConfiguredEnvValue("ETHERSCAN_API_KEY")),
    BASESCAN_API_KEY: Boolean(getConfiguredEnvValue("BASESCAN_API_KEY")),
    BSCSCAN_API_KEY: Boolean(getConfiguredEnvValue("BSCSCAN_API_KEY")),
    BSCSAN_API_KEY_ALIAS: Boolean(getConfiguredEnvValue("BSCSAN_API_KEY"))
  };
}

function getConfiguredEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (value.startsWith("YOUR_")) return undefined;
  if (value.endsWith("_HERE")) return undefined;
  return value;
}

function getBscScanApiKey(): string | undefined {
  return getConfiguredEnvValue("BSCSCAN_API_KEY") ?? getConfiguredEnvValue("BSCSAN_API_KEY");
}

export async function getRuntimeNetworkDiagnostics(): Promise<RuntimeNetworkDiagnostics> {
  const checks = await Promise.allSettled(
    getChainConfigs().flatMap((config) =>
      getConfiguredProviders(config).map(async (provider) => {
        const endpointUrl = getProviderDiagnosticUrl(config, provider);
        const connectivity = endpointUrl ? await checkEndpointConnectivity(endpointUrl) : null;
        return {
          network: config.id,
          label: config.label,
          provider: provider.name,
          priority: provider.priority,
          configured: provider.configured,
          safeUrl: endpointUrl ? sanitizeUrl(endpointUrl) : provider.url,
          hostname: endpointUrl?.hostname ?? null,
          resolvedIps: connectivity?.resolvedIps ?? [],
          httpStatus: connectivity?.httpStatus ?? null,
          responseSummary: connectivity?.responseSummary ?? null,
          error: connectivity?.error ?? (provider.url ? null : "No provider URL configured.")
        };
      })
    )
  );

  return {
    proxy: getSafeProxyDiagnostics(),
    providers: checks.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : {
            network: "ethereum" as const,
            label: "Unknown",
            provider: "Unknown",
            priority: "fallback" as const,
            configured: false,
            safeUrl: null,
            hostname: null,
            resolvedIps: [],
            httpStatus: null,
            responseSummary: null,
            error: getErrorMessage(result.reason)
          }
    )
  };
}

function getProviderDiagnosticUrl(
  config: ChainConfig,
  provider: CrossChainProviderHealth["providers"][number]
): URL | null {
  if (!provider.url) return null;
  if (provider.name === "Blockscout") return new URL(provider.url);

  const url = new URL(config.explorerApiUrl ?? provider.url);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", "0x0000000000000000000000000000000000000000");
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "1");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "1");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("apikey", config.explorerApiKey ?? "MISSING_API_KEY");
  if (config.explorerFlavor === "etherscan-v2") {
    url.searchParams.set("chainid", config.chainId);
  }
  return url;
}

function getSafeProxyDiagnostics(): Record<string, string> {
  return Object.fromEntries(
    ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"].map((name) => [
      name,
      sanitizeEnvValue(process.env[name])
    ])
  );
}

function sanitizeEnvValue(value: string | undefined): string {
  if (!value) return "missing";
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "[redacted]";
      url.password = "";
    }
    return url.toString();
  } catch {
    return `configured length=${value.length}`;
  }
}

async function checkEndpointConnectivity(url: URL): Promise<{
  resolvedIps: string[];
  httpStatus: number | null;
  responseSummary: string | null;
  error: string | null;
}> {
  let resolvedIps: string[] = [];
  try {
    const addresses = await lookup(url.hostname, { all: true });
    resolvedIps = addresses.map((address) => address.address);
  } catch (error) {
    return {
      resolvedIps,
      httpStatus: null,
      responseSummary: null,
      error: `DNS lookup failed: ${getErrorMessage(error)}`
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json,text/plain,*/*" },
      next: { revalidate: 0 },
      signal: controller.signal
    });
    const text = await response.text();
    return {
      resolvedIps,
      httpStatus: response.status,
      responseSummary: summarizeBody(text),
      error: response.ok ? null : `${response.status} ${response.statusText}`.trim()
    };
  } catch (error) {
    return {
      resolvedIps,
      httpStatus: null,
      responseSummary: null,
      error: getErrorMessage(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getBlockscoutEnvName(network: CrossChainNetworkId): string {
  if (network === "ethereum") return "ETHEREUM_BLOCKSCOUT_API_URL";
  if (network === "base") return "BASE_BLOCKSCOUT_API_URL";
  return "BNB_BLOCKSCOUT_API_URL";
}

function getExplorerUrlEnvName(network: CrossChainNetworkId): string {
  if (network === "ethereum") return "ETHERSCAN_API_URL";
  if (network === "base") return "BASESCAN_API_URL";
  return "BNB_ETHERSCAN_API_URL or BSCSCAN_API_URL";
}

function getExplorerKeyEnvName(network: CrossChainNetworkId): string {
  if (network === "ethereum") return "ETHERSCAN_API_KEY";
  if (network === "base") return "BASESCAN_API_KEY or ETHERSCAN_API_KEY";
  return "ETHERSCAN_API_KEY or BSCSCAN_API_KEY";
}

function getLimitations(): string[] {
  return [
    "Cross-chain context is optional supporting evidence only.",
    "KX reads indexed explorer data and does not collect token balances, NFT history, logs, events, internal transactions or full transfer history.",
    "If an explorer only returns a limited page, KX reports limited coverage instead of presenting partial totals as full history.",
    "Cross-chain context does not modify Risk Score or Trust Score."
  ];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      "cause" in error && error.cause
        ? ` cause=${error.cause instanceof Error ? error.cause.message : String(error.cause)}`
        : "";
    return `${error.message}${cause}`;
  }
  if (typeof error === "string") return error;
  return "Unknown provider error";
}

function asUrl(baseUrl: string, path: string): URL {
  return new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
}

async function fetchJson(url: URL): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 0 },
      signal: controller.signal
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      return {
        __providerError: `${response.status} ${response.statusText}`.trim(),
        __providerUrl: sanitizeUrl(url),
        __providerBody: summarizeBody(text)
      };
    }
    return body;
  } catch (error) {
    return {
      __providerError: getErrorMessage(error),
      __providerUrl: sanitizeUrl(url),
      __providerBody: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readProviderError(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "__providerError" in body) {
    const url = "__providerUrl" in body ? String(body.__providerUrl) : "unknown-url";
    const summary = "__providerBody" in body && body.__providerBody ? ` body=${String(body.__providerBody)}` : "";
    return `${url}: ${String(body.__providerError)}${summary}`;
  }
  return null;
}

function sanitizeUrl(url: URL): string {
  const safe = new URL(url.toString());
  if (safe.searchParams.has("apikey")) safe.searchParams.set("apikey", "[redacted]");
  if (safe.searchParams.has("apiKey")) safe.searchParams.set("apiKey", "[redacted]");
  if (safe.searchParams.has("key")) safe.searchParams.set("key", "[redacted]");
  return safe.toString();
}

function summarizeBody(text: string): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").slice(0, 240);
}

function getActiveDays(transactions: IndexedTransaction[]): number | null {
  if (transactions.length === 0) return null;
  const days = new Set(
    transactions
      .map((tx) => (tx.timestamp ? new Date(tx.timestamp * 1000).toISOString().slice(0, 10) : null))
      .filter((value): value is string => Boolean(value))
  );
  return days.size || null;
}

function getContractInteractions(transactions: IndexedTransaction[], wallet: string): number | null {
  if (transactions.length === 0) return null;
  const walletLower = wallet.toLowerCase();
  return transactions.filter(
    (tx) => tx.from?.toLowerCase() === walletLower && Boolean(tx.to) && Boolean(tx.input) && tx.input !== "0x"
  ).length;
}

function getOutboundTransactionCount(transactions: IndexedTransaction[], wallet: string): number | null {
  if (transactions.length === 0) return null;
  const walletLower = wallet.toLowerCase();
  return transactions.filter((tx) => tx.from?.toLowerCase() === walletLower).length;
}

function getActivityBounds(transactions: IndexedTransaction[]): { first: string | null; last: string | null } {
  const timestamps = transactions
    .map((tx) => tx.timestamp)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  return {
    first: timestamps[0] ? new Date(timestamps[0] * 1000).toISOString() : null,
    last: timestamps.at(-1) ? new Date(timestamps.at(-1)! * 1000).toISOString() : null
  };
}

function getTimestampSample(transactions: IndexedTransaction[], limit = 50): string[] {
  return transactions
    .map((tx) => tx.timestamp)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b)
    .slice(-limit)
    .map((timestamp) => new Date(timestamp * 1000).toISOString());
}

function getWalletAgeDays(firstActivity: string | null): number | null {
  if (!firstActivity) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(firstActivity).getTime()) / 86_400_000));
}

class BlockscoutContextProvider implements CrossChainContextProvider {
  readonly source = "Blockscout";

  async fetchWalletContext(config: ChainConfig, wallet: string): Promise<ProviderResult | null> {
    if (!config.blockscoutApiUrl) return null;

    const countersUrl = asUrl(config.blockscoutApiUrl, `/addresses/${wallet}/counters`);
    const txUrl = asUrl(config.blockscoutApiUrl, `/addresses/${wallet}/transactions`);
    const [countersBody, txBody] = await Promise.all([fetchJson(countersUrl), fetchJson(txUrl)]);
    const providerErrors = [readProviderError(countersBody), readProviderError(txBody)].filter(
      (value): value is string => Boolean(value)
    );
    if (providerErrors.length === 2) {
      return {
        source: this.source,
        txCount: null,
        outboundTransactionCount: null,
        activeDays: null,
        contractInteractions: null,
        firstActivity: null,
        lastActivity: null,
        timestampSample: [],
        coverage: "unavailable",
        message: "Blockscout could not return indexed wallet context.",
        providerErrors
      };
    }
    if (!countersBody && !txBody) return null;

    const counters = countersBody as {
      transactions_count?: string | number;
      transactions_count_all?: string | number;
    } | null;
    const txPayload = txBody as { items?: Array<Record<string, unknown>>; next_page_params?: unknown } | null;
    const transactions = (txPayload?.items ?? []).map((item): IndexedTransaction => ({
      timestamp: typeof item.timestamp === "string" ? Math.floor(new Date(item.timestamp).getTime() / 1000) : null,
      from: typeof item.from === "object" && item.from !== null && "hash" in item.from ? String(item.from.hash) : null,
      to: typeof item.to === "object" && item.to !== null && "hash" in item.to ? String(item.to.hash) : null,
      input: typeof item.raw_input === "string" ? item.raw_input : typeof item.input === "string" ? item.input : null
    }));
    const bounds = getActivityBounds(transactions);
    const txCountValue = counters?.transactions_count ?? counters?.transactions_count_all;
    const txCount = txCountValue === undefined ? null : Number(txCountValue);
    const coverage = txPayload?.next_page_params ? "limited" : "full";

    return {
      source: this.source,
      txCount: Number.isFinite(txCount) ? txCount : null,
      outboundTransactionCount: coverage === "full" ? getOutboundTransactionCount(transactions, wallet) : null,
      activeDays: coverage === "full" ? getActiveDays(transactions) : null,
      contractInteractions: coverage === "full" ? getContractInteractions(transactions, wallet) : null,
      firstActivity: coverage === "full" ? bounds.first : null,
      lastActivity: bounds.last,
      timestampSample: getTimestampSample(transactions),
      coverage,
      message:
        coverage === "limited"
          ? "Blockscout returned paginated history. KX reports full counters when available and leaves sampled-only fields null."
          : "Blockscout indexed wallet history.",
      providerErrors
    };
  }
}

class EtherscanStyleContextProvider implements CrossChainContextProvider {
  readonly source = "Etherscan-compatible API";

  async fetchWalletContext(config: ChainConfig, wallet: string): Promise<ProviderResult | null> {
    if (!config.explorerApiUrl || !config.explorerApiKey) return null;

    const url = new URL(config.explorerApiUrl);
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "txlist");
    url.searchParams.set("address", wallet);
    url.searchParams.set("startblock", "0");
    url.searchParams.set("endblock", "999999999");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", String(maxExplorerRecords));
    url.searchParams.set("sort", "asc");
    url.searchParams.set("apikey", config.explorerApiKey);
    if (config.explorerFlavor === "etherscan-v2") {
      url.searchParams.set("chainid", config.chainId);
    }

    const body = (await fetchJson(url)) as { status?: string; result?: unknown; message?: string } | null;
    const providerError = readProviderError(body);
    if (providerError) {
      return {
        source: config.explorerFlavor === "etherscan-legacy" ? "BscScan API" : "Etherscan API v2",
        txCount: null,
        outboundTransactionCount: null,
        activeDays: null,
        contractInteractions: null,
        firstActivity: null,
        lastActivity: null,
        timestampSample: [],
        coverage: "unavailable",
        message: "Explorer API could not return indexed wallet context.",
        providerErrors: [providerError]
      };
    }
    if (!body || !Array.isArray(body.result)) {
      const resultMessage = typeof body?.result === "string" ? body.result : null;
      if (body?.message) {
        return {
          source: config.explorerFlavor === "etherscan-legacy" ? "BscScan API" : "Etherscan API v2",
          txCount: null,
          outboundTransactionCount: null,
          activeDays: null,
          contractInteractions: null,
          firstActivity: null,
          lastActivity: null,
          timestampSample: [],
          coverage: "unavailable",
          message: body.message,
          providerErrors: [
            `status=${body.status ?? "unknown"} message=${body.message}${
              resultMessage ? ` result=${resultMessage}` : ""
            }`
          ]
        };
      }
      return null;
    }

    const transactions = body.result.map((item): IndexedTransaction => {
      const tx = item as Record<string, unknown>;
      const timestamp = Number(tx.timeStamp);
      return {
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        from: typeof tx.from === "string" ? tx.from : null,
        to: typeof tx.to === "string" ? tx.to : null,
        input: typeof tx.input === "string" ? tx.input : null
      };
    });
    const coverage = transactions.length >= maxExplorerRecords ? "limited" : "full";
    const bounds = getActivityBounds(transactions);

    return {
      source: config.explorerFlavor === "etherscan-legacy" ? "BscScan API" : "Etherscan API v2",
      txCount: coverage === "full" ? transactions.length : null,
      outboundTransactionCount: coverage === "full" ? getOutboundTransactionCount(transactions, wallet) : null,
      activeDays: coverage === "full" ? getActiveDays(transactions) : null,
      contractInteractions: coverage === "full" ? getContractInteractions(transactions, wallet) : null,
      firstActivity: coverage === "full" ? bounds.first : null,
      lastActivity: bounds.last,
      timestampSample: getTimestampSample(transactions),
      coverage,
      message:
        coverage === "limited"
          ? "Explorer returned the maximum page size. KX marks coverage as limited and avoids partial totals."
          : "Explorer returned normal transaction history.",
      providerErrors: body.status === "0" && body.message ? [body.message] : []
    };
  }
}

const providers: CrossChainContextProvider[] = [
  new EtherscanStyleContextProvider(),
  new BlockscoutContextProvider()
];

function notConfiguredNetwork(config: ChainConfig): CrossChainNetworkContext {
  return {
    schemaVersion: crossChainContextSchemaVersion,
    network: config.id,
    label: config.label,
    status: "not_configured",
    walletAgeDays: null,
    transactionCount: null,
    outboundTransactionCount: null,
    activeDays: null,
    contractInteractionCount: null,
    firstActivity: null,
    lastActivity: null,
    timestampSample: [],
    source: null,
    indexedAt: null,
    coverage: "unavailable",
    providerErrors: [],
    message: `${config.label} has no configured Blockscout or explorer API credentials.`
  };
}

function getConfidenceBoost(summary: CrossChainContext["summary"]): ConfidenceLevel | null {
  if (summary.networksAnalyzed === 0) return null;
  if (
    (summary.transactionCount ?? 0) >= 50 ||
    (summary.activeDays ?? 0) >= 8 ||
    (summary.contractInteractionCount ?? 0) >= 20
  ) {
    return "High";
  }
  if (
    (summary.transactionCount ?? 0) >= 5 ||
    (summary.activeDays ?? 0) >= 2 ||
    (summary.contractInteractionCount ?? 0) >= 3
  ) {
    return "Medium";
  }
  return null;
}

function sumNullable(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => typeof value === "number");
  if (known.length === 0) return null;
  return known.reduce((sum, value) => sum + value, 0);
}

function mergeSummary(networks: CrossChainNetworkContext[]): CrossChainContext["summary"] {
  const available = networks.filter((network) => network.status === "available");
  const firstActivities = available
    .flatMap((network) => [network.firstActivity])
    .filter((value): value is string => Boolean(value))
    .sort();
  const lastActivities = available
    .flatMap((network) => [network.lastActivity])
    .filter((value): value is string => Boolean(value))
    .sort();
  const coverage =
    available.length === 0
      ? "unavailable"
      : available.every((network) => network.coverage === "full")
        ? "full"
        : "limited";

  return {
    networksAnalyzed: available.length,
    transactionCount: sumNullable(available.map((network) => network.transactionCount)),
    outboundTransactionCount: sumNullable(available.map((network) => network.outboundTransactionCount ?? null)),
    activeDays: sumNullable(available.map((network) => network.activeDays)),
    contractInteractionCount: sumNullable(available.map((network) => network.contractInteractionCount)),
    earliestActivity: firstActivities[0] ?? null,
    lastActivity: lastActivities.at(-1) ?? null,
    coverage
  };
}

function getStatus(networks: CrossChainNetworkContext[]): CrossChainContext["status"] {
  if (networks.every((network) => network.status === "not_configured")) return "not_configured";
  if (networks.some((network) => network.status === "available")) {
    return networks.every((network) => network.status === "available") ? "available" : "partial";
  }
  return "unavailable";
}

function buildContext(input: {
  wallet: string;
  networks: CrossChainNetworkContext[];
  cacheSource: CrossChainContext["cacheSource"];
  refreshedAt: string | null;
  expiresAt: string | null;
}): CrossChainContext {
  const summary = mergeSummary(input.networks);
  return {
    schemaVersion: crossChainContextSchemaVersion,
    wallet: input.wallet,
    status: getStatus(input.networks),
    cacheSource: input.cacheSource,
    refreshedAt: input.refreshedAt,
    expiresAt: input.expiresAt,
    networks: input.networks,
    summary,
    confidenceBoost: getConfidenceBoost(summary),
    limitations: getLimitations()
  };
}

async function analyzeNetwork(config: ChainConfig, wallet: string): Promise<CrossChainNetworkContext> {
  const hasAnyProvider = Boolean(config.blockscoutApiUrl || (config.explorerApiUrl && config.explorerApiKey));
  if (!hasAnyProvider) return notConfiguredNetwork(config);

  const providerErrors: string[] = [];
  for (const provider of providers) {
    const result = await provider.fetchWalletContext(config, wallet);
    if (!result) continue;
    if (result.coverage === "unavailable") {
      providerErrors.push(
        ...(result.providerErrors ?? [result.message ?? `${provider.source} unavailable`]).map(
          (error) => `${provider.source}: ${error}`
        )
      );
      continue;
    }
    const indexedAt = new Date().toISOString();
    return {
      schemaVersion: crossChainContextSchemaVersion,
      network: config.id,
      label: config.label,
      status: "available",
      walletAgeDays: getWalletAgeDays(result.firstActivity),
      transactionCount: result.txCount,
      outboundTransactionCount: result.outboundTransactionCount,
      activeDays: result.activeDays,
      contractInteractionCount: result.contractInteractions,
      firstActivity: result.firstActivity,
      lastActivity: result.lastActivity,
      timestampSample: result.timestampSample,
      source: result.source,
      indexedAt,
      coverage: result.coverage,
      providerErrors: [...providerErrors, ...(result.providerErrors ?? [])],
      message: result.message
    };
  }

  return {
    schemaVersion: crossChainContextSchemaVersion,
    network: config.id,
    label: config.label,
    status: "unavailable",
    walletAgeDays: null,
    transactionCount: null,
    outboundTransactionCount: null,
    activeDays: null,
    contractInteractionCount: null,
    firstActivity: null,
    lastActivity: null,
    timestampSample: [],
    source: null,
    indexedAt: new Date().toISOString(),
    coverage: "unavailable",
    providerErrors,
    message:
      providerErrors.length > 0
        ? `${config.label} indexed providers returned errors.`
        : `${config.label} indexed APIs could not return wallet context.`
  };
}

function isSupportedCachedContext(context: CrossChainContext): boolean {
  if (context.schemaVersion !== crossChainContextSchemaVersion) return false;
  if (!Array.isArray(context.networks)) return false;
  return context.networks.every(
    (network) =>
      supportedNetworkIds.includes(network.network) &&
      network.schemaVersion === crossChainContextSchemaVersion &&
      "source" in network &&
      "indexedAt" in network &&
      "coverage" in network
  );
}

export async function getCachedCrossChainContext(wallet: string): Promise<CrossChainContext | null> {
  if (!isPostgresEnabled()) return null;

  const rows = await pgQuery<CrossChainContextRow>(
    `
      SELECT data, refreshed_at, expires_at
      FROM cross_chain_context
      WHERE LOWER(wallet_address) = LOWER($1)
      LIMIT 1
    `,
    [wallet]
  );
  const row = rows[0];
  if (!row) return null;
  if (!isSupportedCachedContext(row.data)) return null;
  const cacheAgeMs = Date.now() - row.refreshed_at.getTime();
  if (row.data.status === "unavailable" && cacheAgeMs > crossChainFailureTtlMs) return null;

  return {
    ...row.data,
    cacheSource: "postgres_cache",
    refreshedAt: row.refreshed_at.toISOString(),
    expiresAt: row.expires_at.toISOString()
  };
}

export async function invalidateCrossChainContext(wallet: string): Promise<void> {
  if (!isPostgresEnabled()) return;

  await pgQuery(
    `
      DELETE FROM cross_chain_context
      WHERE LOWER(wallet_address) = LOWER($1)
    `,
    [wallet]
  );
}

async function storeCrossChainContext(context: CrossChainContext): Promise<void> {
  if (!isPostgresEnabled()) return;

  const expiresAt = context.expiresAt ?? new Date(Date.now() + crossChainFailureTtlMs).toISOString();
  await pgQuery(
    `
      INSERT INTO cross_chain_context (wallet_address, data, refreshed_at, expires_at)
      VALUES ($1, $2::jsonb, NOW(), $3::timestamptz)
      ON CONFLICT (wallet_address) DO UPDATE SET
        data = EXCLUDED.data,
        refreshed_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `,
    [context.wallet, JSON.stringify(context), expiresAt]
  );
}

export async function refreshCrossChainContext(
  wallet: string,
  options: { bypassMemoryCache?: boolean } = {}
): Promise<CrossChainContext> {
  const walletKey = wallet.toLowerCase();
  const existing = refreshLocks.get(walletKey);
  if (existing && !options.bypassMemoryCache) return existing;

  const refresh = (async () => {
    const now = new Date();
    const settledNetworks = await Promise.allSettled(
      getChainConfigs().map((config) => analyzeNetwork(config, wallet))
    );
    const configs = getChainConfigs();
    const networks = settledNetworks.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            schemaVersion: crossChainContextSchemaVersion,
            network: configs[index].id,
            label: configs[index].label,
            status: "unavailable" as const,
            walletAgeDays: null,
            transactionCount: null,
            activeDays: null,
            contractInteractionCount: null,
            firstActivity: null,
            lastActivity: null,
            timestampSample: [],
            source: null,
            indexedAt: new Date().toISOString(),
            coverage: "unavailable" as const,
            providerErrors: [getErrorMessage(result.reason)],
            message: `${configs[index].label} provider failed before returning context.`
          }
    );
    const hasRealData = networks.some((network) => network.status === "available");
    const ttlMs = hasRealData ? crossChainCacheTtlMs : crossChainFailureTtlMs;
    const expiresAt = new Date(now.getTime() + ttlMs);
    const context = buildContext({
      wallet,
      networks,
      cacheSource: "fresh",
      refreshedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    await storeCrossChainContext(context);
    return context;
  })();

  refreshLocks.set(walletKey, refresh);
  try {
    return await refresh;
  } finally {
    refreshLocks.delete(walletKey);
  }
}

export async function refreshCrossChainContextIfStale(wallet: string): Promise<CrossChainContext> {
  const cached = await getCachedCrossChainContext(wallet);
  if (cached?.expiresAt && new Date(cached.expiresAt).getTime() > Date.now()) {
    return cached;
  }
  return refreshCrossChainContext(wallet);
}

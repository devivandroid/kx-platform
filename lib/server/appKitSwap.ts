import { AppKit, type SwapEstimate, type SwapParams, type SwapResult } from "@circle-fin/app-kit";
import { ArcTestnet } from "@circle-fin/app-kit/chains";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { createPublicClient, erc20Abi, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const arcSwapTokens = ["USDC", "EURC"] as const;
export type ArcSwapToken = (typeof arcSwapTokens)[number];

const tokenConfig: Record<ArcSwapToken, { address: `0x${string}`; decimals: number }> = {
  USDC: { address: ArcTestnet.usdcAddress as `0x${string}`, decimals: 6 },
  EURC: { address: ArcTestnet.eurcAddress as `0x${string}`, decimals: 6 }
};

export type AppKitSwapRequest = {
  amountIn?: string;
  tokenIn?: string;
  tokenOut?: string;
  chain?: string;
};

const kit = new AppKit();
const arcPublicClient = createPublicClient({
  chain: {
    id: ArcTestnet.chainId,
    name: ArcTestnet.name,
    nativeCurrency: ArcTestnet.nativeCurrency,
    rpcUrls: {
      default: { http: [...ArcTestnet.rpcEndpoints] },
      public: { http: [...ArcTestnet.rpcEndpoints] }
    }
  },
  transport: http(ArcTestnet.rpcEndpoints[0])
});

function isConfiguredSecret(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return !/^YOUR[_-]/i.test(normalized) && !normalized.includes("[YOUR-");
}

function isConfiguredKitKey(value: string | undefined): value is string {
  return isConfiguredSecret(value) && /^KIT_KEY:[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$/.test(value.trim());
}

function normalizePrivateKey(value: string): `0x${string}` {
  const normalized = value.trim();
  const withPrefix = normalized.startsWith("0x") ? normalized : `0x${normalized}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw new Error("APP_KIT_SERVER_PRIVATE_KEY must be a 32-byte hex private key.");
  }
  return withPrefix as `0x${string}`;
}

function isPositiveAmount(value: string | undefined): value is string {
  if (!value) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeToken(value: string | undefined): ArcSwapToken | null {
  const normalized = value?.toUpperCase();
  if (normalized === "USDC" || normalized === "EURC") return normalized;
  return null;
}

export function getAppKitSwapConfigStatus() {
  const kitKeyConfigured = isConfiguredKitKey(process.env.KIT_KEY);
  const privateKeyConfigured = isConfiguredSecret(process.env.APP_KIT_SERVER_PRIVATE_KEY);
  let serverWalletAddress: string | null = null;

  if (privateKeyConfigured) {
    try {
      serverWalletAddress = privateKeyToAccount(
        normalizePrivateKey(process.env.APP_KIT_SERVER_PRIVATE_KEY!)
      ).address;
    } catch {
      serverWalletAddress = null;
    }
  }

  return {
    ok: kitKeyConfigured && privateKeyConfigured && Boolean(serverWalletAddress),
    testnetOnly: true,
    chain: "Arc_Testnet",
    supportedPairs: [
      { tokenIn: "USDC", tokenOut: "EURC" },
      { tokenIn: "EURC", tokenOut: "USDC" }
    ],
    configured: {
      KIT_KEY: kitKeyConfigured,
      APP_KIT_SERVER_PRIVATE_KEY: privateKeyConfigured
    },
    serverWalletAddress
  };
}

export function validateSwapRequest(body: AppKitSwapRequest) {
  if (!isPositiveAmount(body.amountIn)) {
    return { ok: false as const, status: 400, error: "INVALID_AMOUNT", message: "Provide a positive swap amount." };
  }
  if (body.chain !== "Arc_Testnet") {
    return { ok: false as const, status: 400, error: "UNSUPPORTED_CHAIN", message: "This demo only supports Arc Testnet swap context." };
  }
  const tokenIn = normalizeToken(body.tokenIn ?? "USDC");
  if (!tokenIn) {
    return { ok: false as const, status: 400, error: "UNSUPPORTED_TOKEN_IN", message: "Arc Testnet Protected Swap supports USDC and EURC as input tokens." };
  }
  const tokenOut = normalizeToken(body.tokenOut);
  if (!tokenOut) {
    return { ok: false as const, status: 400, error: "UNSUPPORTED_TOKEN_OUT", message: "Arc Testnet Protected Swap supports USDC and EURC as output tokens." };
  }
  if (tokenIn === tokenOut) {
    return { ok: false as const, status: 400, error: "UNSUPPORTED_PAIR", message: "Choose either USDC -> EURC or EURC -> USDC." };
  }
  if (body.amountIn === undefined) {
    return { ok: false as const, status: 400, error: "INVALID_AMOUNT", message: "Provide a positive swap amount." };
  }
  return { ok: true as const, amountIn: body.amountIn, tokenIn, tokenOut };
}

function getServerAdapter() {
  const status = getAppKitSwapConfigStatus();
  if (!status.configured.KIT_KEY) {
    throw new Error("KIT_KEY is not configured or does not match KIT_KEY:<keyId>:<keySecret>.");
  }
  if (!status.configured.APP_KIT_SERVER_PRIVATE_KEY) {
    throw new Error("APP_KIT_SERVER_PRIVATE_KEY is not configured.");
  }
  const privateKey = normalizePrivateKey(process.env.APP_KIT_SERVER_PRIVATE_KEY!);
  const adapter = createViemAdapterFromPrivateKey({
    privateKey,
    capabilities: {
      addressContext: "user-controlled",
      supportedChains: [ArcTestnet]
    }
  });
  const account = privateKeyToAccount(privateKey);
  return { adapter, account };
}

async function getErc20Balance(tokenAddress: `0x${string}`, wallet: `0x${string}`) {
  return arcPublicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet]
  });
}

async function getServerWalletBalanceState() {
  const { account } = getServerAdapter();
  const [nativeBalance, usdcBalance, eurcBalance] = await Promise.all([
    arcPublicClient.getBalance({ address: account.address }),
    getErc20Balance(tokenConfig.USDC.address, account.address),
    getErc20Balance(tokenConfig.EURC.address, account.address)
  ]);

  return {
    wallet: account.address,
    nativeBalance: formatUnits(nativeBalance, ArcTestnet.nativeCurrency.decimals),
    USDC: formatUnits(usdcBalance, tokenConfig.USDC.decimals),
    EURC: formatUnits(eurcBalance, tokenConfig.EURC.decimals),
    raw: { nativeBalance, USDC: usdcBalance, EURC: eurcBalance }
  };
}

export async function getServerWalletBalances() {
  const balances = await getServerWalletBalanceState();
  return {
    wallet: balances.wallet,
    nativeBalance: balances.nativeBalance,
    USDC: balances.USDC,
    EURC: balances.EURC
  };
}

export async function validateServerWalletBalance(amountIn: string, tokenIn: ArcSwapToken) {
  const balances = await getServerWalletBalanceState();
  const amount = parseUnits(amountIn, tokenConfig[tokenIn].decimals);

  if (balances.raw.nativeBalance <= 0n) {
    throw new Error("Server wallet has no native Arc Testnet USDC for gas.");
  }
  if (balances.raw[tokenIn] < amount) {
    throw new Error(
      `Insufficient server wallet ${tokenIn} balance. Required ${amountIn} ${tokenIn}, available ${balances[tokenIn]} ${tokenIn}.`
    );
  }

  return {
    wallet: balances.wallet,
    nativeBalance: balances.nativeBalance,
    USDC: balances.USDC,
    EURC: balances.EURC
  };
}

export function buildSwapParams(input: {
  amountIn: string;
  tokenIn: ArcSwapToken;
  tokenOut: ArcSwapToken;
}): SwapParams {
  const { adapter } = getServerAdapter();
  return {
    from: { adapter, chain: ArcTestnet },
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: input.amountIn,
    config: {
      slippageBps: 300,
      allowanceStrategy: "permit",
      kitKey: process.env.KIT_KEY
    }
  };
}

export function formatSwapEstimate(estimate: SwapEstimate) {
  return {
    tokenIn: estimate.tokenIn,
    tokenOut: estimate.tokenOut,
    amountIn: estimate.amountIn,
    chainIn: estimate.chainIn,
    chainOut: estimate.chainOut,
    fromAddress: estimate.fromAddress,
    toAddress: estimate.toAddress,
    estimatedOutput: estimate.estimatedOutput,
    minimumOutput: estimate.stopLimit,
    fees: estimate.fees ?? [],
    slippageBps: 300
  };
}

export function formatSwapResult(result: SwapResult) {
  return {
    tokenIn: result.tokenIn,
    tokenOut: result.tokenOut,
    amountIn: result.amountIn,
    amountOut: result.amountOut ?? null,
    chainIn: result.chainIn,
    chainOut: result.chainOut,
    fromAddress: result.fromAddress,
    toAddress: result.toAddress,
    status: result.progress.status,
    progress: result.progress,
    txHash: result.txHash,
    explorerUrl: result.explorerUrl ?? ArcTestnet.explorerUrl.replace("{hash}", result.txHash),
    fees: result.fees ?? []
  };
}

export async function estimateProtectedSwap(input: { amountIn: string; tokenIn: ArcSwapToken; tokenOut: ArcSwapToken }) {
  const balance = await validateServerWalletBalance(input.amountIn, input.tokenIn);
  const params = buildSwapParams(input);
  const estimate = await kit.estimateSwap(params);
  return { balance, estimate: formatSwapEstimate(estimate) };
}

export async function executeProtectedSwap(input: { amountIn: string; tokenIn: ArcSwapToken; tokenOut: ArcSwapToken }) {
  const balance = await validateServerWalletBalance(input.amountIn, input.tokenIn);
  const params = buildSwapParams(input);
  const result = await kit.swap(params);
  return { balance, result: formatSwapResult(result) };
}

export function getReadableAppKitError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Circle App Kit swap operation failed.";
}

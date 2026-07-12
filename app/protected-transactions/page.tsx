"use client";

import { AppKit, isRetryableError } from "@circle-fin/app-kit";
import { ArcTestnet, BaseSepolia, EthereumSepolia } from "@circle-fin/app-kit/chains";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { useMemo, useState } from "react";
import { isAddress } from "ethers";
import type { EIP1193Provider } from "viem";
import { CodeSnippet } from "@/components/CodeSnippet";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { KXClient, type TrustWalletResponse } from "@/lib/sdk/kx";
import { getExplorerTxUrl, shortenAddress } from "@/lib/web3";
import { useWallet } from "@/hooks/useWallet";

const kit = new AppKit();

const testnetChains = [
  { id: "Arc_Testnet", label: "Arc Testnet", chain: ArcTestnet },
  { id: "Base_Sepolia", label: "Base Sepolia", chain: BaseSepolia },
  { id: "Ethereum_Sepolia", label: "Ethereum Sepolia", chain: EthereumSepolia }
] as const;

type ChainId = (typeof testnetChains)[number]["id"];
type FlowPhase = "idle" | "trust" | "executing" | "success" | "error";

type TrustExecutionState = {
  phase: FlowPhase;
  trust?: TrustWalletResponse;
  message?: string;
  result?: unknown;
  txHash?: string | null;
};

const appKitSnippet = `const trust = await client.trust(recipient);

if (trust.allow) {
  await kit.send({
    from: { adapter, chain: ArcTestnet },
    to: recipient,
    amount: "25.00",
    token: "USDC"
  });
}`;

function decisionClass(decision?: string) {
  if (decision === "ALLOW") return "border-arc-mint/40 bg-arc-mint/10 text-arc-mint";
  if (decision === "BLOCK") return "border-red-300/40 bg-red-300/10 text-red-100";
  return "border-amber-300/40 bg-amber-300/10 text-amber-100";
}

function getChain(chainId: ChainId) {
  return testnetChains.find((chain) => chain.id === chainId)?.chain ?? ArcTestnet;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The App Kit operation could not be completed.";
}

function extractTxHash(result: unknown): string | null {
  const value = result as { txHash?: string; hash?: string; transactionHash?: string };
  return value?.txHash ?? value?.hash ?? value?.transactionHash ?? null;
}

function getBridgeStepLinks(result: unknown) {
  if (!result) return [];

  const bridgeResult = result as { steps?: Array<{ txHash?: string; hash?: string; name?: string; state?: string }> };
  return (bridgeResult.steps ?? [])
    .map((step, index) => ({
      label: step.name ?? `Step ${index + 1}`,
      state: step.state ?? "submitted",
      txHash: step.txHash ?? step.hash ?? null
    }))
    .filter((step) => step.txHash);
}

async function createBrowserAdapter() {
  if (!window.ethereum) {
    throw new Error("Connect a browser wallet before using Arc App Kit.");
  }

  return createViemAdapterFromProvider({
    provider: window.ethereum as EIP1193Provider,
    capabilities: {
      addressContext: "user-controlled",
      supportedChains: [ArcTestnet, BaseSepolia, EthereumSepolia]
    }
  });
}

export default function ProtectedTransactionsPage() {
  const wallet = useWallet();
  const kxClient = useMemo(() => new KXClient({ baseUrl: "" }), []);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("1.00");
  const [bridgeRecipient, setBridgeRecipient] = useState("");
  const [bridgeAmount, setBridgeAmount] = useState("1.00");
  const [bridgeFrom, setBridgeFrom] = useState<ChainId>("Arc_Testnet");
  const [bridgeTo, setBridgeTo] = useState<ChainId>("Base_Sepolia");
  const [swapTarget, setSwapTarget] = useState("Arc_Testnet protocol context");
  const [swapAmount, setSwapAmount] = useState("1.00");
  const [swapTokenOut, setSwapTokenOut] = useState("USDT");
  const [sendState, setSendState] = useState<TrustExecutionState>({ phase: "idle" });
  const [bridgeState, setBridgeState] = useState<TrustExecutionState>({ phase: "idle" });
  const [swapState, setSwapState] = useState<TrustExecutionState>({ phase: "idle" });

  const ensureWalletReady = async () => {
    if (!wallet.address) await wallet.connect();
    if (!wallet.isArcTestnet) await wallet.switchToArcTestnet();
  };

  const runTrustGate = async (
    target: string,
    setState: (state: TrustExecutionState) => void
  ) => {
    if (!isAddress(target)) {
      setState({ phase: "error", message: "Enter a valid wallet or contract address." });
      return null;
    }

    setState({ phase: "trust", message: "Checking KX Trust before opening App Kit..." });
    const trust = await kxClient.trust(target, { useIndexedData: true });
    setState({ phase: "success", trust, message: "KX Trust check completed." });
    return trust;
  };

  const handleSend = async (force = false) => {
    try {
      const trust = force ? sendState.trust : await runTrustGate(sendRecipient, setSendState);
      if (!trust) return;
      if (!force && trust.decision !== "ALLOW") return;

      setSendState({ phase: "executing", trust, message: "Opening Circle App Kit Send..." });
      await ensureWalletReady();
      const adapter = await createBrowserAdapter();
      const result = await kit.send({
        from: { adapter, chain: ArcTestnet },
        to: sendRecipient,
        amount: sendAmount,
        token: "USDC"
      });
      const txHash = extractTxHash(result);
      setSendState({ phase: "success", trust, result, txHash, message: "Send submitted." });
    } catch (error) {
      setSendState({
        phase: "error",
        trust: sendState.trust,
        message: normalizeError(error)
      });
    }
  };

  const handleBridge = async (force = false) => {
    try {
      const trust = force ? bridgeState.trust : await runTrustGate(bridgeRecipient, setBridgeState);
      if (!trust) return;
      if (!force && trust.decision !== "ALLOW") return;

      setBridgeState({ phase: "executing", trust, message: "Opening Circle App Kit Bridge..." });
      await ensureWalletReady();
      const adapter = await createBrowserAdapter();
      const result = await kit.bridge({
        from: { adapter, chain: getChain(bridgeFrom) },
        to: { adapter, chain: getChain(bridgeTo), recipientAddress: bridgeRecipient },
        amount: bridgeAmount,
        token: "USDC"
      });
      const txHash = extractTxHash(result);
      setBridgeState({ phase: "success", trust, result, txHash, message: "Bridge flow submitted." });
    } catch (error) {
      setBridgeState({
        phase: "error",
        trust: bridgeState.trust,
        result: bridgeState.result,
        message: normalizeError(error)
      });
    }
  };

  const handleRetryBridge = async () => {
    try {
      if (!bridgeState.result || !isRetryableError(bridgeState.result)) {
        setBridgeState({ ...bridgeState, phase: "error", message: "This bridge result is not retryable." });
        return;
      }
      setBridgeState({ ...bridgeState, phase: "executing", message: "Retrying bridge with App Kit..." });
      const adapter = await createBrowserAdapter();
      const result = await kit.retryBridge(bridgeState.result as never, { from: adapter, to: adapter });
      setBridgeState({
        phase: "success",
        trust: bridgeState.trust,
        result,
        txHash: extractTxHash(result),
        message: "Bridge retry submitted."
      });
    } catch (error) {
      setBridgeState({ ...bridgeState, phase: "error", message: normalizeError(error) });
    }
  };

  const handleSwapEstimate = async () => {
    setSwapState({ phase: "trust", message: "Checking KX Trust for protocol context..." });
    try {
      const trustTarget = isAddress(swapTarget) ? swapTarget : wallet.address;
      if (!trustTarget) {
        setSwapState({ phase: "error", message: "Connect a wallet or provide a protocol address." });
        return;
      }
      const trust = await kxClient.trust(trustTarget, { useIndexedData: true });
      setSwapState({ phase: "executing", trust, message: "Requesting server-side swap estimate..." });
      const response = await fetch("/api/app-kit/swap/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountIn: swapAmount,
          tokenIn: "USDC",
          tokenOut: swapTokenOut,
          chain: "Arc_Testnet"
        })
      });
      const body = await response.json();
      setSwapState({
        phase: response.ok ? "success" : "error",
        trust,
        result: body,
        message: response.ok ? "Swap estimate received." : body.message ?? "Swap is unavailable."
      });
    } catch (error) {
      setSwapState({ phase: "error", message: normalizeError(error) });
    }
  };

  const renderTrustResult = (state: TrustExecutionState, onContinue: () => void) => {
    if (state.phase === "idle") return null;
    if (state.phase === "trust" || state.phase === "executing") {
      return (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-arc-border bg-black/20 p-3 text-sm text-slate-300">
          <LoadingSpinner />
          {state.message}
        </div>
      );
    }
    if (state.phase === "error") {
      return (
        <div className="mt-4 rounded-lg border border-red-300/40 bg-red-300/10 p-3 text-sm leading-6 text-red-100">
          {state.message}
        </div>
      );
    }
    if (!state.trust) return null;

    return (
      <div className="mt-4 rounded-lg border border-arc-border bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">KX Trust decision</p>
            <p className="mt-1 text-sm text-slate-300">{shortenAddress(state.trust.wallet)}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${decisionClass(state.trust.decision)}`}>
            {state.trust.decision}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Trust Score</dt>
            <dd className="mt-1 text-white">{state.trust.trustScore ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Risk Score</dt>
            <dd className="mt-1 text-white">{state.trust.riskScore ?? "Not available"}</dd>
          </div>
        </dl>
        {state.txHash ? (
          <a
            href={getExplorerTxUrl(state.txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm font-semibold text-arc-blue hover:text-white"
          >
            View transaction on Arcscan
          </a>
        ) : null}
        {state.trust.decision === "ALLOW" ? (
          <button type="button" onClick={onContinue} className="mt-4 inline-flex w-full justify-center rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink">
            Continue with App Kit
          </button>
        ) : (
          <div className="mt-4 grid gap-3">
            <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
              KX recommends review before continuing. This testnet demo allows an explicit override.
            </p>
            <button type="button" onClick={onContinue} className="inline-flex w-full justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
              Continue anyway
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Arc App Kit + KX Trust"
        title="Protected Transactions"
        description="Run KX Trust before Circle App Kit Send, Bridge and Swap flows so risk is checked before money moves."
      />

      <section className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <h2 className="text-lg font-semibold text-white">Official App Kit pattern</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This page uses the official Circle App Kit packages with the browser wallet adapter:
              <span className="text-slate-200"> createViemAdapterFromProvider({"{ provider }"})</span>.
              KX runs first; App Kit executes only after confirmation.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-arc-border bg-white/5 px-3 py-1">Arc Testnet</span>
              <span className="rounded-full border border-arc-border bg-white/5 px-3 py-1">USDC</span>
              <span className="rounded-full border border-arc-border bg-white/5 px-3 py-1">Browser wallet adapter</span>
              <span className="rounded-full border border-arc-border bg-white/5 px-3 py-1">Testnet only</span>
            </div>
          </div>
          <CodeSnippet code={appKitSnippet} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <p className="text-xs font-medium uppercase tracking-normal text-arc-blue">Protected Send</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Send USDC after recipient trust</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Checks the recipient wallet before calling App Kit Send.</p>
          <input value={sendRecipient} onChange={(event) => setSendRecipient(event.target.value)} placeholder="Recipient wallet" className="mt-4 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue" />
          <input value={sendAmount} onChange={(event) => setSendAmount(event.target.value)} placeholder="USDC amount" className="mt-3 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue" />
          <button type="button" onClick={() => handleSend(false)} className="mt-4 inline-flex w-full justify-center rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-arc-blue">Check trust</button>
          {renderTrustResult(sendState, () => handleSend(true))}
        </article>

        <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <p className="text-xs font-medium uppercase tracking-normal text-arc-blue">Protected Bridge</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Bridge USDC after destination trust</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Checks the destination wallet before calling App Kit Bridge.</p>
          <select value={bridgeFrom} onChange={(event) => setBridgeFrom(event.target.value as ChainId)} className="mt-4 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue">
            {testnetChains.map((chain) => <option key={chain.id} value={chain.id}>{chain.label}</option>)}
          </select>
          <select value={bridgeTo} onChange={(event) => setBridgeTo(event.target.value as ChainId)} className="mt-3 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue">
            {testnetChains.map((chain) => <option key={chain.id} value={chain.id}>{chain.label}</option>)}
          </select>
          <input value={bridgeRecipient} onChange={(event) => setBridgeRecipient(event.target.value)} placeholder="Destination wallet" className="mt-3 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue" />
          <input value={bridgeAmount} onChange={(event) => setBridgeAmount(event.target.value)} placeholder="USDC amount" className="mt-3 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue" />
          <button type="button" onClick={() => handleBridge(false)} className="mt-4 inline-flex w-full justify-center rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-arc-blue">Check trust</button>
          {renderTrustResult(bridgeState, () => handleBridge(true))}
          {getBridgeStepLinks(bridgeState.result).length > 0 ? (
            <div className="mt-3 grid gap-2 text-xs">
              {getBridgeStepLinks(bridgeState.result).map((step) => (
                <a key={step.txHash} href={getExplorerTxUrl(step.txHash ?? "")} target="_blank" rel="noreferrer" className="text-arc-blue hover:text-white">
                  {step.label}: {step.state}
                </a>
              ))}
            </div>
          ) : null}
          {bridgeState.phase === "error" && bridgeState.result ? (
            <button type="button" onClick={handleRetryBridge} className="mt-3 inline-flex w-full justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">Retry bridge if supported</button>
          ) : null}
        </article>

        <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <p className="text-xs font-medium uppercase tracking-normal text-arc-blue">Protected Swap</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Server-side swap guard</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Swap requires server-side App Kit credentials and wallet execution. KX still checks protocol context first.</p>
          <input value={swapTarget} onChange={(event) => setSwapTarget(event.target.value)} placeholder="Protocol/router address or context" className="mt-4 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue" />
          <input value={swapAmount} onChange={(event) => setSwapAmount(event.target.value)} placeholder="USDC amount" className="mt-3 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue" />
          <select value={swapTokenOut} onChange={(event) => setSwapTokenOut(event.target.value)} className="mt-3 w-full rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-arc-blue">
            <option value="USDT">USDT</option>
            <option value="EURC">EURC</option>
          </select>
          <button type="button" onClick={handleSwapEstimate} className="mt-4 inline-flex w-full justify-center rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-arc-blue">Check trust and estimate swap</button>
          {renderTrustResult(swapState, handleSwapEstimate)}
          {swapState.result ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-arc-border bg-black/30 p-3 text-xs leading-5 text-slate-300">{JSON.stringify(swapState.result, null, 2)}</pre>
          ) : null}
        </article>
      </section>
    </PageShell>
  );
}

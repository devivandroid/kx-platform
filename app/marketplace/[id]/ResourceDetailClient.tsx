"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits, isAddress, parseUnits } from "ethers";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { RatingSummaryText, StarDisplay, StarInput } from "@/components/StarRating";
import { TransactionStatus, type TransactionState } from "@/components/TransactionStatus";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustCheckButton } from "@/components/TrustCheckButton";
import { useUsdc } from "@/hooks/useUsdc";
import { useWallet } from "@/hooks/useWallet";
import { getIdentitySourceLabel } from "@/lib/arcNative";
import { usdcDecimals } from "@/lib/contracts/microWorkEscrow";
import {
  getEntityTypeLabel,
  getParticipantBadgeClass,
  getUserTypeLabel
} from "@/lib/participants";
import { getPurchases, savePurchase, type InstantAccessPurchase } from "@/lib/purchases";
import {
  getRatingSummary,
  getUserRating,
  saveResourceRating,
  type RatingSummary,
  type ResourceRating
} from "@/lib/ratings";
import {
  getExplorerAddressUrl,
  getExplorerTxUrl,
  normalizeWeb3Error,
  shortenAddress
} from "@/lib/web3";
import type { InstantResource } from "@/types/resource";

type ResourceDetailClientProps = {
  initialResource: InstantResource | null;
  resourceId: string;
};

function getFriendlyFileType(mimeType: string, filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  const labels: Record<string, string> = {
    "text/csv": "CSV",
    "text/markdown": "Markdown",
    "text/x-python": "Python Script",
    "application/json": "JSON",
    "application/pdf": "PDF",
    "application/zip": "ZIP Archive",
    "application/x-yaml": "YAML",
    "application/yaml": "YAML",
    "application/octet-stream": "Binary File"
  };
  const extensionLabels: Record<string, string> = {
    csv: "CSV",
    md: "Markdown",
    py: "Python Script",
    json: "JSON",
    pdf: "PDF",
    zip: "ZIP Archive",
    yaml: "YAML",
    yml: "YAML",
    parquet: "Parquet",
    ipynb: "Jupyter Notebook",
    txt: "Text"
  };

  return labels[mimeType] ?? (extension ? extensionLabels[extension] : undefined) ?? "File";
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function getAgentPreviewPayload(resource: InstantResource): string {
  if (resource.deliveryType === "download") {
    const previewFiles = (resource.files ?? []).slice(0, 3).map((file) => ({
      filename: file.filename,
      fileType: getFriendlyFileType(file.mimeType, file.filename),
      downloadUrl: `/api/download/${resource.id}/${file.filename}`
    }));

    return JSON.stringify(
      {
        id: resource.id,
        license: resource.license,
        resourceType: resource.resourceType,
        deliveryType: resource.deliveryType,
        files: previewFiles
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      id: resource.id,
      license: resource.license,
      resourceType: resource.resourceType,
      deliveryType: resource.deliveryType,
      payload: "Structured JSON/Markdown product payload"
    },
    null,
    2
  );
}

async function trackClientReputationEvent(input: Record<string, string | undefined>) {
  await fetch("/api/reputation/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  }).catch(() => undefined);
}

export function ResourceDetailClient({ initialResource, resourceId }: ResourceDetailClientProps) {
  const { address, connect, isConnecting, isArcTestnet, switchToArcTestnet } = useWallet();
  const {
    balance,
    balanceUsdc,
    isLoading: isBalanceLoading,
    transferUSDC,
    invalidateUsdc
  } = useUsdc();
  const [resource, setResource] = useState<InstantResource | null>(initialResource);
  const [purchase, setPurchase] = useState<InstantAccessPurchase | null>(null);
  const [txState, setTxState] = useState<TransactionState>({ phase: "idle" });
  const [apiCopied, setApiCopied] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState(`/api/resources/${resourceId}`);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average: 0, count: 0 });
  const [userRating, setUserRating] = useState<ResourceRating | null>(null);
  const [ratingSaved, setRatingSaved] = useState(false);
  const isTxBusy = ["signature", "submitted", "confirming"].includes(txState.phase);
  const unlocked = Boolean(purchase);
  const isApiBackedResource = Boolean(initialResource);
  const sellerDisplayName =
    resource?.participantName ?? resource?.sellerName ?? "Independent Creator";

  useEffect(() => {
    setResource(initialResource);
  }, [initialResource, resourceId]);

  useEffect(() => {
    if (!address || !resource) {
      setPurchase(null);
      return;
    }

    const storedPurchase =
      getPurchases(address).find((item) => item.resourceId === resource.id) ?? null;
    setPurchase(storedPurchase);
  }, [address, resource]);

  useEffect(() => {
    setApiEndpoint(`${window.location.origin}/api/resources/${resourceId}`);
  }, [resourceId]);

  useEffect(() => {
    if (!resource) {
      setRatingSummary({ average: 0, count: 0 });
      setUserRating(null);
      return;
    }

    const currentResource = resource;

    setRatingSummary(getRatingSummary(currentResource.id));
    setUserRating(getUserRating(address, currentResource.id));
    setRatingSaved(false);

    let cancelled = false;

    async function loadRatings() {
      const query = address ? `?walletAddress=${encodeURIComponent(address)}` : "";
      const response = await fetch(`/api/resources/${currentResource.id}/ratings${query}`);
      const body = (await response.json()) as {
        summary?: RatingSummary;
        userRating?: ResourceRating | null;
      };

      if (!cancelled) {
        if (body.summary) setRatingSummary(body.summary);
        if (body.userRating !== undefined) setUserRating(body.userRating);
      }
    }

    loadRatings().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [address, purchase, resource]);

  if (!resource) {
    return (
      <PageShell>
        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-normal text-arc-blue">
            Product not found
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This product is not in the public catalog.
          </p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-lg bg-arc-blue px-4 py-2 text-sm font-semibold text-arc-ink"
          >
            Back to Marketplace
          </Link>
        </div>
      </PageShell>
    );
  }

  const requiredAmount = parseUnits(resource.priceUSDC, usdcDecimals);
  const hasInsufficientBalance =
    Boolean(address && isArcTestnet && !isBalanceLoading && !unlocked) && balance < requiredAmount;
  const missingBalanceUsdc =
    hasInsufficientBalance && requiredAmount > balance
      ? formatUnits(requiredAmount - balance, usdcDecimals)
      : "0";

  const handleBuy = async () => {
    if (!address) {
      setTxState({ phase: "error", message: "Connect MetaMask before buying this product." });
      return;
    }

    if (!isArcTestnet) {
      await switchToArcTestnet();
      return;
    }

    if (!isAddress(resource.sellerAddress)) {
      setTxState({ phase: "error", message: "Invalid creator address for this product." });
      return;
    }

    if (hasInsufficientBalance) {
      setTxState({
        phase: "error",
        message: `Insufficient USDC balance. You need ${missingBalanceUsdc} more USDC to buy this product.`
      });
      return;
    }

    try {
      await trackClientReputationEvent({
        walletAddress: address,
        counterpartyAddress: resource.sellerAddress,
        eventType: "RESOURCE_PURCHASE_STARTED",
        resourceId: resource.id,
        amountUSDC: resource.priceUSDC
      });
      setTxState({ phase: "signature", message: "Confirm USDC payment in MetaMask." });
      const tx = await transferUSDC(resource.sellerAddress, resource.priceUSDC);
      setTxState({ phase: "submitted", hash: tx.hash, message: "Payment submitted." });
      await tx.wait();

      const newPurchase: InstantAccessPurchase = {
        resourceId: resource.id,
        buyerAddress: address,
        sellerAddress: resource.sellerAddress,
        amountUSDC: resource.priceUSDC,
        txHash: tx.hash,
        purchasedAt: new Date().toISOString(),
        license: resource.license,
        resourceType: resource.resourceType
      };

      savePurchase(address, newPurchase);
      setPurchase(newPurchase);
      await trackClientReputationEvent({
        walletAddress: address,
        counterpartyAddress: resource.sellerAddress,
        eventType: "RESOURCE_PURCHASED",
        resourceId: resource.id,
        txHash: tx.hash,
        amountUSDC: resource.priceUSDC
      });
      await invalidateUsdc();
      setTxState({
        phase: "success",
        hash: tx.hash,
        message: "Payment confirmed. Product unlocked locally for this wallet."
      });
    } catch (error) {
      setTxState({ phase: "error", message: normalizeWeb3Error(error) });
    }
  };

  const handleRatingChange = async (rating: number) => {
    if (!address || !resource || !purchase) {
      return;
    }

    const savedRating = saveResourceRating({
      resourceId: resource.id,
      walletAddress: address,
      rating
    });

    setUserRating(savedRating);
    setRatingSummary(getRatingSummary(resource.id));
    setRatingSaved(true);

    try {
      const response = await fetch(`/api/resources/${resource.id}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, rating })
      });
      const body = (await response.json()) as {
        rating?: ResourceRating;
        summary?: RatingSummary;
        message?: string;
        error?: string;
      };

      if (!response.ok || !body.rating || !body.summary) {
        throw new Error(body.message || body.error || "Rating could not be saved.");
      }

      setUserRating(body.rating);
      setRatingSummary(body.summary);
    } catch {
      setTxState({
        phase: "error",
        message:
          "Your rating was saved in this browser, but it could not be synced to the shared database."
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Instant product"
        title={resource.title}
        description={resource.description}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <div className="flex flex-wrap gap-2">
            {unlocked ? (
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                Unlocked
              </span>
            ) : null}
            {resource.featured ? (
              <span className="rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold text-brand-cyan">
                {resource.featuredLabel ?? "Featured Research Asset"}
              </span>
            ) : null}
            <span className="rounded-full border border-arc-mint/40 bg-arc-mint/10 px-3 py-1 text-xs font-semibold text-arc-mint">
              Instant Access
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getParticipantBadgeClass(
                resource.participantType
              )}`}
            >
              {getUserTypeLabel(resource.userType)}
            </span>
            {resource.agentConsumable ? (
              <span className="rounded-full border border-arc-blue/40 bg-arc-blue/10 px-3 py-1 text-xs font-semibold text-arc-blue">
                Agent-ready
              </span>
            ) : null}
            {resource.deliveryType === "download" ? (
              <span className="rounded-full border border-purple-300/40 bg-purple-300/10 px-3 py-1 text-xs font-semibold text-purple-100">
                Downloadable files
              </span>
            ) : null}
            {isApiBackedResource ? (
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                Agent API available
              </span>
            ) : (
              <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                Local catalog only
              </span>
            )}
          </div>

          <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-500">Product type</dt>
              <dd className="mt-1 text-white">{resource.resourceType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd className="mt-1 text-white">{resource.category}</dd>
            </div>
            <div>
              <dt className="text-slate-500">License</dt>
              <dd className="mt-1 text-white">{resource.license}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Creator</dt>
              <dd className="mt-1">
                <span className="block text-white">{sellerDisplayName}</span>
                <a
                  href={getExplorerAddressUrl(resource.sellerAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-arc-blue"
                >
                  {shortenAddress(resource.sellerAddress)}
                </a>
                <span className="mt-2 block">
                  <TrustBadge wallet={resource.sellerAddress} />
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">User Type</dt>
              <dd className="mt-1 text-white">{getUserTypeLabel(resource.userType)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entity Type</dt>
              <dd className="mt-1 text-white">{getEntityTypeLabel(resource.entityType)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Identity Source</dt>
              <dd className="mt-1 text-white">{getIdentitySourceLabel(resource.identitySource)}</dd>
            </div>
            {resource.arcIdentityId ? (
              <div>
                <dt className="text-slate-500">Arc Identity ID</dt>
                <dd className="mt-1 break-all text-white">{resource.arcIdentityId}</dd>
              </div>
            ) : null}
            {resource.operatorAddress ? (
              <div>
                <dt className="text-slate-500">Operator wallet</dt>
                <dd className="mt-1">
                  <a
                    href={getExplorerAddressUrl(resource.operatorAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white hover:text-arc-blue"
                  >
                    {shortenAddress(resource.operatorAddress)}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6">
            <p className="text-sm text-slate-500">Product Preview</p>
            <p className="mt-2 rounded-lg bg-black/30 p-3 text-sm leading-6 text-slate-300">
              {resource.previewText}
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-arc-border bg-black/20 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Product rating</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Ratings are based on KX activity.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <StarDisplay rating={ratingSummary.average} size="md" />
                <RatingSummaryText summary={ratingSummary} />
              </div>
            </div>

            {purchase ? (
              <div className="mt-5 rounded-lg border border-arc-border bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Rate this product</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <StarInput value={userRating?.rating ?? 0} onChange={handleRatingChange} />
                  <p className="text-xs text-slate-500">
                    {userRating ? "You can update your rating anytime." : "One rating per wallet."}
                  </p>
                </div>
                {ratingSaved ? (
                  <p className="mt-3 rounded-lg border border-arc-mint/30 bg-arc-mint/10 p-3 text-sm text-arc-mint">
                    Your rating has been saved.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-arc-border bg-white/[0.03] p-3 text-sm leading-6 text-slate-400">
                Buyers can rate this product after buying it.
              </p>
            )}
          </div>

          {resource.files?.length ? (
            <div className="mt-6 rounded-lg border border-arc-border bg-black/20 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {unlocked ? "Unlocked downloads" : "Package contents"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {resource.files.length} curated file{resource.files.length === 1 ? "" : "s"}{" "}
                    included with this product.
                  </p>
                </div>
                {unlocked ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-arc-mint/40 bg-arc-mint/10 px-3 py-1 text-xs font-semibold text-arc-mint">
                      Ready to download
                    </span>
                    {purchase ? (
                      <button
                        type="button"
                        onClick={() => {
                          resource.files?.forEach((file) => {
                            window.open(
                              `/api/download/${resource.id}/${encodeURIComponent(
                                file.filename
                              )}?txHash=${encodeURIComponent(
                                purchase.txHash
                              )}&buyerAddress=${encodeURIComponent(purchase.buyerAddress)}`,
                              "_blank",
                              "noreferrer"
                            );
                          });
                        }}
                        className="rounded-full border border-arc-border bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-arc-blue"
                      >
                        Download all
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3">
                {resource.files.map((file) => {
                  const downloadUrl = purchase
                    ? `/api/download/${resource.id}/${encodeURIComponent(
                        file.filename
                      )}?txHash=${encodeURIComponent(
                        purchase.txHash
                      )}&buyerAddress=${encodeURIComponent(purchase.buyerAddress)}`
                    : null;

                  return (
                    <div
                      key={file.filename}
                      className="grid gap-4 rounded-lg border border-arc-border bg-white/[0.03] p-4 text-sm transition hover:border-arc-blue/60 hover:bg-white/[0.05] md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-semibold text-white">{file.filename}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {getFriendlyFileType(file.mimeType, file.filename)} {" - "}
                          {formatFileSize(file.sizeBytes)}
                        </p>
                        {file.description ? (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                            {file.description}
                          </p>
                        ) : null}
                      </div>
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          className="inline-flex min-w-28 items-center justify-center rounded-lg bg-arc-blue px-4 py-2.5 text-xs font-semibold text-arc-ink transition hover:bg-white"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="inline-flex min-w-28 items-center justify-center rounded-lg border border-arc-border bg-black/20 px-4 py-2.5 text-xs font-semibold text-slate-500">
                          Locked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-lg border border-arc-border bg-black/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-white">Agent Access Preview</p>
              <Link href="/agent-api" className="text-sm text-arc-blue hover:text-white">
                View API docs
              </Link>
            </div>
            {isApiBackedResource ? (
              <>
                <div className="mt-3 flex flex-col gap-2 rounded-lg border border-arc-border bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all text-xs text-slate-300">{apiEndpoint}</code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(apiEndpoint);
                      setApiCopied(true);
                      window.setTimeout(() => setApiCopied(false), 1400);
                    }}
                    className="rounded-lg border border-arc-border px-3 py-2 text-xs font-semibold text-white hover:border-arc-blue"
                  >
                    {apiCopied ? "Copied" : "Copy endpoint"}
                  </button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs leading-6 text-slate-300">
                  {`GET /api/resources/${resource.id}

Response:
402 Payment Required

After payment:
200 OK
${getAgentPreviewPayload(resource)}`}
                </pre>
              </>
            ) : (
              <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                This product is served by the public catalog API when backend persistence is
                configured.
              </p>
            )}
          </div>

          {unlocked && resource.unlockedContentMock ? (
            <div className="mt-6 rounded-lg border border-arc-mint/30 bg-arc-mint/10 p-4">
              <p className="text-sm font-semibold text-arc-mint">
                {resource.deliveryType === "download" ? "Additional notes" : "Unlocked content"}
              </p>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-sm leading-6 text-slate-200">
                {resource.unlockedContentMock}
              </pre>
            </div>
          ) : null}
        </section>

        <aside className="self-start rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <p className="text-sm text-slate-500">Price</p>
          <p className="mt-1 text-2xl font-semibold text-white">{resource.priceUSDC} USDC</p>
          {address ? (
            <p className="mt-2 text-xs text-slate-500">
              Connected: {shortenAddress(address)} - Balance:{" "}
              {isBalanceLoading ? "checking..." : `${balanceUsdc} USDC`}
            </p>
          ) : null}

          {!address ? (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? <LoadingSpinner /> : null}
              Connect Wallet
            </button>
          ) : !isArcTestnet ? (
            <button
              type="button"
              onClick={switchToArcTestnet}
              className="mt-5 w-full rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink"
            >
              Switch to Arc Testnet
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBuy}
              disabled={isTxBusy || unlocked || isBalanceLoading || hasInsufficientBalance}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-mint px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTxBusy ? <LoadingSpinner /> : null}
              {unlocked
                ? "Unlocked"
                : isBalanceLoading
                  ? "Checking balance..."
                  : hasInsufficientBalance
                    ? "Insufficient USDC"
                    : "Buy with USDC"}
            </button>
          )}

          <TrustCheckButton
            wallet={resource.sellerAddress}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-arc-blue disabled:cursor-not-allowed disabled:opacity-60"
          />

          {hasInsufficientBalance ? (
            <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
              This wallet needs {missingBalanceUsdc} more USDC to buy this product.
            </p>
          ) : null}

          <p className="mt-4 text-sm leading-6 text-slate-400">
            The payment is a direct USDC transfer to the creator. Unlock state is stored only
            in this browser for the connected wallet.
          </p>

          <TransactionStatus state={txState} />

          {purchase ? (
            <div className="mt-5 rounded-lg border border-arc-border bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">View Receipt</p>
              <dl className="mt-3 grid gap-2 text-xs text-slate-400">
                <div>
                  <dt>Product</dt>
                  <dd className="text-white">{resource.title}</dd>
                </div>
                <div>
                  <dt>Buyer</dt>
                  <dd className="text-white">{shortenAddress(purchase.buyerAddress)}</dd>
                </div>
                <div>
                  <dt>Creator</dt>
                  <dd className="text-white">{sellerDisplayName}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd className="text-white">{purchase.amountUSDC} USDC</dd>
                </div>
                <div>
                  <dt>License</dt>
                  <dd className="text-white">{purchase.license}</dd>
                </div>
                <div>
                  <dt>Purchased at</dt>
                  <dd className="text-white">{new Date(purchase.purchasedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Transaction</dt>
                  <dd>
                    <a
                      href={getExplorerTxUrl(purchase.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-arc-blue hover:text-white"
                    >
                      View on Arc Explorer
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <Link
            href="/marketplace"
            className="mt-5 inline-flex text-sm text-arc-blue hover:text-white"
          >
            Back to marketplace
          </Link>
        </aside>
      </div>
    </PageShell>
  );
}

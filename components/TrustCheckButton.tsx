"use client";

import { useMemo, useState } from "react";
import { isAddress } from "ethers";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { trustBadgeRefreshEvent } from "@/components/TrustBadge";
import { KXClient, type TrustWalletResponse } from "@/lib/sdk/kx";
import { shortenAddress } from "@/lib/web3";

type TrustCheckState = {
  wallet: string;
  phase: "loading" | "success" | "error";
  result?: TrustWalletResponse;
  message?: string;
};

type TrustCheckButtonProps = {
  wallet: string;
  disabled?: boolean;
  buttonLabel?: string;
  className?: string;
  onProceed?: (wallet: string) => void | Promise<void>;
  allowActionLabel?: string;
  reviewActionLabel?: string;
  warningText?: string;
  onResult?: (result: TrustWalletResponse) => void;
};

const defaultButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-arc-border bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:border-arc-blue disabled:cursor-not-allowed disabled:opacity-60";

export function TrustCheckButton({
  wallet,
  disabled,
  buttonLabel = "Check Trust",
  className = defaultButtonClass,
  onProceed,
  allowActionLabel = "Continue",
  reviewActionLabel = "Continue Anyway",
  warningText = "KX recommends review before continuing. You can still proceed if you accept the risk.",
  onResult
}: TrustCheckButtonProps) {
  const [trustCheck, setTrustCheck] = useState<TrustCheckState | null>(null);
  const kxClient = useMemo(() => new KXClient({ baseUrl: "" }), []);

  const isLoading = trustCheck?.wallet === wallet && trustCheck.phase === "loading";

  const handleCheckTrust = async () => {
    if (!isAddress(wallet)) {
      setTrustCheck({
        wallet,
        phase: "error",
        message: "Enter a valid wallet before checking trust."
      });
      return;
    }

    setTrustCheck({ wallet, phase: "loading" });

    try {
      const result = await kxClient.trust(wallet);
      setTrustCheck({ wallet, phase: "success", result });
      onResult?.(result);
      window.dispatchEvent(
        new CustomEvent(trustBadgeRefreshEvent, {
          detail: { wallet }
        })
      );
    } catch (error) {
      setTrustCheck({
        wallet,
        phase: "error",
        message: error instanceof Error ? error.message : "Unable to check trust for this wallet."
      });
    }
  };

  const handleProceed = async () => {
    if (!onProceed || !trustCheck) {
      return;
    }

    setTrustCheck(null);
    await onProceed(trustCheck.wallet);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCheckTrust}
        disabled={disabled || isLoading}
        className={className}
      >
        {isLoading ? <LoadingSpinner /> : null}
        {buttonLabel}
      </button>

      {trustCheck ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-arc-border bg-arc-panel p-5 shadow-glow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">KX Trust Check</p>
                <p className="mt-1 text-xs text-slate-500">{shortenAddress(trustCheck.wallet)}</p>
              </div>
              <button
                type="button"
                onClick={() => setTrustCheck(null)}
                className="rounded-md border border-arc-border px-2 py-1 text-xs font-semibold text-slate-300 hover:border-arc-blue hover:text-white"
              >
                Close
              </button>
            </div>

            {trustCheck.phase === "loading" ? (
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-arc-border bg-black/20 p-4 text-sm text-slate-300">
                <LoadingSpinner />
                Checking wallet trust signals...
              </div>
            ) : null}

            {trustCheck.phase === "error" ? (
              <div className="mt-5 rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-100">
                {trustCheck.message}
              </div>
            ) : null}

            {trustCheck.phase === "success" && trustCheck.result ? (
              <div className="mt-5 grid gap-3">
                <div className="rounded-lg border border-arc-border bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">Decision</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        trustCheck.result.decision === "ALLOW"
                          ? "bg-arc-mint/15 text-arc-mint"
                          : trustCheck.result.decision === "BLOCK"
                            ? "bg-red-300/15 text-red-100"
                            : "bg-amber-300/15 text-amber-100"
                      }`}
                    >
                      {trustCheck.result.decision}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Trust Score</dt>
                      <dd className="mt-1 text-white">
                        {trustCheck.result.trustScore ?? "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Risk Score</dt>
                      <dd className="mt-1 text-white">
                        {trustCheck.result.riskScore ?? "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Estimated Identity</dt>
                      <dd className="mt-1 text-white">{trustCheck.result.estimatedIdentity}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Human Probability</dt>
                      <dd className="mt-1 text-white">
                        {trustCheck.result.humanProbability === null
                          ? "Not available"
                          : `${trustCheck.result.humanProbability}%`}
                      </dd>
                    </div>
                  </dl>
                </div>

                {trustCheck.result.reasons.length > 0 ? (
                  <div className="rounded-lg border border-arc-border bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                      Reasons
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-300">
                      {trustCheck.result.reasons.slice(0, 2).map((reason) => (
                        <li key={reason}>- {reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {onProceed ? (
                  trustCheck.result.decision === "ALLOW" ? (
                    <button
                      type="button"
                      onClick={handleProceed}
                      disabled={disabled}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-arc-blue px-4 py-3 text-sm font-semibold text-arc-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {allowActionLabel}
                    </button>
                  ) : (
                    <div className="grid gap-3">
                      <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                        {warningText}
                      </p>
                      <button
                        type="button"
                        onClick={handleProceed}
                        disabled={disabled}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reviewActionLabel}
                      </button>
                    </div>
                  )
                ) : null}

                <p className="text-xs leading-5 text-slate-500">
                  KX does not identify people. It estimates wallet behavior and risk signals.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

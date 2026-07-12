"use client";

import { useEffect, useState } from "react";
import { isAddress } from "ethers";

type TrustBadgeSummary = {
  wallet: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK" | "UNKNOWN";
  status: "trusted" | "review" | "high_risk" | "not_checked";
  label: "Trusted" | "Review" | "High Risk" | "Not checked yet";
  trustScore: number | null;
  riskScore: number | null;
  riskTier: string | null;
  estimatedIdentity: string | null;
  humanProbability: number | null;
  updatedAt: string | null;
};

type TrustBadgeProps = {
  wallet: string;
  className?: string;
  showEmpty?: boolean;
};

type TrustBadgeResponse = {
  badge?: TrustBadgeSummary;
};

type TrustBadgesResponse = {
  badges?: TrustBadgeSummary[];
};

const badgeClassByStatus: Record<TrustBadgeSummary["status"], string> = {
  trusted: "border-arc-mint/40 bg-arc-mint/10 text-arc-mint",
  review: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  high_risk: "border-red-300/40 bg-red-300/10 text-red-100",
  not_checked: "border-arc-border bg-white/5 text-slate-400"
};

export const trustBadgeRefreshEvent = "kx:trust-badge-refresh";

const pendingBadgeRequests = new Map<
  string,
  {
    wallet: string;
    resolve: (badge: TrustBadgeSummary | null) => void;
  }
>();
let pendingBadgeTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchSingleTrustBadge(wallet: string): Promise<TrustBadgeSummary | null> {
  const response = await fetch(`/api/trust/badge/${wallet}`, { cache: "no-store" });
  const body = (await response.json()) as TrustBadgeResponse;
  return body.badge ?? null;
}

function requestTrustBadge(wallet: string): Promise<TrustBadgeSummary | null> {
  const key = wallet.toLowerCase();
  const existing = pendingBadgeRequests.get(key);
  if (existing) {
    return new Promise((resolve) => {
      const previousResolve = existing.resolve;
      pendingBadgeRequests.set(key, {
        wallet,
        resolve: (badge) => {
          previousResolve(badge);
          resolve(badge);
        }
      });
    });
  }

  const promise = new Promise<TrustBadgeSummary | null>((resolve) => {
    pendingBadgeRequests.set(key, { wallet, resolve });
  });

  if (!pendingBadgeTimer) {
    pendingBadgeTimer = setTimeout(async () => {
      const requests = Array.from(pendingBadgeRequests.values());
      pendingBadgeRequests.clear();
      pendingBadgeTimer = null;

      if (requests.length === 1) {
        try {
          requests[0]?.resolve(await fetchSingleTrustBadge(requests[0].wallet));
        } catch {
          requests[0]?.resolve(null);
        }
        return;
      }

      try {
        const response = await fetch("/api/trust/badges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallets: requests.map((request) => request.wallet) }),
          cache: "no-store"
        });
        const body = (await response.json()) as TrustBadgesResponse;
        const byWallet = new Map(
          (body.badges ?? []).map((badge) => [badge.wallet.toLowerCase(), badge])
        );

        for (const request of requests) {
          request.resolve(byWallet.get(request.wallet.toLowerCase()) ?? null);
        }
      } catch {
        for (const request of requests) {
          request.resolve(null);
        }
      }
    }, 0);
  }

  return promise;
}

export function TrustBadge({ wallet, className = "", showEmpty = true }: TrustBadgeProps) {
  const [badge, setBadge] = useState<TrustBadgeSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBadge() {
      if (!isAddress(wallet)) {
        setBadge(null);
        return;
      }

      try {
        const nextBadge = await requestTrustBadge(wallet);
        if (!cancelled) setBadge(nextBadge);
      } catch {
        if (!cancelled) setBadge(null);
      }
    }

    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent<{ wallet?: string }>).detail;
      if (!detail?.wallet || detail.wallet.toLowerCase() === wallet.toLowerCase()) {
        void loadBadge();
      }
    }

    void loadBadge();
    window.addEventListener(trustBadgeRefreshEvent, handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener(trustBadgeRefreshEvent, handleRefresh);
    };
  }, [wallet]);

  if (!badge || (!showEmpty && badge.status === "not_checked")) return null;

  return (
    <span
      title={
        badge.updatedAt
          ? `Latest Trust Snapshot: ${new Date(badge.updatedAt).toLocaleString()}`
          : "No Trust Snapshot found yet."
      }
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassByStatus[badge.status]} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {badge.label}
    </span>
  );
}

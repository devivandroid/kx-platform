"use client";

import { useMemo, useState } from "react";

type ParticipantRiskProfileRow = {
  wallet: string;
  displayName: string;
  maskedWallet: string;
  financialBehaviorScore: number | null;
  trustScore?: number | null;
  riskScore: number | null;
  riskTier: string;
  confidenceLevel: string;
  completedVolumeUSDC: string;
};

const rowsPerPage = 5;

function getRiskAccent(tier: string): string {
  if (tier === "Low") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (tier === "Medium") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  if (tier === "High") return "border-red-300/40 bg-red-300/10 text-red-100";
  return "border-slate-400/30 bg-slate-400/10 text-slate-300";
}

function formatNullable(value: number | null): string {
  return value === null ? "Not assessed" : String(value);
}

function formatTrustScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not assessed" : String(value);
}

export function ParticipantRiskProfiles({ profiles }: { profiles: ParticipantRiskProfileRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(profiles.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleProfiles = useMemo(
    () => profiles.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage),
    [currentPage, profiles]
  );

  return (
    <section className="mt-6 rounded-lg border border-arc-border bg-arc-panel/80 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Recent Trust Profiles</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Recently evaluated participants based on KX activity and optional Arc Testnet signals.
            This is not an official Arc or Circle score.
          </p>
        </div>
        <span className="rounded-full border border-slate-500/40 px-3 py-1 text-xs text-slate-300">
          {profiles.length} profiles
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-arc-border">
        {visibleProfiles.length > 0 ? (
          visibleProfiles.map((profile) => (
            <div
              key={profile.wallet}
              className="grid gap-3 border-b border-arc-border bg-black/20 p-4 text-sm last:border-b-0 md:grid-cols-[1.4fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr]"
            >
              <span>
                <span className="block font-semibold text-white">{profile.displayName}</span>
                <span className="text-xs text-slate-500">{profile.maskedWallet}</span>
              </span>
              <span>Trust {formatTrustScore(profile.trustScore ?? profile.financialBehaviorScore)}</span>
              <span>Risk {formatNullable(profile.riskScore)}</span>
              <span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskAccent(
                    profile.riskTier
                  )}`}
                >
                  {profile.riskTier}
                </span>
              </span>
              <span>{profile.confidenceLevel} analysis confidence</span>
              <span>{profile.completedVolumeUSDC} USDC</span>
            </div>
          ))
        ) : (
          <p className="bg-black/20 p-4 text-sm text-slate-400">No participant profiles yet.</p>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}. Showing {rowsPerPage} rows per page.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-arc-border px-3 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-arc-border px-3 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

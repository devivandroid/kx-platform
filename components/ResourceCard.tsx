"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RatingSummaryText, StarDisplay } from "@/components/StarRating";
import { TrustCheckButton } from "@/components/TrustCheckButton";
import { useWallet } from "@/hooks/useWallet";
import {
  getEntityTypeLabel,
  getParticipantBadgeClass,
  getUserTypeLabel
} from "@/lib/participants";
import { hasPurchased } from "@/lib/purchases";
import { getRatingSummary, type RatingSummary } from "@/lib/ratings";
import type { InstantResource } from "@/types/resource";

type ResourceCardProps = {
  resource: InstantResource;
};

export function ResourceCard({ resource }: ResourceCardProps) {
  const { address } = useWallet();
  const [purchased, setPurchased] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary>({ average: 0, count: 0 });

  useEffect(() => {
    setPurchased(hasPurchased(address, resource.id));
    setRatingSummary(getRatingSummary(resource.id));

    let cancelled = false;

    async function loadRatingSummary() {
      const response = await fetch(`/api/resources/${resource.id}/ratings`);
      const body = (await response.json()) as { summary?: RatingSummary };

      if (!cancelled && body.summary) {
        setRatingSummary(body.summary);
      }
    }

    loadRatingSummary().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [address, resource.id]);

  return (
    <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5 transition hover:border-arc-blue hover:bg-arc-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {resource.featured ? (
            <span className="mb-3 inline-flex rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold text-brand-cyan">
              {resource.featuredLabel ?? "Featured Research Asset"}
            </span>
          ) : null}
          <p className="text-xs font-medium uppercase tracking-normal text-arc-blue">
            {resource.resourceType}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">{resource.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{resource.category}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {purchased ? (
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              Unlocked
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
          {resource.deliveryType === "download" ? (
            <span className="rounded-full border border-purple-300/40 bg-purple-300/10 px-3 py-1 text-xs font-semibold text-purple-100">
              Files
            </span>
          ) : null}
          {resource.agentConsumable ? (
            <span className="rounded-full border border-arc-blue/40 bg-arc-blue/10 px-3 py-1 text-xs font-semibold text-arc-blue">
              Agent-ready
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{resource.description}</p>

      <div className="mt-4 grid gap-1 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <StarDisplay rating={ratingSummary.average} />
          <RatingSummaryText summary={ratingSummary} />
        </p>
        <p>License: {resource.license}</p>
        <p>
          Delivery:{" "}
          {resource.deliveryType === "download"
            ? `${resource.files?.length ?? 0} downloadable file${
                (resource.files?.length ?? 0) === 1 ? "" : "s"
              }`
            : "Inline content"}
        </p>
        <p>
          Creator: {resource.participantName ?? resource.sellerName ?? "Independent Creator"} ·{" "}
          {getUserTypeLabel(resource.userType)} / {getEntityTypeLabel(resource.entityType)}
        </p>
        <p>Tags: {resource.tags.join(", ")}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-white">{resource.priceUSDC}</span> USDC
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TrustCheckButton
            wallet={resource.sellerAddress}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-arc-border bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-arc-blue disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Link
            href={`/marketplace/${resource.id}`}
            className="text-sm font-medium text-arc-blue hover:text-white"
          >
            View Product
          </Link>
        </div>
      </div>
    </article>
  );
}

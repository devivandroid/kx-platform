"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TaskCard } from "@/components/TaskCard";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustCheckButton } from "@/components/TrustCheckButton";
import { isEscrowConfigured, useRecentTasks, useTaskCount } from "@/hooks/useEscrowContract";
import {
  getTaskDisplayDescription,
  getTaskDisplayTitle,
  parseTaskMetadata
} from "@/lib/taskMetadata";
import type { EscrowTask } from "@/lib/contracts/microWorkEscrow";

type PublicRequestDraft = {
  id: string;
  arcJobId?: string | null;
  title: string;
  description: string;
  requirements: string;
  budgetUSDC: string;
  license: string;
  requesterAddress: string;
  participantType?: string;
  participantName?: string;
  identitySource?: string;
  resourceType?: string;
  settlement?: string;
  status: string;
  agentConsumable: boolean;
};

const nonProductionRequestPatterns = [
  /send\s+1\s+usdc\s+test\s+task/i,
  /test\s+task\s+cancellation/i,
  /test\s+the\s+escrow\s+flow/i,
  /two\s+applicants/i,
  /build\s+a\s+small\s+test\s+component/i
];

function isProductionRequest(request: EscrowTask) {
  if (request.metadataURI.toLowerCase().includes("kx-arc-runner")) {
    return false;
  }

  const text = [
    getTaskDisplayTitle(request.metadataURI, `Request #${request.id.toString()}`),
    getTaskDisplayDescription(request.metadataURI)
  ].join(" ");

  return !nonProductionRequestPatterns.some((pattern) => pattern.test(text));
}

export default function RequestsPage() {
  const taskCountQuery = useTaskCount();
  const requestsQuery = useRecentTasks();
  const [apiRequests, setApiRequests] = useState<PublicRequestDraft[]>([]);
  const [selectedResourceType, setSelectedResourceType] = useState("all");
  const visibleRequests = useMemo(
    () => requestsQuery.data?.filter(isProductionRequest) ?? [],
    [requestsQuery.data]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadApiRequests() {
      const response = await fetch("/api/requests/search?status=Open");
      const body = (await response.json()) as { requests?: PublicRequestDraft[] };

      if (!cancelled && body.requests) {
        setApiRequests(body.requests);
      }
    }

    loadApiRequests().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const getOnChainResourceType = (request: EscrowTask) =>
    parseTaskMetadata(request.metadataURI)?.resourceType || "Custom Service";
  const getApiResourceType = (request: PublicRequestDraft) =>
    request.resourceType || "Custom Service";
  const resourceTypes = useMemo(
    () =>
      Array.from(
        new Set([
          ...visibleRequests.map(getOnChainResourceType),
          ...apiRequests.map(getApiResourceType)
        ])
      ).sort(),
    [apiRequests, visibleRequests]
  );
  const filteredVisibleRequests = useMemo(
    () =>
      selectedResourceType === "all"
        ? visibleRequests
        : visibleRequests.filter((request) => getOnChainResourceType(request) === selectedResourceType),
    [selectedResourceType, visibleRequests]
  );
  const filteredApiRequests = useMemo(
    () =>
      selectedResourceType === "all"
        ? apiRequests
        : apiRequests.filter((request) => getApiResourceType(request) === selectedResourceType),
    [apiRequests, selectedResourceType]
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Arc Compatible Jobs"
        title="Jobs"
        description="Custom commerce opportunities for deliverables, protected settlement and Arc-native identity context."
      />

      <div className="mb-4 flex justify-end">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Product type
          <select
            value={selectedResourceType}
            onChange={(event) => setSelectedResourceType(event.target.value)}
            className="h-9 rounded-lg border border-arc-border bg-arc-panel px-3 text-sm font-medium text-slate-200 outline-none transition focus:border-arc-blue"
          >
            <option value="all">All product types</option>
            {resourceTypes.map((resourceType) => (
              <option key={resourceType} value={resourceType}>
                {resourceType}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-arc-border bg-arc-panel/80 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Create a custom Job</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Define the deliverable, participant identity context and settlement budget.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex rounded-lg bg-arc-blue px-4 py-2 text-center text-sm font-semibold text-arc-ink hover:bg-white"
        >
          Create Job
        </Link>
      </div>

      {!isEscrowConfigured ? (
        <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
          Protected settlement contract is not configured. Deploy the contract and set{" "}
          <span className="font-semibold">NEXT_PUBLIC_ESCROW_CONTRACT</span>.
        </div>
      ) : null}

      {taskCountQuery.isLoading || requestsQuery.isLoading ? (
        <div className="flex items-center gap-3 rounded-lg border border-arc-border bg-arc-panel/80 p-6 text-sm text-slate-400">
          <LoadingSpinner />
          Loading Jobs from Arc Testnet...
        </div>
      ) : null}

      {taskCountQuery.error || requestsQuery.error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-100">
          Unable to load Jobs. Check RPC, network, and contract address.
        </div>
      ) : null}

      {requestsQuery.data && filteredVisibleRequests.length === 0 && filteredApiRequests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-arc-border bg-arc-panel/80 p-6">
          <p className="text-sm font-semibold text-white">No matching Jobs yet</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Try another product type or create the first matching Job.
          </p>
          <Link
            href="/requests/new"
            className="mt-4 inline-flex rounded-lg bg-arc-blue px-4 py-2 text-sm font-semibold text-arc-ink"
          >
            Create Job
          </Link>
        </div>
      ) : null}

      {filteredApiRequests.length > 0 ? (
        <section className="mb-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Public Job drafts</p>
              <p className="mt-1 text-sm text-slate-500">
                Shared Arc-compatible Job opportunities served from the public API catalog.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredApiRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-lg border border-arc-border bg-arc-panel/80 p-5 shadow-glow"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-arc-blue">
                    {request.status}
                  </p>
                  {request.agentConsumable ? (
                    <span className="rounded-full border border-arc-border px-2 py-1 text-xs text-slate-400">
                      Agent-ready
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">{request.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                  {request.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{request.budgetUSDC} USDC</span>
                  <span>{getApiResourceType(request)}</span>
                  <span>{request.license}</span>
                  {request.participantName ? <span>{request.participantName}</span> : null}
                  <span>
                    {request.identitySource === "arc_identity" ? "Arc Identity" : "Self-declared"}
                  </span>
                  <span>Arc Native</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <TrustBadge wallet={request.requesterAddress} />
                  <TrustCheckButton
                    wallet={request.requesterAddress}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-arc-border bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-arc-blue disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredVisibleRequests.map((request) => (
          <TaskCard key={request.id.toString()} task={request} />
        ))}
      </div>
    </PageShell>
  );
}

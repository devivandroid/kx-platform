"use client";

import Link from "next/link";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TaskCard } from "@/components/TaskCard";
import { isEscrowConfigured, useRecentTasks } from "@/hooks/useEscrowContract";
import { useWallet } from "@/hooks/useWallet";

const zeroAddress = "0x0000000000000000000000000000000000000000";

export default function MyActivityPage() {
  const { address } = useWallet();
  const requestsQuery = useRecentTasks();
  const normalizedAddress = address?.toLowerCase();
  const requesterRequests =
    requestsQuery.data?.filter((request) => request.client.toLowerCase() === normalizedAddress) ??
    [];
  const providerRequests =
    requestsQuery.data?.filter(
      (request) =>
        request.freelancer !== zeroAddress && request.freelancer.toLowerCase() === normalizedAddress
    ) ?? [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Activity"
        title="My Activity"
        description="Track Jobs where your wallet is the buyer or assigned provider."
      />

      {!isEscrowConfigured ? (
        <div className="mb-5 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
          Protected settlement contract is not configured. Deploy the contract and set
          NEXT_PUBLIC_ESCROW_CONTRACT.
        </div>
      ) : null}

      {!address ? (
        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-6">
          <p className="text-sm font-semibold text-white">Wallet required</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Connect MetaMask to view Jobs where your wallet is the buyer or provider.
          </p>
        </div>
      ) : null}

      {requestsQuery.isLoading ? (
        <div className="flex items-center gap-3 rounded-lg border border-arc-border bg-arc-panel/80 p-6 text-sm text-slate-400">
          <LoadingSpinner />
          Loading your activity from Arc Testnet...
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Jobs you created</h2>
          <div className="grid gap-4">
            {requesterRequests.length > 0 ? (
              requesterRequests.map((request) => (
                <TaskCard key={request.id.toString()} task={request} />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-arc-border bg-black/20 p-5 text-sm text-slate-500">
                <p className="font-semibold text-slate-300">No buyer activity found.</p>
                <Link
                  href="/publish-resource"
                  className="mt-3 inline-flex text-arc-blue hover:text-white"
                >
                  Create Job
                </Link>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Jobs assigned to you</h2>
          <div className="grid gap-4">
            {providerRequests.length > 0 ? (
              providerRequests.map((request) => (
                <TaskCard key={request.id.toString()} task={request} />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-arc-border bg-black/20 p-5 text-sm text-slate-500">
                <p className="font-semibold text-slate-300">No provider activity found.</p>
                <Link href="/requests" className="mt-3 inline-flex text-arc-blue hover:text-white">
                  Browse Jobs
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

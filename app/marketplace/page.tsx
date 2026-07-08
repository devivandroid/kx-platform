"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { ResourceCard } from "@/components/ResourceCard";
import { getInstantResources } from "@/services/resources";
import type { InstantResource } from "@/types/resource";

function sortFeaturedFirst(resources: InstantResource[]): InstantResource[] {
  return [...resources].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}

export default function MarketplacePage() {
  const [resources, setResources] = useState<InstantResource[]>(() =>
    sortFeaturedFirst(getInstantResources())
  );
  const [selectedResourceType, setSelectedResourceType] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      const response = await fetch("/api/resources/search");
      const body = (await response.json()) as { resources?: InstantResource[] };

      if (!cancelled && body.resources) {
        setResources(sortFeaturedFirst(body.resources));
      }
    }

    loadResources().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const resourceTypes = useMemo(
    () => Array.from(new Set(resources.map((resource) => resource.resourceType))).sort(),
    [resources]
  );
  const filteredResources = useMemo(
    () =>
      selectedResourceType === "all"
        ? resources
        : resources.filter((resource) => resource.resourceType === selectedResourceType),
    [resources, selectedResourceType]
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Marketplace"
        title="Marketplace"
        description="Browse premium services, datasets, benchmark packages, schemas, templates and machine-readable products from independent creators. Featured products appear first."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/publish-resource"
          className="inline-flex rounded-lg bg-arc-blue px-4 py-2 text-center text-sm font-semibold text-arc-ink hover:bg-white"
        >
          New Product
        </Link>
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

      <div className="mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
        This Arc Testnet preview uses testnet USDC only. Do not upload private or confidential
        content.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </PageShell>
  );
}

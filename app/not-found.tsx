import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell>
      <section className="rounded-lg border border-arc-border bg-arc-panel/80 p-8 text-center">
        <p className="text-sm uppercase tracking-normal text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Product not found</h1>
        <p className="mt-3 text-slate-400">
          This product or job does not exist in the current catalog.
        </p>
        <Link
          href="/marketplace"
          className="mt-6 inline-flex rounded-lg bg-arc-blue px-5 py-3 text-sm font-semibold text-arc-ink"
        >
          Back to Marketplace
        </Link>
      </section>
    </PageShell>
  );
}

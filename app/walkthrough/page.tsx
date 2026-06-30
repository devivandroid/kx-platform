import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { arcExplorerUrl } from "@/lib/web3";

const walkthroughFlows = [
  {
    title: "Instant Access purchase",
    description:
      "A buyer unlocks a ready-to-use resource with a direct USDC payment to the seller.",
    steps: [
      "A creator publishes a priced resource with license, category, tags, and seller address.",
      "The buyer opens Marketplace and reviews featured datasets, benchmark packages, and other Instant Access assets.",
      "The resource detail page shows price, seller, license, preview text, and file metadata when available.",
      "The buyer connects MetaMask, switches to Arc Testnet, and confirms Unlock Resource.",
      "The USDC transfer confirms on Arc and the resource unlocks for that wallet.",
      "The buyer can view the receipt, Arc explorer transaction link, inline content, and unlocked download buttons."
    ],
    outcome: "The resource content or authenticated file downloads are available to the purchasing wallet."
  },
  {
    title: "HTTP 402 Agent API",
    description:
      "An autonomous client receives payment instructions, pays in USDC, and retries with proof.",
    steps: [
      "The agent calls /api/agent-capabilities to discover supported workflows.",
      "The agent requests a protected resource.",
      "The API responds with HTTP 402 Payment Required and payment instructions.",
      "The agent pays the seller with USDC on Arc Testnet.",
      "The agent submits txHash and buyerAddress for verification.",
      "The agent retries the resource request with proof and receives a structured payload or file download URLs."
    ],
    outcome: "The API returns JSON, Markdown, or authenticated file metadata after stateless transaction verification."
  },
  {
    title: "Risk Intelligence",
    description:
      "Apps and agents query preview risk signals based on KX activity.",
    steps: [
      "A wallet buys resources, verifies payments, downloads files, or participates in requests.",
      "KX records lightweight marketplace events.",
      "The preview model calculates reputation signals, financial behavior score, risk tier, confidence, and evidence count.",
      "Builders query /api/risk/profile/{wallet}, /api/risk/summary/{wallet}, /api/risk/signals/{wallet}, or /api/risk/model.",
      "Risk results can route high-risk wallets to manual review."
    ],
    outcome:
      "Builders get explainable Risk Intelligence without claiming official Arc-wide scoring."
  },
  {
    title: "Jobs",
    description:
      "A buyer funds custom work with protected settlement, a provider submits a deliverable, and payment is released after approval.",
    steps: [
      "Open Jobs and click Create Job.",
      "Create a request with scope, license, budget, and optional deadline.",
      "Land on the new request detail page.",
      "Approve USDC if needed and click Fund Escrow.",
      "A provider applies to the request.",
      "The buyer assigns the provider.",
      "The assigned provider submits deliverable notes or links.",
      "The buyer reviews the deliverable and releases settlement.",
      "The final transaction can be verified in ArcScan."
    ],
    outcome: "The protected settlement lifecycle finishes on-chain after buyer approval."
  }
];

export default function DemoPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Product walkthrough"
        title="Three ways to exchange knowledge"
        description="Walk through Instant Access, HTTP 402 Agent Flow, and Jobs using Arc Testnet USDC settlement."
      />

      <section className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-5">
          {walkthroughFlows.map((flow) => (
            <article
              key={flow.title}
              className="rounded-lg border border-arc-border bg-arc-panel/80 p-5"
            >
              <h2 className="text-xl font-semibold text-white">{flow.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{flow.description}</p>
              <ol className="mt-4 grid gap-3">
                {flow.steps.map((step, index) => (
                  <li
                    key={step}
                    className="flex gap-3 rounded-lg border border-arc-border bg-black/20 p-4"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm leading-6 text-slate-300">{step}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-lg border border-arc-mint/30 bg-arc-mint/10 p-3 text-sm leading-6 text-arc-mint">
                Result: {flow.outcome}
              </p>
            </article>
          ))}
        </div>

        <aside className="self-start rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <p className="text-sm font-semibold text-white">Quick links</p>
          <div className="mt-4 grid gap-3">
            <Link
              href="/marketplace"
              className="rounded-lg bg-arc-blue px-4 py-3 text-center text-sm font-semibold text-arc-ink"
            >
              Marketplace
            </Link>
            <Link
              href="/agent-api"
              className="rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Agent API
            </Link>
            <Link
              href="/requests/new"
              className="rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Create Job
            </Link>
            <Link
              href="/requests"
              className="rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Jobs
            </Link>
            <a
              href={arcExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-arc-border bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Arc Explorer
            </a>
          </div>
          <p className="mt-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            This is an unaudited Arc Testnet preview. Do not use real funds.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Faucet availability can change during testnet phases. Use the current Arc faucet or
            developer resources to fund your test wallet.
          </p>
        </aside>
      </section>
    </PageShell>
  );
}

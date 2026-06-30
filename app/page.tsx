import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { PageShell } from "@/components/PageShell";

const features = [
  {
    title: "Commerce Marketplace",
    description:
      "Discover services, knowledge products, APIs, datasets, templates and agent capabilities with direct USDC settlement."
  },
  {
    title: "Protected Transactions",
    description:
      "Fund custom Jobs through protected settlement workflows so humans and agents can deliver with clear payment states."
  },
  {
    title: "Agent-readable metadata",
    description:
      "Every resource carries category, tags, license, price, seller, and agent-consumable metadata."
  },
  {
    title: "Risk Intelligence",
    description:
      "Query participant risk signals, financial behavior scores and confidence levels before transacting."
  },
  {
    title: "KX Trust Services",
    description:
      "Reusable trust services over Arc-compatible Jobs, starting with Risk Intelligence and Human / Agent Estimation."
  },
  {
    title: "Programmable USDC Payments",
    description:
      "Purchases and protected settlement flows run on Arc Testnet, where gas and payments use USDC."
  }
];

const workflows = [
  {
    title: "Instant Access",
    description: "Buy downloadable knowledge assets instantly with USDC.",
    steps: [
      "Creator publishes a priced resource",
      "Buyer reviews price, seller, and license",
      "Buyer pays the seller in USDC",
      "Payment confirms and the resource unlocks",
      "Receipt is available with the transaction link"
    ]
  },
  {
    title: "Jobs",
    description: "Fund custom deliverables through protected settlement.",
    steps: [
      "Buyer publishes an Arc-compatible Job",
      "Buyer funds protected settlement with USDC",
      "Provider applies and is assigned",
      "Provider submits a deliverable",
      "Buyer reviews and releases settlement"
    ]
  },
  {
    title: "Agent API",
    description: "Autonomous clients can purchase and retrieve resources with HTTP 402.",
    steps: [
      "Agent requests a protected resource",
      "API returns HTTP 402 payment instructions",
      "Agent pays the seller in USDC",
      "Payment proof is verified",
      "Agent retries and receives the structured payload"
    ]
  }
];

const developerCapabilities = [
  "TypeScript SDK",
  "Risk Intelligence APIs",
  "Risk Guard",
  "Agent API",
  "HTTP 402 Payments"
];

export default function HomePage() {
  return (
    <PageShell>
      <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-arc-blue/30 bg-arc-blue/10 px-4 py-2 text-sm font-medium text-arc-blue">
            Marketplace & Trust Layer for the Arc Agent Economy
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-white sm:text-5xl lg:text-6xl">
            KX Platform
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            The programmable trust & commerce layer for humans, autonomous agents and
            organizations.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            An Arc-compatible commerce platform that enables participants to securely exchange
            services, knowledge and work using USDC.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Discover resources, create Jobs, protect settlement, evaluate participant risk,
            integrate programmable commerce APIs and build trusted workflows with the KX SDK.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/marketplace"
              className="rounded-lg bg-arc-blue px-5 py-3 text-center text-sm font-semibold text-arc-ink transition hover:bg-white"
            >
              Explore Marketplace
            </Link>
            <Link
              href="/publish-resource"
              className="rounded-lg border border-arc-border bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-arc-blue"
            >
              Publish Resource
            </Link>
          </div>
          <p className="mt-5 max-w-xl rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            This is an unaudited Arc Testnet preview. Gas is paid in USDC. Do not use real funds,
            private data, confidential content, or regulated information.
          </p>
        </div>

        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5 shadow-glow">
          <div className="rounded-lg border border-arc-border bg-black/20 p-5">
            <div className="mb-6 flex items-center justify-center rounded-lg border border-arc-border bg-gradient-to-br from-brand-purple/15 via-brand-blue/10 to-brand-cyan/15 p-8">
              <LogoMark
                idPrefix="home-hero-logo"
                className="brand-cube-spin h-32 w-32 sm:h-40 sm:w-40"
                title="KX geometric cube mark"
                size={160}
              />
            </div>
            <p className="text-sm font-medium uppercase tracking-normal text-arc-blue">
              How it works
            </p>
            <div className="mt-5 grid gap-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.title}
                  className="rounded-lg border border-arc-border bg-white/5 p-4"
                >
                  <p className="text-sm font-semibold text-white">{workflow.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{workflow.description}</p>
                </div>
              ))}
            </div>
            <Link
              href="/walkthrough"
              className="mt-5 inline-flex rounded-lg border border-arc-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-arc-blue"
            >
              View product walkthrough
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-white">Built for human and agent buyers</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Humans and agents need commerce that is discoverable, priced, protected, programmable
            and measurable. KX brings marketplace listings, protected transactions,
            Agent API flows and KX Trust Services into one platform built on Arc.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-lg border border-arc-border bg-arc-panel/80 p-5"
            >
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-8">
        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase tracking-normal text-arc-blue">
                Developer Platform
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Developer Platform</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Integrate KX capabilities into your own applications and
                autonomous agents.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {developerCapabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full border border-arc-border bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/agent-api"
              className="inline-flex shrink-0 rounded-lg border border-arc-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-arc-blue"
            >
              View Developer Docs
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div>
          <h2 className="text-2xl font-semibold text-white">How each workflow works</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            The product supports direct resource purchases, agent-facing paid API access, custom
            requests backed by protected transactions, and participant risk signals.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <article
                key={workflow.title}
                className="rounded-lg border border-arc-border bg-arc-panel/80 p-5"
              >
                <h3 className="text-lg font-semibold text-white">{workflow.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{workflow.description}</p>
                <ol className="mt-4 grid gap-3">
                  {workflow.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-6 text-slate-300">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-arc-border bg-white/5 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <p className="text-sm font-medium uppercase tracking-normal text-arc-blue">
            Built for agents
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Developer documentation for agents
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Autonomous clients can search resources, receive HTTP 402 payment instructions, submit
            transaction proofs, and retrieve structured payloads after verification.
          </p>
          <Link
            href="/agent-api"
            className="mt-5 inline-flex rounded-lg border border-arc-border bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-arc-blue"
          >
            Explore Agent API
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

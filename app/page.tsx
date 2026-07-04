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
    icon: "🛡",
    title: "Trust Engine",
    description:
      "Analyze wallets, generate Signed Trust Snapshots and understand trust before transacting."
  },
  {
    icon: "⚖️",
    title: "Trust Policies",
    description:
      "Apply programmable trust policies to decide whether to allow, review or block interactions."
  },
  {
    icon: "🤝",
    title: "Commerce Platform",
    description:
      "Buy resources, complete Jobs and integrate Agent APIs using Arc-native settlement."
  }
];

const developerCapabilities = [
  "Trust Score API",
  "Risk Intelligence APIs",
  "Trust Policy Engine",
  "Signed Trust Snapshots",
  "Trust Attestations",
  "TypeScript SDK"
];

const arcProvides = ["Identity", "Jobs", "Reputation", "Validation", "Settlement"];

const kxProvides = [
  "Trust Engine",
  "Risk Intelligence",
  "Human / Agent Estimation",
  "Signed Trust Snapshots",
  "Trust Policy Engine",
  "Trust Attestations"
];

const trustArchitectureInputs = [
  { icon: "👤", label: "Humans" },
  { icon: "🤖", label: "Agents" },
  { icon: "🛒", label: "Marketplace" },
  { icon: "🔒", label: "Escrow" },
  { icon: "⚙️", label: "External Apps" }
];

const trustLayerCapabilities = [
  "Trust Engine",
  "Trust Policies",
  "Signed Trust Snapshots",
  "APIs & SDK"
];

const arcSettlementLayer = [
  "Arc Identity Contracts",
  "Arc Jobs",
  "Arc Settlement",
  "KX Trust Attestation Registry"
];

function DownConnector() {
  return (
    <div className="flex justify-center py-3" aria-hidden="true">
      <div className="flex h-10 flex-col items-center">
        <span className="h-8 w-px bg-gradient-to-b from-brand-purple via-brand-blue to-brand-cyan" />
        <span className="-mt-1 text-sm text-brand-cyan">↓</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PageShell>
      <section className="grid gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-arc-blue/30 bg-arc-blue/10 px-4 py-2 text-sm font-medium text-arc-blue">
            KX Trust Engine
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-white sm:text-5xl lg:text-6xl">
            KX Trust Engine
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Arc-native trust infrastructure for human and agent commerce.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Understand trust before transacting. KX turns Arc-compatible commerce activity into
            Trust Scores, Risk Intelligence and Human / Agent Estimation.
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
              href="/reputation"
              className="rounded-lg border border-arc-border bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-arc-blue"
            >
              Analyze Trust
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
            <p className="mt-3 text-lg font-semibold text-white">
              Understand trust before transacting.
            </p>
            <div className="mt-5 grid gap-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.title}
                  className="rounded-lg border border-arc-border bg-white/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg" aria-hidden="true">
                      {workflow.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{workflow.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {workflow.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/walkthrough"
              className="mt-5 inline-flex rounded-lg border border-arc-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-arc-blue"
            >
              See KX in Action
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-white">Arc-native trust services</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            KX does not replace Arc. Arc remains the source of truth for native commerce
            primitives, while KX provides trust services and developer APIs around them.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
            <h3 className="text-lg font-semibold text-white">Arc provides</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {arcProvides.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-arc-border bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
            <h3 className="text-lg font-semibold text-white">KX provides</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {kxProvides.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-arc-border bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>
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
              href="/trust-services"
              className="inline-flex shrink-0 rounded-lg border border-arc-border bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-arc-blue"
            >
              View Developer Docs
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div>
          <h2 className="text-2xl font-semibold text-white">KX platform layers</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            KX combines trust analysis, programmable policy decisions and Arc-native commerce
            workflows in one developer-ready platform.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <article
                key={workflow.title}
                className="rounded-lg border border-arc-border bg-arc-panel/80 p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl" aria-hidden="true">
                    {workflow.icon}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{workflow.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {workflow.description}
                    </p>
                  </div>
                </div>
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

      <section className="py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-white">
              Every interaction is evaluated by the KX Trust Layer before reaching Arc.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Programmable trust for humans, agents and applications.
            </p>
          </div>

          <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5 shadow-glow">
            <div className="grid gap-3 sm:grid-cols-5">
              {trustArchitectureInputs.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-arc-border bg-white/[0.04] p-3 text-center"
                >
                  <span className="text-lg" aria-hidden="true">
                    {item.icon}
                  </span>
                  <p className="mt-2 text-xs font-semibold text-slate-200">{item.label}</p>
                </div>
              ))}
            </div>

            <DownConnector />

            <div className="rounded-lg border border-brand-blue/40 bg-gradient-to-r from-brand-purple/15 via-brand-blue/10 to-brand-cyan/15 p-5">
              <p className="text-center text-xs font-semibold uppercase tracking-normal text-brand-cyan">
                KX Trust Layer
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {trustLayerCapabilities.map((capability) => (
                  <div
                    key={capability}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center text-xs font-semibold text-white"
                  >
                    {capability}
                  </div>
                ))}
              </div>
            </div>

            <DownConnector />

            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-stretch">
              <div className="rounded-lg border border-arc-border bg-white/[0.04] p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {arcSettlementLayer.map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border border-arc-border bg-black/20 px-3 py-2 text-sm font-medium text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center rounded-lg border border-brand-cyan/40 bg-brand-cyan/10 px-5 py-4 text-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-brand-cyan">
                    Arc Network
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Identity, Jobs and Settlement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

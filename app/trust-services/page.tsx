import { CodeSnippet } from "@/components/CodeSnippet";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";

const services = [
  {
    name: "Simple Trust API",
    description:
      "One-call trust decision for external builders that need ALLOW, REVIEW or BLOCK before settlement.",
    endpoint: "GET /api/trust/wallet/:wallet",
    sdk: "client.trust(wallet)",
    useCase: "Add a trust check to an Arc dApp or agent workflow in a few minutes."
  },
  {
    name: "Trust Score API",
    description:
      "Positive evidence score for participant trust, separate from behavioral risk.",
    endpoint: "GET /api/risk/profile/:wallet",
    sdk: "client.getProfile(wallet)",
    useCase: "Show a compact trust signal before a marketplace purchase or Job assignment."
  },
  {
    name: "Risk Intelligence API",
    description:
      "Participant risk profile combining KX activity and optional Arc Network evidence.",
    endpoint: "GET /api/risk/profile/:wallet?source=combined",
    sdk: "client.getCombinedProfile(wallet)",
    useCase: "Evaluate risk tier, risk score, confidence and explainable signals."
  },
  {
    name: "Human / Agent Estimation",
    description:
      "Behavioral estimation from Arc Network activity. It does not use self-declared identity.",
    endpoint: "GET /api/risk/network/:wallet",
    sdk: "client.getNetworkProfile(wallet)",
    useCase: "Understand whether wallet behavior looks human, agent-like, mixed or unknown."
  },
  {
    name: "Trust Policy Engine",
    description:
      "Explainable ALLOW, REVIEW or BLOCK decisions under built-in trust policies.",
    endpoint: "POST /api/trust/policy/evaluate",
    sdk: "client.evaluateTrustPolicy(wallet, policyId)",
    useCase: "Gate transactions, Job assignments or agent workflows with clear rationale."
  },
  {
    name: "Signed Trust Snapshots",
    description:
      "Automatically generated signed off-chain trust reports stored in PostgreSQL.",
    endpoint: "GET /api/risk/snapshots/:wallet",
    sdk: "client.listTrustSnapshots(wallet)",
    useCase: "Verify the integrity and signer of the latest KX trust analysis."
  },
  {
    name: "Trust Attestations",
    description:
      "Manual TEST publication of selected signed snapshots to Arc Testnet.",
    endpoint: "POST /api/risk/snapshots/:wallet",
    sdk: "client.publishTrustSnapshot(wallet, { mode: \"test\" })",
    useCase: "Certify a selected snapshot on-chain during testnet validation."
  },
  {
    name: "TypeScript SDK",
    description:
      "Repository-local SDK for Risk Intelligence, snapshots, attestations and policy checks.",
    endpoint: "GET /api/agent-capabilities",
    sdk: "RiskIntelligenceClient",
    useCase: "Integrate KX Trust Engine capabilities into apps, scripts and autonomous agents."
  }
];

const trustSnippet = `const trust = await client.trust(wallet);

if (trust.allow) {
  continueTransaction();
}`;

export default function TrustServicesPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Developer catalog"
        title="Trust Services"
        description="Reusable KX Trust Engine services for builders, operators and autonomous agents."
      />

      <section className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
        <p className="max-w-3xl text-sm leading-6 text-slate-400">
          Arc provides Identity, Jobs, Reputation, Validation and Settlement. KX provides the Trust
          Engine layer: Risk Intelligence, Human / Agent Estimation, Signed Trust Snapshots, Trust
          Policy decisions and experimental Trust Attestations.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <h2 className="text-lg font-semibold text-white">Integrate trust in 5 minutes</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Arc executes settlement. KX helps builders decide whether a wallet should proceed,
              be reviewed, or be blocked before the transaction continues.
            </p>
          </div>
          <CodeSnippet code={trustSnippet} />
        </div>
        <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          This is not KYC, AML, compliance screening or identity verification. Trust Attestation
          publishing is manual TEST mode for Arc Testnet.
        </p>
      </section>

      <section className="mt-6 grid gap-4">
        {services.map((service) => (
          <article
            key={service.name}
            className="rounded-lg border border-arc-border bg-arc-panel/80 p-5"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr] lg:items-start">
              <div>
                <h2 className="text-lg font-semibold text-white">{service.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{service.description}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  <span className="text-slate-500">Use case:</span> {service.useCase}
                </p>
              </div>
              <dl className="grid gap-3 text-sm">
                <div className="rounded-lg border border-arc-border bg-black/20 p-3">
                  <dt className="text-xs uppercase tracking-normal text-slate-500">API</dt>
                  <dd className="mt-1 break-all font-mono text-slate-200">{service.endpoint}</dd>
                </div>
                <div className="rounded-lg border border-arc-border bg-black/20 p-3">
                  <dt className="text-xs uppercase tracking-normal text-slate-500">SDK</dt>
                  <dd className="mt-1 break-all font-mono text-slate-200">{service.sdk}</dd>
                </div>
              </dl>
            </div>
          </article>
        ))}
      </section>
    </PageShell>
  );
}

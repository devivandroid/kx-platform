import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getEventsAsync } from "@/lib/server/reputation/reputationEventStore";
import { maskWallet } from "@/lib/server/reputation/reputationResponse";
import { ReputationLookup } from "@/app/reputation/ReputationLookup";
import { getAppBaseUrl } from "@/lib/getAppBaseUrl";
import { getEntityTypeLabel, getUserTypeLabel } from "@/lib/participants";
import {
  calculateRiskProfile,
  getUniqueRiskWallets
} from "@/lib/server/risk-intelligence/calculateRiskProfile";
import type { RiskProfile, RiskTier } from "@/lib/server/risk-intelligence/types";

function getRiskAccent(tier: RiskTier): string {
  if (tier === "Low") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (tier === "Medium") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  if (tier === "High") return "border-red-300/40 bg-red-300/10 text-red-100";
  return "border-slate-400/30 bg-slate-400/10 text-slate-300";
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

function getParticipantDisplay(profile: RiskProfile): string {
  const type = `${getUserTypeLabel(
    profile.participant.userType === "unknown" ? undefined : profile.participant.userType
  )} / ${getEntityTypeLabel(
    profile.participant.entityType === "unknown" ? undefined : profile.participant.entityType
  )}`;
  return profile.participant.name ? `${profile.participant.name} - ${type}` : type;
}

export default async function ReputationPage() {
  const appBaseUrl = getAppBaseUrl();
  const events = await getEventsAsync();
  const profiles = getUniqueRiskWallets(events)
    .map((wallet) => calculateRiskProfile(wallet, events))
    .sort(
      (a, b) =>
        (b.scores.financialBehaviorScore ?? -1) - (a.scores.financialBehaviorScore ?? -1)
    );
  const totalVolume = profiles.reduce(
    (sum, profile) => sum + Number(profile.activity.totalCompletedVolumeUSDC),
    0
  );
  const verifiedPayments = events.filter((event) => event.eventType === "PAYMENT_VERIFIED").length;
  const completedEscrows = events.filter((event) => event.eventType === "FUNDS_RELEASED").length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Risk Intelligence"
        title="Risk Intelligence"
        description="Risk and reputation signals for humans, agents and organizations participating in KX activity on Arc."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Wallets tracked", profiles.length],
          ["Total volume", `${totalVolume.toFixed(2)} USDC`],
          ["Verified payments", verifiedPayments],
          ["Completed settlements", completedEscrows]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-arc-border bg-arc-panel/80 p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {profiles[0] ? (
        <section className="mt-6 rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Risk Intelligence snapshot</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Preview participant monitoring for marketplace activity, transaction behavior and
                confidence signals.
              </p>
            </div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRiskAccent(
                profiles[0].scores.riskTier
              )}`}
            >
              {profiles[0].scores.riskTier} risk example
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Financial Behavior Score", profiles[0].scores.financialBehaviorScore],
              ["Risk Score", profiles[0].scores.riskScore],
              ["Confidence Level", profiles[0].scores.confidenceLevel],
              ["Activity Level", profiles[0].activity.activityLevel],
              ["Completed Volume", `${profiles[0].activity.totalCompletedVolumeUSDC} USDC`],
              ["Completed Actions", profiles[0].activity.completedActions],
              ["Last Activity", formatDate(profiles[0].activity.lastActivity ?? null)],
              ["Evidence Count", profiles[0].activity.evidenceCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-arc-border bg-black/20 p-4">
                <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-arc-border bg-arc-panel/80 p-5">
        <h2 className="text-xl font-semibold text-white">Participant risk profiles</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Participant-aware risk profiles based on KX activity and optional Arc
          Testnet RPC signals. This is not an official Arc or Circle score and does not score all
          Arc wallets.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-arc-border">
          {profiles.map((profile) => (
            <div
              key={profile.wallet}
              className="grid gap-3 border-b border-arc-border bg-black/20 p-4 text-sm last:border-b-0 md:grid-cols-[1.4fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr]"
            >
              <span>
                <span className="block font-semibold text-white">
                  {getParticipantDisplay(profile)}
                </span>
                <span className="text-xs text-slate-500">{maskWallet(profile.wallet)}</span>
              </span>
              <span>Behavior {profile.scores.financialBehaviorScore}</span>
              <span>Risk {profile.scores.riskScore}</span>
              <span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskAccent(
                    profile.scores.riskTier
                  )}`}
                >
                  {profile.scores.riskTier}
                </span>
              </span>
              <span>{profile.scores.confidenceLevel} confidence</span>
              <span>{profile.activity.totalCompletedVolumeUSDC} USDC</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <ReputationLookup />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <h2 className="text-xl font-semibold text-white">Methodology</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            The financial behavior score starts at 500 and moves up for successful payments,
            verified payments, downloads, funded settlements, submitted deliverables, released funds,
            consistent activity, counterparty diversity and completed volume. The preview model
            reduces score for request cancellations and purchase starts without completion.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Risk score ranges from 0 to 100, where 0 is lowest observed risk in this preview model.
            Low is 0-24, Medium is 25-59, High is 60-100, and Unknown means insufficient evidence.
            Confidence is Low below 5 events, Medium from 5 to 20 events, and High above 20 events.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Reputation remains part of the underlying signal model, but the product surface is Risk
            Intelligence for builders that need wallet profiles, confidence levels and explainable
            behavior signals.
          </p>
        </div>

        <div className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <h2 className="text-xl font-semibold text-white">Risk Intelligence API Documentation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Builders, human operators and AI agents can query Internal, Arc Network or Combined
            Risk Intelligence profiles, inspect marketplace activity, participant context,
            behavioral signals and model methodology.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs leading-6 text-slate-300">
            {`curl ${appBaseUrl}/api/risk/profile/0x...
curl ${appBaseUrl}/api/risk/profile/0x...?source=internal
curl ${appBaseUrl}/api/risk/network/0x...?useIndexedData=true
curl ${appBaseUrl}/api/risk/profile/0x...?source=combined&useIndexedData=true
curl ${appBaseUrl}/api/risk/summary/0x...
curl ${appBaseUrl}/api/risk/signals/0x...
curl ${appBaseUrl}/api/risk/model
curl ${appBaseUrl}/api/risk/participants`}
          </pre>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Arc Network reads use indexed data by default when a snapshot is less than 1 minute old. Set
            {" "}useIndexedData=false to force a live refresh. Backward-compatible reputation
            endpoints remain available at /api/reputation/*.
          </p>
          <div className="mt-4 rounded-lg border border-arc-border bg-black/20 p-3">
            <p className="text-sm font-semibold text-white">Builder SDK</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Internal TypeScript client and examples are available in
              {" "}lib/sdk/risk-intelligence and examples/risk-intelligence.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs leading-6 text-slate-300">
              {`const client = new RiskIntelligenceClient({ baseUrl: "${appBaseUrl}" });
const summary = await client.getSummary(wallet);`}
            </pre>
          </div>
          <div className="mt-4 rounded-lg border border-arc-border bg-black/20 p-3">
            <p className="text-sm font-semibold text-white">Risk Guard</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Apps and agents can apply their own risk policy before transacting. Risk Guard is not
              compliance screening; it is a pre-transaction helper based on KX activity.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs leading-6 text-slate-300">
              {`await client.canTransactWith(wallet, {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});`}
            </pre>
          </div>
          <div className="mt-4 rounded-lg border border-sky-300/25 bg-sky-300/10 p-3">
            <p className="text-sm font-semibold text-sky-100">Unknown wallets and no-data profiles</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              A wallet with no KX activity returns profileStatus = no_data,
              riskTier = Unknown and null numeric scores. No data is not high risk. Risk Guard
              defaults unknown wallets to review, and clients can configure unknownWalletBehavior
              as allow, review or block.
            </p>
          </div>
          <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
            Scope limitation: this is a preview risk model based on KX activity and
            limited Arc Testnet RPC signals when available. It is not an official Arc or Circle
            score, does not score all Arc wallets and is not AML/KYC/compliance screening. The
            current Arc Network adapter does not include a full indexer, so wallet age, unique
            counterparties and detailed historical contract interactions remain roadmap items.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

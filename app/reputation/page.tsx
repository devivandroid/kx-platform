import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getEventsAsync } from "@/lib/server/reputation/reputationEventStore";
import { maskWallet } from "@/lib/server/reputation/reputationResponse";
import { ReputationLookup } from "@/app/reputation/ReputationLookup";
import { getAppBaseUrl } from "@/lib/getAppBaseUrl";
import { getEntityTypeLabel, getUserTypeLabel } from "@/lib/participants";
import { ParticipantRiskProfiles } from "@/app/reputation/ParticipantRiskProfiles";
import {
  calculateRiskProfile,
  getUniqueRiskWallets
} from "@/lib/server/risk-intelligence/calculateRiskProfile";
import type { RiskProfile } from "@/lib/server/risk-intelligence/types";

export const dynamic = "force-dynamic";

function getParticipantDisplay(profile: RiskProfile): string {
  const userType =
    profile.participant.kxDeclaredUserType && profile.participant.kxDeclaredUserType !== "unknown"
      ? getUserTypeLabel(profile.participant.kxDeclaredUserType)
      : "Not declared";
  const type = `${userType} / ${getEntityTypeLabel(
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
  const participantProfileRows = profiles.map((profile) => ({
    wallet: profile.wallet,
    displayName: getParticipantDisplay(profile),
    maskedWallet: maskWallet(profile.wallet),
    financialBehaviorScore: profile.scores.financialBehaviorScore,
    trustScore: profile.scores.trustScore ?? profile.scores.financialBehaviorScore,
    riskScore: profile.scores.riskScore,
    riskTier: profile.scores.riskTier,
    confidenceLevel: profile.scores.confidenceLevel,
    completedVolumeUSDC: profile.activity.totalCompletedVolumeUSDC
  }));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Risk Intelligence module"
        title="KX Trust Engine"
        description="Understand trust before transacting."
      />

      <div>
        <ReputationLookup />
      </div>

      <ParticipantRiskProfiles profiles={participantProfileRows} />

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <details className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Methodology</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Scoring model, confidence levels and model limitations.
                </p>
              </div>
              <span className="rounded-full border border-slate-500/40 px-3 py-1 text-xs text-slate-300">
                Show details
              </span>
            </div>
          </summary>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            The Trust Score reflects positive evidence such as successful payments,
            verified payments, downloads, funded settlements, submitted deliverables, released funds,
            consistent activity, counterparty diversity and completed volume.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Risk Score ranges from 0 to 100, where lower is safer in this preview model.
            Low is 0-24, Medium is 25-59, High is 60-100, and Unknown means insufficient evidence.
            Analysis Confidence describes evidence quality, not publication eligibility.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Reputation remains part of the underlying signal model, but the product surface is Risk
            Intelligence for builders that need wallet profiles, confidence levels and explainable
            behavior signals.
          </p>
        </details>

        <details className="rounded-lg border border-arc-border bg-arc-panel/80 p-5">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">API / SDK Documentation</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Public Risk Intelligence endpoints and SDK examples for builders.
                </p>
              </div>
              <span className="rounded-full border border-slate-500/40 px-3 py-1 text-xs text-slate-300">
                Show details
              </span>
            </div>
          </summary>
          <p className="mt-4 text-sm leading-6 text-slate-400">
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
        </details>
      </section>
    </PageShell>
  );
}

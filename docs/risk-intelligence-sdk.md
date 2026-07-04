# KX Trust Engine SDK

The KX Trust Engine SDK exposes participant-aware risk profiles for
wallets observed in KX activity. The internal TypeScript SDK wraps the public
`/api/risk/*` routes so builders and agent workflows can integrate them without hand-writing
fetch calls.

This SDK is kept inside the repository for now. It is not published to npm.

## What The Service Provides

- Full participant risk profiles.
- Arc Network Activity Adapter profiles.
- Combined KX + Arc Network profiles.
- Compact summaries for lightweight checks.
- Behavioral signals and risk signals.
- Scoring methodology, tiers and confidence rules.
- Seed/demo participant profiles.
- No-data profile handling for unknown wallets.
- Risk Guard pre-transaction decisions.
- Trust Policy Engine decisions over signed Trust Snapshot evidence.

## Use From This Repository

```ts
import {
  RiskIntelligenceClient,
  recoverTrustSnapshotSigner,
  verifyReportHash,
  verifyTrustSnapshot
} from "@/lib/sdk/risk-intelligence";

const client = new RiskIntelligenceClient({
  baseUrl: "https://kx-platform.fly.dev"
});
```

For local development:

```ts
const client = new RiskIntelligenceClient({
  baseUrl: "http://localhost:3000"
});
```

## API Methods

```ts
const profile = await client.getProfile(wallet);
const network = await client.getNetworkProfile(wallet);
const combined = await client.getCombinedProfile(wallet);
const refreshedNetwork = await client.getNetworkProfile(wallet, {
  useIndexedData: false
});
const summary = await client.getSummary(wallet);
const signals = await client.getSignals(wallet);
const participants = await client.listParticipants({ limit: 10 });
const snapshots = await client.listTrustSnapshots(wallet);
const verified = verifyTrustSnapshot(snapshots.latest);
const hashMatches = verifyReportHash(snapshots.latest);
const signer = snapshots.latest ? recoverTrustSnapshotSigner(snapshots.latest) : null;
const model = await client.getModel();
const guard = await client.evaluateTransactionRisk(wallet, {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});
const policyDecision = await client.evaluateTrustPolicy(wallet, "enterprise-strict");
```

Available methods:

- `getProfile(wallet)` calls `GET /api/risk/profile/:wallet`.
- `getNetworkProfile(wallet, options)` calls `GET /api/risk/network/:wallet`.
- `getCombinedProfile(wallet, options)` calls `GET /api/risk/profile/:wallet?source=combined`.
- `getSummary(wallet)` calls `GET /api/risk/summary/:wallet`.
- `getSignals(wallet)` calls `GET /api/risk/signals/:wallet`.
- `listTrustSnapshots(wallet, limit?)` calls `GET /api/risk/snapshots/:wallet`.
- `publishTrustSnapshot(wallet, options?)` calls `POST /api/risk/snapshots/:wallet`.
- `getModel()` calls `GET /api/risk/model`.
- `listParticipants(params)` calls `GET /api/risk/participants`.
- `evaluateTransactionRisk(wallet, policy)` calls `POST /api/risk/guard`.
- `evaluateTrustPolicy(wallet, policyId, options?)` calls `POST /api/trust/policy/evaluate`.
- `canTransactWith(wallet, policy)` returns `true` when Risk Guard returns `allow`.
- `isRiskAtOrBelow(wallet, maxRiskScore)` returns `true` when `riskScore <= maxRiskScore`.
- `isRiskBelow(wallet, riskScore)` returns `true` when the wallet risk score is below the provided threshold.
- `isRiskAbove(wallet, riskScore)` returns `true` when the wallet risk score is above the provided threshold.
- `hasRiskData(wallet)` returns `false` only when `profileStatus === "no_data"`.

Threshold helpers return `false` for no-data profiles because there is no numeric risk score.

Arc Network reads use indexed data by default when a snapshot is less than 1 minute old. Pass
`{ useIndexedData: false }` to force a fresh Arc Network refresh for the requested wallet.

Risk profile responses may include `identityEstimation`, a Human / Agent behavioral estimation
based only on Arc Network activity. It uses the latest 50 wallet transactions needed for
estimation, keeps `kxDeclaredUserType`, `arcDeclaredIdentity` and `estimatedUserType` separate,
includes `identityMatch` only when a comparable declared identity exists, and returns explainable
timing, gas-fee and counterparty signals. Transaction samples are replaced on each fresh reindex
and are not accumulated as long-term behavioral history. This is estimation, not identity
verification, KYC, AML, compliance screening or bot detection certainty.
Mixed or conflicting evidence returns `Mixed / Inconclusive`; missing evidence returns `Unknown`.

`listParticipants` supports:

- `limit`
- `riskTier`
- `userType`
- `entityType`
- `participantType` as a legacy alias for older clients

## Example Use Cases

### Risk Guard

Risk Guard helps apps and autonomous agents validate participant risk before transacting. It does
not decide for the user; it applies the client application's own policy to the current preview
Risk Intelligence profile.

Endpoint:

```txt
POST /api/risk/guard
```

```ts
const allowed = await client.canTransactWith(wallet, {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  allowUnknownParticipantType: false,
  unknownWalletBehavior: "review"
});
```

Risk Guard is not compliance screening and is based only on KX activity.

Developers who need the full `allow | review | block` distinction should call
`evaluateTransactionRisk`. `canTransactWith` returns `true` only for `allow`; `review` and
`block` both return `false`.

### Trust Policy Engine

The KX Trust Policy Engine is a decision layer over Arc + KX Trust Engine evidence. It answers
whether a wallet should be `ALLOW`, `REVIEW` or `BLOCK` under a selected policy.

Endpoint:

```txt
POST /api/trust/policy/evaluate
```

Built-in policies:

- `basic-safe`
- `human-preferred`
- `agent-safe`
- `enterprise-strict`

```ts
const decision = await client.evaluateTrustPolicy(wallet, "human-preferred", {
  amountUSDC: "250",
  context: "marketplace_purchase"
});
```

The response includes `decision`, `reasons`, `passedRules`, `failedRules`, `trustSnapshot`,
`reportHash` and `signatureStatus`. This is a configurable policy decision, not identity
verification, KYC, AML or compliance approval.

### Unknown Wallets And No-Data Profiles

Risk Intelligence is currently based on KX activity. A wallet with no observed
activity returns:

```json
{
  "profileStatus": "no_data",
  "scores": {
    "financialBehaviorScore": null,
    "riskScore": null,
    "riskTier": "Unknown",
    "confidenceLevel": "Low"
  },
  "message": "No KX activity was found for this wallet.",
  "recommendation": "Missing data is not negative evidence. Apply your own policy or request additional verification before transacting."
}
```

No data is not high risk. Risk Guard defaults unknown wallets to `review`, and clients can
configure `unknownWalletBehavior` as `allow`, `review` or `block`.

### Arc Reputation And Validations

Risk profile, summary and signal responses may include `arcReputation` and `arcValidations`
when the KX deployment is configured with official Arc registry addresses, official ABI JSON
and official read methods.

KX does not bundle invented ReputationRegistry or ValidationRegistry ABIs. If those registry
settings are missing, the fields return a clear `not_configured`, `abi_unavailable` or
`method_unavailable` status instead of guessing.

KX ratings remain separate as KX Commercial Rating. Arc Reputation and Arc Validations are
registry-sourced evidence and should not be interpreted as KYC, AML or compliance screening
unless the registry data explicitly provides that meaning.

### Trust Snapshots

KX stores an off-chain Trust Snapshot whenever a wallet is analyzed. In developer surfaces this is
the Trust Attestation foundation: the snapshot contains the wallet, risk score, risk tier,
Human / Agent Estimation result, confidence, evidence source, signal summary, engine version,
timestamps, `reportHash`, and future on-chain attestation fields.

```ts
const history = await client.listTrustSnapshots(wallet);
const latest = history.latest;
```

Snapshots are persisted in PostgreSQL when `DATABASE_URL` is configured. They are not published
on-chain yet, and they are not identity verification, KYC, AML or compliance screening.

### Experimental Trust Attestation Publishing

Eligible Trust Snapshots can be published manually to Arc Testnet through the
`KXTrustAttestationRegistry` foundation contract. This is an experimental testnet flow.

```ts
const snapshots = await client.listTrustSnapshots(wallet);

if (snapshots.latest?.attestationStatus === "eligible") {
  const publication = await client.publishTrustSnapshot(wallet, {
    snapshotId: snapshots.latest.id
  });
  console.log(publication.explorerUrl);
}
```

Publishing is signed by the configured KX publisher wallet on the backend, not by the analyzed
wallet or website visitor. Required server variables:

```env
KX_ATTESTATION_REGISTRY_ADDRESS=
KX_ATTESTATION_PUBLISHER_PRIVATE_KEY=
```

PostgreSQL stores the complete signed Trust Snapshot history. The registry stores only minimal
fields: wallet, report hash, risk tier, Human / Agent probability, confidence, engine version,
optional evidence URI and timestamp. It does not store the full report and does not provide
identity verification, KYC, AML or compliance screening.

Read decoded on-chain attestations:

```ts
const byId = await client.getAttestation("0");
const latest = await client.getLatestAttestation(wallet);
const walletHistory = await client.getWalletAttestations(wallet);
```

Temporary Arc Testnet validation mode:

```ts
await client.publishTrustSnapshot(wallet, {
  snapshotId: snapshots.latest?.id,
  mode: "test"
});
```

`mode: "test"` bypasses production eligibility rules and labels the registry payload as
`Test Attestation - Arc Testnet`. This is for testnet only and must be disabled before production.

```ts
const decision = await client.evaluateTransactionRisk(wallet, {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});

if (decision.decision === "allow") {
  // Continue transaction.
}

if (decision.decision === "review") {
  // Ask for human confirmation or additional evidence.
}

if (decision.decision === "block") {
  // Do not proceed.
}
```

### Marketplace Pre-Check

```ts
const summary = await client.getSummary(sellerWallet);

if (summary.summary.riskTier === "High") {
  // Route to manual review before showing a direct purchase path.
}
```

### Autonomous Agent Commerce

```ts
const [summary, signals] = await Promise.all([
  client.getSummary(sellerWallet),
  client.getSignals(sellerWallet)
]);

const elevatedSignal = signals.riskSignals.some((signal) => signal.severity === "Elevated");
const canProceed = summary.summary.riskTier !== "High" && !elevatedSignal;
```

### Participant Directory

```ts
const participants = await client.listParticipants({
  limit: 10,
  userType: "AGENT",
  entityType: "INDIVIDUAL"
});
```

## Compact Summary Response

```json
{
  "ok": true,
  "scope": "KX activity only",
  "wallet": "0x...",
  "participant": {
    "type": "agent",
    "userType": "AGENT",
    "entityType": "INDIVIDUAL",
    "name": "ResearchAgent-01",
    "operatorAddress": "0x..."
  },
  "summary": {
    "financialBehaviorScore": 860,
    "riskScore": 14,
    "riskTier": "Low",
    "confidenceLevel": "Medium",
    "activityLevel": "Normal",
    "totalCompletedVolumeUSDC": "128.50",
    "completedActions": 18,
    "lastActivity": "2026-06-24T10:00:00.000Z",
    "evidenceCount": 18
  }
}
```

## Examples

Example scripts live in `examples/risk-intelligence/`:

- `basic-profile.ts`
- `lightweight-check.ts`
- `agent-commerce-check.ts`
- `list-participants.ts`
- `risk-guard-basic.ts`
- `no-data-wallet.ts`
- `pre-transaction-check.ts`
- `risk-guard-unknown-wallet.ts`
- `threshold-helpers.ts`

They use `https://kx-platform.fly.dev` by default. Set `RISK_API_BASE_URL` to use a
local server:

```bash
RISK_API_BASE_URL=http://localhost:3000
```

## Limitations

- KX activity only.
- Preview model.
- Not an official Arc or Circle score.
- Not AML, KYC, sanctions, fraud or compliance screening.
- No authentication or API keys yet.
- No billing, rate limits or production SLA yet.
- Seed/demo participants are for public testnet preview only.

## Arc Network Activity Adapter

The current adapter can enrich profiles with Arc Testnet RPC signals such as transaction count,
native USDC balance, account code and latest observed block context. It does not include a full
network indexer yet.

Future versions may add wallet age, unique counterparties, last network activity, historical
contract interaction count, indexed ERC-20 activity and richer network activity levels. This does
not imply official Arc/Circle coverage, all-wallet scoring or AML/KYC/compliance screening.

# KX Trust Engine SDK

Internal TypeScript client for KX Trust Engine APIs.

Profiles may include `arcReputation` and `arcValidations` when the deployed API is configured
with official Arc registry addresses, official ABI JSON and official read methods. KX does not
guess registry ABIs or replace Arc Reputation/Validation; KX Commercial Rating remains separate.

This SDK is kept inside the repository for now. It is not published to npm and does not add
authentication, API keys, billing, rate limits or production compliance screening.

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

const profile = await client.getProfile("0x...");
const network = await client.getNetworkProfile("0x...");
const combined = await client.getCombinedProfile("0x...");
const refreshedNetwork = await client.getNetworkProfile("0x...", {
  useIndexedData: false
});
const summary = await client.getSummary("0x...");
const signals = await client.getSignals("0x...");
const trustSnapshots = await client.listTrustSnapshots("0x...");
const verified = trustSnapshots.latest
  ? verifyTrustSnapshot(trustSnapshots.latest)
  : false;
const hashMatches = trustSnapshots.latest
  ? verifyReportHash(trustSnapshots.latest)
  : false;
const signer = trustSnapshots.latest
  ? recoverTrustSnapshotSigner(trustSnapshots.latest)
  : null;
const published = await client.publishTrustSnapshot("0x...", {
  snapshotId: trustSnapshots.latest?.id,
  mode: "test"
});
const latestOnChain = await client.getLatestAttestation("0x...");
const participants = await client.listParticipants({ limit: 10 });
const model = await client.getModel();
const guard = await client.evaluateTransactionRisk("0x...", {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});
const policyDecision = await client.evaluateTrustPolicy("0x...", "basic-safe");
```

## Methods

- `getProfile(wallet)` returns the full combined participant risk profile.
- `getNetworkProfile(wallet, options)` returns the Arc Testnet activity profile.
- `getCombinedProfile(wallet, options)` explicitly requests the combined profile.
- `getSummary(wallet)` returns a compact profile for lightweight integrations.
- `getSignals(wallet)` returns behavioral and risk signals only.
- `listTrustSnapshots(wallet, limit?)` returns the latest and historical Trust Snapshots.
- `publishTrustSnapshot(wallet, options?)` publishes an eligible or test Trust Snapshot to the experimental Arc Testnet registry.
- `getAttestation(id)` reads a decoded on-chain Trust Attestation by id.
- `getLatestAttestation(wallet)` reads the latest decoded on-chain Trust Attestation for a wallet.
- `getWalletAttestations(wallet)` reads all decoded on-chain Trust Attestations for a wallet.
- `getModel()` returns scoring methodology, tiers, confidence rules and limitations.
- `listParticipants(params)` returns seeded/demo participant summaries.
- `evaluateTransactionRisk(wallet, policy)` applies a client-defined Risk Guard policy.
- `evaluateTrustPolicy(wallet, policyId, options?)` evaluates `ALLOW`, `REVIEW` or `BLOCK` under a built-in KX trust policy.
- `canTransactWith(wallet, policy)` returns `true` only when Risk Guard allows the transaction.
- `isRiskAtOrBelow(wallet, maxRiskScore)` checks a simple risk score threshold.
- `isRiskBelow(wallet, riskScore)` checks whether a numeric risk score is below a threshold.
- `isRiskAbove(wallet, riskScore)` checks whether a numeric risk score is above a threshold.
- `hasRiskData(wallet)` returns `false` only for `profileStatus === "no_data"`.

Arc Network reads prefer indexed data by default when a snapshot is less than 1 minute old. Pass
`{ useIndexedData: false }` to force a fresh Arc Network refresh for a wallet.

Responses can include `identityEstimation`, a Human / Agent behavioral estimation derived only
from Arc Network evidence. It uses the latest 50 wallet transactions needed for estimation,
keeps `kxDeclaredUserType`, `arcDeclaredIdentity` and `estimatedUserType` separate, and includes
`identityMatch` only when a comparable declared identity is available.
Fresh reindexing replaces the prior transaction sample instead of accumulating old samples.
Mixed or conflicting evidence returns `Mixed / Inconclusive`; missing evidence returns `Unknown`.
Treat it as an explainable estimation, not identity verification or compliance screening.

## Trust Snapshots

Every Risk Intelligence analysis can create an off-chain KX Trust Snapshot when PostgreSQL is
configured. Developer APIs expose this as a Trust Attestation foundation for future on-chain
publication.

```ts
const { latest, snapshots } = await client.listTrustSnapshots("0x...");
```

Snapshots include `reportHash`, confidence, evidence source, signal summary and attestation fields
such as `attestationTxHash`, `attestationRegistryAddress`, `attestationStatus` and `publishedAt`.
They also include `schemaVersion`, `signature`, `signerAddress`, `signingAlgorithm` and `signedAt`
so builders can verify integrity without writing to the blockchain.

Eligible snapshots can be manually published as experimental Arc Testnet Trust Attestations when
the backend has `KX_ATTESTATION_REGISTRY_ADDRESS` and
`KX_ATTESTATION_PUBLISHER_PRIVATE_KEY` configured.

```ts
const history = await client.listTrustSnapshots(wallet);

if (history.latest?.attestationStatus === "eligible") {
  const publication = await client.publishTrustSnapshot(wallet, {
    snapshotId: history.latest.id
  });
  console.log(publication.txHash);
}
```

KX signs attestation publication from the configured publisher wallet; users do not sign this
backend publication transaction. The registry stores only minimal fields and the report hash, not
the full risk report.

`mode: "test"` publishes a clearly labeled `Test Attestation - Arc Testnet` and bypasses normal
eligibility rules for temporary Arc Testnet validation. Disable this mode before production.

## Risk Guard

Risk Guard helps apps and autonomous agents validate a participant before initiating a transaction.
It applies the client application's own risk policy. It is not compliance screening.

Unknown wallets default to review:

```ts
const decision = await client.evaluateTransactionRisk(wallet, {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});
```

No data is not high risk. A wallet with no observed activity returns
`profileStatus: "no_data"`, `riskTier: "Unknown"` and null numeric scores. Threshold helpers return
`false` for no-data profiles because there is no numeric risk score.

## Limitations

- Combined profiles use KX activity and limited Arc Testnet RPC activity.
- Arc Network profiles are RPC-only and do not include full indexed wallet history yet.
- Preview model.
- Not an official Arc or Circle score.
- Not AML, KYC, sanctions, fraud, or compliance screening.
- No authentication or API keys yet.

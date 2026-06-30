# Risk Intelligence SDK

Internal TypeScript client for the KX Public Risk Intelligence Service.

Profiles may include `arcReputation` and `arcValidations` when the deployed API is configured
with official Arc registry addresses, official ABI JSON and official read methods. KX does not
guess registry ABIs or replace Arc Reputation/Validation; KX Commercial Rating remains separate.

This SDK is kept inside the repository for now. It is not published to npm and does not add
authentication, API keys, billing, rate limits or production compliance screening.

```ts
import { RiskIntelligenceClient } from "@/lib/sdk/risk-intelligence";

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
const participants = await client.listParticipants({ limit: 10 });
const model = await client.getModel();
const guard = await client.evaluateTransactionRisk("0x...", {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});
```

## Methods

- `getProfile(wallet)` returns the full combined participant risk profile.
- `getNetworkProfile(wallet, options)` returns the Arc Testnet activity profile.
- `getCombinedProfile(wallet, options)` explicitly requests the combined profile.
- `getSummary(wallet)` returns a compact profile for lightweight integrations.
- `getSignals(wallet)` returns behavioral and risk signals only.
- `getModel()` returns scoring methodology, tiers, confidence rules and limitations.
- `listParticipants(params)` returns seeded/demo participant summaries.
- `evaluateTransactionRisk(wallet, policy)` applies a client-defined Risk Guard policy.
- `canTransactWith(wallet, policy)` returns `true` only when Risk Guard allows the transaction.
- `isRiskAtOrBelow(wallet, maxRiskScore)` checks a simple risk score threshold.
- `isRiskBelow(wallet, riskScore)` checks whether a numeric risk score is below a threshold.
- `isRiskAbove(wallet, riskScore)` checks whether a numeric risk score is above a threshold.
- `hasRiskData(wallet)` returns `false` only for `profileStatus === "no_data"`.

Arc Network reads prefer indexed data by default when a snapshot is less than 1 minute old. Pass
`{ useIndexedData: false }` to force a fresh Arc Network refresh for a wallet.

Responses can include `identityEstimation`, a Human / Agent behavioral estimation derived only
from Arc Network evidence. It uses the latest 50 wallet transactions needed for estimation,
keeps declared `userType` separate from `estimatedUserType`, and includes `identityMatch`.
Fresh reindexing replaces the prior transaction sample instead of accumulating old samples.
Treat it as an explainable estimation, not identity verification or compliance screening.

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

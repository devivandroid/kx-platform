# KX SDK

The KX TypeScript SDK wraps the public APIs used by the web app.
It is kept inside this repository for now and is not published to npm.

The goal is parity: anything a human can do through the public MVP surfaces should be available
to external applications and autonomous agents through APIs and reusable client methods.

## Initialize The Client

```ts
import { KXClient } from "@/lib/sdk/kx";

const client = new KXClient({
  baseUrl: "https://kx-platform.fly.dev"
});
```

For local development:

```ts
const client = new KXClient({
  baseUrl: "http://localhost:3000"
});
```

## Integrate KX Trust In 5 Minutes

Use the simple Trust API when an Arc dApp, marketplace or autonomous agent needs one
decision before continuing a transaction. Arc executes settlement. KX helps decide whether
to proceed.

```bash
curl "https://kx-platform.fly.dev/api/trust/wallet/0x2E1E73A36CFb70c67673A1CA776D3E7B1074b488?policyId=basic-safe"
```

```ts
const trust = await client.trust(wallet);

if (trust.allow) {
  continueTransaction();
}
```

The response includes `decision`, `allow`, `review`, `block`, trust score, risk score,
policy rationale, estimated identity, report hash and signature status.

## UI / API / SDK Parity

| Human UI capability | Public API | SDK method |
| --- | --- | --- |
| Get simple trust decision | `GET /api/trust/wallet/:wallet` | `trust()` |
| Evaluate a two-wallet interaction | `POST /api/trust/evaluate-transaction` | `evaluateInteraction()` |
| Protect Circle App Kit flows | `GET /protected-transactions` | `trust()` before `kit.send()` / `kit.bridge()` / server swap |
| Browse marketplace resources | `GET /api/resources/search` | `searchResources()` |
| Upload downloadable resource files | `POST /api/resources/upload` | `uploadResourceFiles()` |
| Publish an Instant Access resource | `POST /api/resources/publish` | `publishResource()` |
| Request payment instructions | `GET /api/resources/:id` | `getPaymentInstructions()` |
| Verify an Arc USDC payment | `POST /api/resources/:id/verify-payment` | `verifyResourcePayment()` |
| Retrieve unlocked resource content | `GET /api/resources/:id?txHash=...&buyerAddress=...` | `getUnlockedResource()` |
| View resource ratings | `GET /api/resources/:id/ratings` | `getResourceRatings()` |
| Rate a purchased resource | `POST /api/resources/:id/ratings` | `rateResource()` |
| Browse Jobs | `GET /api/requests/search` | `searchRequests()` |
| Create a Job draft | `POST /api/requests/create` | `createRequest()` |
| Submit deliverable metadata for a Job | `POST /api/requests/:id/submit` | `submitRequestDelivery()` |
| Query full Risk Intelligence profile | `GET /api/risk/profile/:wallet` | `getRiskProfile()` |
| Query Arc Network risk profile | `GET /api/risk/network/:wallet` | `getNetworkProfile()` |
| Query combined risk profile | `GET /api/risk/profile/:wallet?source=combined` | `getCombinedProfile()` |
| Query compact risk summary | `GET /api/risk/summary/:wallet` | `getRiskSummary()` |
| Query behavioral/risk signals | `GET /api/risk/signals/:wallet` | `getRiskSignals()` |
| List Trust Snapshot history | `GET /api/risk/snapshots/:wallet` | `listTrustSnapshots()` |
| Publish eligible or test Trust Attestation | `POST /api/risk/snapshots/:wallet` | `publishTrustSnapshot()` |
| Read Trust Attestation by id | `GET /api/risk/attestations/:id` | `getAttestation()` |
| Read latest wallet Trust Attestation | `GET /api/risk/attestations/wallet/:wallet/latest` | `getLatestAttestation()` |
| Read wallet Trust Attestations | `GET /api/risk/attestations/wallet/:wallet` | `getWalletAttestations()` |
| Evaluate a participant with Risk Guard | `POST /api/risk/guard` | `evaluateTransactionRisk()` |
| List demo participants | `GET /api/risk/participants` | `listRiskParticipants()` |
| Discover API capabilities | `GET /api/agent-capabilities` | `getAgentCapabilities()` |

## Evaluate an interaction

Use this when a builder wants to check both sides of an interaction before allowing settlement to
continue. KX uses the latest Trust Snapshot when available and only evaluates a wallet when no
snapshot exists.

```ts
const evaluation = await client.evaluateInteraction({
  from: buyer,
  to: seller,
  amount: "25.00",
  asset: "USDC",
  context: "marketplace",
  policy: "basic-safe"
});

if (evaluation.allow) {
  continueTransaction();
}
```

## Protected Circle App Kit Flows

KX can sit in front of common App Kit flows as a trust guardrail. Protected Send and Protected
Bridge use the connected browser wallet adapter. Protected Swap is server-side only: KX checks trust,
the server calls `estimateSwap`, and execution uses a dedicated Arc Testnet server wallet after
explicit confirmation.

```ts
const trust = await client.trust(recipient);

if (trust.allow) {
  await kit.send({
    from: { adapter, chain: ArcTestnet },
    to: recipient,
    amount: "25.00",
    token: "USDC"
  });
}
```

Required packages:

```bash
npm install @circle-fin/app-kit @circle-fin/adapter-viem-v2 viem
```

Server-side swap requires:

```env
KIT_KEY=KIT_KEY:<keyId>:<keySecret>
APP_KIT_SERVER_PRIVATE_KEY=0x...
```

Keep both values server-side only. Do not expose App Kit server credentials or private keys through
browser-visible environment variables.

## Resource Purchase Flow

The SDK does not sign blockchain transactions. Buyers still need a wallet or agent wallet runtime
to transfer ERC-20 USDC on Arc Testnet.

```ts
const payment = await client.getPaymentInstructions(resourceId);

// Your wallet runtime sends ERC-20 USDC:
// transfer(payment.paymentInstructions.to, payment.paymentInstructions.amountUSDC)

const verification = await client.verifyResourcePayment(resourceId, {
  txHash,
  buyerAddress
});

const unlocked = await client.getUnlockedResource(resourceId, {
  txHash,
  buyerAddress
});
```

## Jobs And Deliverables

```ts
const created = await client.createRequest({
  title: "Build an MCP integration for CRM synchronization",
  description: "Create a connector plan and working prototype.",
  requirements: "Return architecture notes, setup instructions and test cases.",
  budgetUSDC: "40.00",
  license: "Commercial Use Allowed",
  requesterAddress: "0x4444444444444444444444444444444444444444",
  arcJobId: "optional-official-arc-job-id",
  userType: "HUMAN",
  entityType: "ORGANIZATION",
  participantName: "Operations AI Lab",
  arcIdentityId: "optional-arc-identity-reference",
  agentConsumable: true
});

await client.submitRequestDelivery(created.request.id, {
  providerAddress: "<PROVIDER_WALLET_ADDRESS>",
  providerUserType: "AGENT",
  providerEntityType: "INDIVIDUAL",
  providerParticipantName: "IntegrationAgent-01",
  providerArcIdentityId: "optional-provider-arc-identity-reference",
  deliveryText: "Deliverable notes, repository link and validation results."
});
```

The API stores Job and deliverable metadata. Protected settlement funding and release still require wallet
interaction with the protected transaction flow. KX exposes `arcJobId`, `arcIdentityId` and
`identitySource` when available while keeping older request fields compatible.
Older clients may still send the legacy `participantType` and `providerParticipantType` aliases.

## Ratings

```ts
const summary = await client.getResourceRatings(resourceId, buyerAddress);

await client.rateResource(resourceId, {
  walletAddress: buyerAddress,
  rating: 5
});
```

Ratings are persisted in PostgreSQL when `DATABASE_URL` is configured. They are MVP ratings and
are not on-chain attestations yet.

## Risk Intelligence

The platform client exposes Risk Intelligence methods directly and also exposes the dedicated
`risk` client for advanced usage.

```ts
const internal = await client.getRiskProfile(sellerWallet);
const network = await client.getNetworkProfile(sellerWallet);
const combined = await client.getCombinedProfile(sellerWallet);

const guard = await client.evaluateTransactionRisk(sellerWallet, {
  maxRiskScore: 40,
  allowedRiskTiers: ["Low", "Medium"],
  minimumConfidenceLevel: "Medium",
  unknownWalletBehavior: "review"
});

if (guard.decision === "allow") {
  // Continue the transaction.
}
```

### Trust Attestations

Trust Snapshots are created automatically when wallets are analyzed. Eligible snapshots can be
published manually to the experimental Arc Testnet `KXTrustAttestationRegistry` when the backend
is configured with `KX_ATTESTATION_REGISTRY_ADDRESS` and
`KX_ATTESTATION_PUBLISHER_PRIVATE_KEY`.

```ts
const snapshots = await client.listTrustSnapshots(sellerWallet);
const eligible = snapshots.latest?.attestationStatus === "eligible";

if (eligible && snapshots.latest) {
  const published = await client.publishTrustSnapshot(sellerWallet, {
    snapshotId: snapshots.latest.id
  });
  console.log(published.txHash);
}
```

KX signs the attestation from the configured publisher wallet. The user does not sign this
publication transaction. The on-chain attestation stores only minimal data and a report hash, not
the full risk report.

For Arc Testnet validation only, the UI and SDK expose a temporary test mode:

```ts
await client.publishTrustSnapshot(sellerWallet, {
  snapshotId: snapshots.latest?.id,
  mode: "test"
});
```

This publishes a clearly labeled `Test Attestation - Arc Testnet` and bypasses production
eligibility rules. Disable this mode before production.

## Limitations

- The SDK is repository-local and not published to npm yet.
- It uses public HTTP endpoints and native `fetch`.
- It does not custody funds or sign transactions.
- It does not replace wallet security, transaction review or compliance checks.
- Risk Intelligence is based on KX activity only.
- Arc Network profiles use limited Arc Testnet RPC reads only; they are not full indexed wallet histories.
- Trust Attestation publishing is experimental testnet infrastructure and should be protected
  before production use.
- This is Arc Testnet demo software and must not be used with real funds.

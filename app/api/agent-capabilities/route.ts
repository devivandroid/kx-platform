import { NextResponse } from "next/server";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_WS_URL
} from "@/lib/chains/arcTestnet";
import { usdcAddress } from "@/lib/contracts/microWorkEscrow";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    name: "KX Agent API",
    positioning: "Marketplace & Trust Layer for the Arc Agent Economy",
    arcNative: {
      compatible: true,
      identityRegistryConfigured: Boolean(process.env.ARC_IDENTITY_REGISTRY_ADDRESS),
      jobRegistryConfigured: Boolean(process.env.ARC_JOB_REGISTRY_ADDRESS),
      reputationRegistryConfigured: Boolean(process.env.ARC_REPUTATION_REGISTRY_ADDRESS),
      validationRegistryConfigured: Boolean(process.env.ARC_VALIDATION_REGISTRY_ADDRESS),
      reputationRegistryAbiConfigured: Boolean(process.env.ARC_REPUTATION_REGISTRY_ABI_JSON),
      validationRegistryAbiConfigured: Boolean(process.env.ARC_VALIDATION_REGISTRY_ABI_JSON),
      publicTerms: ["Job", "Deliverable", "Settlement", "Identity"],
      jobModel: "KX Jobs map internally to Arc-compatible Job metadata when available.",
      identityModel:
        "Arc Identity is preferred when arcIdentityId is provided; otherwise KX uses self-declared identity metadata.",
      reputationModel:
        "Arc Reputation is consumed from the configured official registry when address, ABI and read method are provided.",
      validationModel:
        "Arc Validations are consumed from the configured official registry when address, ABI and read method are provided.",
      advancedStandards: ["ERC-8004", "ERC-8183"]
    },
    network: {
      name: "Arc Testnet",
      chainId: ARC_TESTNET_CHAIN_ID,
      chainIdHex: ARC_TESTNET_CHAIN_ID_HEX,
      rpcUrl: ARC_TESTNET_RPC_URL,
      wsUrl: ARC_TESTNET_WS_URL,
      nativeGasToken: "USDC",
      usdcAddress,
      usdcDecimals: 6
    },
    payment: {
      standard: "HTTP_402_USDC_TRANSFER",
      token: "USDC",
      tokenType: "ERC-20",
      settlement: "direct_transfer_to_seller",
      amountDecimals: 6,
      proof: {
        type: "Arc Testnet transaction hash",
        verification: "stateless_tx_receipt_check"
      }
    },
    risk_intelligence: true,
    trust_services: {
      name: "KX Trust Services",
      services: [
        "Risk Intelligence",
        "Human / Agent Estimation",
        "Arc Reputation consumption",
        "Arc Validation consumption"
      ],
      planned: ["Fraud Signals", "Compliance adapters"],
      scope: "Reusable trust services over Arc-compatible Jobs"
    },
    risk_profile_endpoint: "/api/risk/profile/{wallet}",
    risk_network_profile_endpoint: "/api/risk/network/{wallet}",
    risk_combined_profile_endpoint: "/api/risk/profile/{wallet}?source=combined",
    risk_summary_endpoint: "/api/risk/summary/{wallet}",
    risk_signals_endpoint: "/api/risk/signals/{wallet}",
    risk_guard: true,
    risk_guard_endpoint: "/api/risk/guard",
    trust_policy_engine: true,
    trust_policy_endpoint: "/api/trust/policy/evaluate",
    trust_policy_decisions: ["ALLOW", "REVIEW", "BLOCK"],
    built_in_trust_policies: [
      "basic-safe",
      "human-preferred",
      "agent-safe",
      "enterprise-strict"
    ],
    pre_transaction_risk_checks: true,
    client_defined_risk_policy: true,
    no_data_profiles: true,
    unknown_wallet_behavior: ["allow", "review", "block"],
    risk_guard_default_unknown_wallet_behavior: "review",
    no_data_is_not_high_risk: true,
    participant_risk_profiles: true,
    behavioral_signals: true,
    confidence_levels: true,
    riskIntelligence: {
      service: "KX Public Risk Intelligence Service",
      profileEndpoint: "/api/risk/profile/{wallet}",
      networkProfileEndpoint: "/api/risk/network/{wallet}",
      combinedProfileEndpoint: "/api/risk/profile/{wallet}?source=combined",
      summaryEndpoint: "/api/risk/summary/{wallet}",
      signalsEndpoint: "/api/risk/signals/{wallet}",
      trustSnapshotsEndpoint: "/api/risk/snapshots/{wallet}",
      trustAttestationPublishEndpoint: "/api/risk/snapshots/{wallet}",
      trustAttestationEndpoint: "/api/risk/attestations/{id}",
      walletTrustAttestationsEndpoint: "/api/risk/attestations/wallet/{wallet}",
      latestWalletTrustAttestationEndpoint: "/api/risk/attestations/wallet/{wallet}/latest",
      trustPolicyEndpoint: "/api/trust/policy/evaluate",
      trustAttestationPublishing: "experimental_manual_testnet",
      trustAttestationTestMode: true,
      trustAttestationRegistryConfigured: Boolean(process.env.KX_ATTESTATION_REGISTRY_ADDRESS),
      guardEndpoint: "/api/risk/guard",
      modelEndpoint: "/api/risk/model",
      participantsEndpoint: "/api/risk/participants",
      scope: "KX activity only",
      noDataProfiles: true,
      unknownWalletBehavior: ["allow", "review", "block"],
      riskGuardDefaultUnknownWalletBehavior: "review",
      noDataIsNotHighRisk: true,
      limitations: [
        "Preview risk model",
        "Not an official Arc or Circle score",
        "No authentication yet",
        "No production-grade compliance screening"
      ],
      dataSources: ["knowledge_exchange", "arc_network", "combined", "no_data"]
    },
    sdk: {
      name: "KX TypeScript SDK",
      repositoryPath: "lib/sdk/kx",
      documentation: "docs/kx-sdk.md",
      parityGoal:
        "Public APIs and SDK methods mirror the current human UI capabilities wherever wallet signing is not required."
    },
    capabilities: [
      {
        id: "search_resources",
        method: "GET",
        endpoint: "/api/resources/search",
        query: ["q", "resourceType", "category", "license", "agentConsumable"]
      },
      {
        id: "publish_resource",
        method: "POST",
        endpoint: "/api/resources/publish",
        requiredFields: [
          "title",
          "description",
          "resourceType",
          "priceUSDC",
          "license",
          "sellerAddress"
        ],
        optionalFields: [
          "userType",
          "entityType",
          "participantType",
          "participantName",
          "operatorAddress"
        ]
      },
      {
        id: "buy_resource_via_402",
        method: "GET",
        endpoint: "/api/resources/{id}",
        note: "Returns 402 Payment Required until a valid Arc Testnet USDC transfer proof is provided.",
        responseCodes: [200, 402, 404, 502]
      },
      {
        id: "downloadable_assets",
        method: "GET",
        endpoint: "/api/download/{resourceId}/{filename}",
        note: "Streams private resource files after txHash and buyerAddress pass payment verification.",
        features: ["authenticated_downloads", "file_metadata", "content_disposition_attachment"],
        responseCodes: [200, 402, 403, 404, 502]
      },
      {
        id: "get_resource_ratings",
        method: "GET",
        endpoint: "/api/resources/{id}/ratings",
        query: ["walletAddress"],
        note: "Returns the resource rating summary and optional current-wallet rating.",
        responseCodes: [200]
      },
      {
        id: "rate_resource",
        method: "POST",
        endpoint: "/api/resources/{id}/ratings",
        requiredFields: ["walletAddress", "rating"],
        note: "Stores or updates one rating per wallet and resource. Purchase eligibility is enforced by the client UI in this MVP.",
        responseCodes: [201, 400]
      },
      {
        id: "query_wallet_risk",
        method: "GET",
        endpoint: "/api/risk/profile/{wallet}",
        query: ["source=internal", "source=arc_network", "source=combined"],
        legacyEndpoint: "/api/reputation/{wallet}",
        note: "Returns a preview Risk Intelligence profile. Defaults to combined KX and Arc Network signals.",
        responseCodes: [200, 400]
      },
      {
        id: "query_arc_network_risk",
        method: "GET",
        endpoint: "/api/risk/network/{wallet}",
        note: "Returns an Arc Testnet RPC activity profile using the Arc Network Activity Adapter.",
        responseCodes: [200, 400]
      },
      {
        id: "query_risk_summary",
        method: "GET",
        endpoint: "/api/risk/summary/{wallet}",
        note: "Returns a compact participant risk profile for lightweight integrations.",
        responseCodes: [200, 400]
      },
      {
        id: "query_risk_signals",
        method: "GET",
        endpoint: "/api/risk/signals/{wallet}",
        note: "Returns behavioral and risk signals for a participant wallet.",
        responseCodes: [200, 400]
      },
      {
        id: "list_trust_snapshots",
        method: "GET",
        endpoint: "/api/risk/snapshots/{wallet}",
        note: "Returns historical off-chain Trust Snapshots and the latest snapshot for a wallet.",
        responseCodes: [200, 400]
      },
      {
        id: "publish_trust_attestation",
        method: "POST",
        endpoint: "/api/risk/snapshots/{wallet}",
        note: "Experimental Arc Testnet flow. Publishes an eligible Trust Snapshot from the configured KX publisher wallet. Use mode=test only for testnet validation.",
        requiredFields: ["snapshotId"],
        optionalFields: ["mode=test"],
        responseCodes: [200, 400, 404, 409, 503]
      },
      {
        id: "get_trust_attestation",
        method: "GET",
        endpoint: "/api/risk/attestations/{id}",
        note: "Reads a decoded minimal Trust Attestation from the Arc Testnet registry.",
        responseCodes: [200, 400]
      },
      {
        id: "get_wallet_trust_attestations",
        method: "GET",
        endpoint: "/api/risk/attestations/wallet/{wallet}",
        note: "Reads all decoded minimal Trust Attestations for a wallet from the Arc Testnet registry.",
        responseCodes: [200, 400]
      },
      {
        id: "get_latest_wallet_trust_attestation",
        method: "GET",
        endpoint: "/api/risk/attestations/wallet/{wallet}/latest",
        note: "Reads the latest decoded minimal Trust Attestation for a wallet from the Arc Testnet registry.",
        responseCodes: [200, 400]
      },
      {
        id: "evaluate_transaction_risk",
        method: "POST",
        endpoint: "/api/risk/guard",
        note: "Applies a client-defined Risk Guard policy before a transaction.",
        requiredFields: ["wallet", "policy"],
        responseCodes: [200, 400]
      },
      {
        id: "search_jobs",
        method: "GET",
        endpoint: "/api/requests/search",
        query: ["q", "category", "license", "status", "agentConsumable"]
      },
      {
        id: "create_job_draft",
        method: "POST",
        endpoint: "/api/requests/create",
        requiredFields: [
          "title",
          "description",
          "requirements",
          "budgetUSDC",
          "license",
          "requesterAddress"
        ],
        optionalFields: [
          "userType",
          "entityType",
          "participantType",
          "participantName",
          "operatorAddress",
          "arcIdentityId"
        ]
      },
      {
        id: "submit_job_deliverable",
        method: "POST",
        endpoint: "/api/requests/{id}/submit",
        requiredFields: ["providerAddress", "deliveryText"],
        optionalFields: [
          "providerParticipantType",
          "providerUserType",
          "providerEntityType",
          "providerParticipantName",
          "providerOperatorAddress",
          "providerArcIdentityId"
        ]
      }
    ],
    limitations: [
      "PostgreSQL persistence requires DATABASE_URL.",
      "Uploaded private files still use MVP filesystem storage and should move to durable object storage for production.",
      "No authentication or API keys yet.",
      "No replay protection yet.",
      "Access proofs are unsigned preview tokens, not production authorization tokens.",
      "Escrow funding still requires wallet interaction.",
      "Arc Testnet only."
    ]
  });
}

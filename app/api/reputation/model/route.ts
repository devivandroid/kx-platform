import { NextResponse } from "next/server";
import { getRiskModelResponse } from "@/lib/server/risk-intelligence/riskService";

export const runtime = "nodejs";

export async function GET() {
  const model = getRiskModelResponse();

  return NextResponse.json({
    ...model,
    legacyEndpoint: "/api/reputation/model",
    publicRiskEndpoint: "/api/risk/model",
    ok: true,
    name: "KX Risk Intelligence Model",
    scope: "KX activity only",
    network: "Arc Testnet",
    positioning: [
      "Participant risk signals for Human & Agent Commerce activity",
      "Designed for KX marketplace and escrow events",
      "Not an official Arc or Circle score",
      "Does not score all Arc wallets globally"
    ],
    scoring: {
      startingScore: 500,
      financialBehaviorScoreRange: "0-1000",
      riskScoreRange: "0-100 where 0 is lowest observed risk",
      positiveSignals: [
        "successful payments",
        "verified payments",
        "resource downloads",
        "escrow funding",
        "delivery submission",
        "funds released",
        "API unlock success",
        "counterparty diversity",
        "completed volume"
      ],
      negativeSignals: [
        "cancelled requests",
        "repeated purchase starts without completion",
        "completed work not released after expected window",
        "assigned job missed deadline without submission"
      ],
      volumeBoost: "Adds capped points for completed USDC volume",
      confidence: {
        Low: "fewer than 5 evidence events",
        Medium: "5-20 evidence events",
        High: "more than 20 evidence events"
      },
      riskTiers: {
        Low: "risk score 0-24",
        Medium: "risk score 25-59",
        High: "risk score 60-100",
        Unknown: "no KX activity; no data is not high risk"
      },
      activityLevels: {
        Dormant: "no activity or last activity more than 30 days ago",
        Low: "less than 1 action per day",
        Normal: "1-5 actions per day",
        High: "more than 5 actions per day"
      },
      profileStatuses: {
        active: "medium or high confidence KX evidence is available",
        limited: "some KX evidence is available, but confidence is low",
        no_data: "no KX activity was found for the wallet"
      },
      noDataHandling: {
        rule: "No data is not high risk.",
        riskTier: "Unknown",
        confidenceLevel: "Low",
        numericScores: "financialBehaviorScore and riskScore are null",
        riskGuardDefault: "review"
      }
    },
    limitations: [
      "MVP preview model",
      "Local/ephemeral event storage",
      "No dispute adjudication yet",
      "No verified agent identities yet",
      "Future roadmap: database, Arc-wide indexing, attestations and paid API tiers"
    ]
  });
}

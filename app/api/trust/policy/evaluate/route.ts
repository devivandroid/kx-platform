import { NextResponse } from "next/server";
import {
  evaluateTrustPolicy,
  evaluateTrustPolicyForProfile,
  normalizeTrustPolicyId
} from "@/lib/server/trust-policy/policyEngine";
import type { RiskProfile } from "@/lib/server/risk-intelligence/types";

export const dynamic = "force-dynamic";

function isLikelyAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!isLikelyAddress(body.wallet)) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_WALLET",
          message: "A valid wallet address is required."
        },
        { status: 400 }
      );
    }

    if (body.counterpartyWallet !== undefined && !isLikelyAddress(body.counterpartyWallet)) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_COUNTERPARTY_WALLET",
          message: "counterpartyWallet must be a valid wallet address when provided."
        },
        { status: 400 }
      );
    }

    const input = {
      wallet: body.wallet,
      policyId: normalizeTrustPolicyId(body.policyId),
      counterpartyWallet: body.counterpartyWallet,
      amountUSDC: body.amountUSDC !== undefined ? String(body.amountUSDC) : undefined,
      context: body.context !== undefined ? String(body.context) : undefined
    };
    const evaluation =
      body.profile && typeof body.profile === "object"
        ? evaluateTrustPolicyForProfile(input, body.profile as RiskProfile)
        : await evaluateTrustPolicy(input);

    return NextResponse.json(evaluation);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "TRUST_POLICY_EVALUATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Trust policy evaluation failed."
      },
      { status: 500 }
    );
  }
}

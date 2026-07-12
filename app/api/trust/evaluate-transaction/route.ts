import { NextResponse } from "next/server";
import {
  evaluateInteractionTrust,
  type EvaluateInteractionInput
} from "@/lib/server/trustTransactionEvaluation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_JSON",
        message: "Provide a valid JSON request body."
      },
      { status: 400 }
    );
  }

  try {
    const result = await evaluateInteractionTrust(body as EvaluateInteractionInput);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TRANSACTION_WALLETS") {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_TRANSACTION_WALLETS",
          message: "Provide valid from and to wallet addresses."
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "TRANSACTION_EVALUATION_FAILED",
        message: "KX could not evaluate this transaction right now."
      },
      { status: 500 }
    );
  }
}


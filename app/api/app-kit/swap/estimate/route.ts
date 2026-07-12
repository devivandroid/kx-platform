import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SwapEstimateRequest = {
  amountIn?: string;
  tokenIn?: string;
  tokenOut?: string;
  chain?: string;
};

function isPositiveAmount(value: string | undefined) {
  if (!value) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export async function POST(request: Request) {
  let body: SwapEstimateRequest;

  try {
    body = (await request.json()) as SwapEstimateRequest;
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

  if (!isPositiveAmount(body.amountIn)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_AMOUNT",
        message: "Provide a positive swap amount."
      },
      { status: 400 }
    );
  }

  if (body.chain !== "Arc_Testnet") {
    return NextResponse.json(
      {
        ok: false,
        error: "UNSUPPORTED_CHAIN",
        message: "This demo only supports Arc Testnet swap context."
      },
      { status: 400 }
    );
  }

  if (!process.env.KIT_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: "APP_KIT_SERVER_SWAP_NOT_CONFIGURED",
        message:
          "Server-side swap estimation requires KIT_KEY and a secure server-side wallet adapter. KX will not mock successful swaps."
      },
      { status: 501 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "SERVER_SIDE_WALLET_REQUIRED",
      message:
        "KIT_KEY is configured, but this project does not yet have a server-side wallet adapter for App Kit swap execution. Keep swap disabled until a secure server wallet is configured."
    },
    { status: 501 }
  );
}

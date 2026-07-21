import { NextResponse } from "next/server";
import {
  estimateProtectedSwap,
  getAppKitSwapConfigStatus,
  getPublicAppKitError,
  getServerWalletBalances,
  logAppKitSwapError,
  type AppKitSwapRequest,
  validateSwapRequest
} from "@/lib/server/appKitSwap";

export const runtime = "nodejs";

export async function GET() {
  const config = getAppKitSwapConfigStatus();
  const publicConfig = {
    ok: config.ok,
    testnetOnly: config.testnetOnly,
    chain: config.chain,
    serverWalletAddress: config.serverWalletAddress
  };

  if (!config.ok) {
    return NextResponse.json({
      ...publicConfig,
      balances: null,
      balanceError: "Protected Swap server wallet is not configured."
    });
  }

  try {
    const balances = await getServerWalletBalances();
    return NextResponse.json({ ...publicConfig, balances });
  } catch (error) {
    logAppKitSwapError("balance refresh failed", error);
    return NextResponse.json({
      ...publicConfig,
      balances: null,
      balanceError: getPublicAppKitError(error)
    });
  }
}

export async function POST(request: Request) {
  let body: AppKitSwapRequest;

  try {
    body = (await request.json()) as AppKitSwapRequest;
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

  const parsed = validateSwapRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error, message: parsed.message },
      { status: parsed.status }
    );
  }

  try {
    const result = await estimateProtectedSwap({
      amountIn: parsed.amountIn,
      tokenIn: parsed.tokenIn,
      tokenOut: parsed.tokenOut
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logAppKitSwapError("estimate failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "APP_KIT_SWAP_ESTIMATE_FAILED",
        message: getPublicAppKitError(error)
      },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  executeProtectedSwap,
  getPublicAppKitError,
  logAppKitSwapError,
  type AppKitSwapRequest,
  validateSwapRequest
} from "@/lib/server/appKitSwap";

export const runtime = "nodejs";

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
    const result = await executeProtectedSwap({
      amountIn: parsed.amountIn,
      tokenIn: parsed.tokenIn,
      tokenOut: parsed.tokenOut
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logAppKitSwapError("execution failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "APP_KIT_SWAP_EXECUTION_FAILED",
        message: getPublicAppKitError(error)
      },
      { status: 502 }
    );
  }
}

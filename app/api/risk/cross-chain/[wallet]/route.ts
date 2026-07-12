import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import {
  getCachedCrossChainContext,
  invalidateCrossChainContext,
  refreshCrossChainContext,
  refreshCrossChainContextIfStale
} from "@/lib/server/risk-intelligence/crossChainContext";

type CrossChainContextRouteContext = {
  params: Promise<{ wallet: string }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, context: CrossChainContextRouteContext) {
  const { wallet } = await context.params;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const refresh = searchParams.get("refresh") === "true";
  const force = searchParams.get("force") === "true";
  if (force) {
    await invalidateCrossChainContext(wallet);
  }
  const contextData = force
    ? await refreshCrossChainContext(wallet, { bypassMemoryCache: true })
    : refresh
      ? await refreshCrossChainContextIfStale(wallet)
      : await getCachedCrossChainContext(wallet);

  return NextResponse.json({
    ok: true,
    wallet,
    crossChainContext: contextData,
    message: contextData
      ? "Cross-chain context is available."
      : "No cached cross-chain context found yet. Request refresh=true after Trust analysis."
  });
}

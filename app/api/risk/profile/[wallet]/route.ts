import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import {
  getArcNetworkRiskProfileAsync,
  getCombinedRiskProfileAsync,
  getRiskProfileAsync,
  toPublicRiskProfileResponse
} from "@/lib/server/risk-intelligence/riskService";
import { refreshCrossChainContextIfStale } from "@/lib/server/risk-intelligence/crossChainContext";

type RiskWalletContext = {
  params: Promise<{ wallet: string }>;
};

export const runtime = "nodejs";

function readUseIndexedData(request: Request): boolean {
  const value = new URL(request.url).searchParams.get("useIndexedData");
  return value !== "false";
}

function readIncludeTrustSnapshot(request: Request): boolean {
  const value = new URL(request.url).searchParams.get("includeTrustSnapshot");
  return value !== "false";
}

export async function GET(request: Request, context: RiskWalletContext) {
  const { wallet } = await context.params;
  const source = new URL(request.url).searchParams.get("source");
  const options = {
    useIndexedData: readUseIndexedData(request),
    includeTrustSnapshot: readIncludeTrustSnapshot(request)
  };

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  if (source === "internal" || source === "knowledge_exchange") {
    const profile = await getRiskProfileAsync(wallet, options);
    void refreshCrossChainContextIfStale(wallet).catch(() => undefined);
    return NextResponse.json(toPublicRiskProfileResponse(profile));
  }

  if (source === "arc_network") {
    const profile = await getArcNetworkRiskProfileAsync(wallet, options);
    void refreshCrossChainContextIfStale(wallet).catch(() => undefined);
    return NextResponse.json(toPublicRiskProfileResponse(profile));
  }

  const profile = await getCombinedRiskProfileAsync(wallet, options);
  void refreshCrossChainContextIfStale(wallet).catch(() => undefined);
  return NextResponse.json(toPublicRiskProfileResponse(profile));
}

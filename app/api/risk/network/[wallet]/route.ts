import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import {
  getArcNetworkRiskProfileAsync,
  toPublicRiskProfileResponse
} from "@/lib/server/risk-intelligence/riskService";

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

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    toPublicRiskProfileResponse(
      await getArcNetworkRiskProfileAsync(wallet, {
        useIndexedData: readUseIndexedData(request),
        includeTrustSnapshot: readIncludeTrustSnapshot(request)
      })
    )
  );
}

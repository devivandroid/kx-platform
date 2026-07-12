import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import { getTrustBadgeSummary } from "@/lib/server/trustBadges";

type TrustBadgeContext = {
  params: Promise<{ wallet: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: TrustBadgeContext) {
  const { wallet } = await context.params;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    badge: await getTrustBadgeSummary(wallet),
    source: "latest_trust_snapshot",
    analysisTriggered: false
  });
}

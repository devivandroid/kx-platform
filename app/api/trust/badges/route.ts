import { NextResponse } from "next/server";
import { getTrustBadgeSummaries } from "@/lib/server/trustBadges";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let wallets: string[] = [];

  try {
    const body = (await request.json()) as { wallets?: unknown };
    wallets = Array.isArray(body.wallets)
      ? body.wallets.filter((wallet): wallet is string => typeof wallet === "string")
      : [];
  } catch {
    wallets = [];
  }

  return NextResponse.json({
    ok: true,
    badges: await getTrustBadgeSummaries(wallets),
    source: "latest_trust_snapshot",
    analysisTriggered: false
  });
}

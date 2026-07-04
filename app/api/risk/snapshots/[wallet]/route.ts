import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import {
  getLatestTrustSnapshot,
  listTrustSnapshots,
  publishEligibleTrustSnapshot
} from "@/lib/server/risk-intelligence/trustSnapshots";

type TrustSnapshotContext = {
  params: Promise<{ wallet: string }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, context: TrustSnapshotContext) {
  const { wallet } = await context.params;
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 25;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  const [latest, snapshots] = await Promise.all([
    getLatestTrustSnapshot(wallet),
    listTrustSnapshots(wallet, Number.isFinite(limit) ? limit : 25)
  ]);

  return NextResponse.json({
    ok: true,
    service: "KX Trust Engine",
    wallet,
    latest,
    snapshots,
    limitations: [
      "Trust Snapshots are off-chain persistence records.",
      "Trust Attestations may be published manually to the experimental Arc Testnet registry.",
      "Not identity verification, KYC, AML or compliance screening."
    ]
  });
}

export async function POST(request: Request, context: TrustSnapshotContext) {
  const { wallet } = await context.params;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  let snapshotId: string | undefined;
  let mode: "eligible" | "test" = "eligible";
  try {
    const body = await request.json();
    snapshotId = typeof body?.snapshotId === "string" ? body.snapshotId : undefined;
    mode = body?.mode === "test" ? "test" : "eligible";
  } catch {
    snapshotId = undefined;
  }

  const result = await publishEligibleTrustSnapshot({ wallet, snapshotId, mode });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    service: "KX Trust Engine",
    wallet,
    snapshot: result.snapshot,
    attestation: result.attestation,
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    limitations: [
      "Experimental Arc Testnet flow.",
      "KX signs Trust Attestations from the configured publisher wallet.",
      "Trust Attestations are not identity verification, KYC, AML or compliance screening."
    ]
  });
}

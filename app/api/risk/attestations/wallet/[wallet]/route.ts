import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import {
  getLatestOnChainTrustAttestation,
  getWalletOnChainTrustAttestations
} from "@/lib/server/risk-intelligence/trustSnapshots";

type WalletAttestationContext = {
  params: Promise<{ wallet: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: WalletAttestationContext) {
  const { wallet } = await context.params;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  const [latest, attestations] = await Promise.all([
    getLatestOnChainTrustAttestation(wallet),
    getWalletOnChainTrustAttestations(wallet)
  ]);

  return NextResponse.json({
    ok: true,
    service: "KX Trust Engine",
    wallet,
    latest,
    attestations,
    limitations: [
      "Experimental Arc Testnet Trust Attestation registry.",
      "PostgreSQL stores complete Trust Snapshot history; the contract stores minimal Trust Attestations."
    ]
  });
}

import { isAddress } from "ethers";
import { NextResponse } from "next/server";
import { getLatestOnChainTrustAttestation } from "@/lib/server/risk-intelligence/trustSnapshots";

type LatestWalletAttestationContext = {
  params: Promise<{ wallet: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: LatestWalletAttestationContext) {
  const { wallet } = await context.params;

  if (!isAddress(wallet)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_WALLET", message: "Provide a valid wallet address." },
      { status: 400 }
    );
  }

  const attestation = await getLatestOnChainTrustAttestation(wallet);

  return NextResponse.json({
    ok: true,
    service: "KX Trust Engine",
    wallet,
    attestation,
    limitations: [
      "Experimental Arc Testnet Trust Attestation registry.",
      "Trust Attestations are not identity verification, KYC, AML or compliance screening."
    ]
  });
}

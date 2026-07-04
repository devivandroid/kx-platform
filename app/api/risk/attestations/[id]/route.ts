import { NextResponse } from "next/server";
import { getOnChainTrustAttestation } from "@/lib/server/risk-intelligence/trustSnapshots";

type AttestationContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: AttestationContext) {
  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ATTESTATION_ID", message: "Provide a numeric attestation id." },
      { status: 400 }
    );
  }

  const attestation = await getOnChainTrustAttestation(id);

  return NextResponse.json({
    ok: true,
    service: "KX Trust Engine",
    attestation: attestation?.isEmpty ? null : attestation,
    limitations: [
      "Experimental Arc Testnet Trust Attestation registry.",
      "The contract stores minimal attestation data only, not full Trust Snapshot reports."
    ]
  });
}

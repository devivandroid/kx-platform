import { NextResponse } from "next/server";
import {
  getCrossChainApiKeyStatus,
  getCrossChainProviderHealth,
  getRuntimeNetworkDiagnostics
} from "@/lib/server/risk-intelligence/crossChainContext";

export const runtime = "nodejs";

export async function GET() {
  const networks = getCrossChainProviderHealth();
  const runtimeDiagnostics = await getRuntimeNetworkDiagnostics();

  return NextResponse.json({
    ok: true,
    service: "KX Cross-Chain Context",
    apiKeys: getCrossChainApiKeyStatus(),
    configuredNetworks: networks.filter((network) => network.configured).map((network) => network.network),
    networks,
    runtimeDiagnostics,
    notes: [
      "URLs are redacted when they contain credentials.",
      "Provider diagnostics include DNS lookup and a direct HTTPS request from this runtime.",
      "This endpoint validates provider configuration only. Use /api/risk/cross-chain/{wallet}?force=true to fetch wallet context.",
      "Cross-chain context is optional supporting evidence and does not modify Risk Score or Trust Score."
    ]
  });
}

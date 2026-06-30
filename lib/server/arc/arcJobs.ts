import { Contract, isAddress } from "ethers";
import { getReadOnlyProvider } from "@/lib/web3";

const arcJobRegistryAbi = [
  "function getJob(uint256 jobId) view returns (tuple(address buyer,address provider,uint256 amount,uint8 status,string metadataURI))",
  "function jobs(uint256 jobId) view returns (address buyer,address provider,uint256 amount,uint8 status,string metadataURI)"
] as const;

export type ArcJobResolution = {
  arcJobId?: string;
  registryAddress?: string;
  status: "found" | "not_configured" | "not_found" | "unavailable";
  data?: {
    buyer?: string;
    provider?: string;
    amount?: string;
    status?: string;
    metadataURI?: string;
  };
};

export function getArcJobRegistryAddress(): string | undefined {
  const value = process.env.ARC_JOB_REGISTRY_ADDRESS?.trim();
  return value && isAddress(value) ? value : undefined;
}

function parseArcJobId(value: unknown): bigint | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/(\d+)$/);
  if (!match) return null;

  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
}

function normalizeJobData(value: unknown): ArcJobResolution["data"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;

  return {
    buyer: typeof item.buyer === "string" ? item.buyer : undefined,
    provider: typeof item.provider === "string" ? item.provider : undefined,
    amount: item.amount !== undefined ? String(item.amount) : undefined,
    status: item.status !== undefined ? String(item.status) : undefined,
    metadataURI: typeof item.metadataURI === "string" ? item.metadataURI : undefined
  };
}

export async function readArcJob(arcJobId?: string): Promise<ArcJobResolution> {
  const registryAddress = getArcJobRegistryAddress();
  if (!registryAddress) return { arcJobId, status: "not_configured" };

  const parsedJobId = parseArcJobId(arcJobId);
  if (parsedJobId === null) return { arcJobId, registryAddress, status: "not_found" };

  const provider = getReadOnlyProvider();
  if (!provider) return { arcJobId, registryAddress, status: "unavailable" };

  const registry = new Contract(registryAddress, arcJobRegistryAbi, provider);
  const calls = [() => registry.getJob(parsedJobId), () => registry.jobs(parsedJobId)];

  for (const call of calls) {
    try {
      const data = normalizeJobData(await call());
      if (data) return { arcJobId, registryAddress, status: "found", data };
    } catch {
      // Try the next official/common registry read shape.
    }
  }

  return { arcJobId, registryAddress, status: "not_found" };
}

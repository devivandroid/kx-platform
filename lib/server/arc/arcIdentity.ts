import { Contract, isAddress } from "ethers";
import { getReadOnlyProvider } from "@/lib/web3";
import type { ArcIdentitySource } from "@/lib/arcNative";

const arcIdentityRegistryAbi = [
  "function identityOf(address wallet) view returns (uint256)",
  "function getIdentity(address wallet) view returns (uint256)",
  "function identityIdOf(address wallet) view returns (bytes32)"
] as const;

export type ArcIdentityResolution = {
  arcIdentityId?: string;
  identitySource: ArcIdentitySource;
  registryAddress?: string;
  status: "found" | "not_configured" | "not_found" | "unavailable";
};

function getArcIdentityRegistryAddress(): string | undefined {
  const value = process.env.ARC_IDENTITY_REGISTRY_ADDRESS?.trim();
  return value && isAddress(value) ? value : undefined;
}

function normalizeIdentityId(value: unknown): string | undefined {
  if (typeof value === "bigint") {
    return value > 0n ? value.toString() : undefined;
  }

  if (typeof value === "number") {
    return value > 0 ? String(value) : undefined;
  }

  if (typeof value === "string") {
    if (!value || /^0x0+$/.test(value)) return undefined;
    return value;
  }

  return undefined;
}

export async function resolveArcIdentity(wallet: string): Promise<ArcIdentityResolution> {
  const registryAddress = getArcIdentityRegistryAddress();

  if (!registryAddress) {
    return { identitySource: "self_declared", status: "not_configured" };
  }

  if (!isAddress(wallet)) {
    return { identitySource: "self_declared", registryAddress, status: "not_found" };
  }

  const provider = getReadOnlyProvider();
  if (!provider) {
    return { identitySource: "self_declared", registryAddress, status: "unavailable" };
  }

  const registry = new Contract(registryAddress, arcIdentityRegistryAbi, provider);
  const calls = [
    () => registry.identityOf(wallet),
    () => registry.getIdentity(wallet),
    () => registry.identityIdOf(wallet)
  ];

  for (const call of calls) {
    try {
      const arcIdentityId = normalizeIdentityId(await call());
      if (arcIdentityId) {
        return {
          arcIdentityId,
          identitySource: "arc_identity",
          registryAddress,
          status: "found"
        };
      }
    } catch {
      // Try the next official/common registry read shape.
    }
  }

  return { identitySource: "self_declared", registryAddress, status: "not_found" };
}

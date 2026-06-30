import { Contract, isAddress, type InterfaceAbi } from "ethers";
import { getReadOnlyProvider } from "@/lib/web3";

export type ArcRegistryStatus =
  | "found"
  | "not_configured"
  | "abi_unavailable"
  | "method_unavailable"
  | "not_found"
  | "unavailable";

export type ArcRegistryEntry = {
  label?: string;
  status?: string;
  value?: string;
  tag?: string;
  issuer?: string;
  txHash?: string;
  raw?: string;
};

export type ArcRegistryReadResult = {
  source: "Arc Reputation" | "Arc Validations";
  status: ArcRegistryStatus;
  registryAddress?: string;
  method?: string;
  entries: ArcRegistryEntry[];
  message?: string;
};

function parseAbi(value?: string): InterfaceAbi | null {
  if (!value?.trim()) return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as InterfaceAbi) : null;
  } catch {
    return null;
  }
}

function stringifyValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item
    );
  } catch {
    return String(value);
  }
}

function normalizeEntry(value: unknown): ArcRegistryEntry {
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return {
      label: stringifyValue(item.label ?? item.name ?? item.key),
      status: stringifyValue(item.status ?? item.state),
      value: stringifyValue(item.value ?? item.score ?? item.reputation),
      tag: stringifyValue(item.tag ?? item.type),
      issuer: stringifyValue(item.issuer ?? item.validator ?? item.source),
      txHash: stringifyValue(item.txHash ?? item.transactionHash),
      raw: stringifyValue(value)
    };
  }

  return { value: stringifyValue(value), raw: stringifyValue(value) };
}

function normalizeEntries(value: unknown): ArcRegistryEntry[] {
  if (Array.isArray(value)) return value.map(normalizeEntry);
  if (value === null || value === undefined) return [];
  return [normalizeEntry(value)];
}

async function readConfiguredRegistry({
  wallet,
  source,
  addressEnv,
  abiEnv,
  methodEnv
}: {
  wallet: string;
  source: ArcRegistryReadResult["source"];
  addressEnv: string;
  abiEnv: string;
  methodEnv: string;
}): Promise<ArcRegistryReadResult> {
  const registryAddress = process.env[addressEnv]?.trim();
  if (!registryAddress || !isAddress(registryAddress)) {
    return { source, status: "not_configured", entries: [] };
  }

  const abi = parseAbi(process.env[abiEnv]);
  if (!abi) {
    return {
      source,
      status: "abi_unavailable",
      registryAddress,
      entries: [],
      message: "Registry address is configured, but no official ABI JSON is configured."
    };
  }

  const method = process.env[methodEnv]?.trim();
  if (!method) {
    return {
      source,
      status: "method_unavailable",
      registryAddress,
      entries: [],
      message: "Registry ABI is configured, but no official read method is configured."
    };
  }

  const provider = getReadOnlyProvider();
  if (!provider) return { source, status: "unavailable", registryAddress, method, entries: [] };

  try {
    const registry = new Contract(registryAddress, abi, provider);
    const result = await registry.getFunction(method)(wallet);
    const entries = normalizeEntries(result);

    return {
      source,
      status: entries.length > 0 ? "found" : "not_found",
      registryAddress,
      method,
      entries
    };
  } catch {
    return {
      source,
      status: "unavailable",
      registryAddress,
      method,
      entries: [],
      message: "Registry read failed with the configured official ABI/method."
    };
  }
}

export function readArcReputation(wallet: string) {
  return readConfiguredRegistry({
    wallet,
    source: "Arc Reputation",
    addressEnv: "ARC_REPUTATION_REGISTRY_ADDRESS",
    abiEnv: "ARC_REPUTATION_REGISTRY_ABI_JSON",
    methodEnv: "ARC_REPUTATION_REGISTRY_METHOD"
  });
}

export function readArcValidations(wallet: string) {
  return readConfiguredRegistry({
    wallet,
    source: "Arc Validations",
    addressEnv: "ARC_VALIDATION_REGISTRY_ADDRESS",
    abiEnv: "ARC_VALIDATION_REGISTRY_ABI_JSON",
    methodEnv: "ARC_VALIDATION_REGISTRY_METHOD"
  });
}

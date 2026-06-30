import type { UserType } from "@/types/resource";

export type ArcIdentitySource = "arc_identity" | "self_declared";

export type ArcNativeMetadata = {
  arcJobId?: string;
  arcIdentityId?: string;
  identitySource?: ArcIdentitySource;
};

export function createArcJobId(id: string): string {
  return `arc-job:${id}`;
}

export function getIdentitySource(arcIdentityId?: string | null): ArcIdentitySource {
  return arcIdentityId ? "arc_identity" : "self_declared";
}

export function getIdentitySourceLabel(source?: ArcIdentitySource | null): string {
  return source === "arc_identity" ? "Arc Identity" : "Self-declared";
}

export function normalizeArcIdentityId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function getDeclaredUserTypeLabel(userType?: UserType | "unknown" | null): string {
  if (userType === "AGENT") return "Agent";
  if (userType === "HUMAN") return "Human";
  return "Not declared";
}

import { decodeUtf8Base64 } from "@/lib/utf8Base64";
import type { EntityType, ParticipantType, UserType } from "@/types/resource";

export type TaskMetadata = {
  title?: string;
  description?: string;
  requirements?: string;
  category?: string;
  tags?: string[];
  budgetUSDC?: string;
  license?: string;
  accessType?: "instant" | "manual";
  requesterAddress?: string;
  arcJobId?: string;
  userType?: UserType;
  entityType?: EntityType;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  arcIdentityId?: string;
  identitySource?: "arc_identity" | "self_declared";
  providerAddress?: string;
  providerUserType?: UserType;
  providerEntityType?: EntityType;
  providerParticipantType?: ParticipantType;
  providerParticipantName?: string;
  providerOperatorAddress?: string;
  providerArcIdentityId?: string;
  providerIdentitySource?: "arc_identity" | "self_declared";
  resourceType?: string;
  agentConsumable?: boolean;
  deadline?: string | null;
  note?: string;
  submittedAt?: string;
  createdFrom?: string;
};

export function parseTaskMetadata(metadataURI: string): TaskMetadata | null {
  if (!metadataURI) {
    return null;
  }

  try {
    if (metadataURI.startsWith("data:application/json;base64,")) {
      const encoded = metadataURI.replace("data:application/json;base64,", "");
      return JSON.parse(decodeUtf8Base64(encoded)) as TaskMetadata;
    }

    if (metadataURI.trim().startsWith("{")) {
      return JSON.parse(metadataURI) as TaskMetadata;
    }
  } catch {
    return null;
  }

  return null;
}

export function getTaskDisplayTitle(metadataURI: string, fallback: string): string {
  return parseTaskMetadata(metadataURI)?.title || fallback;
}

export function getTaskDisplayDescription(metadataURI: string): string {
  const metadata = parseTaskMetadata(metadataURI);

  return metadata?.description || metadataURI;
}

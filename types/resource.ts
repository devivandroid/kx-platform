export type AccessType = "instant" | "manual";
export type DeliveryType = "inline" | "download";
export type ParticipantType = "human" | "agent" | "organization";

export type ParticipantMetadata = {
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
};

export type ResourceFile = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  description?: string;
};

export type LicenseType =
  | "MIT"
  | "Apache-2.0"
  | "GPL-3.0"
  | "CC-BY-4.0"
  | "CC0"
  | "Commercial Use Allowed"
  | "Personal Use Only"
  | "Custom License";

export type ResourceType =
  | "Quality Assurance"
  | "Software Development"
  | "Design"
  | "Course"
  | "Subscription"
  | "Dataset"
  | "Prompt"
  | "Technical Guide"
  | "API Documentation"
  | "Code Snippet"
  | "MCP Server"
  | "Knowledge Base"
  | "Model Artifact"
  | "Template"
  | "Custom Service";

export type InstantResource = {
  id: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  category: string;
  tags: string[];
  priceUSDC: string;
  license: LicenseType;
  accessType: "instant";
  featured?: boolean;
  featuredLabel?: string;
  sellerName?: string;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  sellerAddress: string;
  deliveryType: DeliveryType;
  contentURI?: string;
  lockedContentURI?: string;
  previewText: string;
  agentConsumable: boolean;
  unlockedContentMock?: string;
  files?: ResourceFile[];
};

export type ManualRequestMetadata = {
  title: string;
  description: string;
  requirements: string;
  category: string;
  tags: string[];
  budgetUSDC: string;
  license: LicenseType;
  accessType: "manual";
  requesterAddress?: string;
  providerAddress?: string;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  providerParticipantType?: ParticipantType;
  providerParticipantName?: string;
  providerOperatorAddress?: string;
  deliveryHash?: string;
  metadataURI?: string;
  deadline?: string | null;
  agentConsumable: boolean;
  resourceType?: ResourceType;
  createdFrom?: string;
};

export type KnowledgeAsset = InstantResource | ManualRequestMetadata;

export const licenseValues: LicenseType[] = [
  "MIT",
  "Apache-2.0",
  "GPL-3.0",
  "CC-BY-4.0",
  "CC0",
  "Commercial Use Allowed",
  "Personal Use Only",
  "Custom License"
];

export const resourceTypeValues: ResourceType[] = [
  "Quality Assurance",
  "Software Development",
  "Design",
  "Course",
  "Subscription",
  "Dataset",
  "Prompt",
  "Technical Guide",
  "API Documentation",
  "Code Snippet",
  "MCP Server",
  "Knowledge Base",
  "Model Artifact",
  "Template",
  "Custom Service"
];

export const participantTypeValues: ParticipantType[] = ["human", "agent", "organization"];

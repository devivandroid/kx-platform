import type {
  DeliveryType,
  InstantResource,
  LicenseType,
  EntityType,
  ParticipantType,
  ResourceFile,
  ResourceType,
  UserType
} from "@/types/resource";
import type { RatingSummary, ResourceRating } from "@/lib/ratings";
import type { RiskGuardPolicy, TrustPolicyId } from "@/lib/sdk/risk-intelligence";

export type KXClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export type SearchResourcesParams = {
  q?: string;
  resourceType?: ResourceType | string;
  category?: string;
  license?: LicenseType | string;
  agentConsumable?: boolean;
};

export type ResourceSearchItem = InstantResource & {
  endpoint?: string;
  purchaseFlow?: {
    type: string;
    verifyEndpoint: string;
  };
};

export type SearchResourcesResponse = {
  resources: ResourceSearchItem[];
};

export type PublishResourceInput = {
  id?: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  category?: string;
  tags?: string[] | string;
  priceUSDC: string;
  license: LicenseType;
  sellerAddress: string;
  sellerName?: string;
  userType?: UserType;
  entityType?: EntityType;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  arcIdentityId?: string;
  deliveryType?: DeliveryType;
  previewText?: string;
  unlockedContentMock?: string;
  files?: ResourceFile[];
  agentConsumable?: boolean;
  accessType?: "instant";
};

export type PublishResourceResponse = {
  resource: InstantResource;
  endpoint: string;
  purchaseEndpoint: string;
  message: string;
};

export type UploadResourceFilesResponse = {
  ok: true;
  resourceId: string;
  files: ResourceFile[];
};

export type PaymentRequiredResponse = {
  ok: false;
  error: "PAYMENT_REQUIRED";
  message: string;
  resourceId: string;
  title: string;
  deliveryType?: string;
  priceUSDC: string;
  sellerAddress: string;
  network: string;
  chainId: number;
  chainIdHex: string;
  usdcAddress: string;
  paymentInstructions: {
    method: string;
    token: "USDC";
    decimals: number;
    to: string;
    amountUSDC: string;
  };
  paymentVerificationEndpoint: string;
  resourceEndpoint?: string;
};

export type PaymentProof = {
  txHash: string;
  buyerAddress: string;
};

export type VerifyPaymentResponse = {
  ok: true;
  accessGranted: true;
  resourceId: string;
  receipt: {
    txHash: string;
    buyerAddress: string;
    sellerAddress: string;
    amountUSDC: string;
    resourceId: string;
    license: string;
    resourceType: string;
    blockNumber: number;
  };
  accessToken: string;
};

export type UnlockedResourceResponse = {
  ok: true;
  id: string;
  resourceId: string;
  title: string;
  deliveryType: "inline" | "download";
  license: string;
  resourceType: string;
  content?: string;
  files?: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    checksum?: string;
    description?: string;
    downloadUrl: string;
  }>;
  receipt: VerifyPaymentResponse["receipt"];
};

export type ResourceRatingsResponse = {
  ok: true;
  resourceId: string;
  summary: RatingSummary;
  userRating: ResourceRating | null;
};

export type SaveResourceRatingInput = {
  walletAddress: string;
  rating: number;
};

export type SaveResourceRatingResponse = {
  ok: true;
  resourceId: string;
  rating: ResourceRating;
  summary: RatingSummary;
  message: string;
};

export type SearchRequestsParams = {
  q?: string;
  category?: string;
  license?: LicenseType | string;
  status?: string;
  agentConsumable?: boolean;
};

export type RequestDraft = {
  id: string;
  arcJobId?: string | null;
  title: string;
  description: string;
  requirements: string;
  budgetUSDC: string;
  license: LicenseType | string;
  requesterAddress: string;
  userType?: UserType;
  entityType?: EntityType;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  arcIdentityId?: string | null;
  identitySource?: "arc_identity" | "self_declared" | string;
  providerAddress?: string | null;
  providerUserType?: UserType;
  providerEntityType?: EntityType;
  providerParticipantType?: ParticipantType;
  providerParticipantName?: string;
  providerOperatorAddress?: string;
  providerArcIdentityId?: string | null;
  providerIdentitySource?: "arc_identity" | "self_declared" | string;
  settlement?: string;
  status: "Draft" | "Open" | "Submitted" | string;
  agentConsumable: boolean;
  detailUrl?: string;
};

export type SearchRequestsResponse = {
  requests: RequestDraft[];
};

export type CreateRequestInput = {
  arcJobId?: string;
  title: string;
  description: string;
  requirements: string;
  category?: string;
  tags?: string[] | string;
  budgetUSDC: string;
  license: LicenseType | string;
  requesterAddress: string;
  userType?: UserType;
  entityType?: EntityType;
  participantType?: ParticipantType;
  participantName?: string;
  operatorAddress?: string;
  arcIdentityId?: string;
  agentConsumable?: boolean;
};

export type CreateRequestResponse = {
  request: RequestDraft;
  fundingInstructions: string;
  roadmap: string;
};

export type SubmitDeliveryInput = {
  providerAddress: string;
  providerUserType?: UserType;
  providerEntityType?: EntityType;
  providerParticipantType?: ParticipantType;
  providerParticipantName?: string;
  providerOperatorAddress?: string;
  providerArcIdentityId?: string;
  deliveryText: string;
  deliveryURI?: string;
  deliveryHash?: string;
};

export type SubmitDeliveryResponse = {
  requestId: string;
  providerAddress: string;
  providerUserType?: UserType;
  providerEntityType?: EntityType;
  providerParticipantType?: ParticipantType;
  providerParticipantName?: string;
  providerOperatorAddress?: string;
  providerArcIdentityId?: string | null;
  providerIdentitySource?: "arc_identity" | "self_declared" | string;
  deliveryHash: string;
  deliveryURI: string;
  message: string;
};

export type AgentCapabilitiesResponse = Record<string, unknown>;

export type RiskGuardInput = {
  wallet: string;
  policy: RiskGuardPolicy;
};

export type TrustWalletOptions = {
  policyId?: TrustPolicyId;
  source?: "internal" | "arc_network" | "combined";
  useIndexedData?: boolean;
};

export type TrustWalletResponse = {
  wallet: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  allow: boolean;
  review: boolean;
  block: boolean;
  trustScore: number | null;
  riskScore: number | null;
  riskTier: string;
  policyId: TrustPolicyId;
  policyName: string;
  reasons: string[];
  estimatedIdentity: string;
  humanProbability: number | null;
  analysisConfidence: string;
  snapshotVerified: boolean;
  reportHash: string | null;
  signatureStatus: "verified" | "unsigned" | "not_configured" | "invalid" | null;
  attestationStatus: string;
  lastUpdated: string | null;
};

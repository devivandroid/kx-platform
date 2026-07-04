import {
  RiskIntelligenceClient,
  type RiskGuardPolicy,
  type RiskGuardResponse,
  type RiskModelResponse,
  type RiskParticipantsResponse,
  type RiskProfileResponse,
  type RiskSignalsResponse,
  type RiskSummaryResponse,
  type RiskTrustAttestationResponse,
  type RiskTrustSnapshotPublishResponse,
  type RiskTrustSnapshotsResponse,
  type RiskWalletTrustAttestationsResponse,
  type TrustSnapshotPublishOptions
} from "@/lib/sdk/risk-intelligence";
import type {
  AgentCapabilitiesResponse,
  CreateRequestInput,
  CreateRequestResponse,
  KXClientOptions,
  PaymentProof,
  PaymentRequiredResponse,
  PublishResourceInput,
  PublishResourceResponse,
  ResourceRatingsResponse,
  SaveResourceRatingInput,
  SaveResourceRatingResponse,
  SearchRequestsParams,
  SearchRequestsResponse,
  SearchResourcesParams,
  SearchResourcesResponse,
  SubmitDeliveryInput,
  SubmitDeliveryResponse,
  UnlockedResourceResponse,
  UploadResourceFilesResponse,
  VerifyPaymentResponse
} from "@/lib/sdk/kx/types";
import type { ListParticipantsParams } from "@/lib/sdk/risk-intelligence/types";
import type { RiskProfileRequestOptions } from "@/lib/sdk/risk-intelligence/types";

export class KXClientError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "KXClientError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new KXClientError("KX baseUrl is required.");
  }

  return normalized;
}

function appendQuery(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export class KXClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  readonly risk: RiskIntelligenceClient;

  constructor(options: KXClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (!this.fetchImpl) {
      throw new KXClientError(
        "No fetch implementation available. Provide fetchImpl when running in older Node.js runtimes."
      );
    }

    this.risk = new RiskIntelligenceClient({
      baseUrl: this.baseUrl,
      fetchImpl: this.fetchImpl
    });
  }

  getAgentCapabilities(): Promise<AgentCapabilitiesResponse> {
    return this.get("/api/agent-capabilities");
  }

  searchResources(params?: SearchResourcesParams): Promise<SearchResourcesResponse> {
    return this.get(
      appendQuery("/api/resources/search", {
        q: params?.q,
        resourceType: params?.resourceType,
        category: params?.category,
        license: params?.license,
        agentConsumable: params?.agentConsumable
      })
    );
  }

  publishResource(input: PublishResourceInput): Promise<PublishResourceResponse> {
    return this.post("/api/resources/publish", input);
  }

  uploadResourceFiles(
    resourceId: string,
    files: Array<File | Blob>
  ): Promise<UploadResourceFilesResponse> {
    const formData = new FormData();
    formData.set("resourceId", resourceId);

    for (const file of files) {
      formData.append("files", file);
    }

    return this.request("/api/resources/upload", {
      method: "POST",
      body: formData
    });
  }

  getPaymentInstructions(resourceId: string): Promise<PaymentRequiredResponse> {
    return this.get(`/api/resources/${encodeURIComponent(resourceId)}`, {
      expectedStatuses: [402]
    });
  }

  verifyResourcePayment(
    resourceId: string,
    proof: PaymentProof
  ): Promise<VerifyPaymentResponse> {
    return this.post(`/api/resources/${encodeURIComponent(resourceId)}/verify-payment`, proof);
  }

  getUnlockedResource(
    resourceId: string,
    proof: PaymentProof
  ): Promise<UnlockedResourceResponse> {
    return this.get(
      appendQuery(`/api/resources/${encodeURIComponent(resourceId)}`, {
        txHash: proof.txHash,
        buyerAddress: proof.buyerAddress
      })
    );
  }

  getResourceRatings(
    resourceId: string,
    walletAddress?: string
  ): Promise<ResourceRatingsResponse> {
    return this.get(
      appendQuery(`/api/resources/${encodeURIComponent(resourceId)}/ratings`, {
        walletAddress
      })
    );
  }

  rateResource(
    resourceId: string,
    input: SaveResourceRatingInput
  ): Promise<SaveResourceRatingResponse> {
    return this.post(`/api/resources/${encodeURIComponent(resourceId)}/ratings`, input);
  }

  searchRequests(params?: SearchRequestsParams): Promise<SearchRequestsResponse> {
    return this.get(
      appendQuery("/api/requests/search", {
        q: params?.q,
        category: params?.category,
        license: params?.license,
        status: params?.status,
        agentConsumable: params?.agentConsumable
      })
    );
  }

  createRequest(input: CreateRequestInput): Promise<CreateRequestResponse> {
    return this.post("/api/requests/create", input);
  }

  submitRequestDelivery(
    requestId: string,
    input: SubmitDeliveryInput
  ): Promise<SubmitDeliveryResponse> {
    return this.post(`/api/requests/${encodeURIComponent(requestId)}/submit`, input);
  }

  getRiskProfile(
    wallet: string,
    options?: RiskProfileRequestOptions
  ): Promise<RiskProfileResponse> {
    return this.risk.getProfile(wallet, options);
  }

  getNetworkProfile(
    wallet: string,
    options?: RiskProfileRequestOptions
  ): Promise<RiskProfileResponse> {
    return this.risk.getNetworkProfile(wallet, options);
  }

  getCombinedProfile(
    wallet: string,
    options?: RiskProfileRequestOptions
  ): Promise<RiskProfileResponse> {
    return this.risk.getCombinedProfile(wallet, options);
  }

  getRiskSummary(wallet: string): Promise<RiskSummaryResponse> {
    return this.risk.getSummary(wallet);
  }

  getRiskSignals(wallet: string): Promise<RiskSignalsResponse> {
    return this.risk.getSignals(wallet);
  }

  listTrustSnapshots(wallet: string, limit?: number): Promise<RiskTrustSnapshotsResponse> {
    return this.risk.listTrustSnapshots(wallet, limit);
  }

  publishTrustSnapshot(
    wallet: string,
    options?: TrustSnapshotPublishOptions
  ): Promise<RiskTrustSnapshotPublishResponse> {
    return this.risk.publishTrustSnapshot(wallet, options);
  }

  getAttestation(attestationId: string | number): Promise<RiskTrustAttestationResponse> {
    return this.risk.getAttestation(attestationId);
  }

  getLatestAttestation(wallet: string): Promise<RiskTrustAttestationResponse> {
    return this.risk.getLatestAttestation(wallet);
  }

  getWalletAttestations(wallet: string): Promise<RiskWalletTrustAttestationsResponse> {
    return this.risk.getWalletAttestations(wallet);
  }

  getRiskModel(): Promise<RiskModelResponse> {
    return this.risk.getModel();
  }

  listRiskParticipants(params?: ListParticipantsParams): Promise<RiskParticipantsResponse> {
    return this.risk.listParticipants(params);
  }

  evaluateTransactionRisk(
    wallet: string,
    policy: RiskGuardPolicy
  ): Promise<RiskGuardResponse> {
    return this.risk.evaluateTransactionRisk(wallet, policy);
  }

  canTransactWith(wallet: string, policy: RiskGuardPolicy): Promise<boolean> {
    return this.risk.canTransactWith(wallet, policy);
  }

  private async get<T>(
    path: string,
    options?: { expectedStatuses?: number[] }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/json"
        }
      });
    } catch (error) {
      throw new KXClientError(
        `KX request failed before receiving a response: ${url}`,
        { details: error }
      );
    }

    return this.parseJsonResponse<T>(response, options);
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw new KXClientError(
        `KX request failed before receiving a response: ${url}`,
        { details: error }
      );
    }

    return this.parseJsonResponse<T>(response);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers ?? {})
        }
      });
    } catch (error) {
      throw new KXClientError(
        `KX request failed before receiving a response: ${url}`,
        { details: error }
      );
    }

    return this.parseJsonResponse<T>(response);
  }

  private async parseJsonResponse<T>(
    response: Response,
    options?: { expectedStatuses?: number[] }
  ): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await response.json() : await response.text();
    const expected = options?.expectedStatuses?.includes(response.status);

    if (!response.ok && !expected) {
      const message =
        typeof body === "object" && body && "message" in body
          ? String(body.message)
          : `KX request failed with status ${response.status}.`;

      throw new KXClientError(message, {
        status: response.status,
        details: body
      });
    }

    if (!isJson) {
      throw new KXClientError(
        `KX expected JSON but received ${contentType || "unknown content type"}.`,
        { status: response.status, details: body }
      );
    }

    return body as T;
  }
}

import type {
  ListParticipantsParams,
  RiskIntelligenceClientOptions,
  RiskProfileRequestOptions,
  RiskGuardPolicy,
  RiskGuardResponse,
  RiskModelResponse,
  RiskParticipantsResponse,
  RiskProfileResponse,
  RiskSignalsResponse,
  RiskSummaryResponse,
  RiskTrustAttestationResponse,
  RiskTrustSnapshotPublishResponse,
  RiskTrustSnapshotsResponse,
  RiskWalletTrustAttestationsResponse,
  TrustSnapshotPublishOptions,
  TrustPolicyEvaluationOptions,
  TrustPolicyEvaluationResponse,
  TrustPolicyId
} from "@/lib/sdk/risk-intelligence/types";

export class RiskIntelligenceClientError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "RiskIntelligenceClientError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();

  if (trimmed === "" || trimmed === "/") {
    return "";
  }

  const normalized = trimmed.replace(/\/+$/, "");

  if (!normalized) {
    throw new RiskIntelligenceClientError("Risk Intelligence baseUrl is required.");
  }

  return normalized;
}

function appendQuery(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export class RiskIntelligenceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RiskIntelligenceClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

    if (!this.fetchImpl) {
      throw new RiskIntelligenceClientError(
        "No fetch implementation available. Provide fetchImpl when running in older Node.js runtimes."
      );
    }
  }

  getProfile(
    wallet: string,
    options: RiskProfileRequestOptions = {}
  ): Promise<RiskProfileResponse> {
    return this.get(
      appendQuery(`/api/risk/profile/${encodeURIComponent(wallet)}`, {
        useIndexedData: options.useIndexedData
      })
    );
  }

  getCombinedProfile(
    wallet: string,
    options: RiskProfileRequestOptions = {}
  ): Promise<RiskProfileResponse> {
    return this.get(
      appendQuery(`/api/risk/profile/${encodeURIComponent(wallet)}`, {
        source: "combined",
        useIndexedData: options.useIndexedData
      })
    );
  }

  getNetworkProfile(
    wallet: string,
    options: RiskProfileRequestOptions = {}
  ): Promise<RiskProfileResponse> {
    return this.get(
      appendQuery(`/api/risk/network/${encodeURIComponent(wallet)}`, {
        useIndexedData: options.useIndexedData
      })
    );
  }

  getSummary(wallet: string): Promise<RiskSummaryResponse> {
    return this.get(`/api/risk/summary/${encodeURIComponent(wallet)}`);
  }

  getSignals(wallet: string): Promise<RiskSignalsResponse> {
    return this.get(`/api/risk/signals/${encodeURIComponent(wallet)}`);
  }

  listTrustSnapshots(wallet: string, limit = 25): Promise<RiskTrustSnapshotsResponse> {
    return this.get(
      appendQuery(`/api/risk/snapshots/${encodeURIComponent(wallet)}`, { limit })
    );
  }

  publishTrustSnapshot(
    wallet: string,
    options: TrustSnapshotPublishOptions = {}
  ): Promise<RiskTrustSnapshotPublishResponse> {
    return this.post(`/api/risk/snapshots/${encodeURIComponent(wallet)}`, options);
  }

  getAttestation(attestationId: string | number): Promise<RiskTrustAttestationResponse> {
    return this.get(`/api/risk/attestations/${encodeURIComponent(String(attestationId))}`);
  }

  getLatestAttestation(wallet: string): Promise<RiskTrustAttestationResponse> {
    return this.get(`/api/risk/attestations/wallet/${encodeURIComponent(wallet)}/latest`);
  }

  getWalletAttestations(wallet: string): Promise<RiskWalletTrustAttestationsResponse> {
    return this.get(`/api/risk/attestations/wallet/${encodeURIComponent(wallet)}`);
  }

  getModel(): Promise<RiskModelResponse> {
    return this.get("/api/risk/model");
  }

  listParticipants(params?: ListParticipantsParams): Promise<RiskParticipantsResponse> {
    return this.get(
      appendQuery("/api/risk/participants", {
        limit: params?.limit,
        riskTier: params?.riskTier,
        userType: params?.userType,
        entityType: params?.entityType,
        participantType: params?.participantType
      })
    );
  }

  evaluateTransactionRisk(
    wallet: string,
    policy: RiskGuardPolicy
  ): Promise<RiskGuardResponse> {
    return this.post("/api/risk/guard", { wallet, policy });
  }

  evaluateTrustPolicy(
    wallet: string,
    policyId: TrustPolicyId,
    options: TrustPolicyEvaluationOptions = {}
  ): Promise<TrustPolicyEvaluationResponse> {
    return this.post("/api/trust/policy/evaluate", {
      wallet,
      policyId,
      ...options
    });
  }

  async isRiskAtOrBelow(wallet: string, maxRiskScore: number): Promise<boolean> {
    const summary = await this.getSummary(wallet);
    if (summary.summary.riskScore === null) return false;
    return summary.summary.riskScore <= maxRiskScore;
  }

  async isRiskBelow(wallet: string, riskScore: number): Promise<boolean> {
    const summary = await this.getSummary(wallet);
    if (summary.summary.riskScore === null) return false;
    return summary.summary.riskScore < riskScore;
  }

  async isRiskAbove(wallet: string, riskScore: number): Promise<boolean> {
    const summary = await this.getSummary(wallet);
    if (summary.summary.riskScore === null) return false;
    return summary.summary.riskScore > riskScore;
  }

  async canTransactWith(wallet: string, policy: RiskGuardPolicy): Promise<boolean> {
    const guard = await this.evaluateTransactionRisk(wallet, policy);
    return guard.decision === "allow";
  }

  async hasRiskData(wallet: string): Promise<boolean> {
    const profile = await this.getProfile(wallet);
    return profile.profileStatus !== "no_data";
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/json"
        }
      });
    } catch (error) {
      throw new RiskIntelligenceClientError(
        `Risk Intelligence request failed before receiving a response: ${url}`,
        { details: error }
      );
    }

    return this.parseJsonResponse<T>(response);
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
      throw new RiskIntelligenceClientError(
        `Risk Intelligence request failed before receiving a response: ${url}`,
        { details: error }
      );
    }

    return this.parseJsonResponse<T>(response);
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof body === "object" && body && "message" in body
          ? String(body.message)
          : `Risk Intelligence request failed with status ${response.status}.`;

      throw new RiskIntelligenceClientError(message, {
        status: response.status,
        details: body
      });
    }

    if (!isJson) {
      throw new RiskIntelligenceClientError(
        `Risk Intelligence expected JSON but received ${contentType || "unknown content type"}.`,
        { status: response.status, details: body }
      );
    }

    return body as T;
  }
}

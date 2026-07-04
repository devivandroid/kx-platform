import { keccak256, toUtf8Bytes } from "ethers";
import { createArcJobId, getIdentitySource } from "@/lib/arcNative";
import { createLocalResourceId } from "@/lib/localResources";
import { isPostgresEnabled, pgQuery, upsertParticipant } from "@/lib/server/postgres";
import { getInstantResources } from "@/services/resources";
import {
  licenseValues,
  resourceTypeValues,
  type EntityType,
  type InstantResource,
  type LicenseType,
  type ParticipantType,
  type ResourceType,
  type UserType
} from "@/types/resource";

export type AgentRequestDraft = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  category: string;
  tags: string[];
  budgetUSDC: string;
  license: LicenseType;
  requesterAddress: string;
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
  resourceType?: ResourceType;
  status: "Draft" | "Open" | "Submitted";
  agentConsumable: boolean;
  createdAt: string;
  delivery?: AgentRequestDelivery;
};

export type AgentRequestDelivery = {
  providerAddress: string;
  deliveryText: string;
  deliveryURI: string;
  deliveryHash: string;
  submittedAt: string;
};

type Store = {
  resources: InstantResource[];
  requests: AgentRequestDraft[];
};

let resourcesSeededPromise: Promise<void> | null = null;
let requestsSeededPromise: Promise<void> | null = null;

const globalStore = globalThis as typeof globalThis & {
  kxPlatformAgentStore?: Store;
};

function getStore(): Store {
  if (!globalStore.kxPlatformAgentStore) {
    globalStore.kxPlatformAgentStore = {
      resources: [],
      requests: [
        {
          id: "mcp-integration-for-procurement-agent",
          title: "Build an MCP integration for CRM synchronization",
          description:
            "Design an MCP integration that lets an agent synchronize CRM accounts, contacts, and activity summaries into a structured knowledge workflow.",
          requirements:
            "Deliver tool definitions, request/response schemas, sync boundaries, credential handling notes, and a short implementation plan.",
          category: "Developer Tools",
          tags: ["MCP", "CRM", "Agents"],
          budgetUSDC: "7.2",
          license: "Apache-2.0",
          requesterAddress: "0x4444444444444444444444444444444444444444",
          participantType: "organization",
          userType: "HUMAN",
          entityType: "ORGANIZATION",
          participantName: "Autonomous Economy Lab",
          operatorAddress: "0x4444444444444444444444444444444444444444",
          identitySource: "self_declared",
          status: "Open",
          agentConsumable: true,
          createdAt: new Date().toISOString()
        },
        {
          id: "semantic-retrieval-pipeline-design",
          title: "Design a semantic retrieval pipeline for regulatory content",
          description:
            "Design a retrieval pipeline for regulatory content that agents can cite, filter by jurisdiction, and rank by freshness.",
          requirements:
            "Provide chunk schema, metadata fields, jurisdiction tags, ranking signals, citation format, failure modes, and an evaluation plan.",
          category: "Knowledge Engineering",
          tags: ["Retrieval", "RAG", "Metadata"],
          budgetUSDC: "7.8",
          license: "CC-BY-4.0",
          requesterAddress: "0x4444444444444444444444444444444444444444",
          participantType: "organization",
          userType: "HUMAN",
          entityType: "ORGANIZATION",
          participantName: "Regulatory Systems Lab",
          operatorAddress: "0x4444444444444444444444444444444444444444",
          identitySource: "self_declared",
          status: "Open",
          agentConsumable: true,
          createdAt: new Date().toISOString()
        },
        {
          id: "enterprise-agent-compliance-checklist",
          title: "Create an enterprise AI evaluation rubric",
          description:
            "Create a rubric for evaluating enterprise AI workflows before they are approved for internal production use.",
          requirements:
            "Include scoring categories, pass/fail criteria, risk tiers, evidence requirements, and reviewer guidance.",
          category: "AI Governance",
          tags: ["Evaluation", "Governance", "Compliance"],
          budgetUSDC: "5.9",
          license: "Commercial Use Allowed",
          requesterAddress: "0x4444444444444444444444444444444444444444",
          participantType: "human",
          userType: "HUMAN",
          entityType: "INDIVIDUAL",
          participantName: "Independent Governance Researcher",
          identitySource: "self_declared",
          status: "Open",
          agentConsumable: true,
          createdAt: new Date().toISOString()
        },
        {
          id: "prompt-library-optimization-review",
          title: "Develop a prompt QA framework for support agents",
          description:
            "Develop a QA framework for support-agent prompts across accuracy, tone, escalation, and response structure.",
          requirements:
            "Return evaluation categories, regression cases, failure examples, approval criteria, and a release-readiness checklist.",
          category: "Prompt Engineering",
          tags: ["Prompt QA", "Support Agents", "Evaluation"],
          budgetUSDC: "4.1",
          license: "Personal Use Only",
          requesterAddress: "0x4444444444444444444444444444444444444444",
          participantType: "agent",
          userType: "AGENT",
          entityType: "INDIVIDUAL",
          participantName: "SupportAgent-QA",
          operatorAddress: "0x4444444444444444444444444444444444444444",
          identitySource: "self_declared",
          status: "Open",
          agentConsumable: true,
          createdAt: new Date().toISOString()
        },
        {
          id: "structured-json-knowledge-base",
          title: "Build a structured financial knowledge base",
          description:
            "Convert financial policy notes into an agent-consumable knowledge base with source metadata, tags, and license fields.",
          requirements:
            "Deliver a JSON schema, representative records, validation notes, citation fields, and recommendations for durable storage.",
          category: "Financial Knowledge",
          tags: ["Finance", "Knowledge Base", "JSON"],
          budgetUSDC: "5.2",
          license: "MIT",
          requesterAddress: "0x4444444444444444444444444444444444444444",
          participantType: "organization",
          userType: "HUMAN",
          entityType: "ORGANIZATION",
          participantName: "Structured Finance Ops",
          operatorAddress: "0x4444444444444444444444444444444444444444",
          identitySource: "self_declared",
          status: "Open",
          agentConsumable: true,
          createdAt: new Date().toISOString()
        },
        {
          id: "ai-evaluation-rubric-for-paid-resources",
          title: "Design an agent governance review process",
          description:
            "Design a review process for agents that request, purchase, transform, and reuse paid knowledge resources.",
          requirements:
            "Include role definitions, approval checkpoints, license checks, escalation paths, and a concise JSON review output.",
          category: "Agent Governance",
          tags: ["Governance", "Agents", "Review"],
          budgetUSDC: "4.8",
          license: "CC0",
          requesterAddress: "0x4444444444444444444444444444444444444444",
          participantType: "agent",
          userType: "AGENT",
          entityType: "INDIVIDUAL",
          participantName: "GovernanceAgent-Review",
          operatorAddress: "0x4444444444444444444444444444444444444444",
          identitySource: "self_declared",
          status: "Open",
          agentConsumable: true,
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  return globalStore.kxPlatformAgentStore;
}

function withArcNativeResource(resource: InstantResource): InstantResource {
  return {
    ...resource,
    identitySource: resource.identitySource ?? getIdentitySource(resource.arcIdentityId)
  };
}

function withArcNativeRequest(request: AgentRequestDraft): AgentRequestDraft {
  return {
    ...request,
    arcJobId: request.arcJobId ?? createArcJobId(request.id),
    identitySource: request.identitySource ?? getIdentitySource(request.arcIdentityId),
    providerIdentitySource:
      request.providerIdentitySource ?? getIdentitySource(request.providerArcIdentityId)
  };
}

export function getServerResources(): InstantResource[] {
  const bundled = getInstantResources();
  const published = getStore().resources;
  const bundledIds = new Set(bundled.map((resource) => resource.id));

  return [...published.filter((resource) => !bundledIds.has(resource.id)), ...bundled].map(
    withArcNativeResource
  );
}

async function ensureDbResourcesSeeded() {
  if (!isPostgresEnabled()) return;

  resourcesSeededPromise ??= (async () => {
    for (const resource of getInstantResources()) {
      const arcNativeResource = withArcNativeResource(resource);
      await pgQuery(
        `
          INSERT INTO resources (id, data, created_at, updated_at)
          VALUES ($1, $2::jsonb, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `,
        [arcNativeResource.id, JSON.stringify(arcNativeResource)]
      );
      await upsertParticipant({
        walletAddress: resource.sellerAddress,
        userType: resource.userType ?? null,
        entityType: resource.entityType ?? null,
        participantType: resource.participantType ?? null,
        participantName: resource.participantName ?? resource.sellerName ?? null,
        operatorAddress: resource.operatorAddress ?? null,
        arcIdentityId: resource.arcIdentityId ?? null,
        identitySource: resource.identitySource ?? getIdentitySource(resource.arcIdentityId),
        data: { source: "resource_seed", resourceId: resource.id }
      });
    }
  })();

  await resourcesSeededPromise;
}

async function ensureDbRequestsSeeded() {
  if (!isPostgresEnabled()) return;

  requestsSeededPromise ??= (async () => {
    for (const request of getStore().requests.map(withArcNativeRequest)) {
      await pgQuery(
        `
          INSERT INTO requests (id, arc_job_id, data, created_at, updated_at)
          VALUES ($1, $2, $3::jsonb, $4::timestamptz, NOW())
          ON CONFLICT (id) DO NOTHING
        `,
        [request.id, request.arcJobId ?? createArcJobId(request.id), JSON.stringify(request), request.createdAt]
      );
      await upsertParticipant({
        walletAddress: request.requesterAddress,
        userType: request.userType ?? null,
        entityType: request.entityType ?? null,
        participantType: request.participantType ?? null,
        participantName: request.participantName ?? null,
        operatorAddress: request.operatorAddress ?? null,
        arcIdentityId: request.arcIdentityId ?? null,
        identitySource: request.identitySource ?? getIdentitySource(request.arcIdentityId),
        data: { source: "request_seed", requestId: request.id }
      });
    }
  })();

  await requestsSeededPromise;
}

export async function getServerResourcesAsync(): Promise<InstantResource[]> {
  if (!isPostgresEnabled()) return getServerResources();

  await ensureDbResourcesSeeded();
  const rows = await pgQuery<{ data: InstantResource }>(
    "SELECT data FROM resources ORDER BY COALESCE((data->>'featured')::boolean, false) DESC, created_at DESC"
  );
  return rows.length > 0
    ? rows.map((row) => withArcNativeResource(row.data))
    : getServerResources();
}

export function getServerResourceById(id: string): InstantResource | undefined {
  return getServerResources().find((resource) => resource.id === id);
}

export async function getServerResourceByIdAsync(
  id: string
): Promise<InstantResource | undefined> {
  if (!isPostgresEnabled()) return getServerResourceById(id);

  await ensureDbResourcesSeeded();
  const rows = await pgQuery<{ data: InstantResource }>(
    "SELECT data FROM resources WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0]?.data ? withArcNativeResource(rows[0].data) : getServerResourceById(id);
}

export function publishServerResource(
  input: Omit<InstantResource, "id" | "accessType"> & { id?: string }
) {
  const resource: InstantResource = {
    ...input,
    id: input.id || createLocalResourceId(input.title),
    accessType: "instant",
    identitySource: input.identitySource ?? getIdentitySource(input.arcIdentityId)
  };
  getStore().resources.unshift(resource);
  return resource;
}

export async function publishServerResourceAsync(
  input: Omit<InstantResource, "id" | "accessType"> & { id?: string }
) {
  const resource = publishServerResource(input);

  if (!isPostgresEnabled()) return resource;

  await ensureDbResourcesSeeded();
  await pgQuery(
    `
      INSERT INTO resources (id, data, created_at, updated_at)
      VALUES ($1, $2::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [resource.id, JSON.stringify(resource)]
  );
  await upsertParticipant({
    walletAddress: resource.sellerAddress,
    userType: resource.userType ?? null,
    entityType: resource.entityType ?? null,
    participantType: resource.participantType ?? null,
    participantName: resource.participantName ?? resource.sellerName ?? null,
    operatorAddress: resource.operatorAddress ?? null,
    arcIdentityId: resource.arcIdentityId ?? null,
    identitySource: resource.identitySource ?? getIdentitySource(resource.arcIdentityId),
    data: { source: "resource_publish", resourceId: resource.id }
  });

  return resource;
}

export function getServerRequests(): AgentRequestDraft[] {
  return getStore().requests.map(withArcNativeRequest);
}

export async function getServerRequestsAsync(): Promise<AgentRequestDraft[]> {
  if (!isPostgresEnabled()) return getServerRequests();

  await ensureDbRequestsSeeded();
  const rows = await pgQuery<{ data: AgentRequestDraft }>(
    "SELECT data FROM requests ORDER BY created_at DESC"
  );
  return rows.length > 0
    ? rows.map((row) => withArcNativeRequest(row.data))
    : getServerRequests();
}

export function createServerRequest(input: Omit<AgentRequestDraft, "id" | "status" | "createdAt">) {
  const id = createLocalResourceId(input.title);
  const request: AgentRequestDraft = {
    ...input,
    id,
    arcJobId: input.arcJobId ?? createArcJobId(id),
    identitySource: input.identitySource ?? getIdentitySource(input.arcIdentityId),
    status: "Draft",
    createdAt: new Date().toISOString()
  };
  getStore().requests.unshift(request);
  return request;
}

export async function createServerRequestAsync(
  input: Omit<AgentRequestDraft, "id" | "status" | "createdAt">
) {
  const request = createServerRequest(input);

  if (!isPostgresEnabled()) return request;

  await ensureDbRequestsSeeded();
  await pgQuery(
    `
      INSERT INTO requests (id, arc_job_id, data, created_at, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::timestamptz, NOW())
      ON CONFLICT (id) DO UPDATE SET
        arc_job_id = EXCLUDED.arc_job_id,
        data = EXCLUDED.data,
        updated_at = NOW()
    `,
    [request.id, request.arcJobId ?? createArcJobId(request.id), JSON.stringify(request), request.createdAt]
  );
  await upsertParticipant({
    walletAddress: request.requesterAddress,
    userType: request.userType ?? null,
    entityType: request.entityType ?? null,
    participantType: request.participantType ?? null,
    participantName: request.participantName ?? null,
    operatorAddress: request.operatorAddress ?? null,
    arcIdentityId: request.arcIdentityId ?? null,
    identitySource: request.identitySource ?? getIdentitySource(request.arcIdentityId),
    data: { source: "request_create", requestId: request.id }
  });

  return request;
}

export function submitServerRequestDelivery({
  requestId,
  providerAddress,
  providerParticipantType,
  providerUserType,
  providerEntityType,
  providerParticipantName,
  providerOperatorAddress,
  providerArcIdentityId,
  deliveryText,
  deliveryURI,
  deliveryHash
}: {
  requestId: string;
  providerAddress: string;
  providerParticipantType?: ParticipantType;
  providerUserType?: UserType;
  providerEntityType?: EntityType;
  providerParticipantName?: string;
  providerOperatorAddress?: string;
  providerArcIdentityId?: string;
  deliveryText: string;
  deliveryURI?: string;
  deliveryHash?: string;
}) {
  const request = getStore().requests.find((item) => item.id === requestId);

  if (!request) {
    return null;
  }

  const finalDeliveryURI =
    deliveryURI ||
    `data:application/json;base64,${Buffer.from(
      JSON.stringify({ deliveryText, submittedAt: new Date().toISOString() })
    ).toString("base64")}`;
  const finalDeliveryHash =
    deliveryHash || keccak256(toUtf8Bytes(`${deliveryText}:${finalDeliveryURI}`));
  const delivery: AgentRequestDelivery = {
    providerAddress,
    deliveryText,
    deliveryURI: finalDeliveryURI,
    deliveryHash: finalDeliveryHash,
    submittedAt: new Date().toISOString()
  };

  request.providerAddress = providerAddress;
  request.providerUserType = providerUserType;
  request.providerEntityType = providerEntityType;
  request.providerParticipantType = providerParticipantType;
  request.providerParticipantName = providerParticipantName;
  request.providerOperatorAddress = providerOperatorAddress;
  request.providerArcIdentityId = providerArcIdentityId;
  request.providerIdentitySource = getIdentitySource(providerArcIdentityId);
  request.status = "Submitted";
  request.delivery = delivery;
  return { request, delivery };
}

export async function submitServerRequestDeliveryAsync(
  input: Parameters<typeof submitServerRequestDelivery>[0]
) {
  if (!isPostgresEnabled()) return submitServerRequestDelivery(input);

  await ensureDbRequestsSeeded();
  const rows = await pgQuery<{ data: AgentRequestDraft }>(
    "SELECT data FROM requests WHERE id = $1 LIMIT 1",
    [input.requestId]
  );
  const request = rows[0]?.data;

  if (!request) return submitServerRequestDelivery(input);

  getStore().requests = getStore().requests.filter((item) => item.id !== request.id);
  getStore().requests.unshift(request);
  const result = submitServerRequestDelivery(input);

  if (!result) return null;

  await pgQuery(
    "UPDATE requests SET data = $2::jsonb, updated_at = NOW() WHERE id = $1",
    [result.request.id, JSON.stringify(result.request)]
  );
  await upsertParticipant({
    walletAddress: result.request.providerAddress,
    userType: result.request.providerUserType ?? null,
    entityType: result.request.providerEntityType ?? null,
    participantType: result.request.providerParticipantType ?? null,
    participantName: result.request.providerParticipantName ?? null,
    operatorAddress: result.request.providerOperatorAddress ?? null,
    arcIdentityId: result.request.providerArcIdentityId ?? null,
    identitySource:
      result.request.providerIdentitySource ?? getIdentitySource(result.request.providerArcIdentityId),
    data: { source: "request_delivery", requestId: result.request.id }
  });

  return result;
}

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && resourceTypeValues.includes(value as ResourceType);
}

export function isLicenseType(value: unknown): value is LicenseType {
  return typeof value === "string" && licenseValues.includes(value as LicenseType);
}

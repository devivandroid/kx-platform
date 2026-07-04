import { isAddress } from "ethers";
import { NextResponse, type NextRequest } from "next/server";
import { getIdentitySource, normalizeArcIdentityId } from "@/lib/arcNative";
import { resolveArcIdentity } from "@/lib/server/arc/arcIdentity";
import {
  getEntityTypeFromLegacy,
  getLegacyParticipantType,
  isEntityType,
  isParticipantType,
  isUserType
} from "@/lib/participants";
import {
  isLicenseType,
  isResourceType,
  parseTags,
  publishServerResourceAsync
} from "@/lib/server/agentMockStore";
import { isValidUsdcAmount } from "@/lib/validateUsdcAmount";
import type { DeliveryType, ResourceFile } from "@/types/resource";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const required = [
    "title",
    "description",
    "resourceType",
    "priceUSDC",
    "license",
    "sellerAddress"
  ];
  const missing = required.filter((field) => !body[field]);

  if (missing.length > 0) {
    return NextResponse.json({ error: "MISSING_FIELDS", missing }, { status: 400 });
  }

  if (!isResourceType(body.resourceType) || !isLicenseType(body.license)) {
    return NextResponse.json({ error: "INVALID_METADATA" }, { status: 400 });
  }

  const priceUSDC = body.priceUSDC;

  if (!isValidUsdcAmount(priceUSDC)) {
    return NextResponse.json(
      { error: "INVALID_PRICE_USDC", message: "priceUSDC must be a positive USDC amount." },
      { status: 400 }
    );
  }

  const sellerAddress = body.sellerAddress;

  if (typeof sellerAddress !== "string" || !isAddress(sellerAddress)) {
    return NextResponse.json({ error: "INVALID_SELLER_ADDRESS" }, { status: 400 });
  }

  if (
    body.operatorAddress &&
    (typeof body.operatorAddress !== "string" || !isAddress(body.operatorAddress))
  ) {
    return NextResponse.json({ error: "INVALID_OPERATOR_ADDRESS" }, { status: 400 });
  }

  const participantType = isParticipantType(body.participantType)
    ? body.participantType
    : undefined;
  const userType = isUserType(body.userType) ? body.userType : undefined;
  const entityType = isEntityType(body.entityType)
    ? body.entityType
    : participantType
      ? getEntityTypeFromLegacy(participantType)
      : undefined;
  const participantName =
    typeof body.participantName === "string" && body.participantName.trim()
      ? body.participantName.trim()
      : undefined;
  const operatorAddress =
    typeof body.operatorAddress === "string" && body.operatorAddress.trim()
      ? body.operatorAddress.trim()
      : undefined;
  const providedArcIdentityId = normalizeArcIdentityId(body.arcIdentityId);
  const resolvedIdentity = providedArcIdentityId
    ? {
        arcIdentityId: providedArcIdentityId,
        identitySource: getIdentitySource(providedArcIdentityId)
      }
    : await resolveArcIdentity(sellerAddress);
  const arcIdentityId = resolvedIdentity.arcIdentityId;
  const identitySource = resolvedIdentity.identitySource;
  const deliveryType = body.deliveryType === "download" ? "download" : "inline";
  const files = Array.isArray(body.files) ? (body.files as ResourceFile[]) : [];

  if (deliveryType === "download" && files.length === 0) {
    return NextResponse.json(
      { error: "MISSING_FILES", message: "Downloadable resources require at least one file." },
      { status: 400 }
    );
  }

  const resource = await publishServerResourceAsync({
    id: typeof body.id === "string" ? body.id : undefined,
    title: String(body.title),
    description: String(body.description),
    resourceType: body.resourceType,
    category: String(body.category || "Uncategorized"),
    tags: parseTags(body.tags),
    priceUSDC,
    license: body.license,
    sellerName: participantName,
    userType,
    entityType,
    participantType: participantType ?? (userType ? getLegacyParticipantType(userType) : undefined),
    participantName,
    operatorAddress,
    arcIdentityId,
    identitySource,
    sellerAddress,
    deliveryType: deliveryType as DeliveryType,
    previewText: String(body.previewText || body.description),
    lockedContentURI: "server-memory://resource",
    unlockedContentMock:
      typeof body.unlockedContentMock === "string" ? body.unlockedContentMock : undefined,
    files,
    agentConsumable: Boolean(body.agentConsumable)
  });

  return NextResponse.json(
    {
      resource,
      endpoint: `/api/resources/${resource.id}`,
      purchaseEndpoint: `/api/resources/${resource.id}`,
      message:
        "Resource published. With DATABASE_URL configured, it is persisted in PostgreSQL."
    },
    { status: 201 }
  );
}

import { isAddress } from "ethers";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeArcIdentityId } from "@/lib/arcNative";
import {
  getEntityTypeFromLegacy,
  getLegacyParticipantType,
  isEntityType,
  isParticipantType,
  isUserType
} from "@/lib/participants";
import { submitServerRequestDeliveryAsync } from "@/lib/server/agentMockStore";
import { trackReputationEventAsync } from "@/lib/server/reputation/reputationEventStore";

type SubmitRouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: SubmitRouteContext) {
  const { id } = await context.params;
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (typeof body.providerAddress !== "string" || !isAddress(body.providerAddress)) {
    return NextResponse.json({ error: "INVALID_PROVIDER_ADDRESS" }, { status: 400 });
  }

  if (typeof body.deliveryText !== "string" || !body.deliveryText.trim()) {
    return NextResponse.json({ error: "INVALID_DELIVERY_TEXT" }, { status: 400 });
  }

  if (
    body.deliveryHash !== undefined &&
    (typeof body.deliveryHash !== "string" || !/^0x[A-Fa-f0-9]{64}$/.test(body.deliveryHash))
  ) {
    return NextResponse.json({ error: "INVALID_DELIVERY_HASH" }, { status: 400 });
  }

  if (
    body.providerOperatorAddress &&
    (typeof body.providerOperatorAddress !== "string" || !isAddress(body.providerOperatorAddress))
  ) {
    return NextResponse.json({ error: "INVALID_PROVIDER_OPERATOR_ADDRESS" }, { status: 400 });
  }

  const providerParticipantType = isParticipantType(body.providerParticipantType)
    ? body.providerParticipantType
    : undefined;
  const providerUserType = isUserType(body.providerUserType)
    ? body.providerUserType
    : undefined;
  const providerEntityType = isEntityType(body.providerEntityType)
    ? body.providerEntityType
    : providerParticipantType
      ? getEntityTypeFromLegacy(providerParticipantType)
      : undefined;
  const providerParticipantName =
    typeof body.providerParticipantName === "string" && body.providerParticipantName.trim()
      ? body.providerParticipantName.trim()
      : undefined;
  const providerOperatorAddress =
    typeof body.providerOperatorAddress === "string" && body.providerOperatorAddress.trim()
      ? body.providerOperatorAddress.trim()
      : undefined;
  const providerArcIdentityId = normalizeArcIdentityId(body.providerArcIdentityId);

  const result = await submitServerRequestDeliveryAsync({
    requestId: id,
    providerAddress: body.providerAddress,
    providerUserType,
    providerEntityType,
    providerParticipantType: providerParticipantType ?? (providerUserType ? getLegacyParticipantType(providerUserType) : undefined),
    providerParticipantName,
    providerOperatorAddress,
    providerArcIdentityId,
    deliveryText: body.deliveryText,
    deliveryURI: typeof body.deliveryURI === "string" ? body.deliveryURI : undefined,
    deliveryHash: typeof body.deliveryHash === "string" ? body.deliveryHash : undefined
  });

  if (!result) {
    return NextResponse.json({ error: "REQUEST_NOT_FOUND", requestId: id }, { status: 404 });
  }

  await trackReputationEventAsync({
    walletAddress: body.providerAddress,
    counterpartyAddress: result.request.requesterAddress,
    eventType: "DELIVERY_SUBMITTED",
    requestId: id,
    metadata: {
      deliveryHash: result.delivery.deliveryHash,
      userType: providerUserType ?? null,
      userTypeSource: providerUserType ? "explicit" : null,
      userTypeExplicit: Boolean(providerUserType),
      entityType: providerEntityType ?? null,
      participantType: result.request.providerParticipantType ?? null,
      participantName: providerParticipantName ?? null,
      operatorAddress: providerOperatorAddress ?? null,
      providerArcIdentityId: providerArcIdentityId ?? null
    }
  });

  return NextResponse.json({
    requestId: id,
    providerAddress: result.delivery.providerAddress,
    providerUserType,
    providerEntityType,
    providerParticipantType: result.request.providerParticipantType,
    providerParticipantName,
    providerOperatorAddress,
    providerArcIdentityId: result.request.providerArcIdentityId ?? null,
    providerIdentitySource: result.request.providerIdentitySource ?? "self_declared",
    deliveryHash: result.delivery.deliveryHash,
    deliveryURI: result.delivery.deliveryURI,
    message:
      "Deliverable stored. With DATABASE_URL configured, it is persisted in PostgreSQL. Arc-compatible Jobs still require wallet interaction for protected on-chain settlement."
  });
}

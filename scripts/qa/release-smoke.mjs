const baseUrl = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const validResourceId = "production-ready-agent-wallet-patterns";
const downloadableResourceId = "credit-card-fraud-detection-benchmark-package";
const downloadableFilename = "creditcard_sample.csv";
const featuredDatasetId = "synthetic-agent-commerce-benchmark-dataset";
const featuredRiskDatasetId = "agent-financial-reputation-risk-benchmark";
const validTxHash = `0x${"1".repeat(64)}`;
const validBuyer = "0x5555555555555555555555555555555555555555";
const unknownRiskWallet = "0x1234500000000000000000000000000000000000";
const verbose = process.env.QA_VERBOSE === "1";

const results = [];

function record(name, ok, details = "") {
  results.push({ name, ok, details });
  const prefix = ok ? "PASS" : "FAIL";
  if (!ok || verbose) {
    console.log(`${prefix} ${name}${details ? ` - ${details}` : ""}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasNoStackTrace(payload) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return !/Unhandled Runtime Error|Build Error|Runtime Error|stack trace/i.test(text);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "follow",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {})
    }
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return { response, body: await response.json() };
  }

  return { response, body: await response.text() };
}

async function test(name, fn) {
  try {
    await fn();
    record(name, true);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

await test("GET /api/agent-capabilities exposes Arc metadata", async () => {
  const { response, body } = await request("/api/agent-capabilities");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.network?.name === "Arc Testnet", "missing Arc Testnet name");
  assert(body.network?.chainId === 5042002, "wrong chainId");
  assert(body.network?.chainIdHex === "0x4CF4B2", "wrong chainId hex");
  assert(body.network?.nativeGasToken === "USDC", "wrong native gas token");
  assert(body.network?.usdcDecimals === 6, "wrong USDC decimals");
  assert(body.payment?.standard === "HTTP_402_USDC_TRANSFER", "missing payment standard");
  assert(
    body.capabilities?.some((capability) => capability.id === "downloadable_assets"),
    "missing downloadable assets capability"
  );
  assert(
    body.capabilities?.some((capability) => capability.id === "get_resource_ratings"),
    "missing resource ratings capability"
  );
  assert(
    body.capabilities?.some((capability) => capability.id === "rate_resource"),
    "missing rate resource capability"
  );
  assert(
    body.sdk?.repositoryPath === "lib/sdk/kx",
    "missing KX SDK metadata"
  );
  assert(body.risk_intelligence === true, "missing risk_intelligence flag");
  assert(
    body.risk_profile_endpoint === "/api/risk/profile/{wallet}",
    "missing public risk profile endpoint"
  );
  assert(
    body.risk_network_profile_endpoint === "/api/risk/network/{wallet}",
    "missing public risk network endpoint"
  );
  assert(
    body.capabilities?.some((capability) => capability.id === "query_arc_network_risk"),
    "missing Arc Network risk capability"
  );
  assert(
    body.capabilities?.some((capability) => capability.id === "publish_trust_attestation"),
    "missing Trust Attestation publish capability"
  );
  assert(body.participant_risk_profiles === true, "missing participant risk profiles flag");
  assert(body.behavioral_signals === true, "missing behavioral signals flag");
  assert(body.confidence_levels === true, "missing confidence levels flag");
  assert(body.risk_guard === true, "missing risk_guard flag");
  assert(body.risk_guard_endpoint === "/api/risk/guard", "missing risk guard endpoint");
  assert(body.trust_policy_engine === true, "missing trust policy engine flag");
  assert(
    body.trust_policy_endpoint === "/api/trust/policy/evaluate",
    "missing trust policy endpoint"
  );
  assert(body.pre_transaction_risk_checks === true, "missing pre-transaction checks flag");
  assert(body.client_defined_risk_policy === true, "missing client-defined policy flag");
  assert(body.no_data_profiles === true, "missing no-data profiles flag");
  assert(body.no_data_is_not_high_risk === true, "missing no-data safety flag");
  assert(
    body.risk_guard_default_unknown_wallet_behavior === "review",
    "wrong default unknown wallet behavior"
  );
  assert(
    Array.isArray(body.unknown_wallet_behavior) &&
      body.unknown_wallet_behavior.includes("allow") &&
      body.unknown_wallet_behavior.includes("review") &&
      body.unknown_wallet_behavior.includes("block"),
    "missing unknown wallet behavior options"
  );
});

await test("GET /api/reputation returns leaderboard", async () => {
  const { response, body } = await request("/api/reputation?limit=5");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(Array.isArray(body.wallets), "wallets must be an array");
  assert(body.wallets.length > 0, "expected seeded reputation wallets");
});

await test("GET /api/reputation/[wallet] returns wallet score", async () => {
  const { response, body } = await request(
    "/api/reputation/0x8e0a1111111111111111111111111111111125be"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.scope === "KX activity only", "wrong reputation scope");
  assert(typeof body.reputationScore === "number", "missing reputation score");
});

await test("GET /api/reputation/events returns masked recent events", async () => {
  const { response, body } = await request("/api/reputation/events?limit=5");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(Array.isArray(body.events), "events must be an array");
  assert(body.events[0]?.walletAddress?.includes("..."), "wallet should be masked");
});

await test("GET /api/reputation/model returns methodology", async () => {
  const { response, body } = await request("/api/reputation/model");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.scope === "KX activity only", "wrong model scope");
  assert(body.scoring?.startingScore === 500, "missing starting score");
});

await test("GET /api/risk/profile/[wallet] returns full RiskProfile", async () => {
  const { response, body } = await request(
    "/api/risk/profile/0x8e0a1111111111111111111111111111111125be"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.service === "KX Public Risk Intelligence Service", "wrong service");
  assert(body.dataSource, "missing dataSource");
  assert(typeof body.scores?.financialBehaviorScore === "number", "missing behavior score");
  assert(Array.isArray(body.behavioralSignals), "missing behavioral signals");
  assert(Array.isArray(body.riskSignals), "missing risk signals");
});

await test("GET /api/risk/network/[wallet] returns Arc Network profile", async () => {
  const { response, body } = await request(
    "/api/risk/network/0x8e0a1111111111111111111111111111111125be"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(["arc_network", "no_data"].includes(body.dataSource), "wrong network dataSource");
  assert(body.network === "Arc Testnet", "wrong network");
  assert(Array.isArray(body.riskSignals), "missing network risk signals");
});

await test("GET /api/risk/profile source=combined returns combined-compatible profile", async () => {
  const { response, body } = await request(
    "/api/risk/profile/0x8e0a1111111111111111111111111111111125be?source=combined"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(
    ["combined", "knowledge_exchange", "arc_network", "no_data"].includes(body.dataSource),
    "wrong combined dataSource"
  );
  assert(body.scores, "missing scores");
});

await test("GET /api/risk/summary/[wallet] returns compact summary", async () => {
  const { response, body } = await request(
    "/api/risk/summary/0x8e0a1111111111111111111111111111111125be"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.summary?.riskTier, "missing risk tier");
  assert(body.summary?.confidenceLevel, "missing confidence level");
  assert(body.participant?.userType, "missing user type");
  assert(body.participant?.entityType, "missing entity type");
});

await test("GET /api/risk/signals/[wallet] returns signals", async () => {
  const { response, body } = await request(
    "/api/risk/signals/0x8e0a1111111111111111111111111111111125be"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(Array.isArray(body.behavioralSignals), "missing behavioral signals");
  assert(Array.isArray(body.riskSignals), "missing risk signals");
});

await test("GET /api/risk/snapshots/[wallet] returns Trust Snapshot history", async () => {
  const { response, body } = await request(
    "/api/risk/snapshots/0x8e0a1111111111111111111111111111111125be"
  );
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.service === "KX Trust Engine", "wrong trust service");
  assert(Array.isArray(body.snapshots), "snapshots must be an array");
  assert("latest" in body, "missing latest snapshot field");
});

await test("GET /api/risk/model returns public methodology", async () => {
  const { response, body } = await request("/api/risk/model");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.service === "KX Public Risk Intelligence Service", "wrong service");
  assert(body.scoring?.financialBehaviorScore?.startingScore === 500, "missing starting score");
});

await test("GET /api/risk/participants returns demo participant summaries", async () => {
  const { response, body } = await request("/api/risk/participants?limit=5");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(Array.isArray(body.participants), "participants must be an array");
  assert(body.participants.length > 0, "expected seeded participants");
  assert(body.participants[0]?.summary?.riskTier, "missing participant risk summary");
});

await test("GET /api/risk/profile unknown wallet returns neutral no_data profile", async () => {
  const { response, body } = await request(`/api/risk/profile/${unknownRiskWallet}`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profileStatus === "no_data", "expected profileStatus=no_data");
  assert(body.scores?.riskTier === "Unknown", "expected Unknown risk tier");
  assert(body.scores?.riskTier !== "High", "unknown wallet must not be High risk");
  assert(body.scores?.riskScore === null, "expected null risk score");
  assert(body.scores?.financialBehaviorScore === null, "expected null behavior score");
});

await test("GET /api/risk/summary unknown wallet returns no_data summary", async () => {
  const { response, body } = await request(`/api/risk/summary/${unknownRiskWallet}`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profileStatus === "no_data", "expected profileStatus=no_data");
  assert(body.summary?.riskTier === "Unknown", "expected Unknown risk tier");
  assert(body.summary?.riskScore === null, "expected null risk score");
  assert(body.summary?.activityLevel === "Unknown", "expected Unknown activity level");
  assert(body.summary?.evidenceCount === 0, "expected zero evidence");
});

await test("GET /api/risk/signals unknown wallet returns informational no-data signal", async () => {
  const { response, body } = await request(`/api/risk/signals/${unknownRiskWallet}`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profileStatus === "no_data", "expected profileStatus=no_data");
  assert(Array.isArray(body.behavioralSignals), "missing behavioral signals");
  assert(body.behavioralSignals.length === 0, "expected no behavioral signals");
  assert(body.riskSignals?.[0]?.label === "No KX activity", "missing no-data signal");
  assert(body.riskSignals?.[0]?.severity === "Info", "no-data signal should be informational");
});

await test("POST /api/risk/guard permissive policy returns allow or review", async () => {
  const { response, body } = await request("/api/risk/guard", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0x8e0a1111111111111111111111111111111125be",
      policy: {
        maxRiskScore: 100,
        allowedRiskTiers: ["Low", "Medium", "High", "Unknown"],
        minimumConfidenceLevel: "Low",
        allowUnknownParticipantType: true
      }
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(["allow", "review"].includes(body.decision), "expected allow or review");
  assert(typeof body.allowed === "boolean", "missing allowed boolean");
  assert(Array.isArray(body.checks), "missing checks");
});

await test("POST /api/risk/guard unknown wallet defaults to review", async () => {
  const { response, body } = await request("/api/risk/guard", {
    method: "POST",
    body: JSON.stringify({ wallet: unknownRiskWallet, policy: {} })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profileStatus === "no_data", "expected profileStatus=no_data");
  assert(body.decision === "review", "unknown wallet should review by default");
  assert(body.allowed === false, "review should not be allowed");
});

await test("POST /api/risk/guard unknown wallet behavior allow returns allow", async () => {
  const { response, body } = await request("/api/risk/guard", {
    method: "POST",
    body: JSON.stringify({
      wallet: unknownRiskWallet,
      policy: { unknownWalletBehavior: "allow", maxRiskScore: 0 }
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profileStatus === "no_data", "expected profileStatus=no_data");
  assert(body.decision === "allow", "unknown allow policy should allow");
  assert(body.allowed === true, "allow decision should be allowed");
});

await test("POST /api/risk/guard unknown wallet behavior block returns block", async () => {
  const { response, body } = await request("/api/risk/guard", {
    method: "POST",
    body: JSON.stringify({
      wallet: unknownRiskWallet,
      policy: { unknownWalletBehavior: "block" }
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profileStatus === "no_data", "expected profileStatus=no_data");
  assert(body.decision === "block", "unknown block policy should block");
  assert(body.allowed === false, "block decision should not be allowed");
});

await test("POST /api/risk/guard strict maxRiskScore returns block or review", async () => {
  const { response, body } = await request("/api/risk/guard", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0x8e0a1111111111111111111111111111111125be",
      policy: {
        maxRiskScore: 0,
        allowedRiskTiers: ["Low", "Medium"],
        minimumConfidenceLevel: "High",
        allowUnknownParticipantType: false
      }
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(["block", "review"].includes(body.decision), "expected block or review");
  assert(body.allowed === false, "strict policy should not allow");
});

await test("POST /api/trust/policy/evaluate returns policy decision", async () => {
  const { response, body } = await request("/api/trust/policy/evaluate", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0x8e0a1111111111111111111111111111111125be",
      policyId: "basic-safe"
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(["ALLOW", "REVIEW", "BLOCK"].includes(body.decision), "missing policy decision");
  assert(body.policyId === "basic-safe", "wrong policy id");
  assert(Array.isArray(body.reasons), "missing reasons");
  assert(Array.isArray(body.passedRules), "missing passed rules");
  assert(Array.isArray(body.failedRules), "missing failed rules");
  assert("reportHash" in body, "missing report hash");
  assert("signatureStatus" in body, "missing signature status");
});

await test("POST /api/trust/policy/evaluate Basic Safe can allow low-risk wallet", async () => {
  const { response, body } = await request("/api/trust/policy/evaluate", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0x5555555555555555555555555555555555555555",
      policyId: "basic-safe"
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.profile?.policyRiskTier, "missing policy risk tier");
  assert(body.profile?.rawRiskTier, "missing raw risk tier");
  assert(body.decision === "ALLOW", `expected ALLOW for seeded low-risk wallet, got ${body.decision}`);
});

await test("GET /api/resources/search returns resources", async () => {
  const { response, body } = await request("/api/resources/search?q=wallet&agentConsumable=true");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(Array.isArray(body.resources), "resources must be an array");
  assert(
    body.resources.some((resource) => resource.id === validResourceId),
    "valid resource missing"
  );
});

await test("GET /api/resources/[id] returns HTTP 402 payment instructions", async () => {
  const { response, body } = await request(`/api/resources/${validResourceId}`);
  assert(response.status === 402, `expected 402, got ${response.status}`);
  assert(body.ok === false, "expected ok=false");
  assert(body.error === "PAYMENT_REQUIRED", "wrong error");
  assert(body.chainId === 5042002, "wrong chainId");
  assert(body.chainIdHex === "0x4CF4B2", "wrong chainIdHex");
  assert(body.paymentInstructions?.decimals === 6, "wrong payment decimals");
  assert(
    body.paymentVerificationEndpoint?.includes(validResourceId),
    "missing verification endpoint"
  );
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

await test("GET /api/resources/[id]/ratings returns rating summary", async () => {
  const { response, body } = await request(`/api/resources/${downloadableResourceId}/ratings`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.ok === true, "expected ok=true");
  assert(body.summary?.count >= 1, "expected seeded ratings");
  assert(body.summary?.average >= 1, "expected average rating");
});

await test("POST /api/resources/[id]/ratings upserts wallet rating", async () => {
  const walletAddress = "0x5555555555555555555555555555555555555555";
  const { response, body } = await request(`/api/resources/${validResourceId}/ratings`, {
    method: "POST",
    body: JSON.stringify({ walletAddress, rating: 4 })
  });
  assert(response.status === 201, `expected 201, got ${response.status}`);
  assert(body.ok === true, "expected ok=true");
  assert(body.rating?.walletAddress === walletAddress.toLowerCase(), "wallet mismatch");
  assert(body.rating?.rating === 4, "rating mismatch");
  assert(body.summary?.count >= 1, "missing summary");
});

await test("GET downloadable resource exposes file metadata", async () => {
  const { response, body } = await request(`/api/resources/search?q=fraud`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const resource = body.resources?.find((item) => item.id === downloadableResourceId);
  assert(resource, "downloadable resource missing");
  assert(resource.deliveryType === "download", "expected deliveryType=download");
  assert(Array.isArray(resource.files) && resource.files.length >= 5, "missing file metadata");
  assert(
    resource.files.some((file) => file.filename === downloadableFilename),
    "missing CSV metadata"
  );
});

await test("GET /api/resources/search exposes featured premium datasets", async () => {
  const { response, body } = await request("/api/resources/search?q=synthetic");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const commerce = body.resources?.find((item) => item.id === featuredDatasetId);
  const risk = body.resources?.find((item) => item.id === featuredRiskDatasetId);
  assert(commerce?.featured === true, "missing featured commerce dataset");
  assert(risk?.featured === true, "missing featured risk dataset");
  assert(commerce.deliveryType === "download", "commerce dataset must be downloadable");
  assert(risk.deliveryType === "download", "risk dataset must be downloadable");
  assert(commerce.files?.some((file) => file.filename === "agent_commerce_sample.csv"), "missing commerce CSV");
  assert(risk.files?.some((file) => file.filename === "agent_risk_scores.csv"), "missing risk CSV");
});

await test("GET downloadable resource returns deliveryType in 402", async () => {
  const { response, body } = await request(`/api/resources/${downloadableResourceId}`);
  assert(response.status === 402, `expected 402, got ${response.status}`);
  assert(body.deliveryType === "download", "expected deliveryType=download");
  assert(body.paymentInstructions?.amountUSDC === "18.00", "wrong downloadable price");
});

await test("GET download without proof requires payment", async () => {
  const { response, body } = await request(
    `/api/download/${downloadableResourceId}/${downloadableFilename}`
  );
  assert(response.status === 402, `expected 402, got ${response.status}`);
  assert(body.error === "PAYMENT_REQUIRED", "wrong error");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

await test("POST /api/resources/[id]/verify-payment rejects invalid JSON shape", async () => {
  const { response, body } = await request(`/api/resources/${validResourceId}/verify-payment`, {
    method: "POST",
    body: JSON.stringify({ txHash: 123, buyerAddress: null })
  });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  assert(body.ok === false, "expected ok=false");
  assert(body.accessGranted === false, "expected accessGranted=false");
  assert(body.error === "INVALID_INPUT", "wrong error");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

await test("POST /api/resources/[id]/verify-payment rejects fake txHash gracefully", async () => {
  const { response, body } = await request(`/api/resources/${validResourceId}/verify-payment`, {
    method: "POST",
    body: JSON.stringify({ txHash: validTxHash, buyerAddress: validBuyer })
  });
  assert([402, 502].includes(response.status), `expected 402 or 502, got ${response.status}`);
  assert(body.ok === false, "expected ok=false");
  assert(body.accessGranted === false, "expected accessGranted=false");
  assert(typeof body.error === "string", "missing error code");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

await test("GET resource with invalid proof stays payment-required", async () => {
  const { response, body } = await request(
    `/api/resources/${validResourceId}?txHash=fake&buyerAddress=fake`
  );
  assert(response.status === 402, `expected 402, got ${response.status}`);
  assert(body.error === "PAYMENT_REQUIRED", "wrong error");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

await test("GET /api/requests/search returns requests", async () => {
  const { response, body } = await request("/api/requests/search?q=wallet&status=Open");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(Array.isArray(body.requests), "requests must be an array");
});

await test("POST /api/resources/publish accepts valid body", async () => {
  const { response, body } = await request("/api/resources/publish", {
    method: "POST",
    body: JSON.stringify({
      title: `QA Resource ${Date.now()}`,
      description: "QA published resource",
      resourceType: "Technical Guide",
      category: "QA",
      tags: ["QA", "Arc"],
      priceUSDC: "1.25",
      license: "Commercial Use Allowed",
      sellerAddress: "0x1111111111111111111111111111111111111111",
      previewText: "QA preview",
      unlockedContentMock: "# QA payload",
      agentConsumable: true
    })
  });
  assert(response.status === 201, `expected 201, got ${response.status}`);
  assert(body.resource?.id, "missing resource id");
  assert(body.endpoint?.includes(body.resource.id), "missing endpoint");
});

await test("POST /api/resources/publish rejects invalid body", async () => {
  const { response, body } = await request("/api/resources/publish", {
    method: "POST",
    body: JSON.stringify({ title: "Bad" })
  });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  assert(typeof body.error === "string", "missing error code");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

let createdRequestId = "mcp-integration-for-procurement-agent";

await test("POST /api/requests/create accepts valid body", async () => {
  const { response, body } = await request("/api/requests/create", {
    method: "POST",
    body: JSON.stringify({
      title: `Design a support-agent prompt QA framework ${Date.now()}`,
      description:
        "Create a practical framework for testing support-agent prompts across accuracy, tone, escalation, and schema stability.",
      requirements:
        "Return evaluation categories, pass/fail criteria, regression cases, and a concise release checklist.",
      category: "Prompt Engineering",
      tags: ["Prompt QA", "Support Agents", "Evaluation"],
      budgetUSDC: "2.5",
      license: "CC-BY-4.0",
      requesterAddress: "0x4444444444444444444444444444444444444444",
      agentConsumable: true
    })
  });
  assert(response.status === 201, `expected 201, got ${response.status}`);
  assert(body.request?.id, "missing request id");
  createdRequestId = body.request.id;
});

await test("POST /api/requests/create rejects invalid body", async () => {
  const { response, body } = await request("/api/requests/create", {
    method: "POST",
    body: JSON.stringify({ title: "Bad" })
  });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  assert(typeof body.error === "string", "missing error code");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

await test("POST /api/requests/[id]/submit accepts valid body", async () => {
  const { response, body } = await request(`/api/requests/${createdRequestId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      providerAddress: "0x5555555555555555555555555555555555555555",
      deliveryText: "QA delivery notes"
    })
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body.deliveryHash?.startsWith("0x"), "missing delivery hash");
});

await test("POST /api/requests/[id]/submit rejects invalid body", async () => {
  const { response, body } = await request(`/api/requests/${createdRequestId}/submit`, {
    method: "POST",
    body: JSON.stringify({ providerAddress: "fake", deliveryText: "" })
  });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  assert(typeof body.error === "string", "missing error code");
  assert(hasNoStackTrace(body), "response leaked stack trace");
});

const pages = [
  "/",
  "/marketplace",
  `/marketplace/${validResourceId}`,
  "/publish-resource",
  "/requests",
  "/requests/new",
  "/my-activity",
  "/reputation",
  "/walkthrough",
  "/demo",
  "/agent-api",
  "/tasks/0",
  "/create-task",
  "/explore",
  "/my-tasks"
];

for (const page of pages) {
  await test(`GET ${page} renders`, async () => {
    const { response, body } = await request(page);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    assert(typeof body === "string" && body.includes("<html"), "missing html document");
    assert(hasNoStackTrace(body), "page leaked stack trace");
  });
}

const failed = results.filter((result) => !result.ok);
if (verbose) {
  console.log(`QA summary: ${results.length - failed.length}/${results.length} checks passed.`);
}
setTimeout(() => process.exit(failed.length > 0 ? 1 : 0), 1);

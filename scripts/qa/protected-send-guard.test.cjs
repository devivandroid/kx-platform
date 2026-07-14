/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node"
  }
});

const { createSingleExecutionGuard } = require("../../lib/client/singleExecutionGuard.ts");

async function main() {
  let trustChecks = 0;
  let transferCalls = 0;
  const guard = createSingleExecutionGuard("Protected Send test", false);

  async function checkTrustOnly() {
    trustChecks += 1;
    return { decision: "ALLOW" };
  }

  async function continueWithAppKit() {
    return guard.run(async () => {
      transferCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { txHash: "0xtest" };
    });
  }

  await checkTrustOnly();
  assert.equal(trustChecks, 1, "Check trust should run once");
  assert.equal(transferCalls, 0, "Check trust must not execute a transfer");

  await continueWithAppKit();
  assert.equal(transferCalls, 1, "A confirmed transfer should execute once");

  await Promise.all([continueWithAppKit(), continueWithAppKit()]);
  assert.equal(transferCalls, 1, "Repeated Continue clicks after success must not execute another transfer");

  guard.reset();
  await Promise.all([continueWithAppKit(), continueWithAppKit()]);
  assert.equal(transferCalls, 2, "Double-click while in flight should execute only one new transfer");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

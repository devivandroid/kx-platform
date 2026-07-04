import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("KXTrustAttestationRegistry", function () {
  const reportHash = ethers.id("kx-trust-report-v1");

  async function deployFixture() {
    const [owner, publisher, wallet, stranger] = await ethers.getSigners();
    const registry = await ethers.deployContract("KXTrustAttestationRegistry", [
      owner.address,
      publisher.address
    ]);

    return { owner, publisher, wallet, stranger, registry };
  }

  it("publishes a minimal trust attestation from the authorized publisher", async function () {
    const { publisher, wallet, registry } = await deployFixture();

    await expect(
      registry
        .connect(publisher)
        .publishAttestation(
          wallet.address,
          reportHash,
          "Low",
          82,
          "High",
          "kx-trust-engine-v0.1",
          "kx-trust-snapshot:test"
        )
    )
      .to.emit(registry, "TrustAttestationPublished")
      .withArgs(
        0,
        wallet.address,
        reportHash,
        "Low",
        82,
        "High",
        "kx-trust-engine-v0.1",
        "kx-trust-snapshot:test"
      );

    const attestation = await registry.getAttestation(0);
    expect(attestation.id).to.equal(0);
    expect(attestation.wallet).to.equal(wallet.address);
    expect(attestation.reportHash).to.equal(reportHash);
    expect(attestation.riskTier).to.equal("Low");
    expect(attestation.humanProbability).to.equal(82);
    expect(attestation.confidence).to.equal("High");
    expect(attestation.engineVersion).to.equal("kx-trust-engine-v0.1");
    expect(attestation.evidenceURI).to.equal("kx-trust-snapshot:test");
    expect(await registry.reportHashPublished(reportHash)).to.equal(true);
    expect(await registry.getAttestationCount()).to.equal(1);

    const walletAttestations = await registry.getWalletAttestations(wallet.address);
    expect(walletAttestations.length).to.equal(1);
    expect(walletAttestations[0].id).to.equal(0);

    const latestAttestation = await registry.getLatestAttestation(wallet.address);
    expect(latestAttestation.id).to.equal(0);
    expect(await registry.latestAttestationId(wallet.address)).to.equal(0);
  });

  it("returns an empty latest attestation for wallets without attestations", async function () {
    const { stranger, registry } = await deployFixture();

    const latestAttestation = await registry.getLatestAttestation(stranger.address);
    expect(latestAttestation.wallet).to.equal(ethers.ZeroAddress);
    expect(latestAttestation.timestamp).to.equal(0);
    expect(await registry.getWalletAttestations(stranger.address)).to.deep.equal([]);
  });

  it("rejects unauthorized publishers", async function () {
    const { stranger, wallet, registry } = await deployFixture();

    await expect(
      registry
        .connect(stranger)
        .publishAttestation(wallet.address, reportHash, "Low", 50, "High", "v1", "")
    ).to.be.revertedWithCustomError(registry, "UnauthorizedPublisher");
  });

  it("rejects duplicate report hashes", async function () {
    const { publisher, wallet, registry } = await deployFixture();

    await registry
      .connect(publisher)
      .publishAttestation(wallet.address, reportHash, "Low", 82, "High", "v1", "");

    await expect(
      registry
        .connect(publisher)
        .publishAttestation(wallet.address, reportHash, "Low", 82, "High", "v1", "")
    ).to.be.revertedWithCustomError(registry, "DuplicateReportHash");
  });
});

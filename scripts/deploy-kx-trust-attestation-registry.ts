import hre from "hardhat";
import { Wallet } from "ethers";

const { ethers, network } = hre;

const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";

function normalizePrivateKey(value: string | undefined, label: string): string {
  const trimmedValue = value?.trim();
  const prefixedValue = trimmedValue?.startsWith("0x")
    ? trimmedValue
    : `0x${trimmedValue ?? ""}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixedValue)) {
    throw new Error(
      `${label} is missing or invalid. Use a 64-character hex testnet private key, with or without 0x. Never commit it.`
    );
  }

  return prefixedValue;
}

async function main() {
  const publisherPrivateKey = normalizePrivateKey(
    process.env.KX_ATTESTATION_PUBLISHER_PRIVATE_KEY,
    "KX_ATTESTATION_PUBLISHER_PRIVATE_KEY"
  );
  const publisherAddress = new Wallet(publisherPrivateKey).address;
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No deployer account found. Set PRIVATE_KEY in .env.local for contract deployment. Never commit or share it."
    );
  }

  const registry = await ethers.deployContract("KXTrustAttestationRegistry", [
    deployer.address,
    publisherAddress
  ]);

  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  const providerNetwork = await ethers.provider.getNetwork();

  console.log("KXTrustAttestationRegistry deployed");
  console.log(`Contract address: ${contractAddress}`);
  console.log(`Publisher address: ${publisherAddress}`);
  console.log(`Owner address: ${deployer.address}`);
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${providerNetwork.chainId.toString()}`);
  console.log(`Explorer link: ${ARC_TESTNET_EXPLORER_URL}/address/${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

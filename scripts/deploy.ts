import hre from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  if (!deployer) {
    throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY in .env (use a throwaway testnet wallet).");
  }

  const publicClient = await hre.viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Network: ${hre.network.name} (chain ${chainId})`);
  console.log(`Deployer: ${deployer.account.address}`);
  console.log(`Balance: ${balance} wei`);
  if (balance === 0n) {
    throw new Error("Deployer has no test ETH. Get Sepolia test ETH from a faucet, then run again.");
  }

  const registry = await hre.viem.deployContract("DocumentRegistry");
  const block = await publicClient.getBlockNumber();

  const out = {
    network: hre.network.name,
    chainId,
    address: registry.address,
    deployer: deployer.account.address,
    deployedAtBlockApprox: Number(block),
  };
  const dir = join(process.cwd(), "deployments");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${hre.network.name}.json`), JSON.stringify(out, null, 2) + "\n");

  console.log("\nDeployed DocumentRegistry:", registry.address);
  console.log("Saved to deployments/" + hre.network.name + ".json");
  console.log("\nNext: add this line to .env.local");
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${registry.address}`);
  if (hre.network.name === "sepolia") {
    console.log(`Explorer: https://sepolia.etherscan.io/address/${registry.address}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

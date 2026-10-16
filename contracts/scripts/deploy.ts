/**
 * Deploys DocumentRegistry with plain viem (no network plugin needed).
 *   npm run deploy:sepolia          (from the repo root)
 *   NETWORK=bnbTestnet npm run deploy:sepolia   (same contract on BNB testnet)
 * Needs DEPLOYER_PRIVATE_KEY in .env.local at the repo root. Use a throwaway wallet with test funds only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet, hardhat, sepolia } from "viem/chains";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
for (const file of [".env.local", ".env"]) if (existsSync(join(root, file))) config({ path: join(root, file), quiet: true });

const NETWORKS = {
  sepolia: { chain: sepolia, rpc: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io" },
  bnbTestnet: { chain: bscTestnet, rpc: process.env.BNB_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545", explorer: "https://testnet.bscscan.com" },
  // Used only to test this script against `npx hardhat node`. Not a real network.
  local: { chain: hardhat, rpc: "http://127.0.0.1:8545", explorer: "http://localhost" },
} as const;

async function main() {
  const name = (process.env.NETWORK || "sepolia") as keyof typeof NETWORKS;
  const net = NETWORKS[name];
  if (!net) throw new Error(`Unknown NETWORK "${name}". Use sepolia, bnbTestnet or local.`);

  const key = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY in .env.local (64 hex characters). Use a throwaway testnet wallet.");
  }
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);

  const artifactPath = join(here, "..", "artifacts", "src", "DocumentRegistry.sol", "DocumentRegistry.json");
  if (!existsSync(artifactPath)) throw new Error("Contract not built. Run `npm run contracts:build` first.");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi: unknown[]; bytecode: Hex };

  const publicClient = createPublicClient({ chain: net.chain, transport: http(net.rpc) });
  const wallet = createWalletClient({ account, chain: net.chain, transport: http(net.rpc) });

  const chainId = await publicClient.getChainId();
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Network: ${name} (chain ${chainId})`);
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance: ${balance} wei`);
  if (balance === 0n) throw new Error("Deployer has no test funds. Use a faucet, then run again.");

  const hash = await wallet.deployContract({ abi: artifact.abi as never, bytecode: artifact.bytecode });
  console.log(`Deploy transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Deployment failed. See the transaction on the explorer.");

  const out = { network: name, chainId, address: receipt.contractAddress, deployer: account.address, transaction: hash, block: Number(receipt.blockNumber) };
  const dir = join(root, "deployments");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(out, null, 2) + "\n");

  console.log(`\nDeployed DocumentRegistry: ${receipt.contractAddress}`);
  console.log(`Saved to deployments/${name}.json`);
  console.log("\nNext: add this line to .env.local (and to your Vercel environment variables)");
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS=${receipt.contractAddress}`);
  console.log(`Explorer: ${net.explorer}/address/${receipt.contractAddress}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

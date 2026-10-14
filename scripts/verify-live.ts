import { createPublicClient, http, keccak256, toHex } from "viem";
import { sepolia } from "viem/chains";
import { existsSync, readFileSync } from "node:fs";

// Checks that the deployed DocumentRegistry really exists on Sepolia.
// Usage: npm run verify:live   (reads NEXT_PUBLIC_REGISTRY_ADDRESS or deployments/sepolia.json)
const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

function findAddress(): string | null {
  const env = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(env)) return env;
  if (existsSync("deployments/sepolia.json")) {
    return JSON.parse(readFileSync("deployments/sepolia.json", "utf8")).address ?? null;
  }
  return null;
}

async function main() {
  const address = findAddress();
  if (!address) throw new Error("No registry address. Deploy first (npm run deploy:sepolia) or set NEXT_PUBLIC_REGISTRY_ADDRESS.");
  const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
  const chainId = await client.getChainId();
  const code = await client.getCode({ address: address as `0x${string}` });
  if (!code || code === "0x") throw new Error(`No contract code at ${address} on chain ${chainId}.`);
  const probe = keccak256(toHex("courtagent-verify-live-probe"));
  const registered = await client.readContract({
    address: address as `0x${string}`,
    abi: [{ type: "function", name: "isRegistered", stateMutability: "view", inputs: [{ name: "docHash", type: "bytes32" }], outputs: [{ type: "bool" }] }],
    functionName: "isRegistered",
    args: [probe],
  });
  console.log(`OK: contract at ${address} on chain ${chainId} (${code.length / 2 - 1} bytes of code).`);
  console.log(`isRegistered(probe) = ${registered} (expected false)`);
  console.log(`https://sepolia.etherscan.io/address/${address}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });

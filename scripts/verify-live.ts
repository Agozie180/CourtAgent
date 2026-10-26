import { createPublicClient, getAddress, http, keccak256, toHex, type Hex } from "viem";
import { documentRegistryAbi } from "../lib/chain/abi";
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
  await checkSamples(client, getAddress(address));
}

type Sample = {
  name: string;
  kind: string;
  fingerprint: Hex;
  parties: string[];
  fullySigned: boolean;
  transactions: { step: string; block: number; hash: Hex; from: string }[];
};

// Checks every transaction listed in deployments/sepolia-samples.json: it succeeded, it was sent to our contract,
// it is in the stated block, it came from the stated wallet, and the registry now holds the stated record.
async function checkSamples(client: ReturnType<typeof createPublicClient>, contract: string) {
  if (!existsSync("deployments/sepolia-samples.json")) return;
  const samples = JSON.parse(readFileSync("deployments/sepolia-samples.json", "utf8")) as { contract: string; records: Sample[] };
  let problems = 0;
  const fail = (message: string) => { problems += 1; console.log(`  MISMATCH: ${message}`); };
  if (getAddress(samples.contract) !== contract) fail(`samples file names ${samples.contract}, not ${contract}`);
  for (const sample of samples.records) {
    console.log(`\n${sample.name}`);
    for (const tx of sample.transactions) {
      const receipt = await client.getTransactionReceipt({ hash: tx.hash });
      const ok = receipt.status === "success" && receipt.to !== null && getAddress(receipt.to) === contract;
      console.log(`  ${ok ? "OK " : "BAD"} ${tx.step}: block ${receipt.blockNumber} to ${receipt.to}`);
      if (receipt.status !== "success") fail(`${tx.hash} did not succeed`);
      if (receipt.to === null || getAddress(receipt.to) !== contract) fail(`${tx.hash} was not sent to the contract`);
      if (Number(receipt.blockNumber) !== tx.block) fail(`${tx.hash} is in block ${receipt.blockNumber}, not ${tx.block}`);
      if (getAddress(receipt.from) !== getAddress(tx.from)) fail(`${tx.hash} was sent by ${receipt.from}, not ${tx.from}`);
    }
    const record = await client.readContract({ address: contract as Hex, abi: documentRegistryAbi, functionName: "getRecord", args: [sample.fingerprint] });
    const [, , fullySignedAt, kind, parties, signed] = record;
    if (kind !== sample.kind) fail(`kind is ${kind}, not ${sample.kind}`);
    if (parties.map((a) => getAddress(a)).join() !== sample.parties.map((a) => getAddress(a)).join()) fail("the parties on-chain differ from the stated parties");
    if ((fullySignedAt > 0n) !== sample.fullySigned || signed.some((done) => !done) === sample.fullySigned) fail("the signed status differs");
    console.log(`  record: kind ${kind}, ${parties.length} ${parties.length === 1 ? "party" : "parties"}, fully signed: ${fullySignedAt > 0n}`);
  }
  console.log(problems === 0 ? "\nAll sample transactions and records match the contract." : `\n${problems} mismatch(es). Do not publish these lines until they are fixed.`);
  if (problems > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });

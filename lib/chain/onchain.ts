import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { documentRegistryAbi } from "./abi";
import { CHAIN, RPC_URL, getRegistryAddress } from "./config";
import type { DocumentKind, RegistryBackend, RegistryRecord, TxResult } from "./types";

export function createReadClient() {
  return createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
}

/** Ask the wallet (MetaMask or any EIP-1193 wallet) for an account and switch it to Sepolia. */
export async function connectInjectedWallet(): Promise<Address> {
  const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;
  if (!ethereum) throw new Error("No Ethereum wallet found. Install MetaMask, or use Demo Mode.");

  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("The wallet did not return an account.");

  const chainIdHex = `0x${CHAIN.id.toString(16)}`;
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: CHAIN.name,
          nativeCurrency: CHAIN.nativeCurrency,
          rpcUrls: [RPC_URL],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ],
    });
  }
  return getAddress(accounts[0]);
}

export class OnChainRegistry implements RegistryBackend {
  readonly source = "chain" as const;
  private readonly publicClient = createReadClient();

  constructor(private readonly connectedAccount: Address | null) {}

  account(): Address | null {
    return this.connectedAccount;
  }

  private contractAddress(): Address {
    const address = getRegistryAddress();
    if (!address) throw new Error("NEXT_PUBLIC_REGISTRY_ADDRESS is not set. Deploy the contract or use Demo Mode.");
    return address;
  }

  private walletClient() {
    if (typeof window === "undefined" || !window.ethereum || !this.connectedAccount) {
      throw new Error("Connect your wallet first.");
    }
    return createWalletClient({ account: this.connectedAccount, chain: CHAIN, transport: custom(window.ethereum) });
  }

  async register(docHash: Hex, kind: DocumentKind, parties: Address[]): Promise<TxResult> {
    const wallet = this.walletClient();
    const hash = await wallet.writeContract({
      address: this.contractAddress(),
      abi: documentRegistryAbi,
      functionName: "register",
      args: [docHash, kind, parties],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, source: "chain" };
  }

  async sign(docHash: Hex): Promise<TxResult> {
    const wallet = this.walletClient();
    const hash = await wallet.writeContract({
      address: this.contractAddress(),
      abi: documentRegistryAbi,
      functionName: "sign",
      args: [docHash],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, source: "chain" };
  }

  async getRecord(docHash: Hex): Promise<RegistryRecord | null> {
    return readChainRecord(docHash);
  }
}

export async function readChainRecord(docHash: Hex): Promise<RegistryRecord | null> {
  const address = getRegistryAddress();
  if (!address) throw new Error("NEXT_PUBLIC_REGISTRY_ADDRESS is not set.");
  const client = createReadClient();
  const registered = await client.readContract({
    address,
    abi: documentRegistryAbi,
    functionName: "isRegistered",
    args: [docHash],
  });
  if (!registered) return null;
  const [creator, createdAt, fullySignedAt, kind, parties, signed] = await client.readContract({
    address,
    abi: documentRegistryAbi,
    functionName: "getRecord",
    args: [docHash],
  });
  return {
    docHash,
    creator,
    createdAt: Number(createdAt),
    fullySignedAt: Number(fullySignedAt),
    kind,
    parties: [...parties],
    signed: [...signed],
    source: "chain",
  };
}

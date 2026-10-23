import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  getAddress,
  http,
  type Address,
  type EIP1193Provider,
  type Hex,
  type PublicClient,
} from "viem";
import { documentRegistryAbi } from "./abi";
import { CHAIN, RPC_URL, getRegistryAddress, rpcUrls, txUrl } from "./config";
import type { DocumentKind, RegistryBackend, RegistryRecord, TxResult } from "./types";

export function createReadClient(): PublicClient {
  // Several public nodes in a row: if the first is slow or rate-limited, the next answers.
  return createPublicClient({
    chain: CHAIN,
    transport: fallback(rpcUrls().map((url) => http(url, { timeout: 15_000, retryCount: 1 }))),
  });
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

type Receipt = { status: "success" | "reverted" };

/** A transaction can be mined and still fail. Without this check the app would say "recorded" for a record that does not exist. */
export function assertMined(receipt: Receipt, hash: string): void {
  if (receipt.status !== "success") {
    throw new Error(`The transaction was mined but failed, so nothing was recorded. See ${txUrl(hash)}`);
  }
}

export type OnChainOptions = {
  /** Test seam: a ready read client. */
  publicClient?: PublicClient;
  /** Test seam: the wallet to sign with. Defaults to the browser's injected wallet. */
  ethereum?: EIP1193Provider;
  /** Test seam: the contract address. Defaults to the configured one. */
  address?: Address;
};

export class OnChainRegistry implements RegistryBackend {
  readonly source = "chain" as const;
  private readonly publicClient: PublicClient;

  constructor(
    private readonly connectedAccount: Address | null,
    private readonly options: OnChainOptions = {},
  ) {
    this.publicClient = options.publicClient ?? createReadClient();
  }

  account(): Address | null {
    return this.connectedAccount;
  }

  private contractAddress(): Address {
    const address = this.options.address ?? getRegistryAddress();
    if (!address) throw new Error("No registry contract is configured. Set NEXT_PUBLIC_REGISTRY_ADDRESS or use Demo Mode.");
    return address;
  }

  private walletClient() {
    const ethereum = this.options.ethereum ?? (typeof window !== "undefined" ? window.ethereum : undefined);
    if (!ethereum || !this.connectedAccount) throw new Error("Connect your wallet first.");
    return createWalletClient({ account: this.connectedAccount, chain: CHAIN, transport: custom(ethereum as EIP1193Provider) });
  }

  async register(docHash: Hex, kind: DocumentKind, parties: Address[]): Promise<TxResult> {
    const wallet = this.walletClient();
    const hash = await wallet.writeContract({
      address: this.contractAddress(),
      abi: documentRegistryAbi,
      functionName: "register",
      args: [docHash, kind, parties],
    });
    assertMined(await this.publicClient.waitForTransactionReceipt({ hash }), hash);
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
    assertMined(await this.publicClient.waitForTransactionReceipt({ hash }), hash);
    return { hash, source: "chain" };
  }

  async getRecord(docHash: Hex): Promise<RegistryRecord | null> {
    return readChainRecord(docHash, this.publicClient, this.contractAddress());
  }
}

export async function readChainRecord(
  docHash: Hex,
  client: PublicClient = createReadClient(),
  address: Address | null = getRegistryAddress(),
): Promise<RegistryRecord | null> {
  if (!address) throw new Error("No registry contract is configured.");
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

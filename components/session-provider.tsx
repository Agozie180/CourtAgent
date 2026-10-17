"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Address } from "viem";
import { DEMO_LANDLORD, DEMO_OWNER, DEMO_STRANGER, DEMO_TENANT, DEMO_WITNESS, DemoRegistry } from "@/lib/chain/demo";
import { getRegistryAddress } from "@/lib/chain/config";
import { OnChainRegistry, connectInjectedWallet } from "@/lib/chain/onchain";
import type { RegistryBackend } from "@/lib/chain/types";

export type Mode = "demo" | "wallet";
export type DemoActor = "tenant" | "landlord" | "owner" | "witness" | "stranger";

export const DEMO_ACTORS: Record<DemoActor, { label: string; address: Address }> = {
  tenant: { label: "Tenant", address: DEMO_TENANT },
  landlord: { label: "Landlord", address: DEMO_LANDLORD },
  owner: { label: "Property owner or widow", address: DEMO_OWNER },
  witness: { label: "Witness (an extra signer)", address: DEMO_WITNESS },
  stranger: { label: "Someone else (not a party)", address: DEMO_STRANGER },
};

/** On /widow only the owner and a bystander make sense: there is no tenant or landlord in a family property record. */
export function actorsForPath(pathname: string | null): DemoActor[] {
  return pathname?.startsWith("/widow") ? ["owner", "witness", "stranger"] : ["tenant", "landlord", "owner", "witness", "stranger"];
}

type Session = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  chainConfigured: boolean;
  /** The Demo Mode roles offered on this page. */
  actors: DemoActor[];
  demoActor: DemoActor;
  setDemoActor: (actor: DemoActor) => void;
  walletAccount: Address | null;
  connectWallet: () => Promise<void>;
  walletError: string | null;
  /** The address that will sign the next transaction, or null if nobody is connected. */
  account: Address | null;
  registry: RegistryBackend;
};

const SessionContext = createContext<Session | null>(null);
const MODE_KEY = "courtagent.mode";

function browserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const modeListeners = new Set<() => void>();
function subscribeMode(onChange: () => void) {
  modeListeners.add(onChange);
  return () => modeListeners.delete(onChange);
}
function readSavedMode(): Mode {
  try {
    return browserStorage()?.getItem(MODE_KEY) === "wallet" ? "wallet" : "demo";
  } catch {
    return "demo";
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const chainConfigured = getRegistryAddress() !== null;
  // The saved choice is read from browser storage after hydration (the server always renders Demo Mode first).
  const savedMode = useSyncExternalStore(subscribeMode, readSavedMode, () => "demo" as Mode);
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode = (chosenMode ?? savedMode) === "wallet" && chainConfigured ? "wallet" : "demo";
  const pathname = usePathname();
  const actors = useMemo(() => actorsForPath(pathname), [pathname]);
  const [chosenActor, setDemoActor] = useState<DemoActor>("tenant");
  // If the chosen role is not offered on this page (for example Tenant on /widow), use the first one that is.
  const demoActor: DemoActor = actors.includes(chosenActor) ? chosenActor : actors[0];
  const [walletAccount, setWalletAccount] = useState<Address | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const setMode = useCallback((next: Mode) => {
    setChosenMode(next);
    // A wallet error ("No Ethereum wallet found") belongs to Sepolia mode, so it must not follow the user back to Demo Mode.
    if (next === "demo") setWalletError(null);
    try {
      browserStorage()?.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setWalletError(null);
    try {
      setWalletAccount(await connectInjectedWallet());
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Could not connect the wallet.");
    }
  }, []);

  useEffect(() => {
    const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!ethereum?.on || !ethereum.removeListener) return;
    const onAccounts = (accounts: unknown) => {
      const first = Array.isArray(accounts) ? (accounts[0] as string | undefined) : undefined;
      setWalletAccount(first ? (first as Address) : null);
    };
    ethereum.on("accountsChanged", onAccounts);
    return () => ethereum.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const account = mode === "demo" ? DEMO_ACTORS[demoActor].address : walletAccount;

  const registry = useMemo<RegistryBackend>(
    () =>
      mode === "demo"
        ? new DemoRegistry(browserStorage(), () => DEMO_ACTORS[demoActor].address)
        : new OnChainRegistry(walletAccount),
    [mode, demoActor, walletAccount],
  );

  const value = useMemo<Session>(
    () => ({
      mode,
      setMode,
      chainConfigured,
      actors,
      demoActor,
      setDemoActor,
      walletAccount,
      connectWallet,
      walletError: mode === "demo" ? null : walletError,
      account,
      registry,
    }),
    [mode, setMode, chainConfigured, actors, demoActor, walletAccount, connectWallet, walletError, account, registry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

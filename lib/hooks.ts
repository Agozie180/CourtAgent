"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Hex } from "viem";
import type { RegistryBackend, RegistryRecord } from "@/lib/chain/types";
import { parseDocuments, readDocumentsRaw, subscribeDocuments, type SavedDocument } from "@/lib/storage";

const subscribeNothing = () => () => {};

/** The date in the user's own time zone as YYYY-MM-DD. (`toISOString()` is UTC and is a day behind in Lagos after midnight.) */
export function localDateIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The page origin, or "" while rendering on the server and during hydration. */
export function useOrigin(): string {
  return useSyncExternalStore(subscribeNothing, () => window.location.origin, () => "");
}

/** Today's local date, or "" while rendering on the server and during hydration. */
export function useToday(): string {
  return useSyncExternalStore(subscribeNothing, () => localDateIso(), () => "");
}

/** Documents saved in this browser. Updates when this tab or another tab saves one. */
export function useSavedDocuments(): SavedDocument[] {
  const raw = useSyncExternalStore(subscribeDocuments, readDocumentsRaw, () => "[]");
  return useMemo(() => parseDocuments(raw), [raw]);
}

type Lookup = { hash: Hex; registry: RegistryBackend; record: RegistryRecord | null; error: unknown };

/**
 * Reads the registry record for a document hash. An answer is kept with the hash and registry it was read for, so a
 * slow answer for an old text is never shown for a new one, and a request that finished late is thrown away.
 * `refresh()` re-reads after a transaction.
 */
export function useRegistryRecord(registry: RegistryBackend, hash: Hex | null) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!hash) return;
    let cancelled = false;
    registry.getRecord(hash).then(
      (record) => {
        if (!cancelled) setLookup({ hash, registry, record, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setLookup({ hash, registry, record: null, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [registry, hash, tick]);

  const current = hash && lookup && lookup.hash === hash && lookup.registry === registry ? lookup : null;
  return {
    record: current?.record ?? null,
    /** True once the registry has answered for this hash (the answer may be "not recorded"). */
    looked: current !== null && current.error === null,
    error: current?.error ?? null,
    refresh: () => setTick((value) => value + 1),
  };
}

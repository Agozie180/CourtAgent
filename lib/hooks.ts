"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Hex } from "viem";
import type { AiStatus } from "@/lib/ai/provider";
import { localDateIso } from "@/lib/domain/dates";
import type { RegistryBackend, RegistryRecord } from "@/lib/chain/types";
import { parseDocuments, readDocumentsRaw, subscribeDocuments, type SavedDocument } from "@/lib/storage";

const subscribeNothing = () => () => {};

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

// ---------------------------------------------------------------------------------------------
// Which AI mode the server is really in (read from /api/status once, then shared by every component).
// ---------------------------------------------------------------------------------------------
let aiStatusCache: AiStatus | null = null;
let aiStatusRequested = false;
const aiStatusListeners = new Set<() => void>();

function loadAiStatus() {
  if (aiStatusRequested || typeof window === "undefined") return;
  aiStatusRequested = true;
  fetch("/api/status", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: AiStatus | null) => {
      if (data && typeof data.provider === "string") {
        aiStatusCache = data;
        aiStatusListeners.forEach((listener) => listener());
      } else {
        aiStatusRequested = false;
      }
    })
    .catch(() => {
      aiStatusRequested = false;
    });
}

function subscribeAiStatus(onChange: () => void) {
  aiStatusListeners.add(onChange);
  loadAiStatus();
  return () => aiStatusListeners.delete(onChange);
}

/** The server's real AI mode, or null until it has answered (so copy never claims a mode it has not checked). */
export function useAiStatus(): AiStatus | null {
  return useSyncExternalStore(subscribeAiStatus, () => aiStatusCache, () => null);
}

/** Test helper: forget the cached status. */
export function resetAiStatusForTests() {
  aiStatusCache = null;
  aiStatusRequested = false;
}

"use client";

import type { ReactNode } from "react";
import { useAiStatus } from "@/lib/hooks";

export function providerName(provider: string): string {
  return provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "the AI";
}

/** Shows `on` when an AI key is working on this server, `off` when the built-in rules are in use, and `unknown` until the server answers. */
export function AiText({ on, off, unknown }: { on: ReactNode; off: ReactNode; unknown?: ReactNode }) {
  const status = useAiStatus();
  if (!status) return <>{unknown ?? off}</>;
  return <>{status.provider === "offline" ? off : on}</>;
}

/** One honest line about the mode, built from the server's status and, when known, the last response. */
export function useModeNote(lastProvider: string | null, aiError?: string): string {
  const status = useAiStatus();
  if (lastProvider && lastProvider !== "offline") return `Rules plus notes from ${providerName(lastProvider)}.`;
  if (!status) return "Checking which mode this server is in…";
  if (status.provider === "offline") {
    if (status.reason === "disabled") return "Built-in rules only. AI is turned off on this server (AI_PROVIDER=offline). Everything still works.";
    const typo = status.misnamed.length ? ` A variable named ${status.misnamed.join(", ")} was found, but only ANTHROPIC_API_KEY and OPENAI_API_KEY are read.` : "";
    return `Built-in rules only. No AI key is set on this server, and everything still works.${typo}`;
  }
  if (aiError) return `An AI key is set (${providerName(status.provider)}), but the last AI request failed (${aiError}). The built-in rules were used instead.`;
  return `AI mode is on (${providerName(status.provider)}). It adds notes. The fixed rules still decide.`;
}

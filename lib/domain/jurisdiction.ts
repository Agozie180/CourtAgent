/** All 36 states plus the Federal Capital Territory. "FCT" is the value used for Abuja. */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export function isNigerianState(value: unknown): value is NigerianState {
  return typeof value === "string" && (NIGERIAN_STATES as readonly string[]).includes(value);
}

export function stateLabel(state: string): string {
  return state === "FCT" ? "Federal Capital Territory, Abuja" : `${state} State`;
}

const ALIASES: Record<string, NigerianState> = {
  abuja: "FCT",
  "federal capital territory": "FCT",
  "akwa-ibom": "Akwa Ibom",
  "cross-river": "Cross River",
};

/** Find a state named anywhere in free text, for example "a flat in Enugu" or "Abuja". */
export function findStateInText(text: string): NigerianState | null {
  const lower = text.toLowerCase();
  for (const [alias, state] of Object.entries(ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) return state;
  }
  if (/\bfct\b/.test(lower)) return "FCT";
  const sorted = [...NIGERIAN_STATES].sort((a, b) => b.length - a.length);
  for (const state of sorted) {
    if (state === "FCT") continue;
    if (new RegExp(`\\b${state.toLowerCase()}\\b`).test(lower)) return state;
  }
  return null;
}

/**
 * Every state named anywhere in free text (for example an address that says "Surulere, Lagos"). Several can match
 * because street names reuse state names ("Delta Street, Lagos"), so a caller that wants to catch a mismatch should
 * ask whether the state it expects is among them, not whether the first match equals it.
 */
export function statesMentioned(text: string): NigerianState[] {
  const lower = text.toLowerCase();
  const found = new Set<NigerianState>();
  for (const [alias, state] of Object.entries(ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) found.add(state);
  }
  if (/\bfct\b/.test(lower)) found.add("FCT");
  for (const state of NIGERIAN_STATES) {
    if (state === "FCT") continue;
    if (new RegExp(`\\b${state.toLowerCase()}\\b`).test(lower)) found.add(state);
  }
  return [...found];
}

/** A warning when the address names states but not the one chosen for the legal notice, else null. */
export function stateMismatchWarning(address: string, selected: string): string | null {
  const named = statesMentioned(address);
  if (named.length === 0 || named.includes(selected as NigerianState)) return null;
  const list = named.map(stateLabel).join(" and ");
  return `The property address you recorded mentions ${list}, but the state chosen for this notice is ${stateLabel(selected)}. The notice and the legal-aid details follow the state you choose here, so check that it is the state where the property is.`;
}

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

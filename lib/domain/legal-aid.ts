/**
 * Free legal help, by state. Every entry here was taken from an official source (a government site, or the
 * organisation's own site) on 2026-10-17. We list web links only. Phone numbers are left out on purpose: the
 * numbers we could find were for other desks (for example a Freedom of Information officer) or were not labelled
 * for legal aid, and a wrong number is worse than none. Add a number only from the organisation's own page.
 */
export type LegalAidGroup = {
  name: string;
  /** What it is, in one line. */
  about: string;
  /** Official link, if we have a verified one. */
  url?: string;
  /** States it serves. "all" means nationwide. */
  states: "all" | readonly string[];
};

export const LEGAL_AID_GROUPS: readonly LegalAidGroup[] = [
  {
    name: "Legal Aid Council of Nigeria",
    about: "Federal agency that gives free legal help to people who cannot pay for a lawyer.",
    url: "https://www.legalaidcouncil.gov.ng",
    states: "all",
  },
  {
    name: "FIDA Nigeria (International Federation of Women Lawyers)",
    about: "Women lawyers who help women and children with legal problems. See its page on how to access its services.",
    url: "https://fida.org.ng/how-to-access-our-services/",
    states: "all",
  },
  {
    name: "Lagos State Office of the Public Defender",
    about: "Lagos State Ministry of Justice office that gives free legal services to people who cannot afford a lawyer.",
    url: "https://lagosstatemoj.org/public-defender/",
    states: ["Lagos"],
  },
];

export function legalAidFor(state: string): LegalAidGroup[] {
  return LEGAL_AID_GROUPS.filter((group) => group.states === "all" || group.states.includes(state));
}

/** One note for a letter's "before you send it" list. Names only, so a printed letter never carries a wrong number. */
export function legalAidNote(state: string): string {
  const groups = legalAidFor(state);
  const names = groups.map((group) => group.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
  const stateOffice =
    state === "Lagos" ? "" : state === "FCT" ? " You can also ask the Federal Capital Territory's justice office." : ` You can also ask the Ministry of Justice of ${state} State.`;
  return `For free or low-cost legal help you can contact the ${list}.${stateOffice} Find their current contact details on their official websites first.`;
}

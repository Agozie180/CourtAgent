/**
 * Free legal help, by state. Links and numbers were taken from each organisation's own official pages on 2026-10-23.
 * A number is listed only when an official page prints it, and each one carries the page it came from and the label that
 * page gives it. Letters and notes still name the organisations only, so a printed letter never carries a number that has
 * since changed. Re-check before relying on a number.
 */
export type LegalAidPhone = {
  /** The number exactly as the official page prints it. */
  number: string;
  /** What the official page calls it. */
  label: string;
  /** The official page that prints it. */
  source: string;
};

export type LegalAidGroup = {
  name: string;
  /** What it is, in one line. */
  about: string;
  /** Official website. */
  url: string;
  /** Official page with contact details, when it is not the website itself. */
  contactUrl?: string;
  phones: readonly LegalAidPhone[];
  /** States it serves. "all" means nationwide. */
  states: "all" | readonly string[];
};

export const LEGAL_AID_VERIFIED_ON = "2026-10-23";

export const LEGAL_AID_GROUPS: readonly LegalAidGroup[] = [
  {
    name: "Legal Aid Council of Nigeria",
    about: "Federal agency that gives free legal help to people who cannot pay for a lawyer.",
    url: "https://www.legalaidcouncil.gov.ng",
    contactUrl: "https://legalaidcouncil.gov.ng/contact-us/",
    phones: [{ number: "+234 7031915990", label: "Call in Centre", source: "https://legalaidcouncil.gov.ng/contact-us/" }],
    states: "all",
  },
  {
    name: "FIDA Nigeria (International Federation of Women Lawyers)",
    about: "Women lawyers who help women and children with legal problems. Its page says to contact your nearest branch or fill in its complaint form.",
    url: "https://fida.org.ng/how-to-access-our-services/",
    phones: [{ number: "+234 708 849 6115", label: "Contact phone (head office, Abuja)", source: "https://fida.org.ng/how-to-access-our-services/" }],
    states: "all",
  },
  {
    name: "Lagos State Office of the Public Defender",
    about: "Lagos State Ministry of Justice office that gives free legal services to people who cannot afford a lawyer.",
    url: "https://lagosstatemoj.org/public-defender/",
    phones: [
      {
        number: "08146671562",
        label: "Free Legal Line (printed in the Ministry of Justice footer of the Public Defender page, not labelled for this office alone)",
        source: "https://lagosstatemoj.org/public-defender/",
      },
    ],
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

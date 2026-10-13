import { TENANCY_TYPE_LABEL, type TenancyType } from "./lagos-tenancy";
import { findStateInText, isNigerianState } from "./jurisdiction";

export type IntakeFields = {
  state: string | null; // Nigerian state or "FCT"
  // Step 1: what the tenant is looking for
  budgetNgn: number | null; // yearly rent budget
  bedrooms: number | null;
  parlour: boolean | null;
  area: string | null;
  // Step 2: the place they found
  landlordName: string | null;
  tenantName: string | null;
  annualRentNgn: number | null;
  advanceMonths: number | null;
  cautionNgn: number | null;
  tenancyType: TenancyType | null;
  startDate: string | null; // YYYY-MM-DD
  durationMonths: number | null;
};

export type IntakeKey = keyof IntakeFields;

export const emptyIntake = (): IntakeFields => ({
  state: null,
  budgetNgn: null,
  bedrooms: null,
  parlour: null,
  area: null,
  landlordName: null,
  tenantName: null,
  annualRentNgn: null,
  advanceMonths: null,
  cautionNgn: null,
  tenancyType: null,
  startDate: null,
  durationMonths: null,
});

export const INTAKE_ORDER: IntakeKey[] = [
  "state",
  "budgetNgn",
  "bedrooms",
  "parlour",
  "area",
  "landlordName",
  "tenantName",
  "annualRentNgn",
  "advanceMonths",
  "cautionNgn",
  "tenancyType",
  "startDate",
  "durationMonths",
];

const QUESTIONS: Record<IntakeKey, string> = {
  state: "Welcome. Which state is the property in? (For example: Lagos, Abuja, Enugu, Rivers)",
  budgetNgn: "What is your yearly rent budget in naira? (For example: 1.2 million)",
  bedrooms: "How many bedrooms do you need? (A self-contain counts as 1.)",
  parlour: "Do you want a parlour (living room) as well? (yes or no)",
  area: "Which area or town do you prefer? (For example: Yaba, Wuse, Independence Layout, GRA)",
  landlordName: "Great. When you have found a place, what is the landlord's full name as shown on their documents?",
  tenantName: "What is your own full name, as it should appear on the agreement?",
  annualRentNgn: "What yearly rent has the landlord quoted, in naira?",
  advanceMonths: "How many months of rent is the landlord asking you to pay in advance? (For example: 12 months, or 1 year)",
  cautionNgn: "Is there a caution (refundable) deposit? Enter the amount in naira, or 0 if there is none.",
  tenancyType: "What type of tenancy is it? (yearly, monthly, quarterly, half-yearly, or fixed term)",
  startDate: "When does the tenancy start? (Date, for example 2026-12-01)",
  durationMonths: "How long is the tenancy, in months? (For example: 12 months, or 1 year)",
};

export function questionFor(key: IntakeKey): string {
  return QUESTIONS[key];
}

export function nextMissing(fields: IntakeFields): IntakeKey | null {
  return INTAKE_ORDER.find((key) => fields[key] === null) ?? null;
}

export function isComplete(fields: IntakeFields): boolean {
  return nextMissing(fields) === null;
}

export function describeFields(fields: IntakeFields): string[] {
  const lines: string[] = [];
  if (fields.state) lines.push(`State: ${fields.state === "FCT" ? "FCT (Abuja)" : fields.state}`);
  if (fields.budgetNgn !== null) lines.push(`Budget: ${formatNgn(fields.budgetNgn)} a year`);
  if (fields.bedrooms !== null) lines.push(`Bedrooms: ${fields.bedrooms}`);
  if (fields.parlour !== null) lines.push(`Parlour: ${fields.parlour ? "yes" : "no"}`);
  if (fields.area) lines.push(`Area: ${fields.area}`);
  if (fields.landlordName) lines.push(`Landlord: ${fields.landlordName}`);
  if (fields.tenantName) lines.push(`Tenant: ${fields.tenantName}`);
  if (fields.annualRentNgn !== null) lines.push(`Yearly rent: ${formatNgn(fields.annualRentNgn)}`);
  if (fields.advanceMonths !== null) lines.push(`Advance rent: ${fields.advanceMonths} months`);
  if (fields.cautionNgn !== null) lines.push(`Caution deposit: ${formatNgn(fields.cautionNgn)}`);
  if (fields.tenancyType) lines.push(`Tenancy type: ${TENANCY_TYPE_LABEL[fields.tenancyType]}`);
  if (fields.startDate) lines.push(`Start date: ${fields.startDate}`);
  if (fields.durationMonths !== null) lines.push(`Duration: ${fields.durationMonths} months`);
  return lines;
}

export function formatNgn(amount: number): string {
  return `NGN ${Math.round(amount).toLocaleString("en-NG")}`;
}

// ---------------------------------------------------------------------------------------------
// Offline extraction (no API key needed). The AI layer can replace or refine this.
// ---------------------------------------------------------------------------------------------

const KNOWN_AREAS = [
  "victoria island", "ikoyi", "lekki", "ajah", "yaba", "surulere", "ikeja", "maryland", "gbagada", "magodo",
  "ogba", "ojodu", "berger", "ketu", "ikorodu", "festac", "mushin", "oshodi", "isolo", "apapa", "agege",
  "alimosho", "egbeda", "ipaja", "iyana ipaja", "badagry", "epe", "ojota", "ilupeju", "oshodi", "anthony",
  "ogudu", "oworonshoki", "bariga", "somolu", "shomolu", "akoka", "sangotedo", "chevron", "oniru", "ilasamaja",
  "satellite town", "amuwo odofin", "ejigbo", "idimu", "lekki phase 1", "banana island",
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

export function parseMoney(text: string): number | null {
  const lower = text.toLowerCase().replace(/[₦,]/g, "").replace(/\bngn\b|\bnaira\b|\bn(?=\d)/g, " ");
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(million|mil|m|thousand|k)?\b/);
  if (!match) return null;
  let value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "million" || unit === "mil" || unit === "m") value *= 1_000_000;
  else if (unit === "thousand" || unit === "k") value *= 1_000;
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function parseCount(text: string): number | null {
  const lower = text.toLowerCase();
  if (/self[\s-]?contain|studio|mini[\s-]?flat/.test(lower)) return 1;
  const digit = lower.match(/(\d+)\s*(?:bed|room|br\b|bedroom)/) ?? lower.match(/^\s*(\d+)\s*$/);
  if (digit) return parseInt(digit[1], 10);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return value;
  }
  return null;
}

function parseYesNo(text: string): boolean | null {
  const lower = text.toLowerCase().trim();
  if (/\b(no|nope|without|don'?t|not needed|none)\b/.test(lower)) return false;
  if (/\b(yes|yeah|yep|sure|with|please|i do|need)\b/.test(lower) || /parlou?r/.test(lower)) return true;
  return null;
}

export function parseMonths(text: string): number | null {
  const lower = text.toLowerCase();
  const years = lower.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  if (years) return Math.round(parseFloat(years[1]) * 12);
  const months = lower.match(/(\d+)\s*(?:months?|mths?|mo\b)/);
  if (months) return parseInt(months[1], 10);
  const bare = lower.match(/^\s*(\d+)\s*$/);
  if (bare) return parseInt(bare[1], 10);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\s+(?:years?)`).test(lower)) return value * 12;
    if (new RegExp(`\\b${word}\\s+(?:months?)`).test(lower)) return value;
  }
  if (/\ba year\b|\byearly\b|\bone year\b/.test(lower)) return 12;
  return null;
}

export function parseTenancyType(text: string): TenancyType | null {
  const lower = text.toLowerCase();
  if (/half[\s-]?year/.test(lower)) return "half_yearly";
  if (/quarter/.test(lower)) return "quarterly";
  if (/at will/.test(lower)) return "at_will";
  if (/fixed/.test(lower)) return "fixed_term";
  if (/month/.test(lower)) return "monthly";
  if (/year/.test(lower)) return "yearly";
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(text: string): string | null {
  const iso = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return toIso(+iso[1], +iso[2], +iso[3]);
  const dmy = text.toLowerCase().match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/);
  if (dmy) {
    const month = MONTHS.indexOf(dmy[2]);
    if (month >= 0) return toIso(+dmy[3], month + 1, +dmy[1]);
  }
  const slash = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return toIso(+slash[3], +slash[2], +slash[1]); // day/month/year, the Nigerian convention
  return null;
}

function toIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function cleanName(text: string): string | null {
  const cleaned = text
    .replace(/^(my name is|i am|i'm|it is|it's|the landlord is|landlord is|his name is|her name is|name:)\s*/i, "")
    .replace(/[.!]+$/g, "")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= 80 && /[a-zA-Z]/.test(cleaned) ? cleaned : null;
}

/**
 * Pull whatever fields the message gives, using the question that was just asked as a hint.
 * Returns only the fields it found.
 */
export function parseIntakeOffline(message: string, expected: IntakeKey | null): Partial<IntakeFields> {
  const found: Partial<IntakeFields> = {};
  const text = message.trim();
  if (!text) return found;
  const lower = text.toLowerCase();

  const foundState = findStateInText(text);
  if (foundState) found.state = foundState;

  const area = KNOWN_AREAS.find((name) => lower.includes(name));
  if (area) found.area = area.replace(/\b\w/g, (c) => c.toUpperCase());
  if (/\bparlou?r\b/.test(lower) && expected !== "parlour") {
    found.parlour = !/\b(no|without|don'?t)\b[^.]*parlou?r/.test(lower);
  }
  const bedrooms = /(\d+|self[\s-]?contain|studio|\b(?:one|two|three|four|five)\b)\s*(?:-)?\s*(?:bed|room|br\b|bedroom|self)/.test(lower)
    ? parseCount(lower)
    : null;
  if (bedrooms !== null && expected !== "bedrooms") found.bedrooms = bedrooms;

  switch (expected) {
    case "state":
      break; // handled above by findStateInText
    case "budgetNgn": {
      const value = parseMoney(text);
      if (value !== null) found.budgetNgn = value;
      break;
    }
    case "bedrooms": {
      const value = parseCount(text);
      if (value !== null) found.bedrooms = value;
      break;
    }
    case "parlour": {
      const value = parseYesNo(text);
      if (value !== null) found.parlour = value;
      break;
    }
    case "area":
      if (!found.area && text.length <= 60 && /[a-zA-Z]/.test(text)) {
        found.area = text.replace(/^(in|at|around|near)\s+/i, "").replace(/[.!]+$/g, "").trim();
      }
      break;
    case "landlordName": {
      const name = cleanName(text);
      if (name) found.landlordName = name;
      break;
    }
    case "tenantName": {
      const name = cleanName(text);
      if (name) found.tenantName = name;
      break;
    }
    case "annualRentNgn": {
      const value = parseMoney(text);
      if (value !== null) found.annualRentNgn = value;
      break;
    }
    case "advanceMonths": {
      const value = parseMonths(text);
      if (value !== null) found.advanceMonths = value;
      break;
    }
    case "cautionNgn": {
      if (/^\s*(none|no|nil|zero)\s*$/i.test(text)) found.cautionNgn = 0;
      else {
        const value = parseMoney(text);
        if (value !== null) found.cautionNgn = value;
      }
      break;
    }
    case "tenancyType": {
      const value = parseTenancyType(text);
      if (value) found.tenancyType = value;
      break;
    }
    case "startDate": {
      const value = parseDate(text);
      if (value) found.startDate = value;
      break;
    }
    case "durationMonths": {
      const value = parseMonths(text);
      if (value !== null) found.durationMonths = value;
      break;
    }
    default:
      break;
  }
  return found;
}

/** Keep only well-formed values, whatever produced them (offline parser or an AI model). */
export function sanitizeFields(input: unknown): Partial<IntakeFields> {
  const out: Partial<IntakeFields> = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;
  const num = (value: unknown, min: number, max: number): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? Math.round(value) : null;
  const str = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 80 ? value.trim() : null;

  if (isNigerianState(raw.state)) out.state = raw.state;
  const budget = num(raw.budgetNgn, 1, 10_000_000_000);
  if (budget !== null) out.budgetNgn = budget;
  const bedrooms = num(raw.bedrooms, 1, 20);
  if (bedrooms !== null) out.bedrooms = bedrooms;
  if (typeof raw.parlour === "boolean") out.parlour = raw.parlour;
  const area = str(raw.area);
  if (area) out.area = area;
  const landlord = str(raw.landlordName);
  if (landlord) out.landlordName = landlord;
  const tenant = str(raw.tenantName);
  if (tenant) out.tenantName = tenant;
  const rent = num(raw.annualRentNgn, 1, 10_000_000_000);
  if (rent !== null) out.annualRentNgn = rent;
  const advance = num(raw.advanceMonths, 1, 120);
  if (advance !== null) out.advanceMonths = advance;
  const caution = num(raw.cautionNgn, 0, 10_000_000_000);
  if (caution !== null) out.cautionNgn = caution;
  if (typeof raw.tenancyType === "string" && raw.tenancyType in TENANCY_TYPE_LABEL) {
    out.tenancyType = raw.tenancyType as TenancyType;
  }
  if (typeof raw.startDate === "string" && parseDate(raw.startDate)) out.startDate = parseDate(raw.startDate);
  const duration = num(raw.durationMonths, 1, 240);
  if (duration !== null) out.durationMonths = duration;
  return out;
}

export function mergeFields(current: IntakeFields, update: Partial<IntakeFields>): IntakeFields {
  const next = { ...current };
  for (const key of INTAKE_ORDER) {
    const value = update[key];
    if (value !== undefined && value !== null) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

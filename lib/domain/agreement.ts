import { isIsoDate } from "./dates";
import { formatNgn } from "./intake";
import { oneLine, plural } from "./text";
import { DISCLAIMER, TENANCY_TYPE_LABEL, type TenancyType } from "./lagos-tenancy";
import { isNigerianState, stateLabel } from "./jurisdiction";
import { isWalletAddress, sameWallet, walletMessage } from "./wallet";
import { checkAdvanceRentFor, lawNoteFor, noticePeriodFor, ruleFor } from "./tenancy-rules";

export type TenancyTerms = {
  /** Nigerian state of the property, or "FCT". Decides which legal rules CourtAgent can apply. */
  state: string;
  landlordName: string;
  tenantName: string;
  landlordWallet: string;
  tenantWallet: string;
  propertyAddress: string;
  bedrooms: number;
  parlour: boolean;
  annualRentNgn: number;
  advanceMonths: number;
  cautionNgn: number;
  tenancyType: TenancyType;
  startDate: string; // YYYY-MM-DD
  durationMonths: number;
  /** Optional: a notice period the parties agree instead of the default. */
  agreedNotice?: string;
  /** Optional: a third person (a witness or guarantor) who must also sign. Empty or missing means only tenant and landlord. */
  witnessWallet?: string;
};

export type TermsIssue = { field: string; message: string };

const MAX_TEXT = 200;
const MAX_MONEY = 10_000_000_000;


export function validateTerms(terms: Partial<TenancyTerms>): TermsIssue[] {
  const issues: TermsIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  const need = (field: keyof TenancyTerms, label: string) => {
    const value = terms[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) add(field, `${label} is required.`);
  };
  const text = (field: "landlordName" | "tenantName" | "propertyAddress", label: string) => {
    const value = terms[field];
    if (value === undefined || value === null) return;
    if (typeof value !== "string") add(field, `${label} must be text.`);
    else if (oneLine(value).length > MAX_TEXT) add(field, `${label} is too long (most ${MAX_TEXT} characters).`);
  };

  if (!isNigerianState(terms.state)) add("state", "Choose the state the property is in.");
  need("landlordName", "Landlord name");
  need("tenantName", "Tenant name");
  need("propertyAddress", "Property address");
  need("annualRentNgn", "Yearly rent");
  need("startDate", "Start date");
  need("durationMonths", "Duration");
  need("tenancyType", "Tenancy type");
  need("bedrooms", "Number of bedrooms");
  need("cautionNgn", "Caution deposit (enter 0 if there is none)");
  if (terms.parlour !== undefined && typeof terms.parlour !== "boolean") add("parlour", "Parlour must be yes or no.");
  else if (terms.parlour === undefined) add("parlour", "Say whether the property has a parlour.");
  text("landlordName", "Landlord name");
  text("tenantName", "Tenant name");
  text("propertyAddress", "Property address");

  const rent = terms.annualRentNgn;
  if (rent !== undefined && rent !== null && !(typeof rent === "number" && Number.isFinite(rent) && rent > 0 && rent <= MAX_MONEY)) {
    add("annualRentNgn", "Yearly rent must be a number above zero.");
  }
  const caution = terms.cautionNgn;
  if (caution !== undefined && caution !== null && !(typeof caution === "number" && Number.isFinite(caution) && caution >= 0 && caution <= MAX_MONEY)) {
    add("cautionNgn", "The caution deposit must be zero or more.");
  }
  const rooms = terms.bedrooms;
  if (rooms !== undefined && rooms !== null && !(Number.isInteger(rooms) && rooms >= 1 && rooms <= 20)) {
    add("bedrooms", "Bedrooms must be a whole number from 1 to 20.");
  }
  const months = terms.durationMonths;
  if (months !== undefined && months !== null && !(Number.isInteger(months) && months >= 1 && months <= 240)) {
    add("durationMonths", "Duration must be a whole number of months from 1 to 240.");
  }
  if (terms.startDate !== undefined && terms.startDate !== "" && (!isIsoDate(terms.startDate) || terms.startDate < "2000-01-01" || terms.startDate > "2100-12-31")) {
    add("startDate", "Start date must be a real date written as YYYY-MM-DD.");
  }
  // Object.hasOwn: a plain `in` test would accept inherited names such as "toString" or "constructor".
  if (terms.tenancyType !== undefined && !(typeof terms.tenancyType === "string" && Object.hasOwn(TENANCY_TYPE_LABEL, terms.tenancyType))) {
    add("tenancyType", "Choose a tenancy type from the list.");
  }
  if (terms.agreedNotice !== undefined && (typeof terms.agreedNotice !== "string" || oneLine(terms.agreedNotice).length > 80)) {
    add("agreedNotice", "The agreed notice period must be short text (most 80 characters), for example 3 months.");
  }
  const landlordOk = isWalletAddress(terms.landlordWallet);
  const tenantOk = isWalletAddress(terms.tenantWallet);
  if (!landlordOk) add("landlordWallet", walletMessage("Landlord wallet address"));
  if (!tenantOk) add("tenantWallet", walletMessage("Tenant wallet address"));
  if (landlordOk && tenantOk && sameWallet(terms.landlordWallet, terms.tenantWallet)) {
    add("tenantWallet", "Landlord and tenant need two different wallet addresses.");
  }
  if (terms.witnessWallet !== undefined) {
    if (!isWalletAddress(terms.witnessWallet)) add("witnessWallet", walletMessage("Witness wallet address"));
    else if (sameWallet(terms.witnessWallet, terms.landlordWallet) || sameWallet(terms.witnessWallet, terms.tenantWallet)) {
      add("witnessWallet", "The witness needs a different wallet from the landlord and the tenant.");
    }
  }
  if (terms.advanceMonths !== undefined) {
    const advance = terms.advanceMonths;
    if (!(typeof advance === "number" && Number.isInteger(advance) && advance <= 120)) {
      add("advanceMonths", "Advance rent must be a whole number of months.");
    } else {
      const check = checkAdvanceRentFor(terms.state ?? "", advance);
      if (!check.ok) add("advanceMonths", check.message);
    }
  } else {
    add("advanceMonths", "Advance rent months is required.");
  }
  const agreedNoticeText = typeof terms.agreedNotice === "string" ? terms.agreedNotice.trim() : "";
  if (isNigerianState(terms.state) && terms.tenancyType && !ruleFor(terms.state) && !agreedNoticeText) {
    add(
      "agreedNotice",
      `Write the notice period you and the landlord agree (for example 3 months). CourtAgent has default notice periods only for states it has checked, and ${stateLabel(terms.state)} is not one of them yet.`,
    );
  }
  return issues;
}

/**
 * The last day of the tenancy: the day before the monthly anniversary of the start date.
 * When the start day does not exist in the target month (31 January plus one month), the anniversary is the last day
 * of that month, so 2026-01-31 for 1 month ends on 2026-02-27, never in March.
 */
export function endDate(startDate: string, durationMonths: number): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const daysInTargetMonth = new Date(Date.UTC(y, m - 1 + durationMonths + 1, 0)).getUTCDate();
  const anniversary = new Date(Date.UTC(y, m - 1 + durationMonths, Math.min(d, daysInTargetMonth)));
  anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return anniversary.toISOString().slice(0, 10);
}

export function noticeText(terms: Pick<TenancyTerms, "state" | "tenancyType" | "agreedNotice">): string {
  return (
    noticePeriodFor(terms.state, terms.tenancyType, terms.agreedNotice) ??
    (terms.tenancyType === "fixed_term"
      ? "no notice is needed once the fixed term has expired"
      : `the notice period required by the law of ${stateLabel(terms.state)}`)
  );
}

/** Deterministic draft. The wording is fixed on purpose: the AI explains it but never rewrites legal terms. */
export function buildAgreement(raw: TenancyTerms): string {
  // Free text is collapsed to one line so a typed line break cannot add a clause to the fixed template.
  const terms: TenancyTerms = {
    ...raw,
    landlordName: oneLine(raw.landlordName),
    tenantName: oneLine(raw.tenantName),
    propertyAddress: oneLine(raw.propertyAddress),
    agreedNotice: raw.agreedNotice === undefined ? undefined : oneLine(raw.agreedNotice),
    landlordWallet: raw.landlordWallet.trim(),
    tenantWallet: raw.tenantWallet.trim(),
    witnessWallet: raw.witnessWallet?.trim() || undefined,
  };
  const monthly = terms.annualRentNgn / 12;
  const advanceAmount = Math.round(monthly * terms.advanceMonths);
  const rooms = `${terms.bedrooms}-bedroom${terms.parlour ? " with parlour" : ""}`;
  const end = endDate(terms.startDate, terms.durationMonths);
  const notice = noticeText(terms);
  const noticeClause =
    terms.tenancyType === "fixed_term" && !terms.agreedNotice
      ? "As this is a fixed-term tenancy, no notice to quit is needed once the fixed term has expired."
      : terms.agreedNotice?.trim()
        ? `Either party who wishes to end this tenancy before the end date must give the other written notice of at least ${notice}. This is the period both parties have agreed.`
        : `Either party who wishes to end this tenancy before the end date must give the other written notice of at least ${notice}. This is the notice period for a ${TENANCY_TYPE_LABEL[terms.tenancyType]} unless both parties have written a different period here.`;

  return `TENANCY AGREEMENT (DRAFT)

Prepared with CourtAgent for review by both parties.

1. PARTIES
Landlord: ${terms.landlordName} (wallet ${terms.landlordWallet})
Tenant: ${terms.tenantName} (wallet ${terms.tenantWallet})${terms.witnessWallet ? `\nWitness, who must also sign: wallet ${terms.witnessWallet}` : ""}

2. PREMISES
The landlord lets and the tenant takes: ${rooms} at ${terms.propertyAddress}, ${stateLabel(terms.state)}, Nigeria ("the Premises").

3. TERM
The tenancy is a ${TENANCY_TYPE_LABEL[terms.tenancyType]} starting on ${terms.startDate} for ${plural(terms.durationMonths, "month")}, ending on ${end}.

4. RENT AND PAYMENT
Yearly rent: ${formatNgn(terms.annualRentNgn)} (about ${formatNgn(monthly)} a month).
Rent paid in advance: ${plural(terms.advanceMonths, "month")}, amounting to ${formatNgn(advanceAmount)}.
Refundable caution deposit: ${terms.cautionNgn > 0 ? formatNgn(terms.cautionNgn) : "none"}.
The landlord will give the tenant a signed receipt for every payment, showing the date, the amount and the period it covers.

5. NOTICE
${noticeClause}

6. RECOVERY OF POSSESSION
The landlord will not remove the tenant, lock the tenant out or take the tenant's belongings by force. If the landlord wants possession of the Premises, the landlord will follow the notice and court process required by the law of ${stateLabel(terms.state)}.

7. CAUTION DEPOSIT
${terms.cautionNgn > 0 ? "The caution deposit is refundable at the end of the tenancy, less the agreed cost of any damage beyond fair wear and tear." : "No caution deposit is payable."}

8. QUIET ENJOYMENT AND REPAIRS
The tenant may live in the Premises peacefully for the term. The tenant keeps the Premises clean and reports faults promptly. The landlord is responsible for structural repairs unless the damage was caused by the tenant.

9. RECORD OF THIS AGREEMENT
The keccak256 hash of this exact text is registered, by the wallets listed in clause 1, in a CourtAgent document registry (a smart contract on the Ethereum Sepolia test network, or its Demo Mode copy in a browser). Anyone holding a copy can hash it and check it against that record. If any word is changed, the hash will no longer match.

10. IMPORTANT
${DISCLAIMER}
${lawNoteFor(terms.state)}`;
}

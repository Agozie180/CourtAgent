import { formatNgn } from "./intake";
import { DISCLAIMER, TENANCY_TYPE_LABEL, type TenancyType } from "./lagos-tenancy";
import { isNigerianState, stateLabel } from "./jurisdiction";
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
};

export type TermsIssue = { field: string; message: string };

export function validateTerms(terms: Partial<TenancyTerms>): TermsIssue[] {
  const issues: TermsIssue[] = [];
  const need = (field: keyof TenancyTerms, label: string) => {
    const value = terms[field];
    if (value === undefined || value === null || value === "") issues.push({ field, message: `${label} is required.` });
  };
  if (!isNigerianState(terms.state)) issues.push({ field: "state", message: "Choose the state the property is in." });
  need("landlordName", "Landlord name");
  need("tenantName", "Tenant name");
  need("propertyAddress", "Property address");
  need("annualRentNgn", "Yearly rent");
  need("startDate", "Start date");
  need("durationMonths", "Duration");
  need("tenancyType", "Tenancy type");
  if (!/^0x[0-9a-fA-F]{40}$/.test(terms.landlordWallet ?? "")) {
    issues.push({ field: "landlordWallet", message: "Landlord wallet address must be a valid 0x address." });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(terms.tenantWallet ?? "")) {
    issues.push({ field: "tenantWallet", message: "Tenant wallet address must be a valid 0x address." });
  }
  if (
    terms.landlordWallet &&
    terms.tenantWallet &&
    terms.landlordWallet.toLowerCase() === terms.tenantWallet.toLowerCase()
  ) {
    issues.push({ field: "tenantWallet", message: "Landlord and tenant need two different wallet addresses." });
  }
  if (terms.advanceMonths !== undefined) {
    const check = checkAdvanceRentFor(terms.state ?? "", terms.advanceMonths);
    if (!check.ok) issues.push({ field: "advanceMonths", message: check.message });
  } else {
    issues.push({ field: "advanceMonths", message: "Advance rent months is required." });
  }
  if (terms.state && terms.tenancyType && !ruleFor(terms.state) && !terms.agreedNotice?.trim()) {
    issues.push({
      field: "agreedNotice",
      message: `Write the notice period you and the landlord agree (for example 3 months). CourtAgent has default notice periods only for states it has checked, and ${stateLabel(terms.state)} is not one of them yet.`,
    });
  }
  return issues;
}

export function endDate(startDate: string, durationMonths: number): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + durationMonths, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
export function buildAgreement(terms: TenancyTerms): string {
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
Tenant: ${terms.tenantName} (wallet ${terms.tenantWallet})

2. PREMISES
The landlord lets and the tenant takes: ${rooms} at ${terms.propertyAddress}, ${stateLabel(terms.state)}, Nigeria ("the Premises").

3. TERM
The tenancy is a ${TENANCY_TYPE_LABEL[terms.tenancyType]} starting on ${terms.startDate} for ${terms.durationMonths} months, ending on ${end}.

4. RENT AND PAYMENT
Yearly rent: ${formatNgn(terms.annualRentNgn)} (about ${formatNgn(monthly)} a month).
Rent paid in advance: ${terms.advanceMonths} months, amounting to ${formatNgn(advanceAmount)}.
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
The keccak256 hash of this exact text is recorded on the Ethereum Sepolia test network by the wallets listed in clause 1. Anyone holding a copy can hash it and check it against that record. If any word is changed, the hash will no longer match.

10. IMPORTANT
${DISCLAIMER}
${lawNoteFor(terms.state)}`;
}

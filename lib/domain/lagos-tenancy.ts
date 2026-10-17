/**
 * Lagos tenancy rules used by CourtAgent.
 * Source: Lagos State Tenancy Law 2011 (Cap. T1, Laws of Lagos State 2015), checked against public legal
 * commentary on 2026-10-13. A 2025 Bill proposes changes (advance rent, agent fees, eviction, deposits) and
 * its passage was NOT confirmed. CourtAgent therefore always says "under the 2011 Law" and shows LAW_NOTE.
 * Not legal advice: have a lawyer review before relying on this.
 */

export type TenancyType = "at_will" | "monthly" | "quarterly" | "half_yearly" | "yearly" | "fixed_term";

export const TENANCY_TYPE_LABEL: Record<TenancyType, string> = {
  at_will: "tenant at will",
  monthly: "monthly tenancy",
  quarterly: "quarterly tenancy",
  half_yearly: "half-yearly tenancy",
  yearly: "yearly tenancy",
  fixed_term: "fixed-term tenancy",
};

/** Default notice to quit when the agreement says nothing else. The parties may agree different notice. */
export const DEFAULT_NOTICE: Record<TenancyType, string> = {
  at_will: "1 week",
  monthly: "1 month",
  quarterly: "3 months",
  half_yearly: "3 months",
  yearly: "6 months",
  fixed_term: "no notice is needed once the fixed term has expired",
};

/** A landlord may not demand more than one year's rent in advance from a new tenant. */
export const MAX_ADVANCE_RENT_MONTHS_NEW_TENANT = 12;

export const LAW_NOTE =
  "Based on the Lagos State Tenancy Law 2011. A 2025 Bill proposes changes and may have been passed since: check before relying on this.";

export const DISCLAIMER =
  "General guidance and a draft only, not legal advice. CourtAgent is not a law firm. Have a lawyer review important documents.";

export const EVICTION_PROCESS_NOTE =
  "Under the Lagos Tenancy Law 2011 a landlord cannot evict a tenant personally or by force. The landlord must give a valid notice to quit, then a 7-day notice of intention to recover possession, and then obtain a court order.";

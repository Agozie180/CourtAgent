import {
  DEFAULT_NOTICE,
  EVICTION_PROCESS_NOTE,
  LAW_NOTE,
  MAX_ADVANCE_RENT_MONTHS_NEW_TENANT,
  type TenancyType,
} from "./lagos-tenancy";
import { stateLabel } from "./jurisdiction";

/**
 * Tenancy rules we have actually checked, by state. Only Lagos is verified so far.
 * To add a state: research its tenancy or recovery-of-premises law, add an entry here with the date checked,
 * and add a test. For any state NOT listed, CourtAgent makes no statutory claims and tells the user to check.
 */
export type StateRule = {
  lawName: string;
  verifiedOn: string;
  maxAdvanceMonthsNewTenant: number | null;
  defaultNotice: Partial<Record<TenancyType, string>>;
  evictionNote: string;
  lawNote: string;
};

export const STATE_RULES: Record<string, StateRule> = {
  Lagos: {
    lawName: "Lagos State Tenancy Law 2011",
    verifiedOn: "2026-10-13",
    maxAdvanceMonthsNewTenant: MAX_ADVANCE_RENT_MONTHS_NEW_TENANT,
    defaultNotice: DEFAULT_NOTICE,
    evictionNote: EVICTION_PROCESS_NOTE,
    lawNote: LAW_NOTE,
  },
};

export function ruleFor(state: string): StateRule | null {
  return STATE_RULES[state] ?? null;
}

export function unverifiedNote(state: string): string {
  return `CourtAgent has not yet checked the tenancy law of ${stateLabel(state)}. Rules on advance rent, notice periods and eviction differ between states, so check them with a lawyer or the state's rent tribunal before you rely on this draft.`;
}

export function lawNoteFor(state: string): string {
  return ruleFor(state)?.lawNote ?? unverifiedNote(state);
}

export function evictionNoteFor(state: string): string {
  const rule = ruleFor(state);
  if (rule) return rule.evictionNote;
  return `In Nigeria a landlord is generally expected to give a valid written notice and to obtain a court order before a tenant can be removed, and may not use force. The exact notice periods and procedure for ${stateLabel(state)} need to be confirmed with a lawyer.`;
}

export type AdvanceCheck = { ok: boolean; checked: boolean; message: string };

export function checkAdvanceRentFor(state: string, advanceMonths: number): AdvanceCheck {
  if (!Number.isFinite(advanceMonths) || advanceMonths <= 0) {
    return { ok: false, checked: true, message: "Enter how many months of rent are paid in advance." };
  }
  const rule = ruleFor(state);
  if (!rule || rule.maxAdvanceMonthsNewTenant === null) {
    return {
      ok: true,
      checked: false,
      message: `I have not checked the advance-rent limit for ${stateLabel(state)}. Ask a lawyer or the state rent tribunal before paying a large advance.`,
    };
  }
  if (advanceMonths > rule.maxAdvanceMonthsNewTenant) {
    return {
      ok: false,
      checked: true,
      message: `Asking for ${advanceMonths} months of rent in advance is above the limit of ${rule.maxAdvanceMonthsNewTenant} months for a new tenant under the ${rule.lawName}. Do not pay it without getting advice.`,
    };
  }
  return {
    ok: true,
    checked: true,
    message: `${advanceMonths} months in advance is within the ${rule.maxAdvanceMonthsNewTenant}-month limit for a new tenant.`,
  };
}

/** The notice period to write in the agreement: the one the parties agreed, else the verified default, else null. */
export function noticePeriodFor(state: string, type: TenancyType, agreed?: string): string | null {
  if (agreed?.trim()) return agreed.trim();
  return ruleFor(state)?.defaultNotice[type] ?? null;
}

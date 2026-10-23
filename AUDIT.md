# Self-audit

A self-audit, not an independent one. The author reviewed the contract, the verify page, the rules and the API for ways
the product could mislead a user, fixed what was found, and pinned each fix with a test that **fails against the code
before the fix**. Checked on 2026-10-14.

## Findings

| ID | Finding | Severity | Fix | Regression test (fails on the old code) |
|---|---|---|---|---|
| F-1 | `register()` let anyone register a document hash with a party list of their own choosing. A stranger who saw an agreement's text could squat on its hash with different parties, and the real parties could then no longer register it. | High | The caller must be a listed party (`CreatorNotAParty`). Mirrored in Demo Mode. | `contracts/test/DocumentRegistry.test.ts` "F-1…" (verified failing on the old contract), `lib/chain/demo.test.ts` "F-1…" |
| F-2 | A hash alone does not say who recorded it. Even with F-1 fixed, a record could be registered by a party list that differs from the wallets written in the text, and the verify page still said "matches". | Medium | `/verify` compares the wallets written in the text with the registry parties and shows a red warning on any mismatch. | `lib/hash/parties.test.ts` |
| F-3 | The scam rule `TEXT_ABROAD` matched "I am travelling", flagging an honest owner who only said they were travelling. | Low | Removed "travelling" from the pattern. Overseas and duty cases are now a separate Medium rule. | `lib/domain/corpus.test.ts` "F-3…" (verified failing on the old pattern) |
| F-4 | The scam rules missed 5 of 14 sample scams (inspection fee, a cousin's account, "no need to inspect", offshore, cannot meet). | Medium | Added six Medium or High text rules. In-sample result went from 9 of 14 to 14 of 14. | `lib/domain/corpus.test.ts` |
| F-5 | The TypeScript ABI used by the app could drift from the contract. | Low | A test compares the ABI with the compiled artifact. | `contracts/test/DocumentRegistry.test.ts` "the TypeScript ABI…" |
| F-6 | A user who sent a "not a party" wallet got no clear explanation. | Low | A "Try to sign anyway" action shows the registry's refusal, and error text names the cause. | `components/home-demos.test.tsx` |
| F-7 | Vercel build failed: `next build` type-checked the Hardhat tests, whose generated types do not exist in a fresh clone. | High | tsconfig only covers the app; contracts live in an isolated `contracts/` workspace. A clean-clone build passes. | `tsconfig.json`, `.github/workflows/ci.yml` |
| F-8 | Deprecated and vulnerable dependencies (old Next, ESLint config chain, solc/tmp). | Medium | Next 16, React 19.3, ESLint 10, vitest 5, Hardhat 3, solc 0.8.37. `npm audit`: 0 vulnerabilities, no install warnings. | `package.json`, `contracts/package.json` |
| F-9 | Letters used the UTC date, a day behind in Lagos after midnight. | Medium | Local date helper. | `lib/domain/dates.ts` |
| F-10 | The widow letter printed a user-typed date as the registration date, so it could be backdated. | High | The letter uses the registry's own timestamp in Lagos time. | `lib/domain/domain.test.ts` |
| F-11 | `validateTerms` accepted nonsense (negative rent, `abc` dates) and `/api/explain` could return a 500. | Medium | Full numeric, date and length checks. | `lib/domain/domain.test.ts`, `app/api/api.test.ts` |
| F-12 | A line break in a name or address could add a fake clause to the agreement. | Medium | Free text is collapsed to one line. | `lib/domain/domain.test.ts` |
| F-13 | "2 bedroom for 1.5m" read the rent as 2. | Low | Amounts with a unit win, else the largest number. | `lib/domain/domain.test.ts` |
| F-14 | No security headers, no body-size pre-check, no error or 404 page, no icon. | Low | CSP, frame, referrer and permissions headers; content-length check; pages added. | `next.config.ts`, `lib/api/guard.ts`, `app/` |
| F-15 | The live app said "No AI key is set" before any AI call was made, and also when a key existed but the AI request failed. | Medium | The page asks `/api/status` and every note, including the home page copy, follows the real mode. A failing AI call is reported as "key set, request failed". | `components/flows.test.tsx`, `lib/domain/fixes.test.ts` |
| F-16 | A chat answer such as "I want a house in Abuja for 5k" was taken as a landlord's name, and any place named in a message could change the state. | High | Name checks, the state is set only by the state question, and after the early questions only the asked field can change. Every answer has an Edit button. | `lib/domain/fixes.test.ts` |
| F-17 | A signed agreement or record could be edited without any sign that it was now a different record. | Medium | Forms lock once signed. "Edit anyway" says "Editing will create a new unsigned record". | `components/flows.test.tsx` |
| F-18 | FULLY SIGNED was possible with one signer, and nobody was asked who must sign. | Medium | A "Who must sign?" choice adds a witness to the text and the registry. FULLY SIGNED shows only when all have signed. | `components/flows.test.tsx` |
| F-19 | Ukeje v Ukeje was worded so it could read as support for a widow's right to stay. Legal-aid lines named bodies for the wrong state. | High | Ukeje is described as a daughter-inheritance case. Legal aid is chosen by state, with official links only and no phone numbers. | `lib/domain/fixes.test.ts` |
| F-20 | A will listed under Documents with "No will" selected could be recorded. A demand could be dated before the tenancy began. | Medium | Both are blocked with a clear message. | `lib/domain/fixes.test.ts`, `components/flows.test.tsx` |
| F-21 | `endDate` rolled a 31st-of-month start into the next month (31 Jan plus 1 month ended 2 March), and that wrong date was written into a hashed agreement. | High | The end is the day before the monthly anniversary, clamped to the month's last day. | `lib/domain/audit2.test.ts` A-1 |
| F-22 | `validateTerms` threw on a non-string wallet, and accepted `toString` as a tenancy type. A missing bedrooms, parlour or caution field produced an agreement containing "undefined". | High | Type-safe wallet checks, `Object.hasOwn`, required-field checks. | A-2, A-3, A-4 |
| F-23 | Wallet addresses were checked by shape only, so a mistyped checksum address was accepted and the wrong person could be named as a signer. | Medium | Full address validation including checksum, shared by rental and property flows. | A-5 |
| F-24 | The offline chat parser accepted 0 bedrooms, 500 bedrooms, zero rent and 0 months, which the AI path rejected. | Medium | Offline output goes through the same sanitiser, with a specific reply for each limit. | A-6 |
| F-25 | A corrupted or hand-edited browser-storage entry crashed the verify page and the Demo ledger. | Medium | Both readers keep only well-formed entries. | A-7 |
| F-26 | The exit letter said "We signed" when the landlord had not, and "lawful possession" after the term had ended. Typed text could add a paragraph. | High | Wording follows the real signature state and dates, with a note; free text is one line. | A-8 |
| F-27 | A Sepolia share link opened in a fresh browser looked up the viewer's empty Demo Mode and showed a false NOT RECORDED. | High | Links carry `net=sepolia`; the verify page offers the switch. | A-9 |
| F-28 | A mined but reverted transaction was reported as recorded. A single public RPC was a single point of failure. A fresh clone with no env variable ran in Demo Mode only. | High | Receipt status is checked, reads fall back across several RPCs, and the committed deployment is the default registry. | A-10, A-11 |
| F-29 | Homepage copy sent visitors to "the code", "the test files" and "the README" even while the repo is private, and promised "seven" questions when the seventh appears only for an agent. | Low | The repo link and wording show only when `NEXT_PUBLIC_REPO_PUBLIC=true`; copy says "six or seven". | `components/home-page.test.tsx`, `flows.test.tsx` R-2 |
| F-30 | Legal aid in the rent and widow steps named bodies but gave no way to reach them. | Medium | Official links, and phone numbers only where an official page prints one, each with its source and verification date. | `lib/domain/requests.test.ts` R-3, `flows.test.tsx` R-3 |
| F-31 | The exit reply mixed "you" and "he" when the tenant wrote about the landlord in the third person. | Medium | The prompt asks for "you"; third-person wording is flagged and holds the letter back until fixed. | `requests.test.ts` R-4, `flows.test.tsx` R-4 |
| F-32 | The widow notice followed the chosen state even when the recorded address named another. | Medium | A warning above the notice; street names such as "Delta Street, Lagos" do not trigger it. | `requests.test.ts` R-5, `flows.test.tsx` R-5 |
| F-33 | A mistyped fingerprint on `/verify` got a vague "not valid yet" hint. | Low | Checked for 0x plus 64 hex characters before any lookup, with a specific error. | `requests.test.ts` R-6, `flows.test.tsx` R-6 |

## What the audit did not fix, stated plainly

- **Held-out result.** After the rules were frozen, 10 new scam wordings and 8 honest ones were written and never used to
  tune a rule. The text rules flagged **3 of 10** scams and wrongly flagged **2 of 8** honest messages (HL04, HL08).
  Keyword rules are brittle, and fitting them to the 14-item sample would be dishonest. The tests pin these numbers so
  the README cannot drift from the code. Do not tune rules on the held-out items. Add new held-out items instead.
- **Both sets were written by one person**, the same one who wrote the rules. They are regression checks, not an
  accuracy measurement on real scams.
- **The six or seven yes/no questions carry most of the score** and do not depend on wording, but a user can answer them
  wrongly.
- **AI paths** are tested with mocked HTTP only.
- **Wallet mode** is untested in a real browser wallet. **No Sepolia deployment** has been made from this environment.
- **The contract is unaudited**, has no revoke or amend, and `AlreadyRegistered` means a hash is public once recorded.
- **The API rate limit** is in memory and per instance.
- **The law notes** were not reviewed by a lawyer.

## How to re-run the audit

```bash
npm run check      # typecheck, lint, 159 unit, UI, flow and API tests, 11 contract tests
npm run measure    # corpus, held-out and tamper-sweep numbers
```

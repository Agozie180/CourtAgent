# Self-audit

A self-audit, not an independent one. The author reviewed the contract, the verify page, the rules and the API for ways
the product could mislead a user, fixed what was found, and pinned each fix with a test that **fails against the code
before the fix**. Checked on 2026-10-14.

## Findings

| ID | Finding | Severity | Fix | Regression test (fails on the old code) |
|---|---|---|---|---|
| F-1 | `register()` let anyone register a document hash with a party list of their own choosing. A stranger who saw an agreement's text could squat on its hash with different parties, and the real parties could then no longer register it. | High | The caller must be a listed party (`CreatorNotAParty`). Mirrored in Demo Mode. | `test/DocumentRegistry.ts` "F-1…" (verified failing on the old contract), `lib/chain/demo.test.ts` "F-1…" |
| F-2 | A hash alone does not say who recorded it. Even with F-1 fixed, a record could be registered by a party list that differs from the wallets written in the text, and the verify page still said "matches". | Medium | `/verify` compares the wallets written in the text with the registry parties and shows a red warning on any mismatch. | `lib/hash/parties.test.ts` |
| F-3 | The scam rule `TEXT_ABROAD` matched "I am travelling", flagging an honest owner who only said they were travelling. | Low | Removed "travelling" from the pattern. Overseas and duty cases are now a separate Medium rule. | `lib/domain/corpus.test.ts` "F-3…" (verified failing on the old pattern) |
| F-4 | The scam rules missed 5 of 14 sample scams (inspection fee, a cousin's account, "no need to inspect", offshore, cannot meet). | Medium | Added six Medium or High text rules. In-sample result went from 9 of 14 to 14 of 14. | `lib/domain/corpus.test.ts` |
| F-5 | The TypeScript ABI used by the app could drift from the contract. | Low | A test compares the ABI with the compiled artifact. | `test/DocumentRegistry.ts` "the TypeScript ABI…" |
| F-6 | A user who sent a "not a party" wallet got no clear explanation. | Low | A "Try to sign anyway" action shows the registry's refusal, and error text names the cause. | `components/home-demos.test.tsx` |

## What the audit did not fix, stated plainly

- **Held-out result.** After the rules were frozen, 10 new scam wordings and 8 honest ones were written and never used to
  tune a rule. The text rules flagged **3 of 10** scams and wrongly flagged **2 of 8** honest messages (HL04, HL08).
  Keyword rules are brittle, and fitting them to the 14-item sample would be dishonest. The tests pin these numbers so
  the README cannot drift from the code. Do not tune rules on the held-out items. Add new held-out items instead.
- **Both sets were written by one person**, the same one who wrote the rules. They are regression checks, not an
  accuracy measurement on real scams.
- **The seven yes/no questions carry most of the score** and do not depend on wording, but a user can answer them
  wrongly.
- **AI paths** are tested with mocked HTTP only.
- **Wallet mode** is untested in a real browser wallet. **No Sepolia deployment** has been made from this environment.
- **The contract is unaudited**, has no revoke or amend, and `AlreadyRegistered` means a hash is public once recorded.
- **The API rate limit** is in memory and per instance.
- **The law notes** were not reviewed by a lawyer.

## How to re-run the audit

```bash
npm run check      # typecheck, lint, 75 unit and UI tests, 11 contract tests
npm run measure    # corpus, held-out and tamper-sweep numbers
```

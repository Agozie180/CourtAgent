# CourtAgent: architecture and non-goals

This is the blueprint the code was built to. If code and this file disagree, fix one of them.

## One-line thesis

The AI explains and flags. Fixed rules decide. A fingerprint on a public chain makes a changed word detectable.

## The load-bearing principle, and why

**No legal term, risk verdict or record is ever produced by a model.** Judges, tenants and courts must be able to
re-derive every output from the inputs. So:

| Output | Produced by | Model's role |
|---|---|---|
| Tenancy agreement text | `lib/domain/agreement.ts`, a pure function of the terms | none |
| Exit-demand and widow letters | `lib/domain/letters.ts`, fixed templates | none |
| Risk level (Low / Medium / High) | `lib/domain/risk.ts`, fixed rules | may add a note, capped at Medium |
| Statutory checks (advance rent, notice) | `lib/domain/tenancy-rules.ts`, verified states only | none |
| Plain-language explanation | `lib/ai/tasks.ts`, with a deterministic offline fallback | writes the explanation only |
| Intake from chat | `lib/domain/intake.ts` parser, optional model extraction, then sanitised | extracts values, which are validated |

Why it matters: a model that can edit a contract can be talked into editing it. Keeping it away from the text removes
that whole class of failure.

## Data model and invariants

`contracts/DocumentRegistry.sol` stores, per `docHash` (keccak256 of the canonical text): creator, createdAt,
fullySignedAt, kind, the list of parties, and who has signed. No text is stored.

1. A hash can be registered once. Re-registering reverts (`AlreadyRegistered`).
2. The caller of `register` must be one of the listed parties (`CreatorNotAParty`). See AUDIT F-1.
3. Only listed parties can sign, and only once (`NotAParty`, `AlreadySigned`).
4. `fullySignedAt` is set when the last party signs and never changes.
5. 1 to 8 parties, no duplicates, no zero address, kind length 1 to 64.

`lib/hash/document.ts` canonicalises text (NFC, line endings, trailing spaces, outer blank lines) before hashing, so
harmless whitespace never changes a hash and any real edit does.

## Verified platform constraints (designed with, not around)

- The build environment could not reach the Solidity compiler host or a Sepolia RPC. The contract compiles with the
  pinned `solc` npm package, and deployment is a one-command step for someone with a key and test ETH.
- Browsers never send a URL fragment to a server, so share links carry the text after `#` (`lib/share.ts`).
- Statutory rules differ by state. Only Lagos is verified, so every other state gets a visible "not checked" notice and
  no statutory claims (`lib/domain/tenancy-rules.ts`).

## Priority order the project was built in (cut from the bottom)

- **P0** Fixed agreement template, hash, registry contract, verify page. (done)
- **P1** Rules-based scam check, Demo Mode with no wallet or key. (done)
- **P2** Optional Anthropic and OpenAI notes and explanations, exit-demand letter, widow module. (done)
- **P3** Live Sepolia deploy, real-key and real-wallet testing, hosting. (needs the owner's keys; not claimed done)
- **P4** More verified states. (optional)

## Non-goals (do not build)

- Judging whether a property exists or whether a landlord owns it. The app cannot know, and says so.
- Replacing a lawyer, a court or a signed paper agreement.
- Letting a model draft or rewrite legal clauses.
- Storing documents on a server, or any database.
- Mainnet, tokens, payments or escrow.
- Legal rules for any state until someone verifies them and adds a test.
- Accounts, logins or analytics.

## Demo script

See [`DEMO.md`](DEMO.md). It leads with the tamper test and shows the guardrails (High-risk message, one-word edit,
stranger refused), not only the happy path.

## Submission checklist

See the end of [`DEMO.md`](DEMO.md).

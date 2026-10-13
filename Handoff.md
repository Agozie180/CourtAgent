# Handoff: CourtAgent (BLI Legal Tech Hackathon 2)

Last updated: 2026-10-13 evening (Lagos time). Status: BUILD IN PROGRESS. The logic, contract, AI layer and API are done and tested. The pages (UI) are NOT built yet.
Repo: https://github.com/Agozie180/CourtAgent (branch main). Local working copy: /home/claude/work/CourtAgent in the build session.

## Hackathon
- BLI Legal Tech Hackathon 2 (DoraHacks, Blockchain Legal Institute), virtual, prize pool 20,000 USD
- Submission deadline: 2026/11/01 02:01
- Main track: LegalTech & RegTech. Secondary: Web3 for Social Good (widow module)

## Decisions (confirmed by the user)
- Project name: CourtAgent
- Chain: Ethereum Sepolia testnet (the same contract can also deploy to BNB testnet)
- AI: both Anthropic and OpenAI, plus an offline rules mode so everything runs with no keys
- Nigeria-wide (user's request on 2026-10-13): the product works for any of the 36 states plus FCT. Statutory rules are only applied for states that have been researched and verified (currently ONLY Lagos). Other states: the user writes the agreed notice period into the agreement, and the app says the state's law has not been checked. Ukeje v Ukeje is national.
- Started from ForgePass (github.com/Agozie180/ForgePass, MIT): reused config files and the share-link idea; Stellar, Soroban, Noir and zero-knowledge parts were NOT carried over
- Must be reproducible by another developer. Keep everything small.

## What CourtAgent does
Module 1, rental agent: chat intake (state, budget, bedrooms, parlour, area, then landlord and terms) -> scam check (rules plus optional AI notes, risk Low / Medium / High) -> deterministic tenancy agreement draft -> both parties sign on-chain (hash of the text) -> public verify page -> after payment, a letter generator for when a landlord demands the tenant leave early.
Module 2, widow protection (one tab): register a property record while alive (hash on-chain), then generate a notice letter to relatives who try to take the home or property.

## Build status
DONE and tested (51 unit tests via `npm test`, 8 contract tests via `npm run contracts:test`, `tsc --noEmit` clean at last run):
- contracts/DocumentRegistry.sol (register / sign / getRecord / isRegistered / isFullySigned; events; max 8 parties). Compiles with the pinned `solc` npm package (solc-js) through an override in hardhat.config.ts, so no compiler download is needed.
- scripts/deploy.ts (`npm run deploy:sepolia`) writes deployments/sepolia.json
- lib/hash/document.ts (canonicalize + keccak256); lib/share.ts (document text in the URL fragment, so it never reaches a server)
- lib/chain/*: abi.ts, config.ts, types.ts, onchain.ts (viem + window.ethereum), demo.ts (Demo Mode ledger in browser storage that mirrors the contract rules; demo actors DEMO_TENANT, DEMO_LANDLORD, DEMO_OWNER)
- lib/domain/*: jurisdiction.ts (36 states + FCT, state finder), tenancy-rules.ts (STATE_RULES table, only Lagos verified; add states here), lagos-tenancy.ts (Lagos constants), intake.ts (state is now the FIRST question; offline parser + sanitizer), agreement.ts, risk.ts, letters.ts (exit-demand reply and widow notice), property.ts (property record text)
- lib/ai/provider.ts (Anthropic and OpenAI over fetch, fallback, offline) and lib/ai/tasks.ts (intake, document check, plain-language explanation; AI notes are capped at "medium" so only fixed rules can say High)
- lib/api/guard.ts (rate limit, JSON reader); API routes /api/status, /api/intake, /api/check, /api/explain
- lib/storage.ts (saved documents in the browser)
- Config: package.json, tsconfig.json, eslint.config.js, vitest.config.ts, next.config.ts, hardhat.config.ts, .env.example, .gitignore, .nvmrc (20), MIT LICENSE

STARTED but not finished (files exist, compile, not committed before this handoff):
- components/session-provider.tsx (Demo vs Sepolia mode, "acting as" actor, wallet connect, registry backend)
- components/site-header.tsx (nav and mode toggle)
- components/bits.tsx (copy, download, document sheet, hash line, tx line, notices, errorMessage)

STILL TO DO, in this order:
1. app/layout.tsx (import fonts `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/source-serif-4`; wrap in SessionProvider; header and footer with the "not legal advice" notice), app/globals.css (design tokens below)
2. Pages: app/page.tsx (landing), app/rent/page.tsx + components/rent-flow.tsx (steps: Details chat -> Check -> Agreement -> Record -> After payment; needs a state selector and a "notice period you agreed" input shown for unverified states), app/widow/page.tsx + components/widow-flow.tsx, app/verify/page.tsx + components/verify-view.tsx (reads `#d=` text from the URL fragment, recomputes the hash, reads the record, lets a listed party sign)
3. /api/check expects `state` in the body; the UI must send it. API route files for explain use validateTerms, which requires `state`.
4. scripts/verify-live.ts (package.json's `verify:live` points at it but it does not exist yet): checks the contract exists on Sepolia
5. README.md (clone, install, env, run in about 5 commands; how to deploy; Demo Mode; what is real and what is limited; how to add a state to STATE_RULES), docs/DEMO.md (2-minute demo script)
6. `npm run build`, `npm run lint`, `npm run check`; fix anything that fails. Look at the pages in a browser if possible.
7. Deploy contract to Sepolia (user needs a throwaway wallet with Sepolia test ETH in .env as DEPLOYER_PRIVATE_KEY), put the address in .env.local as NEXT_PUBLIC_REGISTRY_ADDRESS and in the README, record a 2-minute demo video, submit on DoraHacks.
8. Optional: research more states (FCT, Enugu, Rivers, Ogun, Oyo) and add verified entries to lib/domain/tenancy-rules.ts with tests.

## Design plan (decided; build to this)
- Feel: a trustworthy case file, not a crypto dashboard. Left-aligned, single column, borders and rules that carry meaning, no identical card grid.
- Palette: ink navy #16213A, cool paper #F1F3F4, document white #FDFDFC, danfo yellow #F5B800 (used like a highlighter on key terms), stamp green #1B6B4F (Low risk, verified), warning red #B3341E (High risk), muted #5B6676, rule #C9D0D6, amber for Medium.
- Type: Bricolage Grotesque for the interface; Source Serif 4 for anything that is a document (agreement, letters); monospace only for hashes. Line length under 80 characters.
- One bold element: a rubber stamp that lands once, on a sample agreement in the hero ("Recorded"). Respect prefers-reduced-motion.
- Avoid: cream plus terracotta, dark mode plus acid green, spaced all-caps eyebrows, arrows on buttons, numbering anything that is not a real sequence (the rental steps ARE a sequence).
- Hero headline: "Check the landlord. Sign the agreement. Keep the proof." Buttons: "Start a rental check" and "Record a family property".
- Copy: plain English, active voice, errors say what went wrong and how to fix it.
- React/ESLint reminder: avoid raw apostrophes in JSX text (react/no-unescaped-entities).

## Limits found in the build environment (not product limits)
- The build workspace cannot reach the Solidity compiler download site or Sepolia RPC, so the contract was tested only on the local Hardhat network and has NOT been deployed to Sepolia.
- Anthropic and OpenAI calls were tested only with mocked HTTP, never with real keys. Defaults are ANTHROPIC_MODEL=claude-sonnet-5-5 and OPENAI_MODEL=gpt-4.1-mini (env-configurable). Confirm the OpenAI model name is current.
- The workspace's GitHub access did not include the CourtAgent repo, so the push may need to be done another way (see below).

## Pushing to GitHub
The repo is https://github.com/Agozie180/CourtAgent. If the code is not there yet:
1. Make sure the repo exists on github.com (it can be empty).
2. In a new chat, ask Claude to attach it with push access. If the session cannot see it, give the GitHub app access to this repo: claude.ai Settings -> Connectors (reconnect GitHub and allow the CourtAgent repo). Then ask again.
3. Or push from your own computer: unzip or copy the project, then `git remote add origin https://github.com/Agozie180/CourtAgent.git && git push -u origin main`.

## Verified law notes (checked 2026-10-13; have a lawyer review before submission)
- Ukeje v Ukeje (Supreme Court, 2014): Igbo custom excluding daughters from inheritance is void because it conflicts with the Constitution (s.42). Discrimination reportedly continues in practice. National in effect.
- The Supreme Court has held that a widow has a right to occupy her deceased husband's property (Nzekwu line of cases).
- Lagos: the Administration of Estates Law, 2015 governs the intestate estate of a person married under the Marriage Act who dies residing in Lagos (Obusez v Obusez, Supreme Court 2007, on s.49(5)); customary law does not govern those cases. Customary marriages and other states can differ. Other states have their own estate laws: NOT verified.
- Lagos Tenancy Law 2011: advance rent capped at one year for a new tenant; the landlord cannot evict a tenant personally (court order needed); default notice to quit: tenant at will 1 week, monthly 1 month, quarterly and half-yearly 3 months, yearly 6 months; parties may agree different notice; a fixed-term tenancy needs no notice once it expires; the landlord must issue a receipt for rent paid; a 7-day notice of intention to recover possession comes before court.
- A 2025 Lagos tenancy Bill proposes changes (advance rent, agent fees, eviction, deposits). Passage NOT confirmed. The app says "under the 2011 Law".
- The letters name the Legal Aid Council of Nigeria, FIDA Nigeria and the Lagos State Office of the Public Defender as places to seek help; contact details were NOT verified.
- The app carries a "general guidance, not legal advice" notice.

## Demo story (about 2 minutes)
1. Tenant chats with the agent (state, budget, rooms). 2. Pastes a landlord document; the check flags problems. 3. Agreement signed by both parties; hash on Sepolia; verify page. 4. Landlord "demands" early exit; the agent generates the response letter. 5. Quick look at the widow tab.

## Next step when resumed
Open this repo, read this file and `git log`, run `npm install && npm run check`, then continue with "STILL TO DO" item 1. Do not start over: the logic is finished and tested; the work left is the pages, README, live check script, Sepolia deploy and demo.

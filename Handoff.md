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

ALSO DONE (UI, committed and pushed): app/layout.tsx, app/globals.css, landing, /rent (5 steps), /widow, /verify, session-provider, site-header, bits, record-status; scripts/verify-live.ts; lib/ai/thesis.test.ts (56 unit tests pass); README.md; docs/DEMO.md. Checked in headless Chromium in Demo Mode at desktop and 390px: rental flow, widow flow, verify mismatch, no console errors.

STILL TO DO (the user does these; they need his keys or wallet):
1. Deploy to Sepolia: throwaway wallet with test ETH in .env.local as DEPLOYER_PRIVATE_KEY, run `npm run deploy:sepolia`, put the address in NEXT_PUBLIC_REGISTRY_ADDRESS, commit deployments/sepolia.json, run `npm run verify:live`, fill the contract link in README.
2. Test with real Anthropic and OpenAI keys (confirm the OpenAI model name). AI paths were only tested with mocked HTTP.
3. Test wallet (Sepolia) mode in a real browser with MetaMask. Never tested.
4. Host the app (for example Vercel), put the URL in README. Record the 2-minute demo video (docs/DEMO.md), submit on DoraHacks before 2026/11/01 02:01 (Lagos time).
5. Before submitting: get a lawyer to review the law notes; remove or gitignore Handoff.md; check there are no secrets.
6. Optional: research more states (FCT, Enugu, Rivers, Ogun, Oyo) and add verified entries to lib/domain/tenancy-rules.ts with tests.

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

## RULES FROM THE USER (follow every time)
- AUTHORSHIP: every commit must be authored and committed by Agozie180 only (git user.name "Agozie180", email 137266828+Agozie180@users.noreply.github.com). NO "Co-Authored-By" or "Claude-Session" trailers, no other contributor. History was rewritten on 2026-10-13 to remove them; do not add them back. Check with `git log --format='%an <%ae> | %cn' ` before pushing.
- Apply the user's playbook: github.com/Agozie180/skill.md (SKILL.md, "Hackathon-Winning Playbook"; attach that repo with read access and read it at the start of a new chat).
- Keep everything small. Ask the user before big scope changes.

## Playbook applied to CourtAgent (from skill.md)
Circuit: crypto protocol / legal-tech (judges likely lawyers and compliance people; the repo AND a live Sepolia deploy are scored).
- L5 Thesis enforced in code: "The AI explains and flags; it never writes or changes the legal terms." Already true: the agreement and letters are deterministic templates (lib/domain), AI flags are capped at "medium", AI output is sanitized. TODO: add one test file named for the thesis (for example lib/ai/thesis.test.ts) proving that (a) the agreement text is identical with and without AI, (b) AI cannot raise a risk to High, (c) a one-word change gives a different hash that is not registered.
- L1 Prize surface: enter every track the one build fits: LegalTech & RegTech (main), Web3 for Social Good (widow module), AI x Blockchain (agent). Put the target tracks and the prize pool in the README header.
- L9 README is the judge's answer sheet: bold thesis line, links table (live demo, demo video, /verify page, contract on Sepolia explorer, DoraHacks event), diagrams (Mermaid, not screenshots), "what is used / what is not" table, "thesis enforced" table, "measured" table (test counts, reproduce commands), Limitations, Disclosures.
- L10 One-click runnable: Demo Mode needs no wallet or key; deterministic core runs with no API key; link a Sepolia faucet; copy-paste example prompts in the README.
- L11 Demo shows the guardrail, not just the happy path: a landlord document that scores High, a one-word change that breaks the hash on the verify page, a landlord trying to sign when not a party.
- L12 Honesty: Limitations section (only Lagos legal rules verified; not legal advice; AI untested with real keys unless the user tests it; contract on testnet only; document text is stored only in the browser or in the share link).
- L13 Hygiene: no secrets in git; before final submission remove or gitignore working files (this Handoff.md, task notes) and any agent instruction files; clean labelled commits.
- Submission mechanics: follow the DoraHacks form exactly, submit before 2026/11/01 02:01 (Lagos time is UTC+1) with buffer.

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
Open this repo, read this file and `git log`, run `npm install && npm run check`. The code is finished; what is left is the Sepolia deploy, real-key testing, hosting, demo video and submission (see STILL TO DO). Commits must be authored by Agozie180 only, with no co-author trailers.

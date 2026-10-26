# 2-minute demo script

Start with `npm run dev` (or the hosted URL, https://court-agent.vercel.app/). Stay in Demo Mode. Lead with the unfakeable moment, then show the guardrails.

1. **0:00 The point (15s).** On the home page press **Change the rent to 1,300,000**. The stamp flips from green
   RECORDED to red NOT RECORDED and the fingerprint changes. Say: "AI explains. Rules decide. A fingerprint makes a changed word detectable."
2. **0:15 Guardrail 1, the scam check (20s).** Press **Landlord abroad, keys by courier**. Show **HIGH RISK** and the reasons. Say: fixed rules rated this, no AI, nothing left the browser.
3. **0:35 Intake (20s).** Open *Rent a home*. Paste the answers from the README one at a time (Lagos, 1.2m a year, ...).
4. **0:55 Agreement (15s).** Show the agreement and the plain-language points. Say: the AI never touched the legal text.
5. **1:10 Record and sign (20s).** Acting as Tenant: record and sign. Switch to Landlord: sign. Status shows FULLY SIGNED.
6. **1:30 Guardrail 2, a stranger (10s).** Switch Acting as to *Someone else* and press **Try to sign anyway**. The registry refuses.
7. **1:40 Guardrail 3, the verify link (10s).** Open the verify link: it matches and the wallets match the text. Edit one number: NOT RECORDED.
8. **1:50 Pressure and widow (10s).** Show the exit letter and the *Protect a home* letter.
9. **2:00 Close.** "Lagos verified, honest about the rest. Held-out scam test: 3 of 10, and we say so."

Record several takes. Narrate step 1 slowly: it is the moment a judge cannot fake.

## Submission checklist

- [ ] `npm run deploy:sepolia`, address in `NEXT_PUBLIC_REGISTRY_ADDRESS`, `deployments/sepolia.json` committed, `npm run verify:live` passes, Etherscan link in README
- [x] Hosted URL in README (https://court-agent.vercel.app/)
- [ ] Hosted URL in the DoraHacks form
- [ ] Demo video link in README
- [ ] Try real Anthropic and OpenAI keys once; confirm the OpenAI model name
- [ ] Try Sepolia mode with MetaMask once
- [ ] Lawyer reviews the law notes, or keep the "not reviewed" wording
- [x] `Handoff.md` is removed from the repo and gitignored; confirm no secrets (`git grep -nI "PRIVATE_KEY"`)
- [ ] Repo description names the event; commits authored by Agozie180 only
- [ ] Submit on DoraHacks before 2026/11/01 02:01 Lagos time, with a buffer

# Security

CourtAgent is a hackathon project. The contract is **unaudited** and deployed, if at all, to a **test network** only.
Do not use it for real contracts or real money.

## Reporting a problem

Open a GitHub issue titled "Security" without exploit details, or contact the author, Agozie180, through GitHub. Please
allow a few days for a reply.

## What the design protects, and what it does not

- The registry stores only a keccak256 hash, the parties and signatures. It never stores document text.
- Only listed parties can register or sign. A hash is registered once.
- Share links keep the document text in the URL fragment, which browsers do not send to servers.
- Pasted text sent to `/api/check`, `/api/explain` or `/api/intake` is processed in memory, is not stored or logged by
  this app, and goes to Anthropic or OpenAI only when you configure a key. Those providers have their own policies.
- API routes limit body size and request rate (in memory, per instance). Model output is sanitised and capped before use,
  and pasted text is wrapped as untrusted data in prompts.
- A record proves a text existed and who signed it. It does not prove ownership of a property.

## Secrets

- `.env*` files are gitignored. Only `.env.example` is committed, with empty values.
- Use a throwaway wallet with test ETH for `DEPLOYER_PRIVATE_KEY`. Never use a wallet that holds real funds.

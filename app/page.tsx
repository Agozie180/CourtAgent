import Link from "next/link";
import { TamperDemo, ScamDemo } from "@/components/home-demos";
import { NIGERIAN_STATES } from "@/lib/domain/jurisdiction";
import { STATE_RULES } from "@/lib/domain/tenancy-rules";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>Check the landlord. Sign the agreement. Keep the proof.</h1>
            <p className="lead">
              AI explains and flags. Fixed rules decide. A fingerprint on Ethereum proves nothing was changed. Built for
              Nigerian tenants and for widows who may be pushed out of the family home.
            </p>
            <div className="button-row">
              <Link className="button yellow" href="/rent">
                Start a rental check
              </Link>
              <Link className="button ghost" href="/widow">
                Record a family property
              </Link>
            </div>
            <p className="proof-strip">
              <span>
                <strong>No wallet or key needed</strong> to try it
              </span>
              <span>
                <strong>{NIGERIAN_STATES.length} places</strong> covered, <strong>{Object.keys(STATE_RULES).length} legally verified</strong> (Lagos)
              </span>
              <span>
                <Link href="https://github.com/Agozie180/CourtAgent">Open source, MIT</Link>
              </span>
            </p>
          </div>
          <div id="try-tamper">
            <TamperDemo />
          </div>
        </div>
      </section>

      <section className="section" id="try">
        <div className="wrap">
          <h2>Try the other half: is this landlord message a scam?</h2>
          <p>
            Pick an example or paste a real message. The rating comes from fixed rules you can read in the code, and each
            warning says why.
          </p>
          <div className="try-grid">
            <ScamDemo />
            <div>
              <h3>Three promises, each one tested</h3>
              <ul className="explain-list">
                <li>The AI never writes or edits the legal terms. The agreement is a fixed template.</li>
                <li>The AI can add a warning but can never make a check High risk. Only the fixed rules can.</li>
                <li>One changed word gives a different fingerprint, so a record cannot be quietly rewritten.</li>
              </ul>
              <p className="hint">The proof is in the test files, listed in the README.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>How a rental goes</h2>
          <ol className="ledger">
            <li>
              <div>
                <h3>Tell the agent what you need</h3>
                <p>The state, your budget, the number of rooms and whether you want a parlour. The agent asks one question at a time.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Check the landlord before you pay</h3>
                <p>Paste what the landlord sent you and answer seven yes or no questions. You get a Low, Medium or High warning and the reason for each flag.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Get a plain agreement</h3>
                <p>The terms are fixed by a template, so the wording never changes between drafts. The AI only explains it in simple English.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Both sign, and the fingerprint is recorded</h3>
                <p>Tenant and landlord each sign with their own wallet. Change one word later and the fingerprint no longer matches.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>If the landlord demands you leave</h3>
                <p>Describe what happened. CourtAgent writes a reply that quotes your signed terms, and lists where to get free legal help.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap two-col">
          <div>
            <h2>For a widow who may be pushed out</h2>
            <p>
              After a burial, relatives sometimes arrive to take the house, the land and the property, especially when
              there is no male child. A record made while the family is together is dated, and cannot be edited later.
            </p>
            <p>
              Register the property and the documents you hold. If relatives come, CourtAgent writes a calm notice that
              cites the record and the court rulings that protect a widow, and tells you where to find legal aid.
            </p>
            <Link className="button ghost" href="/widow">
              Record a family property
            </Link>
          </div>
          <div>
            <h2>What goes on the blockchain</h2>
            <p>
              Only a fingerprint: a 66-character code made from the document text. The document itself stays in your
              browser and in the link you choose to share.
            </p>
            <p>
              Anyone with a copy can paste it into the <Link href="/verify">verify page</Link> and see whether that exact
              text was recorded, when, and who has signed.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>What CourtAgent does not do</h2>
          <table className="plain-table">
            <thead>
              <tr>
                <th>It does</th>
                <th>It does not</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Warn you about common rental scam patterns</td>
                <td>Prove that a property exists or that a landlord owns it</td>
              </tr>
              <tr>
                <td>Apply checked tenancy rules for Lagos</td>
                <td>Give the legal rules for other states until they are researched. It says so when it has not checked.</td>
              </tr>
              <tr>
                <td>Let the AI explain and flag</td>
                <td>Let the AI write or change the terms of an agreement</td>
              </tr>
              <tr>
                <td>Record a fingerprint on a test network</td>
                <td>Replace a lawyer, a court, or a signed paper agreement</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// @vitest-environment jsdom
// End-to-end checks of the three flows in Demo Mode. The browser's fetch is wired straight to the real API route handlers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

let path = "/rent";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

import { POST as intakeRoute } from "@/app/api/intake/route";
import { POST as checkRoute } from "@/app/api/check/route";
import { POST as explainRoute } from "@/app/api/explain/route";
import { GET as statusRoute } from "@/app/api/status/route";
import { resetAiStatusForTests } from "@/lib/hooks";
import { RentFlow } from "./rent-flow";
import { WidowFlow } from "./widow-flow";
import { VerifyView } from "./verify-view";
import { SessionProvider } from "./session-provider";
import { SiteHeader } from "./site-header";

let counter = 0;
function wireFetch() {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    counter += 1;
    const headers = new Headers(init?.headers);
    headers.set("x-forwarded-for", `10.0.0.${counter % 250}-${counter}`); // a new address each call, so the rate limit never trips
    const request = new Request(`http://localhost${url}`, { ...init, headers });
    if (url === "/api/status") return statusRoute();
    if (url === "/api/intake") return intakeRoute(request);
    if (url === "/api/check") return checkRoute(request);
    if (url === "/api/explain") return explainRoute(request);
    return new Response("not found", { status: 404 });
  });
}

function App({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SiteHeader />
      {children}
    </SessionProvider>
  );
}

beforeEach(() => {
  Element.prototype.scrollTo = () => {}; // jsdom has no scrollTo
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  localStorage.clear();
  resetAiStatusForTests();
  wireFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function say(text: string) {
  const box = screen.getByLabelText("Your answer") as HTMLInputElement;
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /^(send|save)$/i }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /sending/i })).toBeNull());
}

const chatText = () => document.querySelector(".chat-log")?.textContent ?? "";
const factsText = () => document.querySelector(".facts")?.textContent ?? "";

describe("rent flow", () => {
  it("rejects an answer that does not fit the question and never changes the state", async () => {
    render(<App><RentFlow /></App>);
    await say("Lagos");
    await say("1.5 million");
    await say("2");
    await say("yes");
    await say("Yaba");
    await say("I want a house in Abuja for 5k");
    expect(chatText()).toMatch(/does not look like a person's full name/i);
    expect(factsText()).toContain("State: Lagos");
    expect(factsText()).not.toContain("FCT");
    expect(factsText()).not.toMatch(/Landlord:/);
  });

  it("warns when the quoted rent is above the budget, shows what is still missing, and uses 1 month not 1 months", async () => {
    render(<App><RentFlow /></App>);
    for (const answer of ["Lagos", "1 million", "1", "no", "Yaba", "Mr Chinedu Eze", "Ngozi Okoro", "1.8 million", "1 month"]) await say(answer);
    expect(factsText()).toMatch(/above your budget/i);
    expect(chatText()).toMatch(/above your budget/i);
    expect(factsText()).toContain("Advance rent: 1 month");
    expect(factsText()).not.toContain("1 months");
    expect(factsText()).toMatch(/Still to answer: .*caution deposit.*tenancy type.*start date.*duration/i);
  });

  it("lets a user edit an earlier answer with the Edit button", async () => {
    render(<App><RentFlow /></App>);
    for (const answer of ["Lagos", "1.5 million", "2", "yes", "Yaba"]) await say(answer);
    expect(factsText()).toContain("Bedrooms: 2");
    const bubbles = Array.from(document.querySelectorAll(".bubble.you"));
    const bedroomBubble = bubbles.find((bubble) => bubble.textContent?.startsWith("2"));
    fireEvent.click(within(bedroomBubble as HTMLElement).getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("Your answer") as HTMLInputElement).value).toBe("2");
    await say("3");
    expect(factsText()).toContain("Bedrooms: 3");
    expect(factsText()).toContain("State: Lagos");
  });

  it("shows the not-verified banner for a state other than Lagos", async () => {
    render(<App><RentFlow /></App>);
    expect(screen.queryByText(/not legally verified/i)).toBeNull();
    await say("Enugu");
    expect(screen.getByText("Rules for this state are not legally verified. Get legal advice.")).toBeTruthy();
  });

  it("runs the whole flow: check, agreement, record, sign by both, and a dated letter", async () => {
    render(<App><RentFlow /></App>);
    const answers = ["Lagos", "2 million", "2", "yes", "Yaba", "Mr Chinedu Eze", "Ngozi Okoro", "1.8 million", "12 months", "0", "yearly", "2026-12-01", "12 months"];
    for (const answer of answers) await say(answer);
    fireEvent.click(screen.getByRole("button", { name: /continue to the landlord check/i }));

    // the questions are listed as unanswered, then answered
    expect(screen.getByText(/answer these to run the check/i)).toBeTruthy();
    for (const group of screen.getAllByRole("group", { name: /\?$/ })) {
      fireEvent.click(within(group).getByRole("button", { name: /^no$/i }));
    }
    fireEvent.click(screen.getByRole("button", { name: /run the check/i }));
    await screen.findByText(/RISK/);
    expect(screen.getByText(/Built-in rules only. No AI key is set/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /continue to the agreement/i }));

    // missing address is listed, then fixed
    expect(screen.getByText(/Property address is required/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Property address"), { target: { value: "Flat 3, 12 Akin Adesola Street, Lekki" } });
    expect(await screen.findByText(/TENANCY AGREEMENT/)).toBeTruthy();
    expect(document.querySelector(".sheet-text")?.textContent).toContain("12 months");
    fireEvent.click(screen.getByRole("button", { name: /continue to record and sign/i }));

    // the tenant records and signs; the agreement is NOT fully signed yet
    fireEvent.click(screen.getByRole("button", { name: /^record and sign$/i }));
    await screen.findByText("WAITING FOR SIGNATURES");
    expect(screen.queryByText("FULLY SIGNED")).toBeNull();

    // switch to the landlord and sign: now fully signed
    fireEvent.change(screen.getByRole("combobox", { name: /acting as/i }), { target: { value: "landlord" } });
    fireEvent.click(await screen.findByRole("button", { name: /sign this document/i }));
    await screen.findByText("FULLY SIGNED");

    // the answers are now locked
    fireEvent.click(screen.getByText("1. Details"));
    expect(screen.getByText(/has been signed, so your answers are locked/i)).toBeTruthy();
    expect((screen.getByLabelText("Your answer") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Edit anyway" }));
    expect(screen.getByText(/Editing will create a new unsigned record/i)).toBeTruthy();

    // the letter refuses a demand dated before the tenancy started
    fireEvent.click(screen.getByText("5. If the landlord pushes"));
    fireEvent.change(screen.getByLabelText("Date of the demand"), { target: { value: "2026-01-05" } });
    fireEvent.change(screen.getByLabelText(/what did the landlord say/i), { target: { value: "told me to pack out within two weeks" } });
    expect(screen.getByText(/before the tenancy started on 2026-12-01/i)).toBeTruthy();
    expect(screen.queryByText(/RESPONSE TO YOUR DEMAND/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Date of the demand"), { target: { value: "2026-12-20" } });
    fireEvent.change(screen.getByLabelText("Date of your letter"), { target: { value: "2026-12-21" } });
    expect(await screen.findByText(/RESPONSE TO YOUR DEMAND/)).toBeTruthy();
  });

  it("asks who must sign and only shows FULLY SIGNED after the witness has signed too", async () => {
    render(<App><RentFlow /></App>);
    for (const answer of ["Lagos", "2 million", "2", "yes", "Yaba", "Mr Chinedu Eze", "Ngozi Okoro", "1.8 million", "12 months", "0", "yearly", "2026-12-01", "12 months"]) await say(answer);
    fireEvent.click(screen.getByRole("button", { name: /continue to the landlord check/i }));
    for (const group of screen.getAllByRole("group", { name: /\?$/ })) fireEvent.click(within(group).getByRole("button", { name: /^no$/i }));
    fireEvent.click(screen.getByRole("button", { name: /run the check/i }));
    await screen.findByText(/RISK/);
    fireEvent.click(screen.getByRole("button", { name: /continue to the agreement/i }));
    fireEvent.change(screen.getByLabelText("Property address"), { target: { value: "Flat 3, Lekki" } });
    fireEvent.change(screen.getByLabelText("Who must sign?"), { target: { value: "three" } });
    await screen.findByText(/Witness, who must also sign/);
    fireEvent.click(screen.getByRole("button", { name: /continue to record and sign/i }));
    fireEvent.click(screen.getByRole("button", { name: /^record and sign$/i }));
    await screen.findByText("WAITING FOR SIGNATURES");
    fireEvent.change(screen.getByRole("combobox", { name: /acting as/i }), { target: { value: "landlord" } });
    fireEvent.click(await screen.findByRole("button", { name: /sign this document/i }));
    await waitFor(() => expect(screen.getAllByText("Signed").length).toBe(2));
    expect(screen.queryByText("FULLY SIGNED")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: /acting as/i }), { target: { value: "witness" } });
    fireEvent.click(await screen.findByRole("button", { name: /sign this document/i }));
    await screen.findByText("FULLY SIGNED");
  });
});

describe("rent flow step 5: letter voice and legal aid", () => {
  async function reachStepFive() {
    render(<App><RentFlow /></App>);
    for (const answer of ["Lagos", "2 million", "2", "yes", "Yaba", "Mr Chinedu Eze", "Ngozi Okoro", "1.8 million", "12 months", "0", "yearly", "2026-12-01", "12 months"]) await say(answer);
    fireEvent.click(screen.getByRole("button", { name: /continue to the landlord check/i }));
    for (const group of screen.getAllByRole("group", { name: /\?$/ })) fireEvent.click(within(group).getByRole("button", { name: /^no$/i }));
    fireEvent.click(screen.getByRole("button", { name: /run the check/i }));
    await screen.findByText(/RISK/);
    fireEvent.click(screen.getByRole("button", { name: /continue to the agreement/i }));
    fireEvent.change(screen.getByLabelText("Property address"), { target: { value: "Flat 3, Lekki" } });
    fireEvent.click(screen.getByRole("button", { name: /continue to record and sign/i }));
    fireEvent.click(screen.getByRole("button", { name: /^record and sign$/i }));
    await screen.findByText("WAITING FOR SIGNATURES");
    fireEvent.click(screen.getByText("5. If the landlord pushes"));
    fireEvent.change(screen.getByLabelText("Date of the demand"), { target: { value: "2026-12-20" } });
    fireEvent.change(screen.getByLabelText("Date of your letter"), { target: { value: "2026-12-21" } });
  }

  it("R-2: asks six questions, and a seventh only when an agent is involved", async () => {
    render(<App><RentFlow /></App>);
    for (const answer of ["Lagos", "2 million", "2", "yes", "Yaba", "Mr Chinedu Eze", "Ngozi Okoro", "1.8 million", "12 months", "0", "yearly", "2026-12-01", "12 months"]) await say(answer);
    fireEvent.click(screen.getByRole("button", { name: /continue to the landlord check/i }));
    expect(screen.getAllByRole("group", { name: /\?$/ })).toHaveLength(6);
    expect(screen.queryByText(/letter from the owner allowing them/i)).toBeNull();
    const agent = screen.getByRole("group", { name: /dealing with an agent/i });
    fireEvent.click(within(agent).getByRole("button", { name: /^yes$/i }));
    expect(screen.getAllByRole("group", { name: /\?$/ })).toHaveLength(7);
    expect(screen.getByRole("group", { name: /letter from the owner allowing them/i })).toBeTruthy();
  });

  it("R-4: asks the tenant to write to the landlord as you, and holds the letter back while it says he", async () => {
    await reachStepFive();
    expect(screen.getByLabelText(/what did the landlord say/i).getAttribute("placeholder")).toContain("said you will change the lock");
    expect(screen.getByText(/On that date, you/)).toBeTruthy();
    const box = screen.getByLabelText(/what did the landlord say/i);
    fireEvent.change(box, { target: { value: "told me to pack out and said he will change the lock" } });
    expect(screen.getByText(/Write it to the landlord/)).toBeTruthy();
    expect(screen.getByText(/Replace "he" with "you"/)).toBeTruthy();
    expect(screen.queryByText(/RESPONSE TO YOUR DEMAND/)).toBeNull();
    fireEvent.change(box, { target: { value: "told me to pack out and said you will change the lock" } });
    expect(screen.queryByText(/Write it to the landlord/)).toBeNull();
    await screen.findByText(/RESPONSE TO YOUR DEMAND/);
    expect(document.querySelector(".sheet-text")?.textContent).toContain("you told me to pack out and said you will change the lock");
  });

  it("R-3: shows the three official links and the sourced phone numbers for Lagos", async () => {
    await reachStepFive();
    const aid = screen.getByRole("region", { name: /free legal help/i });
    const hrefs = within(aid).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining([
      "https://www.legalaidcouncil.gov.ng",
      "https://fida.org.ng/how-to-access-our-services/",
      "https://lagosstatemoj.org/public-defender/",
      "tel:+2347031915990",
      "tel:+2347088496115",
    ]));
    expect(within(aid).getByText("+234 7031915990")).toBeTruthy();
    expect(within(aid).getByText(/confirm on the official site/i)).toBeTruthy();
  });
});

describe("verify flow", () => {
  it("tells the visitor what to do on empty input, then verifies pasted text", async () => {
    path = "/verify";
    render(<App><VerifyView /></App>);
    expect(screen.getByText("Paste the document text to check it.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/exact text of the document/i), { target: { value: "Some text nobody recorded." } });
    expect(screen.queryByText("Paste the document text to check it.")).toBeNull();
    await screen.findByText("NOT RECORDED");
  });

  it("R-6: checks a typed fingerprint before looking it up and says what is wrong", async () => {
    path = "/verify";
    render(<App><VerifyView /></App>);
    const box = screen.getByLabelText(/look up a fingerprint/i) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "0x1234" } });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/64 characters after the 0x/);
    expect(alert.textContent).toMatch(/Nothing was looked up/);
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("NOT RECORDED")).toBeNull();

    fireEvent.change(box, { target: { value: "not a hash" } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/starts with 0x/);

    fireEvent.change(box, { target: { value: `0x${"ab".repeat(32)}` } });
    await screen.findByText("NOT RECORDED"); // a well-formed fingerprint is looked up
    expect(screen.queryByRole("alert")).toBeNull();
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });
});

describe("widow flow", () => {
  const fill = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it("hides Tenant and Landlord, blocks a will that is listed but answered No, locks once signed, and is read-only for a stranger", async () => {
    path = "/widow";
    render(<App><WidowFlow /></App>);
    const roles = within(screen.getByRole("combobox", { name: /acting as/i })).getAllByRole("option").map((option) => option.textContent);
    expect(roles.some((role) => /tenant|landlord/i.test(role ?? ""))).toBe(false);
    expect(roles.length).toBeGreaterThan(1);

    fill("Name of the person registering", "Emeka Okoro");
    fill("Describe the property", "Family house at 4 Bode Street, Surulere, Lagos");
    fill("Documents you hold", "Deed of assignment, survey plan, last will and testament");
    fill("Where the original documents are kept", "Fireproof box at home");
    expect(screen.getByText(/listed a will under/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^record and sign$/i })).toBeNull();

    fireEvent.click(within(screen.getByRole("group", { name: "Has a will been made?" })).getByRole("button", { name: "Yes" }));
    expect(screen.queryByText(/listed a will under/i)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /^record and sign$/i }));
    await screen.findByText("FULLY SIGNED"); // one required signer, and they have signed

    // locked, with the warning only after "Edit anyway"
    expect(screen.getByText(/has been signed, so it is locked/i)).toBeTruthy();
    expect(screen.getByLabelText("Name of the person registering").matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Edit anyway" }));
    expect(screen.getByText(/Editing will create a new unsigned record/i)).toBeTruthy();
    fill("Name of the person registering", "Emeka C. Okoro");
    expect(screen.getByText(/this is a new unsigned record/i)).toBeTruthy();
    expect(screen.queryByText("FULLY SIGNED")).toBeNull();

    // a stranger sees the form but cannot edit it
    fireEvent.change(screen.getByRole("combobox", { name: /acting as/i }), { target: { value: "stranger" } });
    expect(screen.getByLabelText("Name of the person registering").matches(":disabled")).toBe(true);
    expect(screen.getByText(/the form is read-only/i)).toBeTruthy();
  });

  it("shows the not-verified banner for a state other than Lagos and a safe Ukeje line", async () => {
    path = "/widow";
    render(<App><WidowFlow /></App>);
    fill("Name of the person registering", "Emeka Okoro");
    fill("Describe the property", "Family house in Enugu");
    fill("Documents you hold", "Deed of assignment");
    fill("Where the original documents are kept", "Home");
    fireEvent.click(await screen.findByRole("button", { name: /^record and sign$/i }));
    await screen.findByText("FULLY SIGNED");
    fill("Your name", "Mrs Ngozi Okoro");
    fill("Name of your late husband", "Emeka Okoro");
    expect(screen.queryByText(/not legally verified/i)).toBeNull();
    fill("State where the property is", "Enugu");
    expect(screen.getByText("Rules for this state are not legally verified. Get legal advice.")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "Do you have a daughter?" })).getByRole("button", { name: "Yes" }));
    const letter = Array.from(document.querySelectorAll(".sheet-text")).pop()?.textContent ?? "";
    expect(letter).toMatch(/Ukeje v Ukeje \(2014\).*daughter/s);
    expect(letter).not.toMatch(/Lagos State Office of the Public Defender/);
  });
});

describe("widow notice: state warning and legal aid", () => {
  const fill = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  async function recordProperty(description: string) {
    path = "/widow";
    render(<App><WidowFlow /></App>);
    fill("Name of the person registering", "Emeka Okoro");
    fill("Describe the property", description);
    fill("Documents you hold", "Deed of assignment");
    fill("Where the original documents are kept", "Home");
    fireEvent.click(await screen.findByRole("button", { name: /^record and sign$/i }));
    await screen.findByText("FULLY SIGNED");
    fill("Your name", "Mrs Ngozi Okoro");
    fill("Name of your late husband", "Emeka Okoro");
  }

  it("R-5: warns above the notice when the chosen state is not the state in the address, and clears when they agree", async () => {
    await recordProperty("Family house at 4 Bode Street, Surulere, Lagos");
    expect(screen.queryByText(/The property address you recorded mentions/)).toBeNull(); // Lagos selected, Lagos in the address
    fill("State where the property is", "Enugu");
    const warning = screen.getByText(/The property address you recorded mentions Lagos State, but the state chosen for this notice is Enugu State/);
    const notice = document.querySelector('[aria-label="Notice to the family"]') as HTMLElement;
    expect(notice).toBeTruthy();
    // the warning comes before the notice in the page
    expect(warning.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fill("State where the property is", "Lagos");
    expect(screen.queryByText(/The property address you recorded mentions/)).toBeNull();
  });

  it("R-5: an address with no state name gives no warning, and a street named after a state does not either", async () => {
    await recordProperty("Family house at 12 Delta Street, Lagos");
    expect(screen.queryByText(/The property address you recorded mentions/)).toBeNull();
  });

  it("R-3: lists the official legal aid links under the notice, and the Lagos office only for Lagos", async () => {
    await recordProperty("Family house at 4 Bode Street, Surulere, Lagos");
    const aid = screen.getByRole("region", { name: /free legal help/i });
    expect(within(aid).getByRole("link", { name: "Lagos State Office of the Public Defender: official website" })).toBeTruthy();
    const hrefs = () => within(screen.getByRole("region", { name: /free legal help/i })).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs()).toContain("https://lagosstatemoj.org/public-defender/");
    fill("State where the property is", "Enugu");
    expect(hrefs()).not.toContain("https://lagosstatemoj.org/public-defender/");
    expect(hrefs()).toEqual(expect.arrayContaining(["https://www.legalaidcouncil.gov.ng", "https://fida.org.ng/how-to-access-our-services/"]));
  });
});

describe("wallet error and mode", () => {
  it("clears a stale wallet error when the user goes back to Demo Mode", async () => {
    path = "/rent";
    vi.stubEnv("NEXT_PUBLIC_REGISTRY_ADDRESS", "0xd64d1fd08e81bbf5aaa194a138d005aa4d4e75ff");
    render(<App><RentFlow /></App>);
    const sepolia = screen.getByRole("button", { name: "Sepolia" }) as HTMLButtonElement;
    expect(sepolia.disabled).toBe(false);
    fireEvent.click(sepolia);
    fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    await screen.findByText(/no ethereum wallet found/i);
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(screen.queryByText(/no ethereum wallet found/i)).toBeNull();
    vi.unstubAllEnvs();
  });
});

import { describe, expect, it } from "vitest";
import { activeProvider, availableProviders, complete, completeJson, extractJson } from "./provider";
import { explainAgreement, explainOffline, runDocumentCheck, runIntake, sanitizeAiFlags } from "./tasks";
import { emptyIntake } from "@/lib/domain/intake";
import type { TenancyTerms } from "@/lib/domain/agreement";

const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const anthropicReply = (text: string) => okJson({ content: [{ type: "text", text }] });
const openaiReply = (text: string) => okJson({ choices: [{ message: { content: text } }] });

const terms: TenancyTerms = {
  state: "Lagos",
  landlordName: "Chief Adewale Bello",
  tenantName: "Ada Okeke",
  landlordWallet: "0x000000000000000000000000000000000001a2d1",
  tenantWallet: "0x0000000000000000000000000000000000007e01",
  propertyAddress: "Flat 3, Lekki",
  bedrooms: 2,
  parlour: true,
  annualRentNgn: 1_200_000,
  advanceMonths: 12,
  cautionNgn: 0,
  tenancyType: "yearly",
  startDate: "2026-12-01",
  durationMonths: 12,
};

describe("provider selection", () => {
  it("is offline with no keys and honours AI_PROVIDER", () => {
    expect(activeProvider({})).toBe("offline");
    expect(availableProviders({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" })).toEqual(["anthropic", "openai"]);
    expect(availableProviders({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", AI_PROVIDER: "openai" })).toEqual(["openai"]);
    expect(availableProviders({ ANTHROPIC_API_KEY: "a", AI_PROVIDER: "openai" })).toEqual([]);
    expect(availableProviders({ ANTHROPIC_API_KEY: "a", AI_PROVIDER: "offline" })).toEqual([]);
  });
});

describe("provider calls", () => {
  it("reads an Anthropic reply and sends the right headers", async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string> };
      return anthropicReply('{"ok":true}');
    }) as unknown as typeof fetch;
    const result = await complete({ system: "s", user: "u" }, { ANTHROPIC_API_KEY: "key" }, fetchImpl);
    expect(result).toEqual({ provider: "anthropic", text: '{"ok":true}' });
    expect(seen!.url).toContain("api.anthropic.com");
    expect(seen!.headers["x-api-key"]).toBe("key");
  });

  it("falls back to OpenAI when Anthropic fails", async () => {
    const fetchImpl = (async (url: string) =>
      url.includes("anthropic") ? new Response("nope", { status: 500 }) : openaiReply('{"ok":1}')) as unknown as typeof fetch;
    const result = await completeJson({ system: "s", user: "u" }, { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }, fetchImpl);
    expect(result).toEqual({ provider: "openai", data: { ok: 1 } });
  });

  it("returns null when nothing works", async () => {
    const failing = (async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
    expect(await complete({ system: "s", user: "u" }, { OPENAI_API_KEY: "o" }, failing)).toBeNull();
    expect(await complete({ system: "s", user: "u" }, {}, failing)).toBeNull();
  });

  it("extracts JSON from fenced or chatty replies", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":2} hope it helps')).toEqual({ a: 2 });
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("AI tasks work offline and accept AI help safely", () => {
  it("runs the intake offline and asks the next question", async () => {
    const first = await runIntake("1.2 million", { ...emptyIntake(), state: "Lagos" }, "budgetNgn", {});
    expect(first.provider).toBe("offline");
    expect(first.fields.budgetNgn).toBe(1_200_000);
    expect(first.next).toBe("bedrooms");
    expect(first.reply).toContain("bedrooms");
  });

  it("re-asks when it did not understand", async () => {
    const result = await runIntake("hmm", { ...emptyIntake(), state: "Lagos" }, "bedrooms", {});
    expect(result.reply.startsWith("I did not catch that")).toBe(true);
    expect(result.next).toBe("budgetNgn");
  });

  it("merges validated AI extraction and ignores junk fields", async () => {
    const fetchImpl = (async () =>
      anthropicReply('{"budgetNgn": 900000, "bedrooms": "lots", "area": "Yaba", "evil": "x"}')) as unknown as typeof fetch;
    const result = await runIntake("around 900k, in Yaba", { ...emptyIntake(), state: "Lagos" }, "budgetNgn", { ANTHROPIC_API_KEY: "k" }, fetchImpl);
    expect(result.provider).toBe("anthropic");
    expect(result.fields.budgetNgn).toBe(900_000);
    expect(result.fields.area).toBe("Yaba");
    expect(result.fields.bedrooms).toBeNull();
  });

  it("caps AI document flags at medium so only fixed rules can say High", async () => {
    const flags = sanitizeAiFlags({ flags: [{ severity: "high", message: "The dates do not match." }, { severity: "x" }] });
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("low");
    const medium = sanitizeAiFlags({ flags: [{ severity: "medium", message: "The payee name differs." }] });
    expect(medium[0].severity).toBe("medium");
  });

  it("runs the document check with AI notes merged in", async () => {
    const fetchImpl = (async () =>
      openaiReply('{"flags":[{"severity":"medium","message":"The receipt date is after the move-in date."}]}')) as unknown as typeof fetch;
    const outcome = await runDocumentCheck(
      {
        state: "Lagos",
        claimedLandlordName: "Chief Adewale Bello",
        documentText: "Receipt from Chief Adewale Bello",
        advanceMonths: 12,
        answers: {
          inspectedInPerson: true,
          sawOriginalTitle: true,
          dealingWithAgent: false,
          agentHasAuthorityLetter: false,
          askedToPayBeforeViewing: false,
          paymentToPersonalAccount: false,
          receiptPromised: true,
        },
      },
      { OPENAI_API_KEY: "o" },
      fetchImpl,
    );
    expect(outcome.provider).toBe("openai");
    expect(outcome.flags.map((flag) => flag.source)).toEqual(["ai"]);
    expect(outcome.level).toBe("Medium");
  });

  it("explains the agreement offline from the terms, and warns about long advance rent", async () => {
    const offline = await explainAgreement(terms, "text", {});
    expect(offline.provider).toBe("offline");
    expect(offline.points.join(" ")).toContain("NGN 1,200,000");
    expect(explainOffline({ ...terms, advanceMonths: 24 })[0]).toContain("Warning");
  });
});

import { describe, expect, it } from "vitest";
import { POST as explain } from "./explain/route";
import { POST as check } from "./check/route";
import { rateLimited } from "@/lib/api/guard";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("API routes", () => {
  it("rejects missing or invalid terms with 400, never a 500", async () => {
    expect((await explain(post({}))).status).toBe(400);
    const res = await explain(post({ terms: { state: "Lagos", startDate: "abc", durationMonths: "x", annualRentNgn: -1 } }));
    expect(res.status).toBe(400);
  });
  it("rejects bodies over the size limit", async () => {
    const res = await explain(post({ terms: { pad: "x".repeat(60_000) } }));
    expect(res.status).toBe(400);
  });
  it("check rejects empty input", async () => {
    expect((await check(post({}))).status).toBe(400);
  });
  it("rate limits one address after 30 requests a minute", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9" } });
    const results = Array.from({ length: 32 }, () => rateLimited(req, 1000));
    expect(results.slice(0, 30).every((r) => r === false)).toBe(true);
    expect(results[31]).toBe(true);
  });
});

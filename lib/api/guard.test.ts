import { describe, expect, it } from "vitest";
import { rateLimited } from "./guard";

const req = (ip: string) => new Request("http://localhost/api/x", { headers: { "x-forwarded-for": ip } });

describe("rate limit", () => {
  it("allows normal use and blocks bursts per IP", () => {
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) expect(rateLimited(req("9.9.9.9"), now)).toBe(false);
    expect(rateLimited(req("9.9.9.9"), now)).toBe(true);
    expect(rateLimited(req("8.8.8.8"), now)).toBe(false);
    expect(rateLimited(req("9.9.9.9"), now + 61_000)).toBe(false);
  });
});

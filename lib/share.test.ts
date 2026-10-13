import { describe, expect, it } from "vitest";
import { buildVerifyPath, decodeShareText, encodeShareText, readShareFromHash } from "./share";

describe("share links", () => {
  it("round-trips text including naira signs and accents", () => {
    const text = "TENANCY AGREEMENT\nRent: ₦1,200,000 — Adéwálé Bello\n\n10. IMPORTANT";
    expect(decodeShareText(encodeShareText(text))).toBe(text);
  });
  it("reads the text back from a URL fragment", () => {
    const path = buildVerifyPath("hello world");
    expect(readShareFromHash(path.slice(path.indexOf("#")))).toBe("hello world");
    expect(readShareFromHash("#other=1")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(decodeShareText("%%%")).toBeNull();
    expect(decodeShareText("")).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./status/route";

afterEach(() => vi.unstubAllEnvs());

describe("/api/status", () => {
  it("reports the real mode from the server's environment", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await (await GET()).json()).toMatchObject({ provider: "offline", reason: "no-key" });
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const body = await (await GET()).json();
    expect(body).toMatchObject({ provider: "anthropic", reason: "ok" });
    expect(JSON.stringify(body)).not.toContain("sk-ant-test");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

async function renderHome(repoPublic: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_REPO_PUBLIC", repoPublic ? "true" : "false");
  const { default: Home } = await import("@/app/page");
  return renderToStaticMarkup(<Home />);
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

afterEach(() => vi.unstubAllEnvs());

describe("R-1: the home page does not point at the README, test files or the code", () => {
  it("while the repo is private, no visitor is told to read the README, the tests or the code, and there is no GitHub link", async () => {
    const html = await renderHome(false);
    const plain = text(html);
    expect(plain).not.toMatch(/readme/i);
    expect(plain).not.toMatch(/test files/i);
    expect(plain).not.toMatch(/in the code/i);
    expect(plain).not.toMatch(/each one tested/i);
    expect(html).not.toContain("github.com");
  });
  it("once NEXT_PUBLIC_REPO_PUBLIC=true, it shows the GitHub link and nothing else about the code", async () => {
    const html = await renderHome(true);
    const links = [...html.matchAll(/href="(https:\/\/github\.com[^"]*)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    expect(new Set(links)).toEqual(new Set(["https://github.com/Agozie180/CourtAgent"]));
    expect(text(html)).not.toMatch(/readme|test files|in the code/i);
  });
});

describe("R-2: the home page does not promise seven questions every time", () => {
  it("says six or seven and explains when the seventh appears", async () => {
    const plain = text(await renderHome(false));
    expect(plain).toMatch(/six or seven yes or no questions/);
    expect(plain).toMatch(/seventh appears only if you are dealing with an agent/);
    expect(plain).not.toMatch(/answer seven/i);
  });
});

/**
 * Thin provider layer: Anthropic and OpenAI over plain HTTPS (no SDKs), plus an "offline" mode.
 * Every caller must work when this returns null, so the product runs with no API keys at all.
 */

export type ProviderName = "anthropic" | "openai" | "offline";

type Env = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export type CompletionRequest = {
  system: string;
  user: string;
  maxTokens?: number;
};

export type CompletionResult = { provider: Exclude<ProviderName, "offline">; text: string };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 25_000;

/** A key as typed into a dashboard: trimmed, and without the quotes people sometimes paste around it. */
export function readKey(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

export function availableProviders(env: Env = process.env): Exclude<ProviderName, "offline">[] {
  const setting = (env.AI_PROVIDER || "auto").trim().toLowerCase();
  if (setting === "offline") return [];
  const hasAnthropic = readKey(env.ANTHROPIC_API_KEY) !== "";
  const hasOpenAI = readKey(env.OPENAI_API_KEY) !== "";
  if (setting === "anthropic") return hasAnthropic ? ["anthropic"] : [];
  if (setting === "openai") return hasOpenAI ? ["openai"] : [];
  // auto: prefer Anthropic, fall back to OpenAI
  const order: Exclude<ProviderName, "offline">[] = [];
  if (hasAnthropic) order.push("anthropic");
  if (hasOpenAI) order.push("openai");
  return order;
}

export function activeProvider(env: Env = process.env): ProviderName {
  return availableProviders(env)[0] ?? "offline";
}

/** Names of environment variables that look like an AI key but are not the ones CourtAgent reads. Names only, never values. */
export function misnamedKeyVariables(env: Env = process.env): string[] {
  const read = new Set(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
  return Object.keys(env)
    .filter((name) => !read.has(name) && /^(next_public_)?(anthropic|openai|claude)(_[a-z0-9]+)*_(api_)?key$/i.test(name) && readKey(env[name]) !== "")
    .sort();
}

export type AiStatus = {
  /** The provider that will be tried first, or "offline". */
  provider: ProviderName;
  /** Why it is offline, when it is. */
  reason: "ok" | "disabled" | "no-key";
  /** Variables that look like keys but have a name that is not read (a typo, or NEXT_PUBLIC_ which would expose a key). */
  misnamed: string[];
};

export function aiStatus(env: Env = process.env): AiStatus {
  const provider = activeProvider(env);
  const disabled = (env.AI_PROVIDER || "auto").trim().toLowerCase() === "offline";
  return { provider, reason: provider !== "offline" ? "ok" : disabled ? "disabled" : "no-key", misnamed: misnamedKeyVariables(env) };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(req: CompletionRequest, env: Env, fetchImpl: FetchLike): Promise<string> {
  const response = await withTimeout((signal) =>
    fetchImpl(ANTHROPIC_URL, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": readKey(env.ANTHROPIC_API_KEY),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      }),
    }),
  );
  if (!response.ok) throw new Error(`Anthropic request failed with status ${response.status}`);
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text");
  return text;
}

async function callOpenAI(req: CompletionRequest, env: Env, fetchImpl: FetchLike): Promise<string> {
  const response = await withTimeout((signal) =>
    fetchImpl(OPENAI_URL, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${readKey(env.OPENAI_API_KEY)}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: { type: "json_object" },
      }),
    }),
  );
  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no text");
  return text;
}

/** Try each configured provider in order. Returns null if none is configured or all fail. */
export async function complete(
  req: CompletionRequest,
  env: Env = process.env,
  fetchImpl: FetchLike = fetch,
  errors?: string[],
): Promise<CompletionResult | null> {
  for (const provider of availableProviders(env)) {
    try {
      const text =
        provider === "anthropic" ? await callAnthropic(req, env, fetchImpl) : await callOpenAI(req, env, fetchImpl);
      return { provider, text };
    } catch (error) {
      // Try the next provider. Never log request bodies: they can contain private documents.
      // The message holds a status code only, never a key, so it is safe to show.
      errors?.push(error instanceof Error ? error.message : "The AI request failed");
    }
  }
  return null;
}

/** Pull the first JSON object out of a model reply, even if it is wrapped in a code fence or chatter. */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function completeJson(
  req: CompletionRequest,
  env: Env = process.env,
  fetchImpl: FetchLike = fetch,
  errors?: string[],
): Promise<{ provider: Exclude<ProviderName, "offline">; data: unknown } | null> {
  const result = await complete(req, env, fetchImpl, errors);
  if (!result) return null;
  const data = extractJson(result.text);
  return data === null ? null : { provider: result.provider, data };
}

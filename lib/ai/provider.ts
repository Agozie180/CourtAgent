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

export function availableProviders(env: Env = process.env): Exclude<ProviderName, "offline">[] {
  const setting = (env.AI_PROVIDER || "auto").toLowerCase();
  if (setting === "offline") return [];
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY?.trim());
  const hasOpenAI = Boolean(env.OPENAI_API_KEY?.trim());
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
        "x-api-key": env.ANTHROPIC_API_KEY as string,
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
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
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
): Promise<CompletionResult | null> {
  for (const provider of availableProviders(env)) {
    try {
      const text =
        provider === "anthropic" ? await callAnthropic(req, env, fetchImpl) : await callOpenAI(req, env, fetchImpl);
      return { provider, text };
    } catch {
      // Try the next provider. Never log request bodies: they can contain private documents.
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
): Promise<{ provider: Exclude<ProviderName, "offline">; data: unknown } | null> {
  const result = await complete(req, env, fetchImpl);
  if (!result) return null;
  const data = extractJson(result.text);
  return data === null ? null : { provider: result.provider, data };
}

import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Small in-memory rate limit so a public demo cannot burn through your AI API credit.
 * It is per server instance. For real production use a shared store (Redis, Upstash, etc.).
 */
export function rateLimited(request: Request, now: number = Date.now()): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "local";
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) buckets.clear();
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

export async function readJson(request: Request, maxBytes = 40_000): Promise<unknown | null> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
export const tooMany = () => NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

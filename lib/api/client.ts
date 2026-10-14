/** Small helper for calling CourtAgent's own API routes from the browser. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON error page */
  }
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || `Request failed (${response.status}). Try again in a moment.`);
  }
  return data as T;
}

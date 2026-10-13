import { NextResponse } from "next/server";
import { explainAgreement } from "@/lib/ai/tasks";
import { badRequest, rateLimited, readJson, tooMany } from "@/lib/api/guard";
import { buildAgreement, validateTerms, type TenancyTerms } from "@/lib/domain/agreement";

export async function POST(request: Request) {
  if (rateLimited(request)) return tooMany();
  const body = (await readJson(request)) as { terms?: Partial<TenancyTerms> } | null;
  const terms = body?.terms;
  if (!terms || typeof terms !== "object") return badRequest("Missing terms.");
  const issues = validateTerms(terms);
  if (issues.length > 0) return badRequest(issues[0].message);
  const full = terms as TenancyTerms;
  // The agreement text is rebuilt on the server from the validated terms, never taken from the client.
  const result = await explainAgreement(full, buildAgreement(full));
  return NextResponse.json(result);
}

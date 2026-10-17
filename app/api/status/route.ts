import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Which AI mode this server is really in. Keys are read here, on the server, and never sent to the browser. */
export function GET() {
  return NextResponse.json(aiStatus());
}

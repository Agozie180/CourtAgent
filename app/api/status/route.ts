import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ provider: activeProvider() });
}

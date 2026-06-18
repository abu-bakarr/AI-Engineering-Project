import { NextRequest, NextResponse } from "next/server";
import { Bot } from "@/lib/types";
import { createBot, getBots } from "@/lib/supabase-store";

export async function GET() {
  const bots = await getBots();
  return NextResponse.json({ bots });
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as Partial<Bot>;
  if (!payload.name || !payload.id) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const bot = await createBot(payload as Bot);
  return NextResponse.json({ bot });
}

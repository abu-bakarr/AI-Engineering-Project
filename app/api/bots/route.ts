import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database-error";
import { Bot } from "@/lib/types";
import { createBot, getBots } from "@/lib/supabase-store";

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export async function GET() {
  try {
    const bots = await getBots();
    return NextResponse.json({ bots });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<Bot>;
    const id = payload.id?.trim();
    const name = payload.name?.trim();

    if (!name || !id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const botToCreate: Bot = {
      id,
      name,
      description: payload.description?.trim() ?? "",
      accentColor: payload.accentColor ?? "#2563eb",
      logoDataUrl: payload.logoDataUrl,
      initials: payload.initials?.trim() || deriveInitials(name),
      createdAt: new Date().toISOString(),
      documents: [],
      status: "draft",
      totalQueries: 0,
    };

    const bot = await createBot(botToCreate);
    return NextResponse.json({ bot });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

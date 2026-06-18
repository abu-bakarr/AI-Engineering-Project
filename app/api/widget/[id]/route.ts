import { NextRequest, NextResponse } from "next/server";
import { getBotById } from "@/lib/supabase-store";

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bot = await getBotById(id);
  if (!bot) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders(req.headers.get("origin")) });
  }
  return NextResponse.json(
    {
      bot: {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        accentColor: bot.accentColor,
        logoDataUrl: bot.logoDataUrl ?? null,
      },
    },
    { headers: corsHeaders(req.headers.get("origin")) }
  );
}

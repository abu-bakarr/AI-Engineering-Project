import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { Bot } from "@/lib/types";
import { createBot, listBots, recordActivity } from "@/lib/supabase-store";

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "bots:read");
    const url = new URL(req.url);
    const result = await listBots(session, {
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      companyId: url.searchParams.get("companyId") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 24),
    });
    return NextResponse.json({ bots: result.items, pageInfo: result.pageInfo });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requirePermission(req, "bots:create");
    if (session.role !== "super_admin" && !session.companyId) {
      return NextResponse.json({ error: "Company context is required." }, { status: 403 });
    }

    const payload = (await req.json()) as Partial<Bot>;
    const id = payload.id?.trim();
    const name = payload.name?.trim();
    const companyId =
      session.role === "super_admin"
        ? payload.companyId?.trim()
        : session.companyId;

    if (!name || !id || !companyId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const botToCreate: Bot = {
      id,
      companyId,
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
    await recordActivity({
      companyId,
      actorId: session.userId,
      type: "bot.created",
      action: "bot.created",
      message: `${bot.name} bot was created.`,
      resourceType: "bot",
      resourceId: bot.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ bot });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

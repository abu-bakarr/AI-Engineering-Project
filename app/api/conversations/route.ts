import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { listConversations } from "@/lib/supabase-store";

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "conversations:read");
    const url = new URL(req.url);
    const result = await listConversations(session, {
      search: url.searchParams.get("search") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({
      conversations: result.items,
      pageInfo: result.pageInfo,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

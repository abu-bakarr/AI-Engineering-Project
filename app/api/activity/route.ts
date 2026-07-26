import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { listActivity } from "@/lib/supabase-store";

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "activity:read");
    const url = new URL(req.url);
    const result = await listActivity(session, {
      search: url.searchParams.get("search") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({
      activity: result.items,
      pageInfo: result.pageInfo,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

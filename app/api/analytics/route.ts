import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { getDashboardAnalytics } from "@/lib/supabase-store";

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "analytics:read");
    const analytics = await getDashboardAnalytics(session);
    return NextResponse.json({ analytics });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

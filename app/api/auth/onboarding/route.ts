import { NextRequest, NextResponse } from "next/server";
import {
  authErrorResponse,
  requireSession,
  setSessionCookie,
} from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { completeOnboarding } from "@/lib/supabase-store";

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    const user = await completeOnboarding(session);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return setSessionCookie(
      NextResponse.json({ ok: true }),
      {
        ...session,
        needsOnboarding: false,
      },
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

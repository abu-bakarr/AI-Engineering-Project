import { NextRequest, NextResponse } from "next/server";
import {
  authErrorResponse,
  requireSession,
  setSessionCookie,
} from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { completeTemporaryPasswordChange } from "@/lib/supabase-store";

export async function POST(req: NextRequest) {
  try {
    const session = requireSession(req);
    const payload = (await req.json().catch(() => ({}))) as {
      temporaryPassword?: string;
      newPassword?: string;
    };

    if (!payload.temporaryPassword || !payload.newPassword) {
      return NextResponse.json(
        { error: "Temporary password and new password are required." },
        { status: 400 },
      );
    }
    if (payload.newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const user = await completeTemporaryPasswordChange(session, {
      temporaryPassword: payload.temporaryPassword,
      newPassword: payload.newPassword,
    });
    if (!user) {
      return NextResponse.json(
        { error: "Temporary password is invalid or expired." },
        { status: 400 },
      );
    }

    const nextSession = {
      ...session,
      needsPasswordChange: false,
      needsOnboarding: true,
    };
    return setSessionCookie(
      NextResponse.json({ user, session: nextSession }),
      nextSession,
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database-error";
import { completePasswordReset } from "@/lib/supabase-store";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
      newPassword?: string;
    };
    if (!payload.email?.trim() || !payload.code?.trim() || !payload.newPassword) {
      return NextResponse.json(
        { error: "Email, confirmation code, and new password are required." },
        { status: 400 },
      );
    }
    if (payload.newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const ok = await completePasswordReset({
      email: payload.email,
      code: payload.code,
      newPassword: payload.newPassword,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "The confirmation code is invalid or expired." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

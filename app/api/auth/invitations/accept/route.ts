import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database-error";
import { acceptUserInvitation } from "@/lib/supabase-store";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => ({}))) as {
      token?: string;
      temporaryPassword?: string;
      newPassword?: string;
    };
    if (!payload.token || !payload.temporaryPassword || !payload.newPassword) {
      return NextResponse.json(
        { error: "Invitation link, temporary password, and new password are required." },
        { status: 400 },
      );
    }
    if (payload.newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const user = await acceptUserInvitation({
      token: payload.token,
      temporaryPassword: payload.temporaryPassword,
      newPassword: payload.newPassword,
    });
    if (!user) {
      return NextResponse.json(
        { error: "Invitation link or temporary password is invalid." },
        { status: 400 },
      );
    }
    return NextResponse.json({ user });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

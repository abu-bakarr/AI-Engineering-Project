import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database-error";
import { verifyPasswordResetCode } from "@/lib/supabase-store";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
    };
    if (!payload.email?.trim() || !payload.code?.trim()) {
      return NextResponse.json(
        { error: "Email and confirmation code are required." },
        { status: 400 },
      );
    }

    const valid = await verifyPasswordResetCode(payload.email, payload.code);
    if (!valid) {
      return NextResponse.json(
        { error: "The confirmation code is invalid or expired." },
        { status: 400 },
      );
    }
    return NextResponse.json({ valid: true });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

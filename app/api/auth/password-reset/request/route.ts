import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database-error";
import { sendPasswordResetEmail } from "@/lib/email";
import { startPasswordReset } from "@/lib/supabase-store";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => ({}))) as { email?: string };
    const email = payload.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const reset = await startPasswordReset(email);
    if (reset) {
      await sendPasswordResetEmail({
        to: reset.user.email,
        name: reset.user.name,
        code: reset.code,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "If the account exists, a reset code has been sent.",
    });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

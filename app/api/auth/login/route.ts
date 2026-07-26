import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email?.trim() || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const session = await authenticateUser(email, password);
  if (!session) {
    return NextResponse.json(
      { error: "Invalid credentials or disabled account." },
      { status: 401 },
    );
  }

  return setSessionCookie(NextResponse.json({ session }), session);
}

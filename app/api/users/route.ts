import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { createUser, listUsersPage, recordActivity } from "@/lib/supabase-store";
import { absoluteUrl, sendInvitationEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "users:read");
    const url = new URL(req.url);
    const result = await listUsersPage(session, {
      search: url.searchParams.get("search") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      companyId: url.searchParams.get("companyId") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({ users: result.items, pageInfo: result.pageInfo });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requirePermission(req, "users:create");
    const payload = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      role?: "company_admin" | "company_user";
      companyId?: string;
    };

    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role === "company_admin" ? "company_admin" : "company_user";
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 },
      );
    }

    const invitation = await createUser(session, {
      name,
      email,
      role,
      companyId: payload.companyId?.trim(),
    });
    const inviteUrl = absoluteUrl(`/invite?token=${invitation.invitationToken}`);
    await sendInvitationEmail({
      to: invitation.user.email,
      name: invitation.user.name,
      dummyPassword: invitation.temporaryPassword,
      inviteUrl,
    });
    await recordActivity({
      companyId: invitation.user.companyId,
      actorId: session.userId,
      type: "user.invited",
      action: "user.invited",
      message: `${invitation.user.name} was invited as ${invitation.user.role.replace("_", " ")}.`,
      resourceType: "user",
      resourceId: invitation.user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json(
      {
        user: invitation.user,
        credentials: {
          username: invitation.user.email,
          temporaryPassword: invitation.temporaryPassword,
          inviteUrl,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

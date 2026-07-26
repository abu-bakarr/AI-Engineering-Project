import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import {
  createUserInvitation,
  recordActivity,
  removeUser,
  updateUser,
} from "@/lib/supabase-store";
import { absoluteUrl, sendInvitationEmail } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(req, "users:update");
    const { id } = await params;
    const payload = (await req.json().catch(() => ({}))) as {
      name?: string;
      role?: "company_admin" | "company_user";
      status?: "active" | "disabled";
    };

    const user = await updateUser(session, id, {
      name: payload.name?.trim(),
      role: payload.role,
      status: payload.status,
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await recordActivity({
      companyId: user.companyId,
      actorId: session.userId,
      type: "user.updated",
      action: "user.updated",
      message: `${user.name} account was updated.`,
      resourceType: "user",
      resourceId: user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ user });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(req, "users:update");
    const { id } = await params;
    const payload = (await req.json().catch(() => ({}))) as {
      action?: string;
    };
    if (payload.action !== "resend_invitation") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const invitation = await createUserInvitation(session, id);
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
      type: "user.invitation_resent",
      action: "user.invitation_resent",
      message: `${invitation.user.name} was sent a new invitation.`,
      resourceType: "user",
      resourceId: invitation.user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({
      user: invitation.user,
      credentials: {
        username: invitation.user.email,
        temporaryPassword: invitation.temporaryPassword,
        inviteUrl,
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(req, "users:disable");
    const { id } = await params;
    const user = await removeUser(session, id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await recordActivity({
      companyId: user.companyId,
      actorId: session.userId,
      type: "user.removed",
      action: "user.removed",
      message: `${user.name} was removed.`,
      resourceType: "user",
      resourceId: user.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ user });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import {
  listChannelIntegrations,
  recordActivity,
  upsertChannelIntegration,
} from "@/lib/supabase-store";
import type { IntegrationChannel } from "@/lib/types";

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "settings:read");
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");
    const result = await listChannelIntegrations(session, companyId);
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requirePermission(req, "integrations:configure");
    const payload = (await req.json().catch(() => ({}))) as {
      companyId?: string;
      channel?: string;
      status?: string;
      displayName?: string;
      externalAccountId?: string;
      tokenExpiresAt?: string;
      appId?: string;
      appSecret?: string;
      verifyToken?: string;
      accessToken?: string;
    };

    if (payload.channel !== "whatsapp" && payload.channel !== "facebook") {
      return NextResponse.json(
        { error: "Choose WhatsApp or Facebook Messenger." },
        { status: 400 },
      );
    }

    const integration = await upsertChannelIntegration(session, {
      companyId: clean(payload.companyId),
      channel: payload.channel as IntegrationChannel,
      status: clean(payload.status),
      displayName: clean(payload.displayName),
      externalAccountId: clean(payload.externalAccountId),
      tokenExpiresAt: clean(payload.tokenExpiresAt) ?? null,
      credentials: {
        appId: clean(payload.appId),
        appSecret: clean(payload.appSecret),
        verifyToken: clean(payload.verifyToken),
        accessToken: clean(payload.accessToken),
      },
    });

    await recordActivity({
      companyId: integration.companyId,
      actorId: session.userId,
      type: "integration.connected",
      action: "integration.connected",
      message: `${integration.channel === "whatsapp" ? "WhatsApp" : "Facebook Messenger"} integration was updated.`,
      resourceType: "channel_integration",
      resourceId: integration.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
      metadata: {
        channel: integration.channel,
        status: integration.status,
        credentialFields: integration.credentialFields,
      },
    });

    return NextResponse.json({ integration });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "@/lib/database-error";
import { recordInboundChannelMessage } from "@/lib/supabase-store";

type MetaChannel = "whatsapp" | "facebook";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyMetaSignature(rawBody: string, signature: string | null, secret?: string) {
  if (!secret) {
    throw Object.assign(new Error("Webhook app secret is not configured."), {
      status: 503,
    });
  }
  if (!signature?.startsWith("sha256=")) {
    throw Object.assign(new Error("Invalid webhook signature."), { status: 401 });
  }
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  if (!safeEqual(expected, signature)) {
    throw Object.assign(new Error("Invalid webhook signature."), { status: 401 });
  }
}

export function verifyWebhook(req: NextRequest, verifyToken?: string) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === verifyToken
  ) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", {
      status: 200,
    });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

function parseWebhookMessage(channel: MetaChannel, payload: unknown) {
  const data = payload as {
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ profile?: { name?: string } }>;
          messages?: Array<{
            id?: string;
            from?: string;
            timestamp?: string;
            text?: { body?: string };
          }>;
        };
      }>;
      messaging?: Array<{
        sender?: { id?: string };
        timestamp?: number;
        message?: { mid?: string; text?: string };
      }>;
    }>;
  };

  const entry = data.entry?.[0];
  if (!entry) return null;

  if (channel === "whatsapp") {
    const value = entry.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!value?.metadata?.phone_number_id || !message?.id || !message.from) {
      return null;
    }
    return {
      externalAccountId: value.metadata.phone_number_id,
      externalMessageId: message.id,
      senderExternalId: message.from,
      senderName: value.contacts?.[0]?.profile?.name,
      text: message.text?.body ?? "",
      receivedAt: message.timestamp
        ? new Date(Number(message.timestamp) * 1000)
        : undefined,
    };
  }

  const event = entry.messaging?.[0];
  if (!entry.id || !event?.message?.mid || !event.sender?.id) return null;
  return {
    externalAccountId: entry.id,
    externalMessageId: event.message.mid,
    senderExternalId: event.sender.id,
    text: event.message.text ?? "",
    receivedAt: event.timestamp ? new Date(event.timestamp) : undefined,
  };
}

export async function handleMetaWebhook(req: NextRequest, channel: MetaChannel) {
  try {
    const rawBody = await req.text();
    const appSecret =
      channel === "whatsapp"
        ? process.env.WHATSAPP_APP_SECRET
        : process.env.FACEBOOK_APP_SECRET;
    verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);

    const parsed = parseWebhookMessage(channel, JSON.parse(rawBody));
    if (!parsed?.text.trim()) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await recordInboundChannelMessage({
      channel,
      ...parsed,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

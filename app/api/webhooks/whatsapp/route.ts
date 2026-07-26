import { NextRequest } from "next/server";
import { handleMetaWebhook, verifyWebhook } from "../meta";

export async function GET(req: NextRequest) {
  return verifyWebhook(req, process.env.WHATSAPP_VERIFY_TOKEN);
}

export async function POST(req: NextRequest) {
  return handleMetaWebhook(req, "whatsapp");
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "rag-chatbot-platform",
    timestamp: new Date().toISOString(),
    checks: {
      openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      chromaConfigured: Boolean(process.env.CHROMA_URL),
      supabaseConfigured: Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
    },
  });
}

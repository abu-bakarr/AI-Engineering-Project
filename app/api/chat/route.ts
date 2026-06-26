import { NextRequest, NextResponse } from "next/server";
import { getBotById, incrementBotQueries } from "@/lib/supabase-store";
import { ChatResponse } from "@/lib/types";

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const origin = req.headers.get("origin");
  const { botId, message } = (await req.json()) as {
    botId?: string;
    message?: string;
  };

  if (!botId || !message?.trim()) {
    return NextResponse.json(
      { error: "botId and message are required" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  const bot = await getBotById(botId);
  if (!bot) {
    return NextResponse.json(
      { error: "Bot not found" },
      { status: 404, headers: corsHeaders(origin) },
    );
  }

  if (bot.documents.length === 0) {
    return NextResponse.json(
      { error: "This bot has no uploaded documents. Upload documents first." },
      { status: 400, headers: corsHeaders(origin) },
    );
  }

  try {
    const { answerFromContext, retrieveContext } = await import("@/lib/rag");
    const { context, sources, citations } = await retrieveContext(
      botId,
      message,
    );
    if (!context.trim()) {
      return NextResponse.json(
        {
          reply:
            "I can only answer questions that are supported by the uploaded documents.",
          citations: [],
          latencyMs: Math.round(performance.now() - startedAt),
        } satisfies ChatResponse,
        { headers: corsHeaders(origin) },
      );
    }

    const reply = await answerFromContext({
      question: message,
      context,
      sources,
    });

    await incrementBotQueries(botId);

    return NextResponse.json(
      {
        reply,
        citations,
        latencyMs: Math.round(performance.now() - startedAt),
      } satisfies ChatResponse,
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "RAG processing failed", details },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

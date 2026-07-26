import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { getConversationById, setConversationControl } from "@/lib/supabase-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(req, "conversations:read");
    const { id } = await params;
    const conversation = await getConversationById(session, id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ conversation });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(req, "conversations:update");
    const { id } = await params;
    const payload = (await req.json().catch(() => ({}))) as {
      action?: "join" | "return_to_ai" | "resolve" | "close";
    };
    const action = payload.action ?? "join";
    if (!["join", "return_to_ai", "resolve", "close"].includes(action)) {
      return NextResponse.json({ error: "Invalid conversation action." }, { status: 400 });
    }

    if (action === "join") {
      requirePermission(req, "conversations:join");
    }

    const conversation = await setConversationControl(session, id, action);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ conversation });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

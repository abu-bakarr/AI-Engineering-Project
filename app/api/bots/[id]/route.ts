import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import { BotDocument } from "@/lib/types";
import {
  deleteBot,
  getBotById,
  removeDocumentObject,
  replaceBotDocuments,
  updateBot,
} from "@/lib/supabase-store";
import { removeBotKnowledgeByDocuments, removeDocumentChunks } from "@/lib/rag";

const DOCUMENT_PROCESSING_TTL_MS = Number(
  process.env.DOCUMENT_PROCESSING_TTL_MS ?? "120000",
);
const DOCUMENT_PLACEHOLDER_TTL_MS = Number(
  process.env.DOCUMENT_PLACEHOLDER_TTL_MS ?? "45000",
);

function isStaleProcessingDocument(document: BotDocument): boolean {
  if (document.status !== "processing") return false;
  const uploadedAtMs = Date.parse(document.uploadedAt);
  if (!Number.isFinite(uploadedAtMs)) return false;

  const ageMs = Date.now() - uploadedAtMs;
  const looksLikePlaceholder =
    !document.storedName && !document.content?.trim();
  if (looksLikePlaceholder) {
    return ageMs > DOCUMENT_PLACEHOLDER_TTL_MS;
  }
  return ageMs > DOCUMENT_PROCESSING_TTL_MS;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(_, "bots:read");
    const { id } = await params;
    const bot = await getBotById(id, session);
    if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const staleIds = new Set(
      bot.documents
        .filter((document) => isStaleProcessingDocument(document as BotDocument))
        .map((document) => document.id),
    );

    if (staleIds.size > 0) {
      const recoveredDocuments = bot.documents.map((document) =>
        staleIds.has(document.id)
          ? {
              ...document,
              status: "failed" as const,
              content: document.content ?? "",
            }
          : document,
      );

      await replaceBotDocuments(id, recoveredDocuments, session);
      bot.documents = recoveredDocuments;
    }

    return NextResponse.json({ bot });
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
    const session = requirePermission(req, "bots:update");
    const { id } = await params;
    const updates = await req.json();
    const currentBot = await getBotById(id, session);
    if (!currentBot)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (Array.isArray(updates.documents)) {
      const currentDocuments = currentBot.documents as BotDocument[];
      const existingIds = new Set(currentDocuments.map((d) => d.id));
      const nextIds = new Set(
        (updates.documents as BotDocument[]).map((d) => d.id),
      );
      const removedIds = Array.from(existingIds).filter(
        (docId) => !nextIds.has(docId),
      );
      await Promise.all(
        removedIds.map(async (docId) => {
          try {
            const doc = currentDocuments.find((item) => item.id === docId);
            if (doc?.storedName) {
              await removeDocumentObject(doc.storedName);
            }
            await removeDocumentChunks(id, docId);
          } catch {
            // Keep bot metadata updates resilient even if vector cleanup fails.
          }
        }),
      );
      await replaceBotDocuments(id, updates.documents as BotDocument[], session);
    }

    const { documents: _documents, ...botUpdates } = updates;
    const bot = await updateBot(id, botUpdates, session);
    return NextResponse.json({ bot });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requirePermission(_, "bots:delete");
    const { id } = await params;
    const botToDelete = await getBotById(id, session);
    if (!botToDelete) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let cleanupWarning: string | null = null;

    try {
      await removeBotKnowledgeByDocuments(id, botToDelete.documents ?? []);
    } catch (error) {
      cleanupWarning =
        error instanceof Error
          ? error.message
          : "Failed to fully clean bot artifacts.";
    }

    await deleteBot(id, session);

    return NextResponse.json({
      ok: true,
      deletedDocuments: botToDelete.documents?.length ?? 0,
      cleanupWarning,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { BotDocument } from "@/lib/types";
import {
  deleteBot,
  getBotById,
  removeDocumentObject,
  replaceBotDocuments,
  updateBot,
} from "@/lib/supabase-store";

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
  const { id } = await params;
  const bot = await getBotById(id);
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

    await replaceBotDocuments(id, recoveredDocuments);
    bot.documents = recoveredDocuments;
  }

  return NextResponse.json({ bot });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const updates = await req.json();
  const currentBot = await getBotById(id);
  if (!currentBot)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (Array.isArray(updates.documents)) {
    const { removeDocumentChunks } = await import("@/lib/rag");
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
    await replaceBotDocuments(id, updates.documents as BotDocument[]);
  }

  const { documents: _documents, ...botUpdates } = updates;
  const bot = await updateBot(id, botUpdates);
  return NextResponse.json({ bot });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const botToDelete = await getBotById(id);
  if (!botToDelete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { removeBotKnowledgeByDocuments } = await import("@/lib/rag");
    await removeBotKnowledgeByDocuments(id, botToDelete.documents ?? [], {
      strict: true,
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : "Failed to fully clean bot artifacts.";
    return NextResponse.json(
      {
        error:
          "Bot cleanup failed. No records were deleted so you can safely retry.",
        details,
      },
      { status: 500 },
    );
  }

  await deleteBot(id);

  return NextResponse.json({
    ok: true,
    deletedDocuments: botToDelete.documents?.length ?? 0,
    cleanupWarning: null,
  });
}

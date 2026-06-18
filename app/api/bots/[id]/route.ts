import { NextRequest, NextResponse } from "next/server";
import { BotDocument } from "@/lib/types";
import {
  deleteBot,
  getBotById,
  removeDocumentObjects,
  removeDocumentObject,
  replaceBotDocuments,
  updateBot,
} from "@/lib/supabase-store";
import { removeBotKnowledgeByDocuments, removeDocumentChunks } from "@/lib/rag";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bot = await getBotById(id);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  let cleanupWarning: string | null = null;
  const storagePaths = (botToDelete.documents ?? [])
    .map((document) => document.storedName)
    .filter((value): value is string => Boolean(value));

  try {
    if (storagePaths.length > 0) {
      await removeDocumentObjects(storagePaths);
    }
    await removeBotKnowledgeByDocuments(id, botToDelete.documents ?? []);
  } catch (error) {
    cleanupWarning =
      error instanceof Error
        ? error.message
        : "Failed to fully clean bot artifacts.";
  }

  await deleteBot(id);

  return NextResponse.json({
    ok: true,
    deletedDocuments: botToDelete.documents?.length ?? 0,
    cleanupWarning,
  });
}

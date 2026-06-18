import { NextRequest, NextResponse } from "next/server";
import { BotDocument } from "@/lib/types";
import {
  appendBotDocuments,
  documentStoragePath,
  getBotById,
  replaceBotDocuments,
  uploadDocumentObject,
} from "@/lib/supabase-store";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
type RagModule = typeof import("@/lib/rag");

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function encodeStreamEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

async function processUploadedDocument(params: {
  botId: string;
  docId: string;
  file: File;
  bytes: Buffer;
  hash: string;
  rag: Pick<
    RagModule,
    "extractDocumentText" | "indexDocumentChunks" | "sanitizeFileName"
  >;
}): Promise<BotDocument> {
  const { botId, docId, file, bytes, hash, rag } = params;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const storedName = documentStoragePath({
    botId,
    docId,
    fileName: rag.sanitizeFileName(file.name),
  });

  let content = "";
  let status: BotDocument["status"] = "ready";
  let uploadedStoredName: string | undefined;

  try {
    await uploadDocumentObject({
      path: storedName,
      bytes,
      contentType: file.type || "application/octet-stream",
    });
    uploadedStoredName = storedName;
  } catch (error) {
    status = "failed";
    const details =
      error instanceof Error ? error.message : "Unknown storage error";
    console.warn(`Document upload failed for ${file.name}: ${details}`);
  }

  if (status !== "failed") {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsti-upload-"));
    const tempPath = path.join(tempDir, rag.sanitizeFileName(file.name));

    try {
      fs.writeFileSync(tempPath, bytes);
      content = await rag.extractDocumentText({
        buffer: bytes,
        filePath: tempPath,
        fileName: file.name,
        extension: ext,
      });
      if (!content.trim()) {
        status = "failed";
      }
    } catch (error) {
      status = "failed";
      const details =
        error instanceof Error ? error.message : "Unknown extraction error";
      console.warn(`Document extraction failed for ${file.name}: ${details}`);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  const document: BotDocument = {
    id: docId,
    name: file.name,
    size: file.size,
    type: ext,
    uploadedAt: new Date().toISOString(),
    status,
    hash,
    storedName: uploadedStoredName,
    content,
    source: "upload",
  };

  if (document.status === "ready" && content.trim()) {
    try {
      await rag.indexDocumentChunks({
        botId,
        docId: document.id,
        fileName: document.name,
        text: content,
      });
    } catch (error) {
      status = "failed";
      const details =
        error instanceof Error ? error.message : "Unknown indexing error";
      console.warn(`Cloud indexing failed for ${document.name}: ${details}`);
      throw new Error(`Cloud indexing failed for ${document.name}: ${details}`);
    }
  }

  return document;
}

export async function POST(req: NextRequest) {
  try {
    const rag = await import("@/lib/rag");
    const { ALLOWED_EXTENSIONS, hashBuffer, indexDocumentChunks } = rag;

    const form = await req.formData();
    const botId = String(form.get("botId") ?? "").trim();
    const richText = String(form.get("richText") ?? "").trim();
    const incoming = form
      .getAll("files")
      .filter((f): f is File => f instanceof File);
    if (incoming.length === 0 && !richText) {
      return NextResponse.json(
        { error: "Upload a supported file or add rich text." },
        { status: 400 },
      );
    }
    if (!botId) {
      return NextResponse.json({ error: "botId is required" }, { status: 400 });
    }
    if (richText && countWords(richText) > 500) {
      return NextResponse.json(
        { error: "Rich text content cannot exceed 500 words." },
        { status: 400 },
      );
    }
    const oversized = incoming.filter(
      (file) => file.size > MAX_FILE_SIZE_BYTES,
    );
    if (oversized.length > 0) {
      return NextResponse.json(
        {
          error: `Each file must be 10 MB or smaller. Remove: ${oversized
            .map((file) => file.name)
            .join(", ")}`,
        },
        { status: 400 },
      );
    }

    const bot = await getBotById(botId);
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const knownHashes = new Set(
      bot.documents.map((d) => d.hash).filter(Boolean),
    );
    const seenInRequest = new Set<string>();
    const documents: BotDocument[] = [];
    const skipped: string[] = [];
    const wantsProgressStream =
      req.headers.get("x-upload-progress") === "stream";

    if (richText) {
      const hash = hashBuffer(Buffer.from(richText, "utf8"));
      if (knownHashes.has(hash) || seenInRequest.has(hash)) {
        skipped.push("Rich text content");
      } else {
        seenInRequest.add(hash);
        const doc: BotDocument = {
          id: crypto.randomUUID(),
          name: "Typed knowledge base",
          size: Buffer.byteLength(richText, "utf8"),
          type: "text",
          uploadedAt: new Date().toISOString(),
          status: "ready",
          hash,
          content: richText,
          source: "rich-text",
        };
        documents.push(doc);

        try {
          await indexDocumentChunks({
            botId,
            docId: doc.id,
            fileName: doc.name,
            text: doc.content ?? "",
          });
        } catch (error) {
          const details =
            error instanceof Error ? error.message : "Unknown indexing error";
          throw new Error(`Cloud indexing failed for rich text: ${details}`);
        }
      }
    }

    const uploadJobs: Array<{ file: File; bytes: Buffer; hash: string }> = [];

    for (const file of incoming) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name}` },
          { status: 400 },
        );
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const hash = hashBuffer(bytes);
      if (knownHashes.has(hash) || seenInRequest.has(hash)) {
        skipped.push(file.name);
        continue;
      }
      seenInRequest.add(hash);
      uploadJobs.push({ file, bytes, hash });
    }

    if (wantsProgressStream && uploadJobs.length > 0) {
      const processingDocs: BotDocument[] = uploadJobs.map(
        ({ file, hash }) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.name.split(".").pop()?.toLowerCase() ?? "",
          uploadedAt: new Date().toISOString(),
          status: "processing",
          hash,
          source: "upload",
        }),
      );

      const existingDocuments = [...bot.documents, ...documents];
      const persistedDocuments = [...existingDocuments, ...processingDocs];
      await appendBotDocuments(botId, processingDocs);

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const nextDocuments = [...persistedDocuments];
          const failureReasons: Record<string, string> = {};
          try {
            controller.enqueue(
              encodeStreamEvent({
                type: "processing",
                completed: 0,
                total: uploadJobs.length,
              }),
            );

            for (let index = 0; index < uploadJobs.length; index += 1) {
              const job = uploadJobs[index];
              const placeholder = processingDocs[index];
              let completedDoc: BotDocument;

              try {
                completedDoc = await processUploadedDocument({
                  botId,
                  docId: placeholder.id,
                  file: job.file,
                  bytes: job.bytes,
                  hash: job.hash,
                  rag,
                });
              } catch (error) {
                const details =
                  error instanceof Error
                    ? error.message
                    : "Unknown processing error";
                console.warn(
                  `Document processing failed for ${job.file.name}: ${details}`,
                );
                failureReasons[job.file.name] = details;
                completedDoc = {
                  ...placeholder,
                  status: "failed",
                  content: "",
                };
              }

              nextDocuments[index + existingDocuments.length] = {
                ...completedDoc,
                id: placeholder.id,
              };

              await replaceBotDocuments(botId, nextDocuments);

              controller.enqueue(
                encodeStreamEvent({
                  type: "processing",
                  completed: index + 1,
                  total: uploadJobs.length,
                  fileName: completedDoc.name,
                }),
              );
            }

            const finalDocuments = nextDocuments.slice(
              existingDocuments.length,
            );

            const readyDocuments = finalDocuments.filter(
              (document) => document.status === "ready",
            );
            if (readyDocuments.length === 0) {
              const failedNames = finalDocuments
                .filter((document) => document.status === "failed")
                .map((document) => document.name)
                .join(", ");
              const failedDetails = Object.entries(failureReasons)
                .map(([name, reason]) => `${name}: ${reason}`)
                .join(" | ");

              controller.enqueue(
                encodeStreamEvent({
                  type: "error",
                  error: failedDetails
                    ? `Cloud indexing failed for: ${failedDetails}`
                    : failedNames
                      ? `Cloud indexing failed for: ${failedNames}`
                      : "Cloud indexing failed. No document was indexed.",
                }),
              );
              controller.close();
              return;
            }

            controller.enqueue(
              encodeStreamEvent({
                type: "complete",
                documents: [...documents, ...finalDocuments],
                skipped,
              }),
            );
            controller.close();
          } catch (error) {
            const details =
              error instanceof Error ? error.message : "Unknown upload error";
            controller.enqueue(
              encodeStreamEvent({ type: "error", error: details }),
            );
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    for (const job of uploadJobs) {
      const document = await processUploadedDocument({
        botId,
        docId: crypto.randomUUID(),
        file: job.file,
        bytes: job.bytes,
        hash: job.hash,
        rag,
      });
      documents.push(document);
    }

    if (
      uploadJobs.length > 0 &&
      documents.every((document) => document.status !== "ready")
    ) {
      return NextResponse.json(
        { error: "Cloud indexing failed. No document was indexed." },
        { status: 500 },
      );
    }

    if (documents.length > 0) {
      await appendBotDocuments(botId, documents);
    }

    return NextResponse.json({ documents, skipped });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown upload error";
    console.error(`Upload failed: ${details}`);
    return NextResponse.json({ error: details }, { status: 500 });
  }
}

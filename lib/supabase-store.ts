import prisma from "@/lib/prisma";
import type {
  Bot as PrismaBot,
  BotDocument as PrismaBotDocument,
} from "@/lib/generated/prisma/client";
import { Bot, BotDocument } from "./types";

const DEFAULT_STORAGE_BUCKET = "bot-documents";

let storageBucketReady = false;

function normalizeSupabaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL must be a valid Supabase project URL.");
  }

  if (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") {
    const projectRef = parsed.hostname
      .replace(/^db\./, "")
      .replace(/\.supabase\.co$/, "");
    if (!projectRef || projectRef === parsed.hostname) {
      throw new Error(
        "SUPABASE_URL is a database connection string. Set it to your project URL, for example https://your-project-ref.supabase.co.",
      );
    }
    return `https://${projectRef}.supabase.co`;
  }

  if (parsed.username || parsed.password) {
    parsed.username = "";
    parsed.password = "";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      "SUPABASE_URL must use https://, for example https://your-project-ref.supabase.co.",
    );
  }

  return parsed.toString().replace(/\/+$/, "");
}

function supabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.",
    );
  }

  const url = normalizeSupabaseUrl(rawUrl);
  return { url, serviceRoleKey };
}

function storageBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET;
}

function encodeStoragePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function supabaseStorageRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, serviceRoleKey } = supabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase Storage request failed (${response.status} ${response.statusText}): ${details}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function ensureDocumentStorageBucket(): Promise<void> {
  if (storageBucketReady) return;

  const bucket = storageBucketName();
  try {
    await supabaseStorageRequest(`bucket/${encodeURIComponent(bucket)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("404")) throw error;

    await supabaseStorageRequest("bucket", {
      method: "POST",
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: false,
      }),
    });
  }

  storageBucketReady = true;
}

export function documentStoragePath(params: {
  botId: string;
  docId: string;
  fileName: string;
}): string {
  const extension = params.fileName.split(".").pop()?.toLowerCase();
  const safeExtension = extension
    ? `.${extension.replace(/[^a-z0-9]/g, "")}`
    : "";
  return `${params.botId}/${params.docId}${safeExtension}`;
}

export async function uploadDocumentObject(params: {
  path: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<void> {
  await ensureDocumentStorageBucket();
  const body = params.bytes.buffer.slice(
    params.bytes.byteOffset,
    params.bytes.byteOffset + params.bytes.byteLength,
  ) as ArrayBuffer;

  await supabaseStorageRequest(
    `object/${encodeURIComponent(storageBucketName())}/${encodeStoragePath(params.path)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": params.contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body,
    },
  );
}

export async function removeDocumentObject(path: string): Promise<void> {
  if (!path) return;
  await ensureDocumentStorageBucket();

  await supabaseStorageRequest(
    `object/${encodeURIComponent(storageBucketName())}`,
    {
      method: "DELETE",
      body: JSON.stringify({ prefixes: [path] }),
    },
  );
}

export async function removeDocumentObjects(paths: string[]): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;
  await ensureDocumentStorageBucket();

  await supabaseStorageRequest(
    `object/${encodeURIComponent(storageBucketName())}`,
    {
      method: "DELETE",
      body: JSON.stringify({ prefixes: uniquePaths }),
    },
  );
}

function botFromRecord(row: PrismaBot, documents: BotDocument[] = []): Bot {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    accentColor: row.accentColor,
    logoDataUrl: row.logoDataUrl ?? undefined,
    initials: row.initials,
    createdAt: row.createdAt.toISOString(),
    status: row.status === "active" ? "active" : "draft",
    totalQueries: row.totalQueries ?? 0,
    documents,
  };
}

function documentFromRecord(row: PrismaBotDocument): BotDocument {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    uploadedAt: row.uploadedAt.toISOString(),
    status:
      row.status === "processing" || row.status === "failed"
        ? row.status
        : "ready",
    hash: row.hash ?? undefined,
    storedName: row.storedName ?? undefined,
    content: row.content ?? undefined,
    source:
      row.source === "upload" || row.source === "rich-text"
        ? row.source
        : undefined,
  };
}

function botCreateData(bot: Bot) {
  return {
    id: bot.id,
    name: bot.name,
    description: bot.description || null,
    accentColor: bot.accentColor,
    logoDataUrl: bot.logoDataUrl ?? null,
    initials: bot.initials,
    createdAt: bot.createdAt,
    status: bot.status,
    totalQueries: bot.totalQueries ?? 0,
  };
}

function documentCreateData(botId: string, document: BotDocument) {
  return {
    id: document.id,
    botId,
    name: document.name,
    size: document.size,
    type: document.type,
    uploadedAt: document.uploadedAt,
    status: document.status,
    hash: document.hash ?? null,
    storedName: document.storedName ?? null,
    content: document.content ?? null,
    source: document.source ?? null,
  };
}

function botUpdateData(updates: Partial<Bot>) {
  const row: Partial<ReturnType<typeof botCreateData>> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) {
    row.description = updates.description || null;
  }
  if (updates.accentColor !== undefined) row.accentColor = updates.accentColor;
  if (updates.logoDataUrl !== undefined) {
    row.logoDataUrl = updates.logoDataUrl ?? null;
  }
  if (updates.initials !== undefined) row.initials = updates.initials;
  if (updates.createdAt !== undefined) row.createdAt = updates.createdAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.totalQueries !== undefined) row.totalQueries = updates.totalQueries;
  return row;
}

async function listDocumentRecords(botId: string): Promise<PrismaBotDocument[]> {
  return prisma.botDocument.findMany({
    where: { botId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getBots(): Promise<Bot[]> {
  const bots = await prisma.bot.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  return bots.map((bot) =>
    botFromRecord(bot, bot.documents.map(documentFromRecord)),
  );
}

export async function getBotById(id: string): Promise<Bot | null> {
  const bot = await prisma.bot.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!bot) return null;

  return botFromRecord(bot, bot.documents.map(documentFromRecord));
}

export async function createBot(bot: Bot): Promise<Bot> {
  const created = await prisma.bot.create({
    data: {
      ...botCreateData(bot),
      documents: {
        create: bot.documents.map((document) => ({
          id: document.id,
          name: document.name,
          size: document.size,
          type: document.type,
          uploadedAt: document.uploadedAt,
          status: document.status,
          hash: document.hash ?? null,
          storedName: document.storedName ?? null,
          content: document.content ?? null,
          source: document.source ?? null,
        })),
      },
    },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  return botFromRecord(created, created.documents.map(documentFromRecord));
}

export async function appendBotDocuments(
  botId: string,
  documents: BotDocument[],
): Promise<void> {
  if (documents.length === 0) return;

  await prisma.$transaction(
    documents.map((document) =>
      prisma.botDocument.upsert({
        where: { id: document.id },
        create: documentCreateData(botId, document),
        update: documentCreateData(botId, document),
      }),
    ),
  );
}

export async function replaceBotDocuments(
  botId: string,
  documents: BotDocument[],
): Promise<BotDocument[]> {
  const existing = (await listDocumentRecords(botId)).map(documentFromRecord);
  const nextIds = new Set(documents.map((document) => document.id));
  const removed = existing.filter((document) => !nextIds.has(document.id));

  if (removed.length > 0) {
    await prisma.botDocument.deleteMany({
      where: {
        botId,
        id: { in: removed.map((document) => document.id) },
      },
    });
  }

  if (documents.length > 0) {
    await appendBotDocuments(botId, documents);
  }

  return removed;
}

export async function updateBot(
  id: string,
  updates: Partial<Bot>,
): Promise<Bot | null> {
  const rowUpdates = botUpdateData(updates);

  if (Object.keys(rowUpdates).length > 0) {
    await prisma.bot.updateMany({
      where: { id },
      data: rowUpdates,
    });
  }

  if (Array.isArray(updates.documents)) {
    await replaceBotDocuments(id, updates.documents);
  }

  return getBotById(id);
}

export async function deleteBot(id: string): Promise<void> {
  await prisma.bot.deleteMany({
    where: { id },
  });
}

export async function incrementBotQueries(id: string): Promise<void> {
  await prisma.bot.updateMany({
    where: { id },
    data: {
      totalQueries: {
        increment: 1,
      },
    },
  });
}

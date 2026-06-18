import { Bot, BotDocument } from "./types";

type BotRow = {
  id: string;
  name: string;
  description: string | null;
  accent_color: string;
  logo_data_url: string | null;
  initials: string;
  created_at: string;
  status: "active" | "draft";
  total_queries: number;
};

type BotDocumentRow = {
  id: string;
  bot_id: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
  status: "processing" | "ready" | "failed";
  hash: string | null;
  stored_name: string | null;
  content: string | null;
  source: "upload" | "rich-text" | null;
};

const BOT_COLUMNS =
  "id,name,description,accent_color,logo_data_url,initials,created_at,status,total_queries";
const DOCUMENT_COLUMNS =
  "id,bot_id,name,size,type,uploaded_at,status,hash,stored_name,content,source";
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
    const projectRef = parsed.hostname.replace(/^db\./, "").replace(/\.supabase\.co$/, "");
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
    throw new Error("SUPABASE_URL must use https://, for example https://your-project-ref.supabase.co.");
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

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, serviceRoleKey } = supabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase request failed (${response.status} ${response.statusText}): ${details}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Supabase returned an invalid JSON response.");
  }
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
  const safeExtension = extension ? `.${extension.replace(/[^a-z0-9]/g, "")}` : "";
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

  await supabaseStorageRequest(`object/${encodeURIComponent(storageBucketName())}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [path] }),
  });
}

export async function removeDocumentObjects(paths: string[]): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;
  await ensureDocumentStorageBucket();

  await supabaseStorageRequest(`object/${encodeURIComponent(storageBucketName())}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: uniquePaths }),
  });
}

function botFromRow(row: BotRow, documents: BotDocument[] = []): Bot {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    accentColor: row.accent_color,
    logoDataUrl: row.logo_data_url ?? undefined,
    initials: row.initials,
    createdAt: row.created_at,
    status: row.status,
    totalQueries: row.total_queries ?? 0,
    documents,
  };
}

function documentFromRow(row: BotDocumentRow): BotDocument {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    uploadedAt: row.uploaded_at,
    status: row.status,
    hash: row.hash ?? undefined,
    storedName: row.stored_name ?? undefined,
    content: row.content ?? undefined,
    source: row.source ?? undefined,
  };
}

function botToRow(bot: Bot): BotRow {
  return {
    id: bot.id,
    name: bot.name,
    description: bot.description || null,
    accent_color: bot.accentColor,
    logo_data_url: bot.logoDataUrl ?? null,
    initials: bot.initials,
    created_at: bot.createdAt,
    status: bot.status,
    total_queries: bot.totalQueries ?? 0,
  };
}

function documentToRow(botId: string, document: BotDocument): BotDocumentRow {
  return {
    id: document.id,
    bot_id: botId,
    name: document.name,
    size: document.size,
    type: document.type,
    uploaded_at: document.uploadedAt,
    status: document.status,
    hash: document.hash ?? null,
    stored_name: document.storedName ?? null,
    content: document.content ?? null,
    source: document.source ?? null,
  };
}

function botUpdatesToRow(updates: Partial<Bot>): Partial<BotRow> {
  const row: Partial<BotRow> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description || null;
  if (updates.accentColor !== undefined) row.accent_color = updates.accentColor;
  if (updates.logoDataUrl !== undefined) row.logo_data_url = updates.logoDataUrl ?? null;
  if (updates.initials !== undefined) row.initials = updates.initials;
  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.totalQueries !== undefined) row.total_queries = updates.totalQueries;
  return row;
}

async function listDocumentRows(botId: string): Promise<BotDocumentRow[]> {
  return supabaseRequest<BotDocumentRow[]>(
    `bot_documents?select=${DOCUMENT_COLUMNS}&bot_id=eq.${encodeURIComponent(botId)}&order=uploaded_at.desc`,
  );
}

export async function getBots(): Promise<Bot[]> {
  const [botRows, documentRows] = await Promise.all([
    supabaseRequest<BotRow[]>(`bots?select=${BOT_COLUMNS}&order=created_at.desc`),
    supabaseRequest<BotDocumentRow[]>(`bot_documents?select=${DOCUMENT_COLUMNS}&order=uploaded_at.desc`),
  ]);

  const documentsByBot = new Map<string, BotDocument[]>();
  for (const row of documentRows) {
    const documents = documentsByBot.get(row.bot_id) ?? [];
    documents.push(documentFromRow(row));
    documentsByBot.set(row.bot_id, documents);
  }

  return botRows.map((row) => botFromRow(row, documentsByBot.get(row.id) ?? []));
}

export async function getBotById(id: string): Promise<Bot | null> {
  const rows = await supabaseRequest<BotRow[]>(
    `bots?select=${BOT_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;

  const documents = (await listDocumentRows(id)).map(documentFromRow);
  return botFromRow(row, documents);
}

export async function createBot(bot: Bot): Promise<Bot> {
  const rows = await supabaseRequest<BotRow[]>("bots", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(botToRow(bot)),
  });

  if (bot.documents.length > 0) {
    await appendBotDocuments(bot.id, bot.documents);
  }

  return botFromRow(rows[0] ?? botToRow(bot), bot.documents);
}

export async function appendBotDocuments(
  botId: string,
  documents: BotDocument[],
): Promise<void> {
  if (documents.length === 0) return;

  await supabaseRequest("bot_documents?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(documents.map((document) => documentToRow(botId, document))),
  });
}

export async function replaceBotDocuments(
  botId: string,
  documents: BotDocument[],
): Promise<BotDocument[]> {
  const existing = (await listDocumentRows(botId)).map(documentFromRow);
  const nextIds = new Set(documents.map((document) => document.id));
  const removed = existing.filter((document) => !nextIds.has(document.id));

  await Promise.all(
    removed.map((document) =>
      supabaseRequest(
        `bot_documents?id=eq.${encodeURIComponent(document.id)}&bot_id=eq.${encodeURIComponent(botId)}`,
        { method: "DELETE" },
      ),
    ),
  );

  if (documents.length > 0) {
    await appendBotDocuments(botId, documents);
  }

  return removed;
}

export async function updateBot(
  id: string,
  updates: Partial<Bot>,
): Promise<Bot | null> {
  const rowUpdates = botUpdatesToRow(updates);

  if (Object.keys(rowUpdates).length > 0) {
    await supabaseRequest(
      `bots?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(rowUpdates),
      },
    );
  }

  if (Array.isArray(updates.documents)) {
    await replaceBotDocuments(id, updates.documents);
  }

  return getBotById(id);
}

export async function deleteBot(id: string): Promise<void> {
  await supabaseRequest(`bots?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function incrementBotQueries(id: string): Promise<void> {
  const bot = await getBotById(id);
  if (!bot) return;

  await supabaseRequest(`bots?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ total_queries: (bot.totalQueries ?? 0) + 1 }),
  });
}

import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import type {
  Bot as PrismaBot,
  BotDocument as PrismaBotDocument,
  Prisma,
} from "@/lib/generated/prisma/client";
import type { AuthSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac";
import { canJoinLiveChat, canUseChannel, requirePlanFeature } from "@/lib/plans";
import {
  ActivityLog,
  AppUser,
  Bot,
  BotDocument,
  ChannelIntegration,
  Company,
  Conversation,
  DashboardAnalytics,
  IntegrationChannel,
  SupportMessage,
} from "./types";

export type TenantScope = Pick<AuthSession, "role" | "companyId">;

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

type BotWithCompany = PrismaBot & {
  company?: { name: string } | null;
  _count?: { conversations: number };
};

export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
  pageInfo: PageInfo;
};

function tenantWhere(scope?: TenantScope) {
  if (!scope || isSuperAdmin(scope.role)) return {};
  return { companyId: scope.companyId ?? "__missing_company__" };
}

function companyWhere(scope: TenantScope, companyId?: string) {
  if (isSuperAdmin(scope.role)) {
    return companyId ? { id: companyId } : {};
  }
  return { id: scope.companyId ?? "__missing_company__" };
}

function normalizePlan(plan?: string | null) {
  return plan === "growth" || plan === "enterprise" ? plan : "starter";
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function generateTemporaryPassword(): string {
  return `Temp-${crypto.randomBytes(5).toString("base64url")}9!`;
}

export function generateResetCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function planAllowsMessaging(plan?: string | null) {
  return normalizePlan(plan) !== "starter";
}

function normalizePagination(input?: PaginationInput) {
  const page = Math.max(1, Number(input?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(input?.pageSize ?? 24) || 24));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function paginated<T>(
  items: T[],
  total: number,
  input?: PaginationInput,
): PaginatedResult<T> {
  const { page, pageSize } = normalizePagination(input);
  return {
    items,
    pageInfo: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

function botFromRecord(row: BotWithCompany, documents: BotDocument[] = []): Bot {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company?.name ?? undefined,
    name: row.name,
    description: row.description ?? "",
    accentColor: row.accentColor,
    logoDataUrl: row.logoDataUrl ?? undefined,
    initials: row.initials,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
    status: row.status === "active" ? "active" : "draft",
    totalQueries: row.totalQueries ?? 0,
    conversationCount: row._count?.conversations ?? 0,
    lastActivityAt: row.updatedAt?.toISOString() ?? row.createdAt.toISOString(),
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
    companyId: bot.companyId,
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

function documentCreateData(
  botId: string,
  companyId: string,
  document: BotDocument,
) {
  return {
    id: document.id,
    companyId,
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

async function listDocumentRecords(
  botId: string,
  scope?: TenantScope,
): Promise<PrismaBotDocument[]> {
  return prisma.botDocument.findMany({
    where: { botId, ...tenantWhere(scope) },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getBots(
  scope?: TenantScope,
  filters: PaginationInput & {
    search?: string;
    status?: string;
    companyId?: string;
  } = {},
): Promise<Bot[]> {
  const result = await listBots(scope, filters);
  return result.items;
}

export async function listBots(
  scope?: TenantScope,
  filters: PaginationInput & {
    search?: string;
    status?: string;
    companyId?: string;
  } = {},
): Promise<PaginatedResult<Bot>> {
  const { skip, pageSize } = normalizePagination(filters);
  const search = filters.search?.trim();
  const status = filters.status?.trim();
  const requestedCompanyId = filters.companyId?.trim();
  const where = {
    ...tenantWhere(scope),
    ...(isSuperAdmin(scope?.role ?? "company_user") && requestedCompanyId
      ? { companyId: requestedCompanyId }
      : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, bots] = await Promise.all([
    prisma.bot.count({ where }),
    prisma.bot.findMany({
      where,
      skip,
      take: pageSize,
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: { name: true },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
      _count: {
        select: { conversations: true },
      },
    },
    }),
  ]);

  return paginated(
    bots.map((bot) =>
      botFromRecord(bot, bot.documents.map(documentFromRecord)),
    ),
    total,
    filters,
  );
}

export async function getBotById(
  id: string,
  scope?: TenantScope,
): Promise<Bot | null> {
  const bot = await prisma.bot.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      company: {
        select: { name: true },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
      _count: {
        select: { conversations: true },
      },
    },
  });

  if (!bot) return null;

  return botFromRecord(bot, bot.documents.map(documentFromRecord));
}

export async function getPublicBotById(id: string): Promise<Bot | null> {
  const bot = await prisma.bot.findFirst({
    where: { id, status: "active" },
    include: {
      company: {
        select: { name: true },
      },
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
          companyId: bot.companyId,
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
      company: {
        select: { name: true },
      },
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
  scope?: TenantScope,
): Promise<void> {
  if (documents.length === 0) return;
  const bot = await getBotById(botId, scope);
  if (!bot) throw new Error("Bot not found");

  await prisma.$transaction(
    documents.map((document) =>
      prisma.botDocument.upsert({
        where: { id: document.id },
        create: documentCreateData(botId, bot.companyId, document),
        update: documentCreateData(botId, bot.companyId, document),
      }),
    ),
  );
}

export async function replaceBotDocuments(
  botId: string,
  documents: BotDocument[],
  scope?: TenantScope,
): Promise<BotDocument[]> {
  const bot = await getBotById(botId, scope);
  if (!bot) throw new Error("Bot not found");
  const existing = (await listDocumentRecords(botId, scope)).map(documentFromRecord);
  const nextIds = new Set(documents.map((document) => document.id));
  const removed = existing.filter((document) => !nextIds.has(document.id));

  if (removed.length > 0) {
    await prisma.botDocument.deleteMany({
      where: {
        botId,
        ...tenantWhere(scope),
        id: { in: removed.map((document) => document.id) },
      },
    });
  }

  if (documents.length > 0) {
    await appendBotDocuments(botId, documents, scope);
  }

  return removed;
}

export async function updateBot(
  id: string,
  updates: Partial<Bot>,
  scope?: TenantScope,
): Promise<Bot | null> {
  const rowUpdates = botUpdateData(updates);

  if (Object.keys(rowUpdates).length > 0) {
    await prisma.bot.updateMany({
      where: { id, ...tenantWhere(scope) },
      data: rowUpdates,
    });
  }

  if (Array.isArray(updates.documents)) {
    await replaceBotDocuments(id, updates.documents, scope);
  }

  return getBotById(id, scope);
}

export async function deleteBot(id: string, scope?: TenantScope): Promise<void> {
  await prisma.bot.deleteMany({
    where: { id, ...tenantWhere(scope) },
  });
}

export async function incrementBotQueries(
  id: string,
  scope?: TenantScope,
): Promise<void> {
  await prisma.bot.updateMany({
    where: { id, ...tenantWhere(scope) },
    data: {
      totalQueries: {
        increment: 1,
      },
    },
  });
}

function companyFromRecord(row: {
  id: string;
  name: string;
  logoUrl?: string | null;
  website: string | null;
  industry?: string | null;
  description?: string | null;
  supportEmail: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  timezone: string;
  defaultLanguage?: string | null;
  status: string;
  subscriptionStatus: string;
  plan: string;
  billingCycle: string | null;
  whatsappEnabled: boolean;
  facebookEnabled: boolean;
  liveChatEnabled: boolean;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userCount?: number;
  botCount?: number;
  conversationCount?: number;
  integrationStatus?: string;
  primaryAdmin?: string;
}): Company {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl ?? undefined,
    website: row.website ?? undefined,
    industry: row.industry ?? undefined,
    description: row.description ?? undefined,
    supportEmail: row.supportEmail ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    country: row.country ?? undefined,
    timezone: row.timezone || "UTC",
    defaultLanguage: row.defaultLanguage ?? "en",
    status: row.status === "inactive" ? "inactive" : "active",
    subscriptionStatus: row.subscriptionStatus,
    plan: row.plan,
    billingCycle: row.billingCycle ?? undefined,
    whatsappEnabled: row.whatsappEnabled,
    facebookEnabled: row.facebookEnabled,
    liveChatEnabled: row.liveChatEnabled,
    trialEndsAt: row.trialEndsAt?.toISOString(),
    subscriptionEndsAt: row.subscriptionEndsAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userCount: row.userCount,
    botCount: row.botCount,
    conversationCount: row.conversationCount,
    integrationStatus: row.integrationStatus ?? "Not configured",
    primaryAdmin: row.primaryAdmin,
  };
}

function userFromRecord(row: {
  id: string;
  companyId: string | null;
  company?: { name: string } | null;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  invitedAt?: Date | null;
  invitationExpiresAt?: Date | null;
  firstLoginCompletedAt?: Date | null;
  onboardingCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AppUser {
  return {
    id: row.id,
    companyId: row.companyId ?? undefined,
    companyName: row.company?.name ?? undefined,
    email: row.email,
    name: row.name,
    role:
      row.role === "super_admin" || row.role === "company_admin"
        ? row.role
        : "company_user",
    status: row.status === "disabled" ? "disabled" : "active",
    lastLoginAt: row.lastLoginAt?.toISOString(),
    invitedAt: row.invitedAt?.toISOString(),
    invitationExpiresAt: row.invitationExpiresAt?.toISOString(),
    firstLoginCompletedAt: row.firstLoginCompletedAt?.toISOString(),
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCompanies(
  scope: TenantScope,
  filters: PaginationInput & {
    search?: string;
    plan?: string;
    status?: string;
  } = {},
): Promise<Company[]> {
  const result = await listCompaniesPage(scope, filters);
  return result.items;
}

export async function listCompaniesPage(
  scope: TenantScope,
  filters: PaginationInput & {
    search?: string;
    plan?: string;
    status?: string;
  } = {},
): Promise<PaginatedResult<Company>> {
  const { skip, pageSize } = normalizePagination(filters);
  const search = filters.search?.trim();
  const plan = filters.plan?.trim();
  const status = filters.status?.trim();
  const where = {
    ...companyWhere(scope),
    ...(plan && plan !== "all" ? { plan } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { website: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return paginated([], total, filters);

  type CompanyCount = {
    companyId: string;
    _count: { _all: number };
  };
  type IntegrationStatus = {
    companyId: string;
    status: string;
  };
  const enterpriseDelegates = prisma as unknown as {
    conversation?: {
      groupBy: (args: unknown) => Promise<CompanyCount[]>;
    };
    channelIntegration?: {
      findMany: (args: unknown) => Promise<IntegrationStatus[]>;
    };
  };

  const [
    users,
    bots,
    conversations,
    integrations,
    primaryAdmins,
  ] = await Promise.all([
    prisma.appUser.groupBy({
      by: ["companyId"],
      where: { companyId: { in: companyIds } },
      _count: { _all: true },
    }),
    prisma.bot.groupBy({
      by: ["companyId"],
      where: { companyId: { in: companyIds } },
      _count: { _all: true },
    }),
    enterpriseDelegates.conversation
      ? enterpriseDelegates.conversation
          .groupBy({
            by: ["companyId"],
            where: { companyId: { in: companyIds } },
            _count: { _all: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    enterpriseDelegates.channelIntegration
      ? enterpriseDelegates.channelIntegration
          .findMany({
            where: { companyId: { in: companyIds } },
            select: { companyId: true, status: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.appUser.findMany({
      where: { companyId: { in: companyIds }, role: "company_admin" },
      select: { companyId: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const userCounts = new Map(
    users
      .filter((item) => item.companyId)
      .map((item) => [item.companyId as string, item._count._all]),
  );
  const botCounts = new Map(
    bots.map((item) => [item.companyId, item._count._all]),
  );
  const conversationCounts = new Map(
    conversations.map((item) => [item.companyId, item._count._all]),
  );
  const integrationCounts = new Map<string, { connected: number; total: number }>();
  integrations.forEach((item) => {
    const current = integrationCounts.get(item.companyId) ?? {
      connected: 0,
      total: 0,
    };
    current.total += 1;
    if (item.status === "connected") current.connected += 1;
    integrationCounts.set(item.companyId, current);
  });
  const primaryAdminByCompany = new Map<string, string>();
  primaryAdmins.forEach((admin) => {
    if (admin.companyId && !primaryAdminByCompany.has(admin.companyId)) {
      primaryAdminByCompany.set(admin.companyId, admin.name);
    }
  });

  return paginated(
    companies.map((company) => {
      const integration = integrationCounts.get(company.id);
      return companyFromRecord({
        ...company,
        userCount: userCounts.get(company.id) ?? 0,
        botCount: botCounts.get(company.id) ?? 0,
        conversationCount: conversationCounts.get(company.id) ?? 0,
        integrationStatus: integration
          ? `${integration.connected}/${integration.total} connected`
          : "Not configured",
        primaryAdmin: primaryAdminByCompany.get(company.id),
      });
    }),
    total,
    filters,
  );
}

export async function getCompanyById(
  scope: TenantScope,
  id: string,
): Promise<Company | null> {
  const targetId = isSuperAdmin(scope.role)
    ? id
    : scope.companyId === id
      ? id
      : "__missing_company__";
  const company = await prisma.company.findFirst({
    where: { id: targetId },
  });
  if (!company) return null;

  const [userCount, botCount, primaryAdmin] = await Promise.all([
    prisma.appUser.count({ where: { companyId: company.id } }),
    prisma.bot.count({ where: { companyId: company.id } }),
    prisma.appUser.findFirst({
      where: { companyId: company.id, role: "company_admin" },
      select: { name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const enterpriseDelegates = prisma as unknown as {
    conversation?: {
      count: (args: unknown) => Promise<number>;
    };
    channelIntegration?: {
      findMany: (args: unknown) => Promise<Array<{ status: string }>>;
    };
  };
  const [conversationCount, integrations] = await Promise.all([
    enterpriseDelegates.conversation
      ? enterpriseDelegates.conversation
          .count({ where: { companyId: company.id } })
          .catch(() => 0)
      : Promise.resolve(0),
    enterpriseDelegates.channelIntegration
      ? enterpriseDelegates.channelIntegration
          .findMany({
            where: { companyId: company.id },
            select: { status: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const connected = integrations.filter((item) => item.status === "connected").length;

  return companyFromRecord({
    ...company,
    userCount,
    botCount,
    conversationCount,
    integrationStatus: integrations.length
      ? `${connected}/${integrations.length} connected`
      : "Not configured",
    primaryAdmin: primaryAdmin?.name,
  });
}

export async function getCompanyForSession(
  scope: TenantScope,
): Promise<Company | null> {
  const company = await prisma.company.findFirst({
    where: companyWhere(scope),
  });
  return company ? companyFromRecord(company) : null;
}

export async function createCompany(input: {
  name: string;
  plan: string;
  billingCycle?: string;
  website?: string;
  supportEmail?: string;
  timezone?: string;
  subscriptionStatus?: string;
}): Promise<Company> {
  const plan = normalizePlan(input.plan);
  const id = crypto.randomUUID();
  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        id,
        name: input.name,
        website: input.website || null,
        supportEmail: input.supportEmail || null,
        timezone: input.timezone || "UTC",
        plan,
        billingCycle: input.billingCycle ?? "monthly",
        subscriptionStatus: input.subscriptionStatus ?? "trialing",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    await tx.subscription.create({
      data: {
        id: crypto.randomUUID(),
        companyId: id,
        plan,
        status: input.subscriptionStatus ?? "trialing",
        billingCycle: input.billingCycle ?? "monthly",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await tx.companySetting.create({
      data: {
        id: crypto.randomUUID(),
        companyId: id,
        welcomeMessage: "Hi, how can we help today?",
        offlineMessage:
          "We are currently offline. Leave a message and our team will respond.",
        botDisplayName: `${input.name} Support`,
        supportedLanguages: ["en"],
        responseTone: "professional",
        confidenceThreshold: 0.72,
        escalationThreshold: 0.45,
      },
    });
    return created;
  });
  return companyFromRecord(company);
}

export async function updateCompany(
  scope: TenantScope,
  input: {
    companyId?: string;
    name?: string;
    website?: string;
    industry?: string;
    description?: string;
    supportEmail?: string;
    phone?: string;
    address?: string;
    country?: string;
    timezone?: string;
    defaultLanguage?: string;
    plan?: string;
    billingCycle?: string;
    status?: "active" | "inactive";
    subscriptionStatus?: string;
    whatsappEnabled?: boolean;
    facebookEnabled?: boolean;
    liveChatEnabled?: boolean;
  },
): Promise<Company | null> {
  const target = await prisma.company.findFirst({
    where: companyWhere(scope, input.companyId),
  });
  if (!target) return null;

  const nextPlan = input.plan ? normalizePlan(input.plan) : target.plan;
  const canUseMessaging = planAllowsMessaging(nextPlan);
  const superAdmin = isSuperAdmin(scope.role);

  const result = await prisma.company.updateMany({
    where: { id: target.id },
    data: {
      name: input.name,
      website: input.website === undefined ? undefined : input.website || null,
      industry: input.industry === undefined ? undefined : input.industry || null,
      description:
        input.description === undefined ? undefined : input.description || null,
      supportEmail:
        input.supportEmail === undefined ? undefined : input.supportEmail || null,
      phone: input.phone === undefined ? undefined : input.phone || null,
      address: input.address === undefined ? undefined : input.address || null,
      country: input.country === undefined ? undefined : input.country || null,
      timezone: input.timezone || undefined,
      defaultLanguage: input.defaultLanguage || undefined,
      plan: nextPlan,
      billingCycle: input.billingCycle,
      status: superAdmin ? input.status : undefined,
      subscriptionStatus: superAdmin ? input.subscriptionStatus : undefined,
      whatsappEnabled:
        superAdmin && canUseMessaging
          ? input.whatsappEnabled
          : canUseMessaging
            ? target.whatsappEnabled
            : false,
      facebookEnabled:
        superAdmin && canUseMessaging
          ? input.facebookEnabled
          : canUseMessaging
            ? target.facebookEnabled
            : false,
      liveChatEnabled:
        superAdmin && canUseMessaging
          ? input.liveChatEnabled
          : canUseMessaging
            ? target.liveChatEnabled
            : false,
    },
  });
  if (result.count === 0) return null;

  const company = await prisma.company.findUnique({ where: { id: target.id } });
  return company ? companyFromRecord(company) : null;
}

export async function listUsers(
  scope: TenantScope,
  filters: PaginationInput & {
    search?: string;
    role?: string;
    status?: string;
    companyId?: string;
  } = {},
): Promise<AppUser[]> {
  const result = await listUsersPage(scope, filters);
  return result.items;
}

export async function listUsersPage(
  scope: TenantScope,
  filters: PaginationInput & {
    search?: string;
    role?: string;
    status?: string;
    companyId?: string;
  } = {},
): Promise<PaginatedResult<AppUser>> {
  const { skip, pageSize } = normalizePagination(filters);
  const search = filters.search?.trim();
  const role = filters.role?.trim();
  const status = filters.status?.trim();
  const requestedCompanyId = filters.companyId?.trim();
  const where = {
    ...tenantWhere(scope),
    ...(isSuperAdmin(scope.role) && requestedCompanyId
      ? { companyId: requestedCompanyId }
      : {}),
    ...(role && role !== "all" ? { role } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.appUser.count({ where }),
    prisma.appUser.findMany({
      where,
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);
  return paginated(users.map(userFromRecord), total, filters);
}

export async function createUser(
  scope: TenantScope,
  input: {
    name: string;
    email: string;
    role: "company_admin" | "company_user";
    companyId?: string;
  },
): Promise<{
  user: AppUser;
  temporaryPassword: string;
  invitationToken: string;
}> {
  const companyId = isSuperAdmin(scope.role)
    ? input.companyId
    : scope.companyId ?? undefined;
  if (!companyId) throw new Error("companyId is required");

  const temporaryPassword = generateTemporaryPassword();
  const invitationToken = randomToken();
  const now = new Date();
  const user = await prisma.appUser.create({
    data: {
      id: crypto.randomUUID(),
      companyId,
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      status: "active",
      passwordHash: sha256(temporaryPassword),
      invitationTokenHash: sha256(invitationToken),
      invitationExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      invitedAt: now,
      firstLoginCompletedAt: null,
      onboardingCompletedAt: null,
    },
    include: { company: { select: { name: true } } },
  });
  return {
    user: userFromRecord(user),
    temporaryPassword,
    invitationToken,
  };
}

export async function createUserInvitation(
  scope: TenantScope,
  id: string,
): Promise<{
  user: AppUser;
  temporaryPassword: string;
  invitationToken: string;
}> {
  const existing = await prisma.appUser.findFirst({
    where: { id, ...tenantWhere(scope), role: { not: "super_admin" } },
    include: { company: { select: { name: true } } },
  });
  if (!existing) {
    throw Object.assign(new Error("User not found."), { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const invitationToken = randomToken();
  const now = new Date();
  const updated = await prisma.appUser.update({
    where: { id },
    data: {
      status: "active",
      passwordHash: sha256(temporaryPassword),
      invitationTokenHash: sha256(invitationToken),
      invitationExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      invitedAt: now,
      firstLoginCompletedAt: null,
      onboardingCompletedAt: null,
    },
    include: { company: { select: { name: true } } },
  });

  return {
    user: userFromRecord(updated),
    temporaryPassword,
    invitationToken,
  };
}

export async function removeUser(
  scope: TenantScope & { userId?: string },
  id: string,
): Promise<AppUser | null> {
  if (scope.userId === id) {
    throw Object.assign(new Error("You cannot remove your own account."), {
      status: 403,
    });
  }
  const existing = await prisma.appUser.findFirst({
    where: { id, ...tenantWhere(scope), role: { not: "super_admin" } },
    include: { company: { select: { name: true } } },
  });
  if (!existing) return null;

  await prisma.appUser.delete({ where: { id } });
  return userFromRecord(existing);
}

export async function acceptUserInvitation(input: {
  token: string;
  temporaryPassword: string;
  newPassword: string;
}): Promise<AppUser | null> {
  const tokenHash = sha256(input.token);
  const user = await prisma.appUser.findFirst({
    where: {
      invitationTokenHash: tokenHash,
      status: "active",
      invitationExpiresAt: { gt: new Date() },
    },
    include: { company: { select: { name: true } } },
  });
  if (!user || !user.passwordHash || user.passwordHash !== sha256(input.temporaryPassword)) {
    return null;
  }

  const updated = await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordHash: sha256(input.newPassword),
      invitationTokenHash: null,
      invitationExpiresAt: null,
      firstLoginCompletedAt: new Date(),
      onboardingCompletedAt: null,
    },
    include: { company: { select: { name: true } } },
  });
  return userFromRecord(updated);
}

export async function completeTemporaryPasswordChange(
  scope: TenantScope & { userId?: string },
  input: {
    temporaryPassword: string;
    newPassword: string;
  },
): Promise<AppUser | null> {
  if (!scope.userId) return null;
  const user = await prisma.appUser.findFirst({
    where: {
      id: scope.userId,
      status: "active",
      invitationTokenHash: { not: null },
      firstLoginCompletedAt: null,
      invitationExpiresAt: { gt: new Date() },
    },
    include: { company: { select: { name: true } } },
  });
  if (!user?.passwordHash || user.passwordHash !== sha256(input.temporaryPassword)) {
    return null;
  }

  const updated = await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordHash: sha256(input.newPassword),
      invitationTokenHash: null,
      invitationExpiresAt: null,
      firstLoginCompletedAt: new Date(),
      onboardingCompletedAt: null,
    },
    include: { company: { select: { name: true } } },
  });
  return userFromRecord(updated);
}

export async function startPasswordReset(email: string): Promise<{
  user: AppUser;
  code: string;
} | null> {
  const user = await prisma.appUser.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { company: { select: { name: true } } },
  });
  if (!user || user.status !== "active") return null;

  const code = generateResetCode();
  const updated = await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordResetCodeHash: sha256(code),
      passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
    include: { company: { select: { name: true } } },
  });
  return { user: userFromRecord(updated), code };
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<boolean> {
  const user = await prisma.appUser.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      passwordResetCodeHash: true,
      passwordResetExpiresAt: true,
      status: true,
    },
  });
  return Boolean(
    user?.status === "active" &&
      user.passwordResetCodeHash &&
      user.passwordResetCodeHash === sha256(code.trim()) &&
      user.passwordResetExpiresAt &&
      user.passwordResetExpiresAt > new Date(),
  );
}

export async function completePasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<boolean> {
  const valid = await verifyPasswordResetCode(input.email, input.code);
  if (!valid) return false;

  await prisma.appUser.update({
    where: { email: input.email.trim().toLowerCase() },
    data: {
      passwordHash: sha256(input.newPassword),
      passwordResetCodeHash: null,
      passwordResetExpiresAt: null,
      invitationTokenHash: null,
      invitationExpiresAt: null,
      firstLoginCompletedAt: new Date(),
    },
  });
  return true;
}

export async function completeOnboarding(
  scope: TenantScope & { userId?: string },
): Promise<AppUser | null> {
  if (!scope.userId) return null;
  const updated = await prisma.appUser.update({
    where: { id: scope.userId },
    data: { onboardingCompletedAt: new Date() },
    include: { company: { select: { name: true } } },
  });
  return userFromRecord(updated);
}

export async function updateUser(
  scope: TenantScope,
  id: string,
  input: Partial<Pick<AppUser, "name" | "role" | "status">>,
): Promise<AppUser | null> {
  if (input.role === "super_admin" && !isSuperAdmin(scope.role)) {
    throw Object.assign(new Error("Company administrators cannot assign super admins."), {
      status: 403,
    });
  }
  if (input.role === "super_admin") {
    throw Object.assign(new Error("Super admin role changes require platform provisioning."), {
      status: 403,
    });
  }
  const result = await prisma.appUser.updateMany({
    where: { id, ...tenantWhere(scope) },
    data: {
      name: input.name,
      role: input.role,
      status: input.status,
    },
  });
  if (result.count === 0) return null;

  const user = await prisma.appUser.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: { company: { select: { name: true } } },
  });
  return user ? userFromRecord(user) : null;
}

function tenantActivityCreateData(input: {
  id?: string;
  companyId?: string | null;
  actorId?: string | null;
  type: string;
  action?: string | null;
  message: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | Prisma.InputJsonValue;
}) {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...(input.metadata as Record<string, unknown>) }
      : {};
  const auditContext = {
    action: input.action ?? input.type,
    resourceType: input.resourceType ?? undefined,
    resourceId: input.resourceId ?? undefined,
    ipAddress: input.ipAddress ?? undefined,
    userAgent: input.userAgent ?? undefined,
  };

  return {
    id: input.id ?? crypto.randomUUID(),
    company: input.companyId
      ? {
          connect: {
            id: input.companyId,
          },
        }
      : undefined,
    actorId: input.actorId ?? null,
    type: input.type,
    message: input.message,
    metadata: {
      ...metadata,
      auditContext,
    } as Prisma.InputJsonValue,
  } as Prisma.TenantActivityCreateInput;
}

export async function recordActivity(input: {
  companyId?: string | null;
  actorId?: string | null;
  type: string;
  action?: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.tenantActivity.create({
    data: tenantActivityCreateData(input),
  });
}

function activityFromRecord(row: {
  id: string;
  companyId: string | null;
  actorId: string | null;
  type: string;
  action: string | null;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}): ActivityLog {
  return {
    id: row.id,
    companyId: row.companyId ?? undefined,
    actorId: row.actorId ?? undefined,
    type: row.type,
    action: row.action ?? undefined,
    message: row.message,
    resourceType: row.resourceType ?? undefined,
    resourceId: row.resourceId ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listActivity(
  scope: TenantScope,
  filters: PaginationInput & {
    type?: string;
    search?: string;
  } = {},
): Promise<PaginatedResult<ActivityLog>> {
  const { skip, pageSize } = normalizePagination(filters);
  const type = filters.type?.trim();
  const search = filters.search?.trim();
  const where = {
    ...tenantWhere(scope),
    ...(type && type !== "all" ? { type } : {}),
    ...(search
      ? {
          OR: [
            { message: { contains: search, mode: "insensitive" as const } },
            { resourceType: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, activity] = await Promise.all([
    prisma.tenantActivity.count({ where }),
    prisma.tenantActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return paginated(activity.map(activityFromRecord), total, filters);
}

const INTEGRATION_CHANNELS = ["whatsapp", "facebook"] as const;
const INTEGRATION_STATUSES = [
  "connected",
  "disconnected",
  "pending",
  "error",
  "token_expired",
  "reauthorization_required",
] as const;

type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];
type IntegrationSecretInput = {
  appId?: string;
  appSecret?: string;
  verifyToken?: string;
  accessToken?: string;
};

function isIntegrationChannel(value: unknown): value is IntegrationChannel {
  return INTEGRATION_CHANNELS.includes(value as IntegrationChannel);
}

function normalizeIntegrationStatus(value: unknown): IntegrationStatus {
  return INTEGRATION_STATUSES.includes(value as IntegrationStatus)
    ? (value as IntegrationStatus)
    : "pending";
}

function credentialEncryptionKey(): Buffer {
  const configured = process.env.INTEGRATION_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
  }

  const fallback =
    process.env.AUTH_SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "development-only-integration-secret";
  return crypto.createHash("sha256").update(fallback).digest();
}

function maskSecret(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (value.length <= 4) return "configured";
  return `••••${value.slice(-4)}`;
}

function jsonObject(value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function encryptIntegrationCredential(input: Record<string, string>) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", credentialEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(input), "utf8"),
    cipher.final(),
  ]);
  const maskedCredentials = Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, maskSecret(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    credentialFields: Object.keys(input),
    maskedCredentials,
    configuredAt: new Date().toISOString(),
  } satisfies Prisma.InputJsonObject;
}

function decryptIntegrationCredential(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
): Record<string, string> {
  const envelope = jsonObject(value);
  if (!envelope) return {};
  if (
    envelope.algorithm !== "aes-256-gcm" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.tag !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    return {};
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      credentialEncryptionKey(),
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as unknown;
    const record = jsonObject(parsed as Prisma.JsonValue);
    if (!record) return {};
    return Object.fromEntries(
      Object.entries(record).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function credentialSummary(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
) {
  const envelope = jsonObject(value);
  const fields = Array.isArray(envelope?.credentialFields)
    ? envelope.credentialFields.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const masked = jsonObject(envelope?.maskedCredentials as Prisma.JsonValue);
  return {
    hasCredentials: fields.length > 0,
    credentialFields: fields,
    maskedCredentials: Object.fromEntries(
      Object.entries(masked ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
}

function integrationFromRecord(row: {
  id: string;
  companyId: string;
  company?: { name: string; plan: string } | null;
  channel: string;
  status: string;
  displayName: string | null;
  externalAccountId: string | null;
  encryptedCredential: Prisma.JsonValue | null;
  connectedAt: Date | null;
  tokenExpiresAt: Date | null;
  updatedAt: Date;
  lastError: string | null;
}): ChannelIntegration {
  const summary = credentialSummary(row.encryptedCredential);
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company?.name ?? undefined,
    companyPlan: row.company?.plan ?? undefined,
    channel: row.channel === "facebook" ? "facebook" : "whatsapp",
    status: normalizeIntegrationStatus(row.status),
    displayName: row.displayName ?? undefined,
    externalAccountId: row.externalAccountId ?? undefined,
    connectedAt: row.connectedAt?.toISOString(),
    tokenExpiresAt: row.tokenExpiresAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastError: row.lastError ?? undefined,
    ...summary,
  };
}

async function getIntegrationTargetCompany(
  scope: TenantScope,
  companyId?: string | null,
) {
  const targetId = isSuperAdmin(scope.role)
    ? companyId?.trim()
    : scope.companyId;
  if (!targetId) {
    throw Object.assign(new Error("Company is required."), { status: 400 });
  }

  const company = await prisma.company.findFirst({
    where: { id: targetId, ...companyWhere(scope, targetId) },
    select: {
      id: true,
      name: true,
      plan: true,
      whatsappEnabled: true,
      facebookEnabled: true,
    },
  });
  if (!company) {
    throw Object.assign(new Error("Company not found."), { status: 404 });
  }
  return company;
}

export async function listChannelIntegrations(
  scope: TenantScope,
  companyId?: string | null,
): Promise<{
  company: {
    id: string;
    name: string;
    plan: string;
    whatsappEnabled: boolean;
    facebookEnabled: boolean;
  };
  canConfigure: boolean;
  integrations: ChannelIntegration[];
}> {
  const company = await getIntegrationTargetCompany(scope, companyId);
  const rows = await prisma.channelIntegration.findMany({
    where: {
      companyId: company.id,
      channel: { in: [...INTEGRATION_CHANNELS] },
    },
    orderBy: { channel: "asc" },
    include: {
      company: {
        select: {
          name: true,
          plan: true,
        },
      },
    },
  });

  return {
    company,
    canConfigure:
      (canUseChannel(company.plan, "whatsapp") &&
        (isSuperAdmin(scope.role) || company.whatsappEnabled)) ||
      (canUseChannel(company.plan, "facebook") &&
        (isSuperAdmin(scope.role) || company.facebookEnabled)),
    integrations: rows.map(integrationFromRecord),
  };
}

export async function upsertChannelIntegration(
  scope: TenantScope,
  input: {
    companyId?: string | null;
    channel: IntegrationChannel;
    status?: string;
    displayName?: string;
    externalAccountId?: string;
    tokenExpiresAt?: string | null;
    credentials?: IntegrationSecretInput;
  },
): Promise<ChannelIntegration> {
  if (!isIntegrationChannel(input.channel)) {
    throw Object.assign(new Error("Unsupported integration channel."), { status: 400 });
  }

  const company = await getIntegrationTargetCompany(scope, input.companyId);
  if (!canUseChannel(company.plan, input.channel)) {
    throw Object.assign(
      new Error("This company needs Growth or Enterprise before this channel can be connected."),
      { status: 403 },
    );
  }
  if (!isSuperAdmin(scope.role)) {
    const channelEnabled =
      input.channel === "whatsapp"
        ? company.whatsappEnabled
        : company.facebookEnabled;
    if (!channelEnabled) {
      throw Object.assign(
        new Error("This channel is disabled for this company by a Super Admin."),
        { status: 403 },
      );
    }
  }

  const existing = await prisma.channelIntegration.findUnique({
    where: {
      companyId_channel: {
        companyId: company.id,
        channel: input.channel,
      },
    },
    select: {
      encryptedCredential: true,
    },
  });
  const existingCredentials = decryptIntegrationCredential(
    existing?.encryptedCredential,
  );
  const nextCredentials = {
    ...existingCredentials,
    ...Object.fromEntries(
      Object.entries(input.credentials ?? {})
        .map(([key, value]) => [key, value?.trim()])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  };
  const tokenExpiresAt = input.tokenExpiresAt
    ? new Date(input.tokenExpiresAt)
    : null;
  const status = normalizeIntegrationStatus(input.status);
  const row = await prisma.channelIntegration.upsert({
    where: {
      companyId_channel: {
        companyId: company.id,
        channel: input.channel,
      },
    },
    create: {
      id: crypto.randomUUID(),
      companyId: company.id,
      channel: input.channel,
      status,
      displayName: input.displayName?.trim() || null,
      externalAccountId: input.externalAccountId?.trim() || null,
      encryptedCredential:
        Object.keys(nextCredentials).length > 0
          ? encryptIntegrationCredential(nextCredentials)
          : undefined,
      connectedAt: status === "connected" ? new Date() : null,
      tokenExpiresAt,
    },
    update: {
      status,
      displayName:
        input.displayName === undefined ? undefined : input.displayName.trim() || null,
      externalAccountId:
        input.externalAccountId === undefined
          ? undefined
          : input.externalAccountId.trim() || null,
      encryptedCredential:
        Object.keys(nextCredentials).length > 0
          ? encryptIntegrationCredential(nextCredentials)
          : undefined,
      connectedAt: status === "connected" ? new Date() : undefined,
      tokenExpiresAt:
        input.tokenExpiresAt === undefined ? undefined : tokenExpiresAt,
      lastError: status === "error" ? undefined : null,
    },
    include: {
      company: {
        select: {
          name: true,
          plan: true,
        },
      },
    },
  });

  return integrationFromRecord(row);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function messageFromRecord(row: {
  id: string;
  companyId: string;
  conversationId: string;
  senderType: string;
  senderUser?: { name: string } | null;
  channel: string;
  body: string;
  deliveryStatus: string | null;
  readAt: Date | null;
  createdAt: Date;
}): SupportMessage {
  return {
    id: row.id,
    companyId: row.companyId,
    conversationId: row.conversationId,
    senderType:
      row.senderType === "customer" ||
      row.senderType === "ai" ||
      row.senderType === "agent"
        ? row.senderType
        : "system",
    senderName: row.senderUser?.name,
    channel:
      row.channel === "whatsapp" || row.channel === "facebook"
        ? row.channel
        : "web",
    body: row.body,
    deliveryStatus: row.deliveryStatus ?? undefined,
    readAt: row.readAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function conversationFromRecord(row: {
  id: string;
  companyId: string;
  company?: { name: string } | null;
  botId: string | null;
  bot?: { name: string } | null;
  contact?: {
    id: string;
    companyId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    organization: string | null;
    tags: Prisma.JsonValue | null;
    consentStatus: string;
    lastActivityAt: Date | null;
    createdAt: Date;
  } | null;
  channel: string;
  status: string;
  mode: string;
  priority: string;
  subject: string | null;
  assignedAgentId: string | null;
  assignedAgent?: { name: string } | null;
  tags: Prisma.JsonValue | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<Parameters<typeof messageFromRecord>[0]>;
}): Conversation {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company?.name ?? undefined,
    botId: row.botId ?? undefined,
    botName: row.bot?.name ?? undefined,
    contact: row.contact
      ? {
          id: row.contact.id,
          companyId: row.contact.companyId,
          name: row.contact.name ?? undefined,
          email: row.contact.email ?? undefined,
          phone: row.contact.phone ?? undefined,
          organization: row.contact.organization ?? undefined,
          tags: stringArray(row.contact.tags),
          lastActivityAt: row.contact.lastActivityAt?.toISOString(),
          consentStatus: row.contact.consentStatus,
          createdAt: row.contact.createdAt.toISOString(),
        }
      : undefined,
    channel:
      row.channel === "whatsapp" || row.channel === "facebook"
        ? row.channel
        : "web",
    status:
      row.status === "pending" ||
      row.status === "resolved" ||
      row.status === "closed"
        ? row.status
        : "open",
    mode:
      row.mode === "HUMAN_REQUESTED" ||
      row.mode === "HUMAN_ACTIVE" ||
      row.mode === "AI_PAUSED" ||
      row.mode === "RESOLVED" ||
      row.mode === "CLOSED"
        ? row.mode
        : "AI_ACTIVE",
    priority: row.priority,
    subject: row.subject ?? undefined,
    assignedAgentId: row.assignedAgentId ?? undefined,
    assignedAgentName: row.assignedAgent?.name,
    tags: stringArray(row.tags),
    lastMessageAt: row.lastMessageAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages?.map(messageFromRecord),
  };
}

export async function listConversations(
  scope: TenantScope,
  filters: PaginationInput & {
    search?: string;
    channel?: string;
    status?: string;
    priority?: string;
  } = {},
): Promise<PaginatedResult<Conversation>> {
  const { skip, pageSize } = normalizePagination(filters);
  const search = filters.search?.trim();
  const channel = filters.channel?.trim();
  const status = filters.status?.trim();
  const priority = filters.priority?.trim();
  const where = {
    ...tenantWhere(scope),
    ...(channel && channel !== "all" ? { channel } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(priority && priority !== "all" ? { priority } : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search, mode: "insensitive" as const } },
            { contact: { name: { contains: search, mode: "insensitive" as const } } },
            { contact: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [total, conversations] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        company: { select: { name: true } },
        bot: { select: { name: true } },
        contact: {
          select: {
            id: true,
            companyId: true,
            name: true,
            email: true,
            phone: true,
            organization: true,
            tags: true,
            consentStatus: true,
            lastActivityAt: true,
            createdAt: true,
          },
        },
        assignedAgent: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { senderUser: { select: { name: true } } },
        },
      },
    }),
  ]);

  return paginated(conversations.map(conversationFromRecord), total, filters);
}

export async function getConversationById(
  scope: TenantScope,
  id: string,
): Promise<Conversation | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      company: { select: { name: true } },
      bot: { select: { name: true } },
      contact: {
        select: {
          id: true,
          companyId: true,
          name: true,
          email: true,
          phone: true,
          organization: true,
          tags: true,
          consentStatus: true,
          lastActivityAt: true,
          createdAt: true,
        },
      },
      assignedAgent: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { senderUser: { select: { name: true } } },
      },
    },
  });
  return conversation ? conversationFromRecord(conversation) : null;
}

export async function setConversationControl(
  scope: TenantScope & { userId?: string },
  id: string,
  action: "join" | "return_to_ai" | "resolve" | "close",
): Promise<Conversation | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: { company: { select: { plan: true } } },
  });
  if (!conversation) return null;

  requirePlanFeature(conversation.company.plan, "human_takeover");
  if (!canJoinLiveChat(conversation.company.plan)) {
    throw Object.assign(new Error("Live chat is not enabled for this plan."), {
      status: 403,
    });
  }

  const next =
    action === "join"
      ? { mode: "HUMAN_ACTIVE", status: "open", assignedAgentId: scope.userId ?? null }
      : action === "return_to_ai"
        ? { mode: "AI_ACTIVE", status: "open", assignedAgentId: null }
        : action === "resolve"
          ? { mode: "RESOLVED", status: "resolved", resolvedAt: new Date() }
          : { mode: "CLOSED", status: "closed", closedAt: new Date() };

  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: next,
    }),
    prisma.conversationEvent.create({
      data: {
        id: crypto.randomUUID(),
        companyId: conversation.companyId,
        conversationId: conversation.id,
        actorId: scope.userId ?? null,
        type: `conversation.${action}`,
        metadata: { previousMode: conversation.mode },
      },
    }),
    prisma.tenantActivity.create({
      data: tenantActivityCreateData({
        companyId: conversation.companyId,
        actorId: scope.userId ?? null,
        type: `conversation.${action}`,
        action: `conversation.${action}`,
        message: `Conversation ${action.replaceAll("_", " ")} recorded.`,
        resourceType: "conversation",
        resourceId: conversation.id,
      }),
    }),
  ]);

  return getConversationById(scope, id);
}

export async function canAiRespondToConversation(params: {
  botId: string;
  conversationId?: string | null;
}): Promise<boolean> {
  if (!params.conversationId) return true;
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.conversationId,
      botId: params.botId,
    },
    select: {
      mode: true,
      status: true,
    },
  });
  if (!conversation) return false;
  return (
    conversation.status === "open" &&
    (conversation.mode === "AI_ACTIVE" || conversation.mode === "HUMAN_REQUESTED")
  );
}

export async function recordInboundChannelMessage(input: {
  channel: "whatsapp" | "facebook";
  externalAccountId: string;
  externalMessageId: string;
  senderExternalId: string;
  senderName?: string;
  text: string;
  receivedAt?: Date;
}): Promise<{ duplicate: boolean; conversationId?: string; messageId?: string }> {
  const integration = await prisma.channelIntegration.findFirst({
    where: {
      channel: input.channel,
      externalAccountId: input.externalAccountId,
      status: { in: ["connected", "pending"] },
    },
    include: { company: { select: { plan: true } } },
  });
  if (!integration) {
    throw Object.assign(new Error("Integration is not configured for this account."), {
      status: 404,
    });
  }
  requirePlanFeature(
    integration.company.plan,
    input.channel === "whatsapp" ? "whatsapp" : "facebook",
  );

  const existing = await prisma.message.findUnique({
    where: {
      companyId_channel_externalMessageId: {
        companyId: integration.companyId,
        channel: input.channel,
        externalMessageId: input.externalMessageId,
      },
    },
    select: { id: true, conversationId: true },
  });
  if (existing) {
    return {
      duplicate: true,
      conversationId: existing.conversationId,
      messageId: existing.id,
    };
  }

  const now = input.receivedAt ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    const identity = await tx.contactChannelIdentity.findFirst({
      where: {
        companyId: integration.companyId,
        channel: input.channel,
        externalId: input.senderExternalId,
      },
      include: { contact: true },
    });

    const contact = identity?.contact
      ? await tx.contact.update({
          where: { id: identity.contact.id },
          data: {
            name: input.senderName || identity.contact.name,
            lastActivityAt: now,
          },
        })
      : await tx.contact.create({
          data: {
            id: crypto.randomUUID(),
            companyId: integration.companyId,
            name: input.senderName ?? null,
            lastActivityAt: now,
            identities: {
              create: {
                id: crypto.randomUUID(),
                companyId: integration.companyId,
                channel: input.channel,
                externalId: input.senderExternalId,
                displayName: input.senderName ?? null,
              },
            },
          },
        });

    const conversation =
      (await tx.conversation.findFirst({
        where: {
          companyId: integration.companyId,
          contactId: contact.id,
          channel: input.channel,
          status: { in: ["open", "pending"] },
        },
        orderBy: { lastMessageAt: "desc" },
      })) ??
      (await tx.conversation.create({
        data: {
          id: crypto.randomUUID(),
          companyId: integration.companyId,
          contactId: contact.id,
          channel: input.channel,
          status: "open",
          mode: "AI_ACTIVE",
          priority: "normal",
          subject: input.text.slice(0, 120),
          lastMessageAt: now,
        },
      }));

    const message = await tx.message.create({
      data: {
        id: crypto.randomUUID(),
        companyId: integration.companyId,
        conversationId: conversation.id,
        contactId: contact.id,
        senderType: "customer",
        channel: input.channel,
        body: input.text,
        externalMessageId: input.externalMessageId,
        deliveryStatus: "received",
        createdAt: now,
      },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, updatedAt: now },
    });

    await tx.tenantActivity.create({
      data: tenantActivityCreateData({
        companyId: integration.companyId,
        type: "conversation.opened",
        action: "conversation.opened",
        message: `${input.channel} message received.`,
        resourceType: "conversation",
        resourceId: conversation.id,
        metadata: { externalMessageId: input.externalMessageId },
      }),
    });

    return { conversationId: conversation.id, messageId: message.id };
  });

  return { duplicate: false, ...result };
}

export async function getDashboardAnalytics(
  scope: TenantScope,
): Promise<DashboardAnalytics> {
  const where = tenantWhere(scope);
  const trendStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const [
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    totalUsers,
    activeUsers,
    totalBots,
    activeBots,
    totalDocuments,
    documentStorage,
    queryAggregate,
    totalConversations,
    openConversations,
    humanActiveConversations,
    totalMessages,
    totalContacts,
    messagesForTrend,
    botStatusRows,
    conversationStatusRows,
    conversationModeRows,
    channelRows,
    topBots,
    planRows,
    companyStatusRows,
    integrationStatusRows,
    topCompanies,
    recentActivity,
    company,
  ] = await Promise.all([
    isSuperAdmin(scope.role) ? prisma.company.count() : Promise.resolve(undefined),
    isSuperAdmin(scope.role)
      ? prisma.company.count({ where: { status: "active" } })
      : Promise.resolve(undefined),
    isSuperAdmin(scope.role)
      ? prisma.company.count({ where: { status: "inactive" } })
      : Promise.resolve(undefined),
    prisma.appUser.count({ where }),
    prisma.appUser.count({ where: { ...where, status: "active" } }),
    prisma.bot.count({ where }),
    prisma.bot.count({ where: { ...where, status: "active" } }),
    prisma.botDocument.count({ where }),
    prisma.botDocument.aggregate({ where, _sum: { size: true } }),
    prisma.bot.aggregate({
      where,
      _sum: { totalQueries: true },
    }),
    prisma.conversation.count({ where }),
    prisma.conversation.count({ where: { ...where, status: "open" } }),
    prisma.conversation.count({
      where: { ...where, mode: { in: ["HUMAN_REQUESTED", "HUMAN_ACTIVE", "AI_PAUSED"] } },
    }),
    prisma.message.count({ where }),
    prisma.contact.count({ where }),
    prisma.message.findMany({
      where: { ...where, createdAt: { gte: trendStart } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    prisma.bot.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ["mode"],
      where,
      _count: { _all: true },
    }),
    prisma.conversation.groupBy({
      by: ["channel"],
      where,
      _count: { _all: true },
    }),
    prisma.bot.findMany({
      where,
      orderBy: [{ totalQueries: "desc" }, { updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        totalQueries: true,
        company: { select: { name: true } },
        _count: { select: { conversations: true } },
      },
    }),
    isSuperAdmin(scope.role)
      ? prisma.company.groupBy({
          by: ["plan"],
          _count: { _all: true },
        })
      : Promise.resolve([]),
    isSuperAdmin(scope.role)
      ? prisma.company.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve([]),
    isSuperAdmin(scope.role)
      ? prisma.channelIntegration.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      : Promise.resolve([]),
    isSuperAdmin(scope.role)
      ? prisma.company.findMany({
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            name: true,
            plan: true,
            status: true,
            _count: {
              select: {
                users: true,
                bots: true,
                conversations: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.tenantActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    scope.companyId
      ? prisma.company.findUnique({ where: { id: scope.companyId } })
      : Promise.resolve(null),
  ]);

  const dayBuckets = new Map<string, number>();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayBuckets.set(
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      0,
    );
  }
  messagesForTrend.forEach((message) => {
    const label = message.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (dayBuckets.has(label)) {
      dayBuckets.set(label, (dayBuckets.get(label) ?? 0) + 1);
    }
  });

  return {
    scope: isSuperAdmin(scope.role) ? "platform" : "company",
    companyName: company?.name,
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    totalUsers,
    activeUsers,
    totalBots,
    activeBots,
    totalDocuments,
    totalQueries: queryAggregate._sum.totalQueries ?? 0,
    totalConversations,
    openConversations,
    humanActiveConversations,
    totalMessages,
    totalContacts,
    storageBytes: documentStorage._sum.size ?? 0,
    activity: Array.from(dayBuckets.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    planBreakdown: isSuperAdmin(scope.role)
      ? planRows.map((row) => ({ label: row.plan, value: row._count._all }))
      : undefined,
    companyStatusBreakdown: isSuperAdmin(scope.role)
      ? companyStatusRows.map((row) => ({
          label: row.status,
          value: row._count._all,
        }))
      : undefined,
    botStatusBreakdown: botStatusRows.map((row) => ({
      label: row.status,
      value: row._count._all,
    })),
    conversationStatusBreakdown: conversationStatusRows.map((row) => ({
      label: row.status,
      value: row._count._all,
    })),
    conversationModeBreakdown: conversationModeRows.map((row) => ({
      label: row.mode,
      value: row._count._all,
    })),
    channelBreakdown: channelRows.map((row) => ({
      label: row.channel,
      value: row._count._all,
    })),
    integrationStatusBreakdown: isSuperAdmin(scope.role)
      ? integrationStatusRows.map((row) => ({
          label: row.status,
          value: row._count._all,
        }))
      : undefined,
    topCompanies: isSuperAdmin(scope.role)
      ? topCompanies.map((item) => ({
          id: item.id,
          name: item.name,
          plan: item.plan,
          status: item.status,
          users: item._count.users,
          bots: item._count.bots,
          conversations: item._count.conversations,
        }))
      : undefined,
    topBots: topBots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      companyName: bot.company.name,
      status: bot.status,
      totalQueries: bot.totalQueries,
      conversations: bot._count.conversations,
    })),
    recentActivity: recentActivity.map((activity) => ({
      id: activity.id,
      type: activity.type,
      message: activity.message,
      createdAt: activity.createdAt.toISOString(),
    })),
  };
}

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { can, isRole, Role, Permission, requiresTenant } from "@/lib/rbac";

const COOKIE_NAME = "support_ai_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? "Password123!";

export type AuthSession = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  companyName: string | null;
  needsOnboarding: boolean;
  needsPasswordChange: boolean;
};

type SessionPayload = AuthSession & {
  exp: number;
};

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "development-only-session-secret"
  );
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSessionToken(session: AuthSession): string {
  const payload = base64url(
    JSON.stringify({
      ...session,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    } satisfies SessionPayload),
  );
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token?: string): AuthSession | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64url(payload)) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (!isRole(parsed.role)) return null;
    if (requiresTenant(parsed.role) && !parsed.companyId) return null;

    return {
      userId: parsed.userId,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      companyId: parsed.companyId,
      companyName: parsed.companyName,
      needsOnboarding: Boolean(parsed.needsOnboarding),
      needsPasswordChange: Boolean(parsed.needsPasswordChange),
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): AuthSession | null {
  return parseSessionToken(req.cookies.get(COOKIE_NAME)?.value);
}

export function requireSession(req: NextRequest): AuthSession {
  const session = getSessionFromRequest(req);
  if (!session) {
    throw Object.assign(new Error("Authentication required."), {
      status: 401,
    });
  }
  return session;
}

export function requirePermission(
  req: NextRequest,
  permission: Permission,
): AuthSession {
  const session = requireSession(req);
  if (!can(session.role, permission)) {
    throw Object.assign(new Error("Permission denied."), { status: 403 });
  }
  return session;
}

export function authErrorResponse(error: unknown): NextResponse | null {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null;
  if (!status) return null;

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unauthorized" },
    { status },
  );
}

async function verifySupabasePassword(email: string, password: string) {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey || rawUrl.startsWith("postgres")) return null;

  const url = rawUrl.replace(/\/+$/, "");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) return null;
  return response.json();
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function verifyLocalPassword(
  password: string,
  storedHash?: string | null,
): Promise<boolean> {
  if (storedHash) {
    return safeEqual(sha256(password), storedHash);
  }
  return password === DEMO_PASSWORD;
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.appUser.findUnique({
    where: { email: normalizedEmail },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user || user.status !== "active" || !isRole(user.role)) {
    return null;
  }
  if (
    user.invitationTokenHash &&
    !user.firstLoginCompletedAt &&
    user.invitationExpiresAt &&
    user.invitationExpiresAt < new Date()
  ) {
    return null;
  }

  const supabaseAuth = await verifySupabasePassword(normalizedEmail, password);
  const localAuth = supabaseAuth
    ? true
    : await verifyLocalPassword(password, user.passwordHash);

  if (!localAuth) return null;
  if (requiresTenant(user.role) && (!user.companyId || !user.company)) {
    return null;
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.name ?? null,
    needsOnboarding: Boolean(
      user.firstLoginCompletedAt && !user.onboardingCompletedAt,
    ),
    needsPasswordChange: Boolean(user.invitationTokenHash && !user.firstLoginCompletedAt),
  } satisfies AuthSession;
}

export function setSessionCookie(
  response: NextResponse,
  session: AuthSession,
): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: createSessionToken(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return response;
}

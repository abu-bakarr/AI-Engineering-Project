import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-error";
import {
  createCompany,
  listCompaniesPage,
  recordActivity,
  updateCompany,
} from "@/lib/supabase-store";

export async function GET(req: NextRequest) {
  try {
    const session = requirePermission(req, "companies:read");
    const url = new URL(req.url);
    const result = await listCompaniesPage(session, {
      search: url.searchParams.get("search") ?? undefined,
      plan: url.searchParams.get("plan") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    });
    return NextResponse.json({ companies: result.items, pageInfo: result.pageInfo });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requirePermission(req, "companies:create");
    const payload = (await req.json().catch(() => ({}))) as {
      name?: string;
      plan?: string;
      billingCycle?: string;
      website?: string;
      supportEmail?: string;
      timezone?: string;
    };
    const name = payload.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    const company = await createCompany({
      name,
      plan: payload.plan?.trim() || "starter",
      billingCycle: payload.billingCycle?.trim() || "monthly",
      website: payload.website?.trim(),
      supportEmail: payload.supportEmail?.trim(),
      timezone: payload.timezone?.trim(),
    });
    await recordActivity({
      companyId: company.id,
      actorId: session.userId,
      type: "company.created",
      action: "company.created",
      message: `${company.name} was provisioned.`,
      resourceType: "company",
      resourceId: company.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requirePermission(req, "companies:update");
    const payload = (await req.json().catch(() => ({}))) as {
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
    };

    const company = await updateCompany(session, {
      companyId: payload.companyId?.trim(),
      name: payload.name?.trim(),
      website: payload.website?.trim(),
      industry: payload.industry?.trim(),
      description: payload.description?.trim(),
      supportEmail: payload.supportEmail?.trim(),
      phone: payload.phone?.trim(),
      address: payload.address?.trim(),
      country: payload.country?.trim(),
      timezone: payload.timezone?.trim(),
      defaultLanguage: payload.defaultLanguage?.trim(),
      plan: payload.plan?.trim(),
      billingCycle: payload.billingCycle?.trim(),
      status: payload.status,
      subscriptionStatus: payload.subscriptionStatus?.trim(),
      whatsappEnabled: payload.whatsappEnabled,
      facebookEnabled: payload.facebookEnabled,
      liveChatEnabled: payload.liveChatEnabled,
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    await recordActivity({
      companyId: company.id,
      actorId: session.userId,
      type: "company.updated",
      action: "company.updated",
      message: `${company.name} settings were updated.`,
      resourceType: "company",
      resourceId: company.id,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ company });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const response = databaseErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

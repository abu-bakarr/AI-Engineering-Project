export const ROLES = ["super_admin", "company_admin", "company_user"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "companies:create",
  "companies:read",
  "companies:update",
  "users:create",
  "users:read",
  "users:update",
  "users:disable",
  "bots:create",
  "bots:read",
  "bots:update",
  "bots:delete",
  "conversations:read",
  "conversations:update",
  "conversations:join",
  "activity:read",
  "settings:read",
  "settings:update",
  "integrations:configure",
  "analytics:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  company_admin: [
    "companies:read",
    "companies:update",
    "users:create",
    "users:read",
    "users:update",
    "users:disable",
    "bots:create",
    "bots:read",
    "bots:update",
    "bots:delete",
    "conversations:read",
    "conversations:update",
    "conversations:join",
    "activity:read",
    "settings:read",
    "settings:update",
    "integrations:configure",
    "analytics:read",
  ],
  company_user: [
    "bots:create",
    "bots:read",
    "bots:update",
    "conversations:read",
    "conversations:update",
    "conversations:join",
    "settings:read",
    "analytics:read",
  ],
};

export function isRole(value: string | null | undefined): value is Role {
  return ROLES.includes(value as Role);
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isSuperAdmin(role: Role): boolean {
  return role === "super_admin";
}

export function requiresTenant(role: Role): boolean {
  return role !== "super_admin";
}

export function canAccessTenant(params: {
  role: Role;
  sessionCompanyId?: string | null;
  resourceCompanyId?: string | null;
}): boolean {
  if (isSuperAdmin(params.role)) return true;
  return Boolean(
    params.sessionCompanyId &&
      params.resourceCompanyId &&
      params.sessionCompanyId === params.resourceCompanyId,
  );
}

export function assertValidTenantMembership(params: {
  role: Role;
  companyId?: string | null;
}): void {
  if (requiresTenant(params.role) && !params.companyId) {
    throw new Error("Tenant-scoped users must belong to exactly one company.");
  }
  if (params.role === "super_admin" && params.companyId) {
    throw new Error("Super admins must not be assigned to a tenant.");
  }
}

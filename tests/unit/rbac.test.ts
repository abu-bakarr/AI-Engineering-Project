import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidTenantMembership,
  can,
  canAccessTenant,
  isSuperAdmin,
} from "../../lib/rbac.ts";
import {
  canAccessAdvancedAnalytics,
  canJoinLiveChat,
  canUseChannel,
  hasFeature,
} from "../../lib/plans.ts";

test("super admin has unrestricted platform permissions", () => {
  assert.equal(can("super_admin", "companies:create"), true);
  assert.equal(can("super_admin", "bots:delete"), true);
  assert.equal(can("super_admin", "analytics:read"), true);
  assert.equal(isSuperAdmin("super_admin"), true);
});

test("company admin can manage own users and bots but not companies", () => {
  assert.equal(can("company_admin", "users:create"), true);
  assert.equal(can("company_admin", "bots:update"), true);
  assert.equal(can("company_admin", "integrations:configure"), true);
  assert.equal(can("company_admin", "companies:create"), false);
});

test("company user is read-oriented", () => {
  assert.equal(can("company_user", "bots:create"), true);
  assert.equal(can("company_user", "bots:read"), true);
  assert.equal(can("company_user", "bots:update"), true);
  assert.equal(can("company_user", "analytics:read"), true);
  assert.equal(can("company_user", "users:create"), false);
  assert.equal(can("company_user", "bots:delete"), false);
  assert.equal(can("company_user", "integrations:configure"), false);
});

test("tenant membership rules are enforced", () => {
  assert.doesNotThrow(() =>
    assertValidTenantMembership({ role: "company_admin", companyId: "c1" }),
  );
  assert.throws(() =>
    assertValidTenantMembership({ role: "company_user", companyId: null }),
  );
  assert.throws(() =>
    assertValidTenantMembership({ role: "super_admin", companyId: "c1" }),
  );
});

test("tenant access allows super admin override and exact company match only", () => {
  assert.equal(
    canAccessTenant({ role: "super_admin", resourceCompanyId: "c2" }),
    true,
  );
  assert.equal(
    canAccessTenant({
      role: "company_admin",
      sessionCompanyId: "c1",
      resourceCompanyId: "c1",
    }),
    true,
  );
  assert.equal(
    canAccessTenant({
      role: "company_admin",
      sessionCompanyId: "c1",
      resourceCompanyId: "c2",
    }),
    false,
  );
});

test("subscription feature helpers enforce Starter, Growth, and Enterprise gates", () => {
  assert.equal(canUseChannel("starter", "web"), true);
  assert.equal(canUseChannel("starter", "whatsapp"), false);
  assert.equal(canUseChannel("starter", "facebook"), false);
  assert.equal(canJoinLiveChat("starter"), false);
  assert.equal(canUseChannel("growth", "whatsapp"), true);
  assert.equal(canJoinLiveChat("growth"), true);
  assert.equal(canAccessAdvancedAnalytics("growth"), true);
  assert.equal(hasFeature("enterprise", "sla_management"), true);
  assert.equal(hasFeature("growth", "sla_management"), false);
});

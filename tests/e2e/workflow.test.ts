import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("primary SaaS workflow pages exist", () => {
  for (const route of [
    "app/page.tsx",
    "app/about/page.tsx",
    "app/login/page.tsx",
    "app/billing/page.tsx",
    "app/contact/page.tsx",
    "app/book-demo/page.tsx",
    "app/invite/page.tsx",
    "app/forgot-password/page.tsx",
    "app/onboarding/page.tsx",
    "app/dashboard/page.tsx",
    "app/inbox/page.tsx",
    "app/bots/page.tsx",
    "app/bots/new/page.tsx",
    "app/users/page.tsx",
    "app/companies/page.tsx",
    "app/companies/[id]/page.tsx",
    "app/activity/page.tsx",
    "components/IntegrationConfigurationPanel.tsx",
    "components/FirstLoginPasswordModal.tsx",
  ]) {
    assert.equal(fs.existsSync(path.join(root, route)), true, `${route} missing`);
  }
});

test("integration setup appears in dashboard and settings", () => {
  const dashboard = fs.readFileSync(
    path.join(root, "components/DashboardChatInterface.tsx"),
    "utf8",
  );
  const settings = fs.readFileSync(path.join(root, "app/settings/page.tsx"), "utf8");
  const panel = fs.readFileSync(
    path.join(root, "components/IntegrationConfigurationPanel.tsx"),
    "utf8",
  );
  assert.match(dashboard, /IntegrationConfigurationPanel/);
  assert.match(settings, /IntegrationConfigurationPanel/);
  assert.match(panel, /WHATSAPP_ACCESS_TOKEN/);
  assert.match(panel, /FACEBOOK_PAGE_ACCESS_TOKEN/);
});

test("dashboard renders distinct platform and company experiences", () => {
  const dashboard = fs.readFileSync(
    path.join(root, "components/DashboardChatInterface.tsx"),
    "utf8",
  );
  const types = fs.readFileSync(path.join(root, "lib/types.ts"), "utf8");
  assert.match(dashboard, /function PlatformDashboard/);
  assert.match(dashboard, /function CompanyDashboard/);
  assert.match(dashboard, /analytics\.scope === "platform"/);
  assert.match(dashboard, /Super Admin Dashboard/);
  assert.match(dashboard, /Company support workspace/);
  assert.match(dashboard, /Company-only support analytics/);
  assert.match(dashboard, /planBreakdown/);
  assert.match(dashboard, /topCompanies/);
  assert.match(types, /planBreakdown/);
  assert.match(types, /totalConversations/);
});

test("settings page is designed for company administrators", () => {
  const settings = fs.readFileSync(path.join(root, "app/settings/page.tsx"), "utf8");
  assert.match(settings, /Only Company Admins can access this page/);
  assert.match(settings, /Plan and channel setup/);
  assert.match(settings, /isSuperAdmin && \(/);
  assert.match(settings, /selectedCompanyId/);
  assert.match(settings, /The profile fields, Plan and channel setup, and integration setup are tied to this selected company/);
  assert.match(settings, /The profile fields and integration setup are tied to your company/);
  assert.match(settings, /lockCompanySelection/);
  assert.match(settings, /channelAvailability/);
  assert.match(settings, /unavailable features stay unchecked and disabled/);
  assert.match(settings, /Requires Growth or Enterprise/);
});

test("first-time user and password reset screens are present", () => {
  const invite = fs.readFileSync(path.join(root, "app/invite/page.tsx"), "utf8");
  const reset = fs.readFileSync(path.join(root, "app/forgot-password/page.tsx"), "utf8");
  const onboarding = fs.readFileSync(path.join(root, "app/onboarding/page.tsx"), "utf8");
  const firstLogin = fs.readFileSync(
    path.join(root, "components/FirstLoginPasswordModal.tsx"),
    "utf8",
  );
  const users = fs.readFileSync(path.join(root, "app/users/page.tsx"), "utf8");
  assert.match(invite, /Temporary password/);
  assert.match(reset, /confirmation code/);
  assert.match(onboarding, /Skip/);
  assert.match(onboarding, /Next feature/);
  assert.match(onboarding, /roleSteps/);
  assert.match(onboarding, /company_user/);
  assert.match(onboarding, /company_admin/);
  assert.match(onboarding, /super_admin/);
  assert.match(onboarding, /companies/);
  assert.match(onboarding, /settings/);
  assert.match(firstLogin, /Change your temporary password/);
  assert.match(users, /User credentials ready/);
  assert.match(users, /Copy all/);
});

test("public landing page links to marketing pages and demo flow", () => {
  const source = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  const nav = fs.readFileSync(path.join(root, "components/PublicNavbar.tsx"), "utf8");
  assert.match(nav, /href="\/login"/);
  assert.match(nav, /href: "\/about"/);
  assert.match(nav, /href: "\/contact"/);
  assert.match(source, /href="\/billing"/);
  assert.match(source, /href="\/book-demo"/);
  assert.match(source, /Support customers faster without losing the human touch/);
});

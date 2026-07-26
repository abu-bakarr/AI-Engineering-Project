import {
  BarChart3,
  Bot,
  BrainCircuit,
  Headphones,
  Languages,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

export const PLAN_IDS = ["starter", "growth", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type ChannelId = "web" | "whatsapp" | "facebook";
export type FeatureId =
  | "website_chatbot"
  | "bot_management"
  | "knowledge_base"
  | "basic_conversation_history"
  | "basic_analytics"
  | "company_settings"
  | "email_support"
  | "whatsapp"
  | "facebook"
  | "live_monitoring"
  | "human_takeover"
  | "advanced_analytics"
  | "routing_escalation"
  | "ai_quality_management"
  | "sla_management"
  | "custom_roles_approvals"
  | "security_audit_center"
  | "agent_assist"
  | "knowledge_analytics";

export const BASIC_FEATURES = [
  "Company-scoped web chatbot",
  "Document-grounded answers with citations",
  "Bot management and embed workflow",
  "Basic analytics and activity history",
];

export const GROWTH_PREMIUM_FEATURES = [
  "Advanced conversation analytics",
  "Custom bot branding and workspace controls",
];

export const ENTERPRISE_PREMIUM_FEATURES = [
  "AI quality assurance scorecards",
  "SLA-aware escalation workflows",
  "Multilingual knowledge routing",
];

export const ENTERPRISE_SUPPORT_FEATURES = [
  {
    icon: ShieldCheck,
    title: "SSO and audit controls",
    copy: "Centralized identity, admin audit trails, and policy-ready access reviews.",
  },
  {
    icon: Workflow,
    title: "CRM and ticketing workflows",
    copy: "Route qualified issues into enterprise service workflows with full context.",
  },
  {
    icon: BrainCircuit,
    title: "AI quality monitoring",
    copy: "Review answer quality, risky responses, and unresolved knowledge gaps.",
  },
  {
    icon: Languages,
    title: "Multilingual support operations",
    copy: "Serve regional teams with localized answers from tenant-owned knowledge.",
  },
  {
    icon: LockKeyhole,
    title: "Data retention governance",
    copy: "Apply retention, export, and compliance controls across support interactions.",
  },
];

export const PLAN_DEFINITIONS = [
  {
    id: "starter",
    name: "Starter",
    summary: "The current web chatbot experience for basic support automation.",
    price: "$49",
    icon: Bot,
    includes: BASIC_FEATURES,
    channels: ["Web chatbot"],
  },
  {
    id: "growth",
    name: "Growth",
    summary: "Starter plus premium controls, WhatsApp/Facebook, and live join chat.",
    price: "$149",
    icon: MessagesSquare,
    includes: [
      ...BASIC_FEATURES,
      ...GROWTH_PREMIUM_FEATURES,
      "WhatsApp AI chat integration",
      "Facebook Messenger AI chat integration",
      "Admin live conversation join",
    ],
    channels: ["Web chatbot", "WhatsApp", "Facebook Messenger", "Live join chat"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    summary: "Growth plus enterprise support operations, governance, and escalation.",
    price: "Custom",
    icon: Sparkles,
    includes: [
      ...BASIC_FEATURES,
      ...GROWTH_PREMIUM_FEATURES,
      "WhatsApp AI chat integration",
      "Facebook Messenger AI chat integration",
      "Admin live conversation join",
      ...ENTERPRISE_PREMIUM_FEATURES,
    ],
    channels: ["Web chatbot", "WhatsApp", "Facebook Messenger", "Live join chat"],
  },
] satisfies Array<{
  id: PlanId;
  name: string;
  summary: string;
  price: string;
  icon: typeof Bot;
  includes: string[];
  channels: string[];
}>;

export const PLAN_FEATURES: Record<PlanId, FeatureId[]> = {
  starter: [
    "website_chatbot",
    "bot_management",
    "knowledge_base",
    "basic_conversation_history",
    "basic_analytics",
    "company_settings",
    "email_support",
  ],
  growth: [
    "website_chatbot",
    "bot_management",
    "knowledge_base",
    "basic_conversation_history",
    "basic_analytics",
    "company_settings",
    "email_support",
    "whatsapp",
    "facebook",
    "live_monitoring",
    "human_takeover",
    "advanced_analytics",
    "routing_escalation",
    "agent_assist",
    "knowledge_analytics",
  ],
  enterprise: [
    "website_chatbot",
    "bot_management",
    "knowledge_base",
    "basic_conversation_history",
    "basic_analytics",
    "company_settings",
    "email_support",
    "whatsapp",
    "facebook",
    "live_monitoring",
    "human_takeover",
    "advanced_analytics",
    "routing_escalation",
    "ai_quality_management",
    "sla_management",
    "custom_roles_approvals",
    "security_audit_center",
    "agent_assist",
    "knowledge_analytics",
  ],
};

export const CHANNELS = [
  {
    key: "whatsappEnabled",
    label: "WhatsApp",
    icon: PhoneCall,
  },
  {
    key: "facebookEnabled",
    label: "Facebook Messenger",
    icon: MessageCircle,
  },
  {
    key: "liveChatEnabled",
    label: "Live join chat",
    icon: Headphones,
  },
] as const;

export function isPlanId(value: string | null | undefined): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export function normalizedPlan(value: string | null | undefined): PlanId {
  return isPlanId(value) ? value : "starter";
}

export function planAllowsMessaging(plan: string | null | undefined): boolean {
  const currentPlan = normalizedPlan(plan);
  return currentPlan === "growth" || currentPlan === "enterprise";
}

export function hasFeature(
  plan: string | null | undefined,
  feature: FeatureId,
): boolean {
  return PLAN_FEATURES[normalizedPlan(plan)].includes(feature);
}

export function canUseChannel(
  plan: string | null | undefined,
  channel: ChannelId,
): boolean {
  if (channel === "web") return hasFeature(plan, "website_chatbot");
  if (channel === "whatsapp") return hasFeature(plan, "whatsapp");
  return hasFeature(plan, "facebook");
}

export function canJoinLiveChat(plan: string | null | undefined): boolean {
  return hasFeature(plan, "human_takeover");
}

export function canAccessAdvancedAnalytics(
  plan: string | null | undefined,
): boolean {
  return hasFeature(plan, "advanced_analytics");
}

export function requirePlanFeature(
  plan: string | null | undefined,
  feature: FeatureId,
): void {
  if (!hasFeature(plan, feature)) {
    throw Object.assign(new Error("Subscription plan does not allow this feature."), {
      status: 403,
    });
  }
}

export function planRank(plan: string | null | undefined): number {
  return PLAN_IDS.indexOf(normalizedPlan(plan));
}

export const planSummaryStats = [
  { label: "Basic features", value: BASIC_FEATURES.length, icon: BarChart3 },
  { label: "Growth premium", value: GROWTH_PREMIUM_FEATURES.length, icon: MessagesSquare },
  { label: "Enterprise premium", value: ENTERPRISE_PREMIUM_FEATURES.length, icon: Sparkles },
  { label: "Enterprise support", value: ENTERPRISE_SUPPORT_FEATURES.length, icon: Users },
];

export interface BotDocument {
  id: string;
  name: string;
  size: number;
  type: "pdf" | "docx" | "text" | string;
  uploadedAt: string;
  status: "processing" | "ready" | "failed";
  hash?: string;
  storedName?: string;
  content?: string;
  source?: "upload" | "rich-text";
}

export interface Bot {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  description: string;
  accentColor: string;
  logoDataUrl?: string;
  initials: string;
  createdAt: string;
  updatedAt?: string;
  documents: BotDocument[];
  status: "active" | "draft";
  totalQueries: number;
  conversationCount?: number;
  lastActivityAt?: string;
}

export interface ChatCitation {
  docId?: string;
  fileName: string;
  snippet: string;
  sourceUrl?: string;
}

export interface ChatResponse {
  reply: string;
  citations: ChatCitation[];
  latencyMs: number;
}

export type UserRole = "super_admin" | "company_admin" | "company_user";
export type UserStatus = "active" | "disabled";
export type CompanyStatus = "active" | "inactive";

export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  description?: string;
  supportEmail?: string;
  phone?: string;
  address?: string;
  country?: string;
  timezone: string;
  defaultLanguage?: string;
  status: CompanyStatus;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | string;
  plan: string;
  billingCycle?: string;
  whatsappEnabled: boolean;
  facebookEnabled: boolean;
  liveChatEnabled: boolean;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  botCount?: number;
  conversationCount?: number;
  integrationStatus?: string;
  primaryAdmin?: string;
}

export interface AppUser {
  id: string;
  companyId?: string;
  companyName?: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
  invitedAt?: string;
  invitationExpiresAt?: string;
  firstLoginCompletedAt?: string;
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardAnalytics {
  scope: "platform" | "company";
  companyName?: string;
  totalCompanies?: number;
  activeCompanies?: number;
  suspendedCompanies?: number;
  totalUsers: number;
  activeUsers: number;
  totalBots: number;
  activeBots: number;
  totalDocuments: number;
  totalQueries: number;
  totalConversations: number;
  openConversations: number;
  humanActiveConversations: number;
  totalMessages: number;
  totalContacts: number;
  storageBytes: number;
  activity: Array<{ label: string; value: number }>;
  planBreakdown?: Array<{ label: string; value: number }>;
  companyStatusBreakdown?: Array<{ label: string; value: number }>;
  botStatusBreakdown: Array<{ label: string; value: number }>;
  conversationStatusBreakdown: Array<{ label: string; value: number }>;
  conversationModeBreakdown: Array<{ label: string; value: number }>;
  channelBreakdown: Array<{ label: string; value: number }>;
  integrationStatusBreakdown?: Array<{ label: string; value: number }>;
  topCompanies?: Array<{
    id: string;
    name: string;
    plan: string;
    status: string;
    users: number;
    bots: number;
    conversations: number;
  }>;
  topBots: Array<{
    id: string;
    name: string;
    companyName?: string;
    status: string;
    totalQueries: number;
    conversations: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }>;
}

export type ConversationMode =
  | "AI_ACTIVE"
  | "HUMAN_REQUESTED"
  | "HUMAN_ACTIVE"
  | "AI_PAUSED"
  | "RESOLVED"
  | "CLOSED";

export type ConversationChannel = "web" | "whatsapp" | "facebook";
export type IntegrationChannel = "whatsapp" | "facebook";

export interface ChannelIntegration {
  id: string;
  companyId: string;
  companyName?: string;
  companyPlan?: string;
  channel: IntegrationChannel;
  status:
    | "connected"
    | "disconnected"
    | "pending"
    | "error"
    | "token_expired"
    | "reauthorization_required";
  displayName?: string;
  externalAccountId?: string;
  connectedAt?: string;
  tokenExpiresAt?: string;
  updatedAt: string;
  lastError?: string;
  hasCredentials: boolean;
  credentialFields: string[];
  maskedCredentials: Record<string, string>;
}

export interface Contact {
  id: string;
  companyId: string;
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  tags: string[];
  lastActivityAt?: string;
  consentStatus: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  companyId: string;
  conversationId: string;
  senderType: "customer" | "ai" | "agent" | "system";
  senderName?: string;
  channel: ConversationChannel;
  body: string;
  deliveryStatus?: string;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  companyName?: string;
  botId?: string;
  botName?: string;
  contact?: Contact;
  channel: ConversationChannel;
  status: "open" | "pending" | "resolved" | "closed";
  mode: ConversationMode;
  priority: "low" | "normal" | "high" | "urgent" | string;
  subject?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  tags: string[];
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  messages?: SupportMessage[];
}

export interface ActivityLog {
  id: string;
  companyId?: string;
  actorId?: string;
  type: string;
  action?: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

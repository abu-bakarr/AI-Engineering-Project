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
  name: string;
  description: string;
  accentColor: string;
  logoDataUrl?: string;
  initials: string;
  createdAt: string;
  documents: BotDocument[];
  status: "active" | "draft";
  totalQueries: number;
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

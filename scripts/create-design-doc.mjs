import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const outFile = path.join(process.cwd(), "system design.docx");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "supportai-docx-"));

const sections = [
  ["title", "SupportAI Agent Software Design Document"],
  ["p", "Version 1.0 | July 20, 2026 | Multi-tenant AI-powered customer support SaaS"],
  ["h1", "1. Problem Statement"],
  ["p", "Companies need a secure, subscription-ready way to deploy AI customer support agents that answer from approved business knowledge instead of unmanaged public knowledge. The platform must let a SaaS operator onboard paying companies, allow each company to manage its own users and bots, and guarantee that one customer's bots, documents, conversations, and analytics are never visible to another customer."],
  ["h1", "2. Stakeholders"],
  ["ul", "Super Admin: operates the SaaS platform, provisions companies, manages global users, and monitors platform analytics."],
  ["ul", "Company Admin: manages users, documents, bots, and analytics for exactly one company."],
  ["ul", "Company User: uses company support bots and sees company-scoped operational data."],
  ["ul", "End Customer: interacts with an embedded support bot on a company website."],
  ["ul", "Engineering/Operations: owns deployment, monitoring, security, CI/CD, and incident response."],
  ["h1", "3. Functional Requirements"],
  ["ul", "Authenticate users and include user id, role, company id, and company name in the session."],
  ["ul", "Allow super admins to create and view all companies."],
  ["ul", "Allow company admins to create, edit, disable, and remove users only inside their company."],
  ["ul", "Create bots that automatically inherit company ownership."],
  ["ul", "Upload documents and rich text knowledge to a company-owned bot."],
  ["ul", "Answer customer questions using retrieval-augmented generation with citations."],
  ["ul", "Display global analytics to super admins and company-only analytics to tenant users."],
  ["ul", "Expose an embeddable public widget for active bots."],
  ["h1", "4. Non-Functional Requirements"],
  ["ul", "Security: enforce tenant isolation in API routes and database queries."],
  ["ul", "Performance: indexed tenant foreign keys for bots, users, documents, and activity."],
  ["ul", "Availability: stateless Next.js application can run behind managed hosting or containers."],
  ["ul", "Maintainability: centralized RBAC and tenant-scoped store helpers avoid duplicated authorization logic."],
  ["ul", "Scalability: document indexing and vector storage can move to background workers without changing user-facing APIs."],
  ["ul", "Accessibility: responsive layouts, semantic controls, readable contrast, and keyboard-operable forms."],
  ["h1", "5. User Stories"],
  ["ul", "As a super admin, I want to create a company so that a paying customer can use the platform."],
  ["ul", "As a company admin, I want to invite users so that my support team can manage bots."],
  ["ul", "As a company admin, I want to create a bot and upload support documents so that customers receive approved answers."],
  ["ul", "As a company user, I want to see only my company's bots so that I cannot access another company's data."],
  ["ul", "As a SaaS operator, I want global analytics so that I can understand platform adoption and usage."],
  ["h1", "6. Use Case Diagram"],
  ["code", "Super Admin --> Create Company\nSuper Admin --> Manage All Users\nSuper Admin --> View Global Analytics\nCompany Admin --> Invite Company Users\nCompany Admin --> Manage Company Bots\nCompany User --> Chat With Company Bots\nEnd Customer --> Use Embedded Widget"],
  ["h1", "7. Entity Relationship Diagram"],
  ["code", "Company 1..* AppUser\nCompany 1..* Bot\nCompany 1..* BotDocument\nCompany 1..* TenantActivity\nBot 1..* BotDocument\nAppUser belongs to exactly one Company unless role is super_admin"],
  ["h1", "8. Architecture Diagram"],
  ["code", "Browser -> Next.js App Router -> Auth/RBAC -> Tenant Store -> Supabase Postgres\nNext.js -> Supabase Storage for original documents\nNext.js -> ChromaDB for vector retrieval\nNext.js -> OpenRouter for embeddings and grounded answer generation\nEmbedded Widget -> Public active-bot API -> RAG pipeline"],
  ["h1", "9. Sequence Diagram"],
  ["code", "User submits chat\nNext.js resolves session\nAPI validates bot ownership\nRAG retrieves vector context\nLLM generates citation-backed answer\nAPI increments tenant-scoped query count\nUI renders answer, citations, and latency"],
  ["h1", "10. Component Diagram"],
  ["ul", "Frontend: landing page, login, dashboard, bots, users, companies, settings, embedded widget."],
  ["ul", "API: auth, companies, users, bots, uploads, chat, analytics, widget metadata."],
  ["ul", "Domain services: RBAC, session signing, tenant-scoped Prisma store, document parsing, vector retrieval."],
  ["ul", "Data layer: Supabase Postgres, Supabase Storage, ChromaDB collections."],
  ["h1", "11. API Design"],
  ["ul", "POST /api/auth/login authenticates against Supabase Auth when configured and issues an httpOnly signed session cookie."],
  ["ul", "GET /api/auth/session returns session role and company context."],
  ["ul", "GET/POST /api/companies is super-admin only."],
  ["ul", "GET/POST /api/users is company-scoped for company admins and global for super admins."],
  ["ul", "GET/POST/PATCH/DELETE /api/bots scopes every operation by authenticated company unless super admin."],
  ["ul", "POST /api/uploads validates bot ownership before persisting documents."],
  ["ul", "POST /chat validates dashboard tenant scope or public active widget access."],
  ["h1", "12. Design Patterns Used"],
  ["ul", "Repository/Data Mapper: Prisma-backed store converts database records to app-level types."],
  ["ul", "Policy Object: centralized RBAC permission matrix in lib/rbac.ts."],
  ["ul", "Guard Clause: API routes fail fast with 401/403/404 before business logic."],
  ["ul", "Adapter: Supabase Storage and ChromaDB access are isolated behind helper functions."],
  ["ul", "Progressive Enhancement: public widget works without an admin session, while dashboard calls are authenticated."],
  ["h1", "13. Technology Choices"],
  ["ul", "Next.js App Router and TypeScript for a production web application with typed API routes."],
  ["ul", "Prisma for schema-driven PostgreSQL access and migrations."],
  ["ul", "Supabase for managed PostgreSQL, private object storage, and optional Auth integration."],
  ["ul", "ChromaDB for vector storage and semantic retrieval."],
  ["ul", "OpenRouter and LangChain for model access, embeddings, and RAG orchestration."],
  ["ul", "Tailwind CSS and lucide-react for responsive, professional UI controls."],
  ["h1", "14. Security Design"],
  ["ul", "Tenant-owned tables include company_id and supporting indexes."],
  ["ul", "Company users cannot choose arbitrary company ids during bot/user creation."],
  ["ul", "All protected API routes call requirePermission and tenant-scoped store methods."],
  ["ul", "Unauthorized requests return 401; forbidden actions return 403; inaccessible tenant resources return 404."],
  ["ul", "Session cookies are signed, httpOnly, same-site, and secure in production."],
  ["ul", "Secrets are placeholders in .env.example and GitHub Actions uses repository secrets."],
  ["h1", "15. Scalability"],
  ["ul", "Bot/document/user/activity queries are indexed by company id."],
  ["ul", "Vector collections are bot-scoped, reducing retrieval blast radius."],
  ["ul", "The upload pipeline can be moved to a queue and worker architecture for larger files or higher volume."],
  ["ul", "Subscription fields support future usage limits, plan gates, and billing cycles."],
  ["h1", "16. Deployment Strategy"],
  ["ul", "Development: npm run dev starts Next.js and ChromaDB."],
  ["ul", "Container: docker-compose up --build runs the app and vector store."],
  ["ul", "Production: deploy Next.js as a stateless service, Supabase as managed data plane, and Chroma as managed or persistent service."],
  ["ul", "CI/CD: GitHub Actions runs install, type check, tests, coverage, audit, and production build."],
  ["h1", "17. Cloud Architecture"],
  ["code", "Internet -> CDN/WAF -> Next.js runtime\nNext.js -> Supabase Postgres\nNext.js -> Supabase Storage\nNext.js -> Chroma Cloud\nNext.js -> OpenRouter\nGitHub Actions -> build/test/deploy pipeline\nMonitoring -> logs, errors, latency, usage metrics"],
  ["h1", "18. Cost Analysis"],
  ["ul", "Supabase free/pro tier can host early demos; production should budget for database size, backups, and storage."],
  ["ul", "OpenRouter cost scales with chat and embedding volume; plan-level usage limits should be added before billing launch."],
  ["ul", "Chroma Cloud or managed container cost scales with indexed document volume and retrieval throughput."],
  ["ul", "Hosting costs are low initially for a single Next.js service; Kubernetes becomes appropriate when worker and scaling needs grow."],
  ["h1", "19. Testing Strategy"],
  ["ul", "Unit tests cover RBAC permission and tenant membership rules."],
  ["ul", "Integration tests verify schema, migrations, company references, and tenant constraints."],
  ["ul", "API tests verify auth/admin route contracts."],
  ["ul", "E2E tests verify primary page workflow presence."],
  ["ul", "Performance tests verify indexes for tenant lookup paths."],
  ["ul", "Security tests verify protected routes require RBAC and scoped store calls."],
  ["ul", "Coverage is produced with Node's built-in test coverage runner."],
  ["h1", "20. Initiative Above Minimum Requirements"],
  ["ul", "AI-powered RAG with citations, refusal behavior, and document ingestion."],
  ["ul", "Authentication, RBAC, multi-tenant isolation, analytics dashboard, activity logging, Docker, CI, security audit, responsive UI, and subscription-ready data model."],
];

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(text, style = "") {
  const pStyle = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pStyle}<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function bullet(text) {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function codeBlock(text) {
  return String(text)
    .split("\n")
    .map((line) => `<w:p><w:pPr><w:shd w:fill="F1F5F9"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`)
    .join("");
}

const body = sections
  .map(([type, text]) => {
    if (type === "title") return paragraph(text, "Title");
    if (type === "h1") return paragraph(text, "Heading1");
    if (type === "ul") return bullet(text);
    if (type === "code") return codeBlock(text);
    return paragraph(text);
  })
  .join("");

const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>SupportAI Agent Software Design Document</dc:title><dc:creator>SupportAI Engineering</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-07-20T00:00:00Z</dcterms:created></cp:coreProperties>`,
  "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Codex</Application></Properties>`,
  "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:color w:val="0E7490"/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style></w:styles>`,
  "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="900" w:bottom="720" w:left="900" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
};

for (const [relative, content] of Object.entries(files)) {
  const target = path.join(tmp, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

try {
  fs.rmSync(outFile, { force: true });
  execFileSync("zip", ["-qr", outFile, "."], { cwd: tmp });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(outFile);

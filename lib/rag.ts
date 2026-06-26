import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { getBotById, removeDocumentObjects } from "@/lib/supabase-store";
import { BotDocument, ChatCitation } from "@/lib/types";

const execFileAsync = promisify(execFile);
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const CHROMA_API_KEY =
  process.env.CHROMA_CLOUD_API_KEY?.trim() ??
  process.env.CHROMA_API_KEY?.trim();
const CHROMA_TENANT = process.env.CHROMA_TENANT?.trim();
const CHROMA_DATABASE = process.env.CHROMA_DATABASE?.trim();
const CHROMA_CLOUD_URL = process.env.CHROMA_CLOUD_URL?.trim();
const CHROMA_URL = process.env.CHROMA_URL?.trim() || "http://localhost:8000";
const CHROMA_PREFER_CLOUD =
  (process.env.CHROMA_PREFER_CLOUD ?? "true").toLowerCase() !== "false";
const CHROMA_COLLECTION = process.env.CHROMA_COLLECTION ?? "dsti_rag_docs";
const CHROMA_BOT_COLLECTION_PREFIX =
  process.env.CHROMA_BOT_COLLECTION_PREFIX ?? CHROMA_COLLECTION;
const OPENROUTER_DOCUMENT_MODEL =
  process.env.OPENROUTER_DOCUMENT_MODEL ?? "openrouter/free";
const DOCUMENT_EXTRACTOR_TIMEOUT_MS = Number(
  process.env.DOCUMENT_EXTRACTOR_TIMEOUT_MS ?? "30000",
);
const DOCUMENT_OCR_TIMEOUT_MS = Number(
  process.env.DOCUMENT_OCR_TIMEOUT_MS ?? "120000",
);
const OCR_MIN_TEXT_LENGTH = Number(process.env.OCR_MIN_TEXT_LENGTH ?? "40");
const PADDLEOCR_MODEL_DIR =
  process.env.PADDLEOCR_MODEL_DIR ??
  path.join(process.cwd(), "rag", "ocr-models");
const PADDLEOCR_DETECTION_MODEL =
  process.env.PADDLEOCR_DETECTION_MODEL ??
  path.join(PADDLEOCR_MODEL_DIR, "PP-OCRv5_mobile_det_infer.onnx");
const PADDLEOCR_RECOGNITION_MODEL =
  process.env.PADDLEOCR_RECOGNITION_MODEL ??
  path.join(PADDLEOCR_MODEL_DIR, "PP-OCRv5_mobile_rec_infer.onnx");
const PADDLEOCR_DICTIONARY =
  process.env.PADDLEOCR_DICTIONARY ??
  path.join(PADDLEOCR_MODEL_DIR, "ppocrv5_dict.txt");
const TESSDATA_PREFIX = resolveTessdataPrefix();

type PdfParseInstance = {
  getText: () => Promise<{ text?: string }>;
  destroy: () => Promise<void>;
};
type PdfParseModule = {
  PDFParse: new (options: { data: Uint8Array }) => PdfParseInstance;
};

type LiteParseInstance = {
  parse: (input: Buffer | string) => Promise<{ text?: string }>;
};
type LiteParseModule = {
  LiteParse: new (options?: {
    outputFormat?: "text" | "json";
    quiet?: boolean;
  }) => LiteParseInstance;
};
type PaddleOcrModule = typeof import("paddleocr");
type OrtModule = typeof import("onnxruntime-node");
type FastPngModule = typeof import("fast-png");
type JpegJsModule = typeof import("jpeg-js");
type OcrImageInput = {
  data: Uint8Array;
  width: number;
  height: number;
};
type OpenRouterChatMessage = {
  role?: string;
  content?: unknown;
};
type OpenRouterChatResponse = {
  choices?: Array<{
    message?: OpenRouterChatMessage;
    text?: unknown;
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
};

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "md",
  "txt",
  "html",
  "htm",
]);

export function uploadsDir(): string {
  return path.join(process.cwd(), "rag", "uploads");
}

export function ensureRagDirs(): void {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  fs.mkdirSync(PADDLEOCR_MODEL_DIR, { recursive: true });
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function extractPrintableText(buffer: Buffer): string {
  let out = "";
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    const isPrintable =
      (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13;
    out += isPrintable ? String.fromCharCode(b) : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLikelyHumanReadableText(text: string): boolean {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 6) return false;

  const words = normalized.match(/[A-Za-z]{2,}/g) ?? [];
  if (words.length < 6) return false;

  const alphaTokens = tokens.filter((token) => /[A-Za-z]/.test(token));
  if (alphaTokens.length === 0) return false;

  const singleCharAlphaTokens = alphaTokens.filter((token) =>
    /^[A-Za-z]$/.test(token),
  ).length;
  const singleCharRatio = singleCharAlphaTokens / alphaTokens.length;
  if (singleCharRatio > 0.38) return false;

  const avgTokenLength =
    tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length;
  if (tokens.length >= 20 && avgTokenLength < 3.2) return false;

  const compact = normalized.replace(/\s+/g, "");
  if (!compact) return false;

  const letters = (compact.match(/[A-Za-z]/g) ?? []).length;
  const symbols = (compact.match(/[^A-Za-z0-9]/g) ?? []).length;
  const letterRatio = letters / compact.length;
  const symbolRatio = symbols / compact.length;

  if (letterRatio < 0.45) return false;
  if (symbolRatio > 0.35) return false;

  const longWeirdTokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 24 && /[^A-Za-z0-9]/.test(token)).length;
  if (longWeirdTokens > 6) return false;

  return true;
}

function normalizeAnswerText(answer: string): string {
  return answer
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isLikelyHumanReadableAnswer(answer: string): boolean {
  const normalized = normalizeAnswerText(answer);
  if (!normalized) return false;
  if (normalized.length < 12) return false;

  const hasSentenceLikeStructure = /[A-Za-z]{2,}[\s\S]*[.!?:]/.test(normalized);
  const hasBullets = /(^|\n)\s*[-*]\s+[A-Za-z]/.test(normalized);
  if (!hasSentenceLikeStructure && !hasBullets) return false;

  return isLikelyHumanReadableText(normalized);
}

function toReadableSnippet(text: string, maxLength = 280): string {
  const normalized = normalizeExtractedText(text)
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  return normalized.slice(0, maxLength);
}

function stripHtmlToText(html: string): string {
  return normalizeExtractedText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|section|article|h[1-6]|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );
}

function resolveTessdataPrefix(): string | undefined {
  const candidates = [
    process.env.TESSDATA_PREFIX,
    "/usr/local/share/tessdata",
    "/opt/homebrew/share/tessdata",
    "/usr/share/tesseract-ocr/5/tessdata",
    "/usr/share/tesseract-ocr/4.00/tessdata",
    "/usr/share/tessdata",
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "eng.traineddata")),
  );
}

function ensureTessdataEnv(): void {
  if (TESSDATA_PREFIX && !process.env.TESSDATA_PREFIX) {
    process.env.TESSDATA_PREFIX = TESSDATA_PREFIX;
  }
}

function commandAvailable(command: string): boolean {
  if (
    command.includes(path.sep) ||
    (path.win32 && command.includes(path.win32.sep))
  ) {
    return fs.existsSync(command);
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];

  return pathEntries.some((entry) =>
    extensions.some((extension) =>
      fs.existsSync(path.join(entry, `${command}${extension}`)),
    ),
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runTextExtractor(
  command: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    env: TESSDATA_PREFIX ? { ...process.env, TESSDATA_PREFIX } : process.env,
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return normalizeExtractedText(stdout);
}

async function extractWithLiteParseApi(
  input: Buffer | string,
): Promise<string> {
  ensureTessdataEnv();
  const { LiteParse } =
    (await import("@llamaindex/liteparse")) as LiteParseModule;
  const parser = new LiteParse({
    outputFormat: "text",
    quiet: true,
  });
  const result = await parser.parse(input);
  return normalizeExtractedText(result.text ?? "");
}

function liteParseNativeAvailable(): boolean {
  const packageName =
    process.platform === "darwin"
      ? `@llamaindex/liteparse-darwin-${process.arch}`
      : process.platform === "linux"
        ? `@llamaindex/liteparse-linux-${process.arch}-gnu`
        : process.platform === "win32"
          ? `@llamaindex/liteparse-win32-${process.arch}-msvc`
          : "";

  return Boolean(
    packageName &&
    fs.existsSync(path.join(process.cwd(), "node_modules", packageName)),
  );
}

async function extractWithLiteParseCli(filePath: string): Promise<string> {
  const command = process.env.LITEPARSE_COMMAND ?? "lit";
  const candidates = [
    ["parse", filePath, "--format", "text", "--quiet"],
    ["parse", filePath, "--format", "text"],
  ];

  let lastError: unknown;
  for (const args of candidates) {
    try {
      const text = await runTextExtractor(command, args);
      if (text) return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LiteParse failed.");
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = require("pdf-parse") as PdfParseModule;
  const parser = new PDFParse({ data: Uint8Array.from(buffer) });
  try {
    const data = await parser.getText();
    return normalizeExtractedText(String(data?.text ?? ""));
  } finally {
    await parser.destroy();
  }
}

async function extractWithMarkItDown(filePath: string): Promise<string> {
  return runTextExtractor(process.env.MARKITDOWN_COMMAND ?? "markitdown", [
    filePath,
  ]);
}

function paddleOcrAssetsAvailable(): boolean {
  return [
    PADDLEOCR_DETECTION_MODEL,
    PADDLEOCR_RECOGNITION_MODEL,
    PADDLEOCR_DICTIONARY,
  ].every((assetPath) => fs.existsSync(assetPath));
}

function readArrayBuffer(filePath: string): ArrayBuffer {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function toUint8Array(data: ArrayLike<number>): Uint8Array {
  return data instanceof Uint8Array ? data : Uint8Array.from(data);
}

function tempOcrDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dsti-rag-ocr-"));
}

function removeDirQuietly(dir: string): void {
  fs.rmSync(dir, { force: true, recursive: true });
}

async function paddleOcrService() {
  const [{ PaddleOcrService }, ort] = (await Promise.all([
    import("paddleocr") as Promise<PaddleOcrModule>,
    import("onnxruntime-node") as Promise<OrtModule>,
  ])) as [PaddleOcrModule, OrtModule];
  const charactersDictionary = fs
    .readFileSync(PADDLEOCR_DICTIONARY, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  return PaddleOcrService.createInstance({
    ort,
    detection: {
      modelBuffer: readArrayBuffer(PADDLEOCR_DETECTION_MODEL),
      minimumAreaThreshold: 24,
      textPixelThreshold: 0.55,
      paddingBoxVertical: 0.3,
      paddingBoxHorizontal: 0.5,
    },
    recognition: {
      modelBuffer: readArrayBuffer(PADDLEOCR_RECOGNITION_MODEL),
      charactersDictionary,
      imageHeight: 48,
    },
  });
}

async function decodeImageBuffer(
  buffer: Buffer,
  extension: string,
): Promise<OcrImageInput> {
  if (extension === "png") {
    const { decode } = (await import("fast-png")) as FastPngModule;
    const image = decode(buffer);
    return {
      data: toUint8Array(image.data),
      width: image.width,
      height: image.height,
    };
  }

  if (extension === "jpg" || extension === "jpeg") {
    const jpeg = (await import("jpeg-js")) as JpegJsModule;
    const image = jpeg.decode(buffer, { useTArray: true });
    return {
      data: toUint8Array(image.data),
      width: image.width,
      height: image.height,
    };
  }

  throw new Error(`Unsupported OCR image type: ${extension}`);
}

async function ocrImageBuffers(
  images: Array<{ buffer: Buffer; extension: string; label: string }>,
): Promise<string> {
  if (!images.length || !paddleOcrAssetsAvailable()) return "";

  const service = await paddleOcrService();
  try {
    const pages: string[] = [];
    for (const image of images) {
      const input = await decodeImageBuffer(image.buffer, image.extension);
      const raw = await service.recognize(input, {
        ordering: { sortByReadingOrder: true },
      });
      const processed = service.processRecognition(raw, {
        lineMergeThresholdRatio: 0.8,
      });
      const text = normalizeExtractedText(processed.text);
      if (text) pages.push(text);
    }
    return normalizeExtractedText(pages.join("\n\n"));
  } finally {
    await service.destroy();
  }
}

async function extractPdfWithPaddleOcr(filePath: string): Promise<string> {
  if (!paddleOcrAssetsAvailable()) return "";

  const dir = tempOcrDir();
  try {
    const prefix = path.join(dir, "page");
    await execFileAsync("pdftoppm", ["-png", "-r", "200", filePath, prefix], {
      timeout: DOCUMENT_OCR_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });

    const images = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".png"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => ({
        buffer: fs.readFileSync(path.join(dir, name)),
        extension: "png",
        label: name,
      }));

    return ocrImageBuffers(images);
  } finally {
    removeDirQuietly(dir);
  }
}

async function listDocxImageEntries(filePath: string): Promise<string[]> {
  const output = await runTextExtractor("unzip", ["-Z1", filePath]);
  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => /^word\/media\/.+\.(png|jpe?g)$/i.test(entry));
}

async function extractDocxWithPaddleOcr(filePath: string): Promise<string> {
  if (!paddleOcrAssetsAvailable()) return "";

  const entries = await listDocxImageEntries(filePath);
  const images = await Promise.all(
    entries.map(async (entry) => {
      const buffer = Buffer.from(
        await execFileAsync("unzip", ["-p", filePath, entry], {
          encoding: "buffer",
          timeout: 30_000,
          maxBuffer: 20 * 1024 * 1024,
        }).then((result) => result.stdout),
      );
      const extension = entry.split(".").pop()?.toLowerCase() ?? "";
      return { buffer, extension, label: entry };
    }),
  );

  return ocrImageBuffers(images);
}

async function extractDocxXml(filePath: string): Promise<string> {
  const xml = await runTextExtractor("unzip", [
    "-p",
    filePath,
    "word/document.xml",
  ]);
  return normalizeExtractedText(
    xml
      .replace(/<w:tab\/>/g, " ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, " "),
  );
}

async function extractPdfWithOpenRouter(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return "";

  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_REFERER ?? "http://localhost:3001",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "RAG Chatbot Platform",
    },
    body: JSON.stringify({
      model: OPENROUTER_DOCUMENT_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the readable text from ${fileName}. Preserve headings, lists, and tables as plain Markdown. Return only extracted document text.`,
            },
            {
              type: "file",
              file: {
                filename: fileName,
                file_data: `data:application/pdf;base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok || !raw.trim()) return "";

  let data: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
  } catch {
    return "";
  }

  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? normalizeExtractedText(text) : "";
}

export async function extractDocumentText(params: {
  buffer: Buffer;
  filePath: string;
  fileName: string;
  extension: string;
}): Promise<string> {
  const { buffer, filePath, fileName, extension } = params;
  const attempts: Array<{ label: string; run: () => Promise<string> }> = [];

  if (extension === "pdf") {
    attempts.push({
      label: "pdf-parse",
      run: () => extractWithPdfParse(buffer),
    });
    attempts.push({
      label: "PaddleOCR PDF image extractor",
      run: () => extractPdfWithPaddleOcr(filePath),
    });
    attempts.push({
      label: "OpenRouter PDF extractor",
      run: () => extractPdfWithOpenRouter(buffer, fileName),
    });
  }

  if (extension === "docx") {
    attempts.push({
      label: "DOCX XML fallback",
      run: () => extractDocxXml(filePath),
    });
    attempts.push({
      label: "PaddleOCR DOCX image extractor",
      run: () => extractDocxWithPaddleOcr(filePath),
    });
  }

  if (extension === "md" || extension === "txt") {
    attempts.push({
      label: "UTF-8 text parser",
      run: async () => normalizeExtractedText(buffer.toString("utf8")),
    });
  }

  if (extension === "html" || extension === "htm") {
    attempts.push({
      label: "HTML text parser",
      run: async () => stripHtmlToText(buffer.toString("utf8")),
    });
  }

  if (liteParseNativeAvailable()) {
    attempts.push(
      {
        label: "LiteParse file API",
        run: () => extractWithLiteParseApi(filePath),
      },
      {
        label: "LiteParse buffer API",
        run: () => extractWithLiteParseApi(buffer),
      },
    );

    if (commandAvailable(process.env.LITEPARSE_COMMAND ?? "lit")) {
      attempts.push({
        label: "LiteParse CLI",
        run: () => extractWithLiteParseCli(filePath),
      });
    }
  }

  if (commandAvailable(process.env.MARKITDOWN_COMMAND ?? "markitdown")) {
    attempts.push({
      label: "MarkItDown",
      run: () => extractWithMarkItDown(filePath),
    });
  }

  attempts.push({
    label: "printable text fallback",
    run: async () => extractPrintableText(buffer),
  });

  for (const attempt of attempts) {
    try {
      const text = normalizeExtractedText(
        await withTimeout(
          attempt.run(),
          DOCUMENT_EXTRACTOR_TIMEOUT_MS,
          attempt.label,
        ),
      );

      if (!text) continue;

      const isReadable = isLikelyHumanReadableText(text);
      const isPrintableFallback = attempt.label === "printable text fallback";
      if (isPrintableFallback && !isReadable) {
        continue;
      }

      if (
        text.length >= OCR_MIN_TEXT_LENGTH ||
        attempt.label.includes("PaddleOCR")
      ) {
        if ((extension === "pdf" || extension === "docx") && !isReadable) {
          continue;
        }
        return text;
      }
    } catch (error) {
      const details =
        error instanceof Error ? error.message : "Unknown parser error";
      console.warn(`Document parser fallback used for ${fileName}: ${details}`);
    }
  }

  return "";
}

function embeddingsModel(): OpenAIEmbeddings {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }
  return new OpenAIEmbeddings({
    apiKey,
    model:
      process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer":
          process.env.OPENROUTER_REFERER ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "RAG Chatbot Platform",
      },
    },
  });
}

function shouldUseChromaCloud(): boolean {
  return (
    CHROMA_PREFER_CLOUD &&
    Boolean(
      CHROMA_API_KEY || CHROMA_TENANT || CHROMA_DATABASE || CHROMA_CLOUD_URL,
    )
  );
}

function toCollectionSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "bot";
}

function botCollectionName(botId: string): string {
  const slug = toCollectionSlug(botId);
  const hashSuffix = crypto
    .createHash("sha1")
    .update(botId)
    .digest("hex")
    .slice(0, 8);
  return `${CHROMA_BOT_COLLECTION_PREFIX}_bot_${slug}_${hashSuffix}`;
}

async function vectorStoreForCollection(
  collectionName: string,
): Promise<Chroma> {
  if (shouldUseChromaCloud()) {
    if (!CHROMA_TENANT) {
      throw new Error("CHROMA_TENANT is required for Chroma Cloud.");
    }
    if (!CHROMA_DATABASE) {
      throw new Error("CHROMA_DATABASE is required for Chroma Cloud.");
    }
    if (!CHROMA_API_KEY) {
      throw new Error(
        "CHROMA_API_KEY (or CHROMA_CLOUD_API_KEY) is required for Chroma Cloud.",
      );
    }

    return new Chroma(embeddingsModel(), {
      collectionName,
      url: CHROMA_CLOUD_URL || "https://api.trychroma.com",
      chromaCloudAPIKey: CHROMA_API_KEY,
      clientParams: {
        tenant: CHROMA_TENANT,
        database: CHROMA_DATABASE,
      },
    });
  }

  return new Chroma(embeddingsModel(), {
    collectionName,
    url: CHROMA_URL,
  });
}

async function vectorStoreForBot(botId: string): Promise<Chroma> {
  return vectorStoreForCollection(botCollectionName(botId));
}

async function legacySharedVectorStore(): Promise<Chroma> {
  return vectorStoreForCollection(CHROMA_COLLECTION);
}

export async function chunkText(
  text: string,
  metadata: Record<string, unknown>,
): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200,
  });
  return splitter.createDocuments([text], [metadata]);
}

function normalizeQueryTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    ),
  );
}

function scoreChunk(content: string, terms: string[]): number {
  const lowered = content.toLowerCase();
  return terms.reduce(
    (score, term) => score + (lowered.includes(term) ? 1 : 0),
    0,
  );
}

async function fallbackRetrieveContext(botId: string, query: string) {
  const bot = await getBotById(botId);
  if (!bot?.documents?.length) {
    return {
      context: "",
      sources: [] as string[],
      citations: [] as ChatCitation[],
    };
  }

  const queryTerms = normalizeQueryTerms(query);
  const docsWithContent = bot.documents.filter(
    (doc) =>
      doc.content?.trim() && isLikelyHumanReadableText(doc.content ?? ""),
  );
  if (docsWithContent.length === 0) {
    return {
      context: "",
      sources: [] as string[],
      citations: [] as ChatCitation[],
    };
  }

  const candidates = (
    await Promise.all(
      docsWithContent.map(async (doc) => {
        const chunks = await chunkText(doc.content ?? "", {
          botId,
          docId: doc.id,
          fileName: doc.name,
          source: "local-document-fallback",
        });

        return chunks
          .map((chunk) => ({
            content: chunk.pageContent.trim(),
            fileName: String(chunk.metadata?.fileName ?? doc.name),
            score: scoreChunk(chunk.pageContent, queryTerms),
          }))
          .filter(
            (chunk) =>
              chunk.content.length > 0 &&
              chunk.score > 0 &&
              isLikelyHumanReadableText(chunk.content),
          );
      }),
    )
  ).flat();

  if (candidates.length === 0) {
    const snippets = docsWithContent
      .slice(0, 4)
      .map((doc) => ({
        content: (doc.content ?? "").trim().slice(0, 1200),
        fileName: doc.name,
        score: 1,
      }))
      .filter(
        (doc) =>
          doc.content.length > 0 && isLikelyHumanReadableText(doc.content),
      );

    return {
      context: snippets
        .map((doc) => `Source: ${doc.fileName}\n${doc.content}`)
        .join("\n\n"),
      sources: Array.from(new Set(snippets.map((doc) => doc.fileName))),
      citations: snippets.map((doc) => ({
        fileName: doc.fileName,
        snippet: toReadableSnippet(doc.content),
      })),
    };
  }

  const bestChunks = candidates
    .sort((a, b) => b.score - a.score || b.content.length - a.content.length)
    .slice(0, 6);

  return {
    context: bestChunks
      .map((chunk) => `Source: ${chunk.fileName}\n${chunk.content}`)
      .join("\n\n"),
    sources: Array.from(new Set(bestChunks.map((chunk) => chunk.fileName))),
    citations: bestChunks.map((chunk) => ({
      fileName: chunk.fileName,
      snippet: toReadableSnippet(chunk.content),
    })),
  };
}

export async function indexDocumentChunks(params: {
  botId: string;
  docId: string;
  fileName: string;
  text: string;
}): Promise<void> {
  const { botId, docId, fileName, text } = params;
  const cleaned = text.trim();
  if (!cleaned) return;

  const chunks = await chunkText(cleaned, { botId, docId, fileName });
  if (chunks.length === 0) return;

  const ids = chunks.map((_, i) => `${botId}:${docId}:${i}`);
  const store = await vectorStoreForBot(botId);
  await store.addDocuments(chunks, { ids });
}

export async function removeDocumentChunks(
  botId: string,
  docId: string,
): Promise<void> {
  const store = await vectorStoreForBot(botId);
  await store.delete({ filter: { $and: [{ botId }, { docId }] } });
}

export async function removeBotKnowledge(botId: string): Promise<void> {
  const bot = await getBotById(botId);
  const docs = bot?.documents ?? [];
  await removeBotKnowledgeByDocuments(botId, docs);
}

export async function removeBotKnowledgeByDocuments(
  botId: string,
  documents: BotDocument[],
  options?: { strict?: boolean },
): Promise<void> {
  const errors: string[] = [];

  try {
    await removeDocumentObjects(
      documents.map((document) => document.storedName ?? ""),
    );
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown file cleanup error";
    errors.push(`Supabase Storage cleanup failed for bot ${botId}: ${details}`);
  }

  try {
    const store = await vectorStoreForBot(botId);
    await store.delete({ filter: { botId } });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown vector cleanup error";
    errors.push(`Vector cleanup failed for bot ${botId}: ${details}`);
  }

  // Backward compatibility: also clean potential vectors in the legacy shared collection.
  try {
    const legacyStore = await legacySharedVectorStore();
    await legacyStore.delete({ filter: { botId } });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : "Unknown legacy vector cleanup error";
    errors.push(`Legacy vector cleanup failed for bot ${botId}: ${details}`);
  }

  if (errors.length > 0) {
    const message = errors.join(" | ");
    if (options?.strict) {
      throw new Error(message);
    }
    console.warn(message);
  }
}

export async function retrieveContext(botId: string, query: string) {
  try {
    const store = await vectorStoreForBot(botId);
    const docs = await store.similaritySearch(query, 8);
    const botDocs = docs
      .filter((doc) => String(doc.metadata?.botId ?? "") === botId)
      .filter((doc) => isLikelyHumanReadableText(doc.pageContent))
      .slice(0, 6);

    const contextBlocks = botDocs
      .map(
        (doc) =>
          `Source: ${String(doc.metadata?.fileName ?? "unknown")}\n${doc.pageContent.trim()}`,
      )
      .filter(Boolean);
    const sources = Array.from(
      new Set(
        botDocs
          .map((doc) => String(doc.metadata?.fileName ?? "unknown"))
          .filter(Boolean),
      ),
    );
    const citations: ChatCitation[] = botDocs.map((doc) => ({
      docId: String(doc.metadata?.docId ?? "") || undefined,
      fileName: String(doc.metadata?.fileName ?? "unknown"),
      snippet: toReadableSnippet(doc.pageContent),
    }));

    if (contextBlocks.length > 0) {
      return {
        context: contextBlocks.join("\n\n"),
        sources,
        citations,
      };
    }

    // Backward compatibility: try legacy shared collection for bots indexed before per-bot isolation.
    const legacyStore = await legacySharedVectorStore();
    const legacyDocs = await legacyStore.similaritySearch(query, 8, { botId });
    const legacyBotDocs = legacyDocs
      .filter((doc) => String(doc.metadata?.botId ?? "") === botId)
      .filter((doc) => isLikelyHumanReadableText(doc.pageContent))
      .slice(0, 6);

    const legacyContextBlocks = legacyBotDocs
      .map(
        (doc) =>
          `Source: ${String(doc.metadata?.fileName ?? "unknown")}\n${doc.pageContent.trim()}`,
      )
      .filter(Boolean);
    const legacySources = Array.from(
      new Set(
        legacyBotDocs
          .map((doc) => String(doc.metadata?.fileName ?? "unknown"))
          .filter(Boolean),
      ),
    );
    const legacyCitations: ChatCitation[] = legacyBotDocs.map((doc) => ({
      docId: String(doc.metadata?.docId ?? "") || undefined,
      fileName: String(doc.metadata?.fileName ?? "unknown"),
      snippet: toReadableSnippet(doc.pageContent),
    }));

    if (legacyContextBlocks.length > 0) {
      return {
        context: legacyContextBlocks.join("\n\n"),
        sources: legacySources,
        citations: legacyCitations,
      };
    }
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown retrieval error";
    console.warn(`Chroma retrieval failed for bot ${botId}: ${details}`);
  }

  return fallbackRetrieveContext(botId, query);
}

function normalizeModelContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractOpenRouterReply(data: OpenRouterChatResponse): string {
  const choice = data.choices?.[0];
  const content = normalizeModelContent(choice?.message?.content);
  if (content) return content;
  if (typeof choice?.text === "string" && choice.text.trim()) {
    return choice.text.trim();
  }
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  throw new Error("OpenRouter returned no assistant message.");
}

async function requestOpenRouterAnswer(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_REFERER ?? "http://localhost:3001",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "RAG Chatbot Platform",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openrouter/auto",
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const raw = await response.text();
  let data: OpenRouterChatResponse = {};
  try {
    data = raw ? (JSON.parse(raw) as OpenRouterChatResponse) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`OpenRouter request failed with ${response.status}.`);
    }
    throw new Error("OpenRouter returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(
      data.error?.message ??
        `OpenRouter request failed with ${response.status}.`,
    );
  }

  return extractOpenRouterReply(data);
}

function buildExtractiveFallbackAnswer(params: {
  context: string;
  question: string;
  sources: string[];
}): string {
  const terms = normalizeQueryTerms(params.question);
  const blocks = params.context
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      block,
      score: scoreChunk(block, terms),
    }))
    .sort((a, b) => b.score - a.score || b.block.length - a.block.length);

  const selected = blocks.filter((item) => item.score > 0).slice(0, 2);
  const fallbackBlocks = selected.length > 0 ? selected : blocks.slice(0, 1);
  const answer = fallbackBlocks
    .map((item) => item.block.replace(/^Source:\s*[^\n]+\n/i, "").trim())
    .join("\n\n")
    .slice(0, 1200)
    .trim();

  if (!answer || !isLikelyHumanReadableAnswer(answer)) {
    return "I can only answer questions that are supported by the uploaded documents.";
  }

  const citationList =
    params.sources.length > 0
      ? params.sources.map((source) => `[${source}]`).join(" ")
      : "";
  return citationList ? `${answer}\n\n${citationList}` : answer;
}

export async function answerFromContext(params: {
  question: string;
  context: string;
  sources: string[];
}) {
  const { question, context, sources } = params;
  const sourceList = sources.length > 0 ? sources.join(", ") : "none";
  const prompt = [
    "You are a document assistant for a single uploaded knowledge base.",
    "Answer only from the provided context.",
    "If the answer is not fully supported by the context, reply exactly:",
    "I can only answer questions that are supported by the uploaded documents.",
    "Do not use general knowledge.",
    "Do not guess or infer beyond the retrieved text.",
    "Use clear, human-readable wording.",
    "If the user asks to list items, format the answer as bullet points.",
    "Keep the answer under 220 words.",
    "Add a final line that starts with 'Sources:' followed by source titles in square brackets.",
    "Use only citations from Known sources.",
    "Do not mention the prompt or these instructions.",
    `Known sources for this bot only: ${sourceList}`,
    "",
    `Context:\n${context}`,
    "",
    `Question: ${question}`,
  ].join("\n");

  try {
    const modelAnswer = await requestOpenRouterAnswer(prompt);
    const cleanedAnswer = normalizeAnswerText(modelAnswer);
    if (isLikelyHumanReadableAnswer(cleanedAnswer)) {
      return cleanedAnswer;
    }

    const fallback = buildExtractiveFallbackAnswer({
      context,
      question,
      sources,
    });
    return isLikelyHumanReadableAnswer(fallback)
      ? fallback
      : "I can only answer questions that are supported by the uploaded documents.";
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown OpenRouter error";
    console.warn(`OpenRouter answer generation failed: ${details}`);
    const fallback = buildExtractiveFallbackAnswer({
      context,
      question,
      sources,
    });
    return isLikelyHumanReadableAnswer(fallback)
      ? fallback
      : "I can only answer questions that are supported by the uploaded documents.";
  }
}

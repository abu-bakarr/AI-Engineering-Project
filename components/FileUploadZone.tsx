"use client";

import { useRef, useState } from "react";
import { Check, FileText, Keyboard, Loader2, Trash2, Upload } from "lucide-react";
import { BotDocument } from "@/lib/types";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface FileUploadZoneProps {
  botId: string;
  files: BotDocument[];
  onFilesAdded: (files: BotDocument[]) => void;
  onDeleteDoc?: (docId: string) => void;
  allowRichText?: boolean;
  onUploadComplete?: (files: BotDocument[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readJsonResponse(res: Response) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok ? "Invalid server response" : "Server returned an invalid response.",
    );
  }
}

function parseJsonResponse(text: string) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned an invalid response.");
  }
}

type UploadStreamEvent =
  | { type: "processing"; completed: number; total: number; fileName?: string }
  | { type: "complete"; documents: BotDocument[]; skipped?: string[] }
  | { type: "error"; error: string };

function uploadFormWithProgress(
  form: FormData,
  onUploadProgress: (percent: number) => void,
  onStreamEvent: (event: UploadStreamEvent) => void,
): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.setRequestHeader("x-upload-progress", "stream");

    let responseCursor = 0;
    let completePayload: any = null;

    function consumeResponseText() {
      const chunk = xhr.responseText.slice(responseCursor);
      if (!chunk) return;

      const lines = chunk.split("\n");
      const lastLineComplete = chunk.endsWith("\n");
      const completeLines = lastLineComplete ? lines.slice(0, -1) : lines.slice(0, -1);
      const consumedLength = completeLines.reduce((total, line) => total + line.length + 1, 0);
      responseCursor += consumedLength;

      for (const line of completeLines) {
        if (!line.trim()) continue;
        const event = parseJsonResponse(line) as UploadStreamEvent;
        onStreamEvent(event);
        if (event.type === "error") {
          reject(new Error(event.error));
          return;
        }
        if (event.type === "complete") {
          completePayload = {
            documents: event.documents ?? [],
            skipped: event.skipped ?? [],
          };
        }
      }
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return;
      onUploadProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));
    xhr.onprogress = () => {
      consumeResponseText();
    };
    xhr.onload = () => {
      consumeResponseText();
      let data;
      try {
        data =
          completePayload ??
          parseJsonResponse(xhr.responseText.trim() || "{}");
      } catch (error) {
        reject(error);
        return;
      }

      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };

    onUploadProgress(0);
    xhr.send(form);
  });
}

export default function FileUploadZone({
  botId,
  files,
  onFilesAdded,
  onDeleteDoc,
  allowRichText = false,
  onUploadComplete,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "text">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStage, setUploadStage] = useState<"uploading" | "processing">("uploading");
  const [processingSummary, setProcessingSummary] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [richText, setRichText] = useState("");

  function handleClick() {
    inputRef.current?.click();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  async function processFiles(raw: File[]) {
    if (!botId) {
      return;
    }
    if (raw.length === 0) return;

    const oversized = raw.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setUploadError(
        `Each file must be 10 MB or smaller. Remove: ${oversized
          .map((file) => file.name)
          .join(", ")}`,
      );
      setUploadProgress(null);
      return;
    }

    const form = new FormData();
    form.append("botId", botId);
    raw.forEach((file) => form.append("files", file));

    try {
      setIsUploading(true);
      setUploadError("");
      setUploadProgress(0);
      setUploadStage("uploading");
      setProcessingSummary(null);
      const { ok, data } = await uploadFormWithProgress(
        form,
        (percent) => {
          setUploadStage("uploading");
          setUploadProgress(percent);
        },
        (event) => {
          if (event.type === "processing") {
            setUploadStage("processing");
            setProcessingSummary({
              completed: event.completed,
              total: event.total,
            });
            const total = event.total || 1;
            setUploadProgress(Math.round((event.completed / total) * 100));
            return;
          }

          if (event.type === "complete") {
            setUploadStage("processing");
            setProcessingSummary((current) =>
              current
                ? { ...current, completed: current.total }
                : current,
            );
            setUploadProgress(100);
          }
        },
      );
      if (!ok) throw new Error(data?.error ?? "Upload failed");
      onFilesAdded(data.documents ?? []);
      if ((data.documents ?? []).length === 0) {
        setUploadError("No new documents were added (possible duplicates).");
      } else {
        onUploadComplete?.(data.documents ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadError(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setProcessingSummary(null);
    }
  }

  function wordCount(value: string): number {
    return value.trim().split(/\s+/).filter(Boolean).length;
  }

  async function submitRichText() {
    if (!botId) return;
    const words = wordCount(richText);
    if (words === 0) {
      setUploadError("Add content before saving typed knowledge.");
      return;
    }
    if (words > 500) {
      setUploadError("Typed knowledge is limited to 500 words.");
      return;
    }

    const form = new FormData();
    form.append("botId", botId);
    form.append("richText", richText.trim());

    try {
      setIsUploading(true);
      setUploadProgress(null);
      setUploadError("");
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data?.error ?? "Text save failed");
      if ((data.documents ?? []).length === 0) {
        setUploadError("No new content was added (possible duplicate).");
      } else {
        setRichText("");
        onUploadComplete?.(data.documents ?? []);
      }
      onFilesAdded(data.documents ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Text save failed";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }

  const currentWordCount = wordCount(richText);

  return (
    <div className="space-y-3">
      {allowRichText && (
        <div className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setUploadError("");
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors ${
              mode === "upload" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Upload size={14} />
            Upload files
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("text");
              setUploadError("");
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors ${
              mode === "text" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Keyboard size={14} />
            Type content
          </button>
        </div>
      )}

      {mode === "upload" ? (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-5 text-center transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/30 sm:p-8"
        >
          <Upload size={32} className="text-gray-400 mb-3" />
          <p className="text-[13px] text-gray-600">Drag PDF, DOCX, MD, TXT, or HTML files here, or click to browse</p>
          <p className="text-[12px] text-gray-400 mt-1">
            Documents are stored and indexed only for this bot. Max 10 MB per file.
          </p>
          {isUploading && (
            <div className="mt-3 w-full max-w-sm">
              <div className="mb-1 flex items-center justify-between gap-3 text-[12px] text-blue-600">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {uploadStage === "uploading"
                    ? "Uploading documents..."
                    : processingSummary
                    ? `Indexing documents... ${processingSummary.completed}/${processingSummary.total}`
                    : "Indexing documents..."}
                </span>
                {uploadProgress !== null && <span>{uploadProgress}%</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${uploadProgress ?? 0}%` }}
                />
              </div>
            </div>
          )}
          {uploadError && <p className="text-[12px] text-red-500 mt-2">{uploadError}</p>}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.md,.txt,.html,.htm"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-gray-800">Typed knowledge</p>
            <p className={`text-[12px] ${currentWordCount > 500 ? "text-red-500" : "text-gray-400"}`}>
              {currentWordCount}/500 words
            </p>
          </div>
          <textarea
            value={richText}
            onChange={(e) => setRichText(e.target.value)}
            rows={8}
            placeholder="Type the exact content this bot can use to answer questions."
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-gray-400">
              Use this for policies, FAQs, short manuals, or pasted notes.
            </p>
            <button
              type="button"
              onClick={submitRichText}
              disabled={isUploading || currentWordCount === 0 || currentWordCount > 500}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isUploading && <Loader2 size={14} className="animate-spin" />}
              Add text
            </button>
          </div>
          {uploadError && <p className="text-[12px] text-red-500 mt-2">{uploadError}</p>}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3"
            >
              <FileText size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-gray-700 truncate">{doc.name}</p>
                <p className="text-[12px] text-gray-400">
                  {doc.source === "rich-text" ? "Typed content" : formatSize(doc.size)}
                </p>
              </div>
              {doc.status === "processing" ? (
                <Loader2 size={16} className="text-gray-400 animate-spin shrink-0" />
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <Check size={16} className="text-green-500" />
                  {onDeleteDoc && (
                    <button
                      type="button"
                      onClick={() => onDeleteDoc(doc.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors duration-150"
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

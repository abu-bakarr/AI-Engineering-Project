"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Trash2, FileText, X } from "lucide-react";
import { Bot, BotDocument } from "@/lib/types";
import FileUploadZone from "@/components/FileUploadZone";
import EmptyState from "@/components/EmptyState";
import { mergeIncomingDocuments } from "@/lib/documents";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BotDocsPage() {
  const params = useParams();
  const id = params.id as string;
  const [bot, setBot] = useState<Bot | null | undefined>(undefined);
  const [uploadBuffer, setUploadBuffer] = useState<BotDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [docPendingDelete, setDocPendingDelete] = useState<BotDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  function loadBot() {
    fetch(`/api/bots/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBot(data?.bot ?? null))
      .catch(() => setBot(null));
  }

  useEffect(() => {
    setBot(undefined);
    loadBot();
  }, [id]);

  function handleFilesAdded(incoming: BotDocument[]) {
    setUploadBuffer((prev) => mergeIncomingDocuments(prev, incoming));
    if (incoming.some((file) => file.status !== "processing")) {
      loadBot();
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!bot) return;
    setIsDeletingDoc(true);
    try {
      const updated = bot.documents.filter((d) => d.id !== docId);
      await fetch(`/api/bots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: updated }),
      }).catch(() => {});
      setDocPendingDelete(null);
      loadBot();
    } finally {
      setIsDeletingDoc(false);
    }
  }

  const botDocuments = bot?.documents ?? [];

  const allDocs = [
    ...botDocuments,
    ...uploadBuffer.filter(
      (u) => !botDocuments.some((d) => d.id === u.id)
    ),
  ];

  useEffect(() => {
    if (allDocs.length === 0) {
      setSelectedDocId("");
      setIsPreviewOpen(false);
      return;
    }

    const selectedStillExists = allDocs.some((doc) => doc.id === selectedDocId);
    if (!selectedStillExists) {
      const firstReady = allDocs.find((doc) => doc.status === "ready");
      setSelectedDocId(firstReady?.id ?? allDocs[0].id);
    }
  }, [allDocs, selectedDocId]);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setIsPreviewOpen(false);
    }

    if (isPreviewOpen) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isPreviewOpen]);

  const selectedDoc = allDocs.find((doc) => doc.id === selectedDocId) ?? null;

  if (bot === undefined) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8" aria-busy="true">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-gray-400">
          <Link href="/bots" className="hover:text-gray-600 transition-colors duration-150">
            Bots
          </Link>
          <span>/</span>
          <span className="text-gray-500">Loading...</span>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="mt-4 h-24 rounded bg-slate-100" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
          <div className="h-10 rounded bg-slate-100" />
          <div className="mt-3 h-10 rounded bg-slate-100" />
          <div className="mt-3 h-10 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (bot === null) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <Link
          href="/bots"
          className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors duration-150 mb-4 inline-block"
        >
          ← Bots
        </Link>
        <div className="bg-white rounded-lg border border-gray-100 p-10 text-center">
          <p className="text-[15px] font-medium text-gray-700 mb-1">Bot not found</p>
          <p className="text-[13px] text-gray-400 mb-5">
            This bot doesn&apos;t exist or has been deleted.
          </p>
          <Link
            href="/bots"
            className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm transition-colors duration-150"
          >
            Back to bots
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-gray-400">
        <Link href="/bots" className="hover:text-gray-600 transition-colors duration-150">
          Bots
        </Link>
        <span>/</span>
        <Link
          href={`/bots/${id}`}
          className="hover:text-gray-600 transition-colors duration-150"
        >
          {bot.name}
        </Link>
        <span>/</span>
        <span className="text-gray-600">Documents</span>
      </div>

      <h1 className="text-[18px] font-medium text-gray-900 mb-6">Documents</h1>

      <div className="mb-6">
        <FileUploadZone botId={id} files={uploadBuffer} onFilesAdded={handleFilesAdded} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {allDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents uploaded yet"
            description="Upload PDF, DOCX, MD, TXT, or HTML files above to build this bot's knowledge base."
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Name", "Type", "Size", "Uploaded", "Status", ""].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[12px] text-gray-400 font-normal px-4 py-3"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {allDocs.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => {
                    if (doc.status === "ready") {
                      setSelectedDocId(doc.id);
                      setIsPreviewOpen(true);
                    }
                  }}
                  className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${
                    doc.status === "ready" ? "cursor-pointer" : "cursor-default"
                  } ${selectedDocId === doc.id ? "bg-blue-50/60" : ""}`}
                >
                  <td className="px-4 py-3 text-[13px] text-gray-700 max-w-[200px] truncate">
                    {doc.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] uppercase text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-500">
                    {formatSize(doc.size)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-400">
                    {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        doc.status === "ready"
                          ? "bg-green-100 text-green-700"
                          : doc.status === "processing"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.status !== "processing" && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setDocPendingDelete(doc);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors duration-150 p-1"
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {isPreviewOpen && selectedDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/45 px-4 py-8 sm:p-8"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-medium text-gray-900">Document preview</h2>
                <p className="mt-1 truncate text-[12px] text-gray-500">{selectedDoc.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Close preview"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {selectedDoc.status === "processing" ? (
                <p className="text-[13px] text-gray-500">
                  This document is still processing. Preview becomes available when indexing completes.
                </p>
              ) : selectedDoc.status === "failed" ? (
                <p className="text-[13px] text-red-500">
                  Text extraction or indexing failed for this document.
                </p>
              ) : !selectedDoc.content?.trim() ? (
                <p className="text-[13px] text-gray-500">
                  No extracted content is available for this document yet.
                </p>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-[13px] leading-6 text-gray-700">
                  {selectedDoc.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {docPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-950">Delete document?</h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500">
                <span className="font-medium text-slate-700">{docPendingDelete.name}</span> will be removed from this bot and its indexed knowledge will be deleted.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setDocPendingDelete(null)}
                disabled={isDeletingDoc}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDoc(docPendingDelete.id)}
                disabled={isDeletingDoc}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeletingDoc ? "Deleting..." : "Delete document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

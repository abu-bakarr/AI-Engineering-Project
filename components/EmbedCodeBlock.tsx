"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface EmbedCodeBlockProps {
  botId: string;
  botName: string;
}

const TABS = ["Script tag", "iFrame"] as const;

export default function EmbedCodeBlock({ botId, botName }: EmbedCodeBlockProps) {
  const [activeTab, setActiveTab] = useState<"Script tag" | "iFrame">("Script tag");
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://your-ai-bot-domain.com");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const scriptCode = `<script
  src="${baseUrl}/widget.js"
  data-bot-id="${botId}"
  data-name="${botName}"
  async
></script>`;

  const iframeCode = `<iframe
  src="${baseUrl}/api/widget/${botId}"
  width="100%"
  height="600"
  frameborder="0"
  title="${botName} Chat"
></iframe>`;

  const code = activeTab === "Script tag" ? scriptCode : iframeCode;

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex overflow-x-auto border-b border-slate-100 px-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`mr-4 whitespace-nowrap border-b-2 px-1 py-3 text-sm transition-colors duration-150 ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="overflow-x-auto rounded-none bg-slate-950 p-4 pr-24 font-mono text-[12px] leading-relaxed text-white sm:text-[13px]">
          <code>{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition-colors duration-150 ${
            copied
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          {copied ? (
            <>
              <Check size={12} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

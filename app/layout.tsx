import type { Metadata } from "next";
import "./globals.css";
import ConditionalShell from "./ConditionalShell";

export const metadata: Metadata = {
  title: "DocBot Admin",
  description: "RAG Chatbot Admin Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 font-sans text-sm text-slate-700 antialiased">
        <ConditionalShell>{children}</ConditionalShell>
      </body>
    </html>
  );
}

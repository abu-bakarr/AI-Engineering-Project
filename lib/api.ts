import { Bot } from "./types";

export async function createBot(payload: Bot): Promise<Bot> {
  const res = await fetch("/api/bots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("[createBot] full response:", data);

  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to create bot");
  }

  // /api/bots returns { bot: Bot }, not the bot object at the top level
  return data.bot as Bot;
}

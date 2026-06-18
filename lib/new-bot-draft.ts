export const NEW_BOT_DRAFT_STORAGE_KEY = "dsti-new-bot-draft";

export function clearNewBotDraft(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(NEW_BOT_DRAFT_STORAGE_KEY);
}

import { BotDocument } from "./types";

export function mergeIncomingDocuments(
  previous: BotDocument[],
  incoming: BotDocument[]
): BotDocument[] {
  const existingIds = new Set(previous.map((f) => f.id));
  const incomingIds = new Set(incoming.map((f) => f.id));

  const updated = previous.map((f) =>
    incomingIds.has(f.id) ? incoming.find((i) => i.id === f.id)! : f
  );
  const brandNew = incoming.filter((i) => !existingIds.has(i.id));

  return [...updated, ...brandNew];
}


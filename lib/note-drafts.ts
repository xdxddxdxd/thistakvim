export type NoteDraft = { content: string; revision: number };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const key = (user: string, date: string) => `haftalik-plan:note-draft:${user}:${date}`;

export function readNoteDraft(storage: Storage, user: string, date: string): NoteDraft | null {
  try {
    const value = JSON.parse(storage.getItem(key(user, date)) ?? "null");
    return value && typeof value.content === "string" && value.content.length <= 500 && Number.isSafeInteger(value.revision) && value.revision >= 0
      ? { content: value.content, revision: value.revision } : null;
  } catch { return null; }
}
export function storeNoteDraft(storage: Storage, user: string, date: string, draft: NoteDraft | null): boolean {
  try {
    if (draft) storage.setItem(key(user, date), JSON.stringify(draft));
    else storage.removeItem(key(user, date));
    return true;
  } catch { return false; }
}

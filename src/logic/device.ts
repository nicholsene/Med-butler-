export type PersistStatus = 'granted' | 'denied' | 'unsupported' | 'unknown';

type StorageLike = { persist?(): Promise<boolean>; persisted?(): Promise<boolean> } | undefined;

/** Asks the browser not to clear this app's data. Never throws. */
export async function requestPersist(storage: StorageLike = globalThis.navigator?.storage): Promise<PersistStatus> {
  if (!storage?.persist) return 'unsupported';
  try {
    if (await storage.persisted?.()) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export const PERSIST_TEXT: Record<PersistStatus, string> = {
  granted: 'Protected: this browser agreed not to clear your data on its own.',
  denied: "Not confirmed: this browser didn't promise to keep your data, so keep your backups current.",
  unsupported: "Not available: this browser can't promise to keep your data, so keep your backups current.",
  unknown: 'Checking whether this browser will keep your data.',
};

type WindowLike = { matchMedia?(q: string): { matches: boolean }; navigator?: { standalone?: boolean } };

/** True when opened from the home screen rather than a browser tab. */
export function isStandalone(win: WindowLike = globalThis as unknown as WindowLike): boolean {
  return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone === true);
}

/**
 * Offline Field Task Storage & Synchronization Engine for Urbix AI
 */

export type OfflineRepairRecord = {
  id: string;
  reportId: string;
  officerId: string;
  beforePhotoUrl?: string;
  afterPhotoDataUrl: string;
  materialsLogged: string;
  costLogged: number;
  notes: string;
  timestamp: string;
  synced: boolean;
};

const OFFLINE_KEY = "urbix_offline_repairs_queue";

export function getOfflineQueue(): OfflineRepairRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineRepair(record: Omit<OfflineRepairRecord, "id" | "timestamp" | "synced">): OfflineRepairRecord {
  const queue = getOfflineQueue();
  const newRecord: OfflineRepairRecord = {
    ...record,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    synced: false,
  };
  queue.push(newRecord);
  if (typeof window !== "undefined") {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  }
  return newRecord;
}

export function clearSyncedOfflineItem(id: string) {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  }
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

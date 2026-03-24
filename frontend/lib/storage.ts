import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

const QUEUE_KEY = "offline_queue";

export type QueueItem = {
  id: string;
  type: "patient" | "visit";
  data: Record<string, unknown>;
  localId: string;
  createdAt: string;
};

export async function enqueue(item: Omit<QueueItem, "id" | "createdAt">) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
  queue.push({ ...item, id: Date.now().toString(), createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return { synced: 0, failed: 0 };

  const queue: QueueItem[] = JSON.parse(raw);
  if (!queue.length) return { synced: 0, failed: 0 };

  const patients = queue.filter((q) => q.type === "patient").map((q) => q.data);
  const visits = queue.filter((q) => q.type === "visit").map((q) => q.data);

  let synced = 0;
  let failed = 0;

  try {
    if (patients.length) {
      await api.post("/patients/sync", { records: patients });
      synced += patients.length;
    }
    if (visits.length) {
      await api.post("/visits/sync", { records: visits });
      synced += visits.length;
    }
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    failed = queue.length;
  }

  return { synced, failed };
}

export async function getQueueCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw).length : 0;
}

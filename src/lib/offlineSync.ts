// IndexedDB Offline Storage & Synchronization Layer for BJI Dawati Brothers

export interface SyncQueueItem {
  id: string;
  timestamp: number;
  collection: 'contacts' | 'organizations' | 'contact_activities' | 'notifications';
  action: 'set' | 'update' | 'remove';
  path: string;
  data?: any;
}

const DB_NAME = 'bji_dawati_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Contacts store
      if (!db.objectStoreNames.contains('contacts')) {
        const store = db.createObjectStore('contacts', { keyPath: 'id' });
        store.createIndex('organizationId', 'organizationId', { unique: false });
      }

      // Organizations store
      if (!db.objectStoreNames.contains('organizations')) {
        db.createObjectStore('organizations', { keyPath: 'id' });
      }

      // Contact activities store
      if (!db.objectStoreNames.contains('contact_activities')) {
        const store = db.createObjectStore('contact_activities', { keyPath: 'id' });
        store.createIndex('contactId', 'contactId', { unique: false });
      }

      // Offline sync queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // App metadata store
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// ── Generic IndexedDB Helpers ──────────────────────────

export async function getAllFromStore<T = any>(storeName: string): Promise<T[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] getAll error on ${storeName}:`, err);
    return [];
  }
}

export async function putAllInStore(storeName: string, items: any[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        if (item && item.id) {
          store.put(item);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] putAll error on ${storeName}:`, err);
  }
}

export async function putInStore(storeName: string, item: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] put error on ${storeName}:`, err);
  }
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] delete error on ${storeName}:`, err);
  }
}

// ── Metadata Store Helpers ─────────────────────────────

export async function getMetaItem<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setMetaItem(key: string, value: any): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] setMetaItem error for ${key}:`, err);
  }
}

// ── Contact Activities Helpers ─────────────────────────

export async function getActivitiesForContact(contactId: string): Promise<any[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('contact_activities', 'readonly');
      const store = tx.objectStore('contact_activities');
      const index = store.index('contactId');
      const req = index.getAll(contactId);
      req.onsuccess = () => {
        const items = (req.result || []).sort(
          (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// ── Sync Queue Helpers ─────────────────────────────────

export async function enqueueSync(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<string> {
  const syncItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
  };

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.put(syncItem);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notifySyncListeners();
  } catch (err) {
    console.error('[IndexedDB] Failed to enqueue sync item:', err);
  }

  return syncItem.id;
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const items = await getAllFromStore<SyncQueueItem>('sync_queue');
    return items.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

export async function getPendingSyncCount(): Promise<number> {
  try {
    const queue = await getSyncQueue();
    return queue.length;
  } catch {
    return 0;
  }
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  await deleteFromStore('sync_queue', id);
  notifySyncListeners();
}

// ── Sync Listener Mechanism ────────────────────────────

type SyncListener = (pendingCount: number, isSyncing: boolean) => void;
const listeners = new Set<SyncListener>();
let currentIsSyncing = false;

export function addSyncListener(cb: SyncListener) {
  listeners.add(cb);
  getPendingSyncCount().then(c => cb(c, currentIsSyncing));
  return () => { listeners.delete(cb); };
}

function notifySyncListeners() {
  getPendingSyncCount().then(c => {
    listeners.forEach(cb => cb(c, currentIsSyncing));
  });
}

// ── ID Generator for Offline Writes ────────────────────

export function generateOfflineId(prefix = 'item'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ── Sync Execution (Drains Queue to Firebase) ───────────

export async function syncQueueWithFirebase(databaseInstance?: any): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  let db = databaseInstance;
  if (!db) {
    try {
      const firebaseModule = await import('@/lib/firebase');
      db = firebaseModule.database;
    } catch (e) {
      console.error('[OfflineSync] Could not initialize Firebase database for sync:', e);
      return { synced: 0, failed: 0 };
    }
  }

  const { ref, set, update, remove } = await import('firebase/database');
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  currentIsSyncing = true;
  notifySyncListeners();

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const targetRef = ref(db, item.path);
      if (item.action === 'set') {
        await set(targetRef, item.data);
      } else if (item.action === 'update') {
        await update(targetRef, item.data);
      } else if (item.action === 'remove') {
        await remove(targetRef);
      }
      await removeSyncQueueItem(item.id);
      synced++;
    } catch (err) {
      console.error(`[OfflineSync] Failed to sync item ${item.id} at ${item.path}:`, err);
      failed++;
    }
  }

  currentIsSyncing = false;
  notifySyncListeners();

  if (synced > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bji_offline_synced', { detail: { synced } }));
  }

  return { synced, failed };
}

// ── Online Event Listener Setup ────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Device back online, starting sync queue...');
    syncQueueWithFirebase();
  });
}

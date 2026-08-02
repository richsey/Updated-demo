// src/lib/cache.ts
// Multi-layer caching strategy: Memory + IndexedDB + localStorage

interface CacheEntry<T> {
  key: string; // Used as keyPath
  data: T;
  timestamp: number;
  ttl: number;
}

// Internal memory cache entry (no key needed — key is the Map key)
interface MemoryCacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const MEMORY_CACHE = new Map<string, MemoryCacheEntry>();
const DB_NAME = "dataflow_cache";
const STORE_NAME = "cache_store";

const getDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2); // Increment version to apply upgrade

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
  });
};

export const CacheManager = {
  // Memory cache (fast)
  getMemory<T>(key: string, maxAge: number = Infinity): T | null {
    const entry = MEMORY_CACHE.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      MEMORY_CACHE.delete(key);
      return null;
    }
    return entry.data as T;
  },

  setMemory<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    MEMORY_CACHE.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  },

  clearMemory(pattern?: string): void {
    if (!pattern) {
      MEMORY_CACHE.clear();
    } else {
      for (const k of MEMORY_CACHE.keys()) {
        if (k.includes(pattern)) {
          MEMORY_CACHE.delete(k);
        }
      }
    }
  },

  // IndexedDB cache (persistent)
  async getIndexedDB<T>(
    key: string,
    maxAge: number = Infinity,
  ): Promise<T | null> {
    try {
      const db = await getDB();
      return new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        
        request.onsuccess = () => {
          const entry = request.result;
          if (!entry) return resolve(null);
          
          if (Date.now() - entry.timestamp > maxAge) {
            this.deleteIndexedDB(key);
            return resolve(null);
          }
          resolve(entry.data as T);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn("[Cache] IndexedDB read error:", err);
      return null;
    }
  },

  async setIndexedDB<T>(
    key: string,
    data: T,
    ttl: number = 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          key,
          data,
          timestamp: Date.now(),
          ttl,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn("[Cache] IndexedDB write error:", err);
    }
  },

  async deleteIndexedDB(key: string): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
    } catch (err) {
      console.warn("[Cache] IndexedDB delete error:", err);
    }
  },

  async clearIndexedDB(pattern?: string): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        if (!pattern) {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        } else {
          const request = store.getAllKeys();
          request.onsuccess = async () => {
            const keys = request.result;
            const deletePromises = [];
            for (const k of keys) {
              if (typeof k === "string" && k.includes(pattern)) {
                deletePromises.push(this.deleteIndexedDB(k));
              }
            }
            await Promise.all(deletePromises);
            resolve();
          };
          request.onerror = () => reject(request.error);
        }
      });
    } catch (err) {
      console.warn("[Cache] IndexedDB clear error:", err);
    }
  },

  // Composite: check memory first, then IndexedDB
  async get<T>(key: string, maxAge: number = Infinity): Promise<T | null> {
    const memoryData = this.getMemory(key, maxAge) as T | null;
    if (memoryData) return memoryData;

    const indexedData = await CacheManager.getIndexedDB<T>(key, maxAge);
    if (indexedData) {
      this.setMemory(key, indexedData, 5 * 60 * 1000);
      return indexedData as T;
    }

    return null;
  },

  async set<T>(
    key: string,
    data: T,
    ttl: number = 5 * 60 * 1000,
  ): Promise<void> {
    this.setMemory(key, data, ttl);
    await this.setIndexedDB(key, data, ttl);
  },

  async clear(pattern?: string): Promise<void> {
    this.clearMemory(pattern);
    await this.clearIndexedDB(pattern);
  },
};

export default CacheManager;

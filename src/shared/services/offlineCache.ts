import { Platform } from "react-native";

/**
 * Offline cache using expo-sqlite.
 * On web, falls back to a no-op implementation.
 */

type CacheEntry = { key: string; value: string; updated_at: number };

let dbPromise: Promise<any> | null = null;

async function getDb() {
    if (Platform.OS === "web") return null;
    if (!dbPromise) {
        dbPromise = (async () => {
            const SQLite = await import("expo-sqlite");
            const db = await SQLite.openDatabaseAsync("minizalo_cache.db");
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS cache_entries (
                    key TEXT PRIMARY KEY NOT NULL,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            `);
            return db;
        })();
    }
    return dbPromise;
}

export const offlineCache = {
    /**
     * Get cached JSON value by key. Returns null if not found or on web.
     */
    async get<T = unknown>(key: string): Promise<T | null> {
        try {
            const db = await getDb();
            if (!db) return null;
            const row = await db.getFirstAsync(
                "SELECT value FROM cache_entries WHERE key = ?",
                [key]
            );
            if (row && typeof (row as CacheEntry).value === "string") {
                return JSON.parse((row as CacheEntry).value) as T;
            }
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Save a JSON-serializable value to cache.
     */
    async set(key: string, value: unknown): Promise<void> {
        try {
            const db = await getDb();
            if (!db) return;
            const json = JSON.stringify(value);
            const now = Date.now();
            await db.runAsync(
                `INSERT OR REPLACE INTO cache_entries (key, value, updated_at) VALUES (?, ?, ?)`,
                [key, json, now]
            );
        } catch {
            // silently fail – cache is best-effort
        }
    },

    /**
     * Remove a specific key or clear all cache entries.
     */
    async clear(key?: string): Promise<void> {
        try {
            const db = await getDb();
            if (!db) return;
            if (key) {
                await db.runAsync("DELETE FROM cache_entries WHERE key = ?", [key]);
            } else {
                await db.runAsync("DELETE FROM cache_entries");
            }
        } catch {
            // ignore
        }
    },
};

// Well-known cache keys
export const CACHE_KEYS = {
    CHAT_ROOMS: "chat_rooms",
    FRIENDS_LIST: "friends_list",
    USER_PROFILE: "user_profile",
} as const;

export default offlineCache;

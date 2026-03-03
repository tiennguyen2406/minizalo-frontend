import axios from "axios";
import { useAuthStore } from "@/shared/store/authStore";
import type { UserProfile } from "./types";
import type { Message } from "../types";

const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

function getAuthHeaders() {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshed = await useAuthStore.getState().refreshAuth();
                if (refreshed) {
                    const token = useAuthStore.getState().accessToken;
                    if (token) {
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    }
                }
            } catch {
                // ignore
            }
            useAuthStore.getState().clear();
        }
        return Promise.reject(error);
    }
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type SearchType = "MESSAGES" | "CONTACTS" | "ALL";

export interface GlobalSearchResult {
    contacts: UserProfile[];
    messages: Message[];
    /** Cursor for next page of message results */
    nextKey?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

// ─── Mapper: MessageDynamo (backend) → Message (frontend) ───────────────────

interface MessageDynamo {
    messageId: string;
    chatRoomId: string;
    senderId: string;
    senderName?: string;
    content: string;
    type: string;
    createdAt: string;
    recalled?: boolean;
    readBy?: string[];
    attachments?: { url: string; name?: string; type?: string; size?: number }[];
}

function mapDynamoToMessage(d: MessageDynamo): Message {
    return {
        id: d.messageId,
        roomId: d.chatRoomId,
        senderId: d.senderId,
        senderName: d.senderName,
        content: d.content || "",
        type: (d.type as Message["type"]) || "TEXT",
        createdAt: d.createdAt,
        isRecall: d.recalled ?? false,
        readBy: d.readBy,
        attachments: d.attachments?.map((a) => ({
            url: a.url,
            type: a.type ?? "DOCUMENT",
            name: a.name ?? "",
            size: a.size ?? 0,
        })),
    };
}

export const searchService = {
    /** Existing per-user search */
    async searchUsers(query: string): Promise<UserProfile[]> {
        const { data } = await api.get<UserProfile[]>("/users/search", {
            headers: getAuthHeaders(),
            params: { q: query },
        });
        return data;
    },

    /**
     * Global search across contacts and/or messages.
     * @param query   Search keyword
     * @param type    'CONTACTS' | 'MESSAGES' | 'ALL'
     * @param lastKey Cursor for message result pagination
     */
    async searchGlobal(
        query: string,
        type: SearchType = "ALL",
        lastKey?: string
    ): Promise<GlobalSearchResult> {
        const headers = getAuthHeaders();
        const result: GlobalSearchResult = { contacts: [], messages: [] };

        if (!query.trim()) return result;

        const fetchContacts = type === "CONTACTS" || type === "ALL";
        const fetchMessages = type === "MESSAGES" || type === "ALL";

        await Promise.all([
            fetchContacts
                ? api
                      .get<UserProfile[]>("/users/search", {
                          headers,
                          params: { q: query },
                      })
                      .then((r) => {
                          result.contacts = r.data;
                      })
                      .catch(() => {})
                : Promise.resolve(),

            fetchMessages
                ? api
                      .get<{ messages: MessageDynamo[]; lastKey?: string; hasMore: boolean }>(
                          "/messages/search",
                          {
                              headers,
                              params: { q: query, limit: 30, lastKey },
                          }
                      )
                      .then((r) => {
                          result.messages = (r.data.messages || []).map(mapDynamoToMessage);
                          result.nextKey = r.data.lastKey;
                      })
                      .catch(() => {})
                : Promise.resolve(),
        ]);

        return result;
    },
};

export default searchService;

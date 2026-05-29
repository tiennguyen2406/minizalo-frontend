import { api } from "@/shared/services/apiClient";
import type { UserProfile } from "./types";
import type { Message } from "../types";

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
        const result: GlobalSearchResult = { contacts: [], messages: [] };

        if (!query.trim()) return result;

        const fetchContacts = type === "CONTACTS" || type === "ALL";
        const fetchMessages = type === "MESSAGES" || type === "ALL";

        await Promise.all([
            fetchContacts
                ? api
                      .get<UserProfile[]>("/users/search", {
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

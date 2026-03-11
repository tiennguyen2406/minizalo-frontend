import axios from "axios";
import { useAuthStore } from "@/shared/store/authStore";

// Type definitions based on backend ChatRoomResponse
export interface UserResponse {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
}

export interface Attachment {
    id: string;
    url: string;
    type: string;
    name: string;
    filename?: string;
    size: number;
}

export interface MessageReaction {
    userId: string;
    emoji: string;
}

export interface MessageDynamo {
    messageId: string;
    chatRoomId: string;
    senderId: string;
    senderName: string;
    content: string;
    attachments: Attachment[];
    type: string;
    createdAt: string;
    replyToMessageId: string;
    read: boolean;
    readBy: string[];
    reactions: MessageReaction[];
    recalled: boolean;
    recalledAt: string;
    pinned: boolean;
}

export interface ChatRoomResponse {
    id: string;
    type: "DIRECT" | "GROUP";
    name: string;
    avatarUrl: string;
    createdBy: UserResponse;
    createdAt: string;
    lastMessage?: MessageDynamo;
    unreadCount: number;
    members: any[]; // Define RoomMemberResponse if needed
}

export interface SearchMessageResponse {
    messages: MessageDynamo[];
    lastKey: string | null;
    hasMore: boolean;
    totalResults: number;
}

// Config Base URL
const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { "Content-Type": "application/json" },
});

// Add interceptor for token
api.interceptors.request.use(async (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Add interceptor for 401 refresh (simplified compared to userService, can copy if needed)
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

export interface PaginatedMessageResult {
    messages: MessageDynamo[];
    lastEvaluatedKey: string | null;
}

export const chatService = {
    getChatRooms: async (): Promise<ChatRoomResponse[]> => {
        console.log("Fetching chat rooms from:", API_BASE_URL + "/chat/rooms");
        try {
            const { data } = await api.get<ChatRoomResponse[]>("/chat/rooms");
            console.log("Chat rooms fetched:", data.length);
            return data;
        } catch (error) {
            console.error("Error fetching chat rooms:", error);
            throw error;
        }
    },

    getChatHistory: async (roomId: string, limit: number = 20, lastKey?: string): Promise<PaginatedMessageResult> => {
        const params: any = { limit };
        if (lastKey) params.lastKey = lastKey;
        const { data } = await api.get<PaginatedMessageResult>(`/chat/history/${roomId}`, { params });
        return data;
    },

    getPinnedMessages: async (roomId: string, limit: number = 20, lastKey?: string): Promise<PaginatedMessageResult> => {
        const params: any = { limit };
        if (lastKey) params.lastKey = lastKey;
        const { data } = await api.get<PaginatedMessageResult>(`/chat/${roomId}/pins`, { params });
        return data;
    },

    sendMessage: async (roomId: string, content: string, replyToMessageId?: string): Promise<MessageDynamo> => {
        const body: any = {
            receiverId: roomId,
            content,
            type: "TEXT",
        };
        if (replyToMessageId) {
            body.replyToMessageId = replyToMessageId;
        }
        const { data } = await api.post<MessageDynamo>("/chat/send", body);
        return data;
    },

    searchMessages: async (roomId: string, query: string, limit: number = 20, lastKey?: string): Promise<SearchMessageResponse> => {
        const params: any = { q: query, limit };
        if (lastKey) params.lastKey = lastKey;
        const { data } = await api.get<SearchMessageResponse>(`/chat/${roomId}/search`, { params });
        return data;
    },
};

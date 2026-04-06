import { api, API_BASE_URL } from "@/shared/services/apiClient";

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

    sendMessage: async (
        roomId: string, 
        content: string, 
        replyToMessageId?: string,
        type: "TEXT" | "IMAGE" | "FILE" | "VIDEO" = "TEXT",
        attachments?: Attachment[]
    ): Promise<MessageDynamo> => {
        const body: any = {
            receiverId: roomId,
            content,
            type,
        };
        if (attachments && attachments.length > 0) {
            body.attachments = attachments;
        }
        if (replyToMessageId) {
            body.replyToMessageId = replyToMessageId;
        }
        const { data } = await api.post<MessageDynamo>("/chat/send", body);
        return data;
    },

    /** Lưu tên gợi nhớ cho phòng chat (1-1). Trả về phòng chat đã cập nhật. */
    saveNickname: async (roomId: string, nickname: string): Promise<ChatRoomResponse> => {
        const { data } = await api.put<ChatRoomResponse>(`/chat/rooms/${roomId}/nickname`, { nickname });
        return data;
    },

    searchMessages: async (roomId: string, query: string, limit: number = 20, lastKey?: string): Promise<SearchMessageResponse> => {
        const params: any = { q: query, limit };
        if (lastKey) params.lastKey = lastKey;
        const { data } = await api.get<SearchMessageResponse>(`/chat/${roomId}/search`, { params });
        return data;
    },
};

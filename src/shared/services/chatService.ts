import { api, API_BASE_URL } from "@/shared/services/apiClient";
import axios from "axios";
import type { ChatRoom, Message } from "@/shared/types";

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
    privacyBlocked?: boolean;
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
    hasInteracted: boolean;
    disbanded?: boolean;
}

export interface SearchMessageResponse {
    messages: MessageDynamo[];
    lastKey: string | null;
    hasMore: boolean;
    totalResults: number;
}

export interface LinkPreviewDto {
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
}

export interface PaginatedMessageResult {
    messages: MessageDynamo[];
    lastEvaluatedKey: string | null;
}

/** Map phòng từ API (sau accept kết bạn / tạo phòng) → model ChatRoom của store. */
export function mapChatRoomResponseToFrontend(room: ChatRoomResponse): ChatRoom {
    const id = String(room.id);
    const type: ChatRoom["type"] = room.type === "GROUP" ? "GROUP" : "PRIVATE";
    const participants: ChatRoom["participants"] = (room.members || []).map((m: any) => ({
        id: m.user?.id != null ? String(m.user.id) : "",
        username: m.user?.username ?? "",
        fullName: m.user?.displayName ?? m.user?.username ?? "",
        avatarUrl: m.user?.avatarUrl,
        businessDescription: m.user?.businessDescription ?? undefined,
    }));
    const updatedAt =
        room.lastMessage?.createdAt ||
        (room.createdAt ? new Date(room.createdAt).toISOString() : new Date().toISOString());
    let resolvedName = room.name;
    if (type === "PRIVATE" && (!resolvedName || !resolvedName.trim())) {
        const partnerParticipant = participants.find((p) => p.fullName && p.fullName.trim());
        resolvedName = partnerParticipant?.fullName || partnerParticipant?.username || "Người dùng";
    }
    const frontendRoom: ChatRoom = {
        id,
        type,
        name: resolvedName || room.name,
        avatarUrl: room.avatarUrl,
        unreadCount: room.unreadCount ?? 0,
        updatedAt,
        participants,
        disbanded: !!room.disbanded,
    };
    if (room.lastMessage) {
        const lm = room.lastMessage as MessageDynamo;
        frontendRoom.lastMessage = {
            id: lm.messageId,
            roomId: id,
            senderId: lm.senderId,
            senderName: lm.senderName,
            content: lm.content || "",
            type: (lm.type as Message["type"]) || "TEXT",
            createdAt: lm.createdAt,
            isRecall: !!lm.recalled,
            attachments: lm.attachments,
        };
    }
    return frontendRoom;
}

export interface ChatSummary {
    roomId: string;
    createdAt: string;
    summaryId: string;
    content: string;
    ttl: number;
}

export const chatService = {
    summarizeChat: async (roomId: string, startTime: string, endTime: string, isUnreadOnly: boolean = false, timezone?: string): Promise<string> => {
        const response = await api.post(`/chat/rooms/${roomId}/ai/summarize`, { startTime, endTime, isUnreadOnly, timezone });
        return response.data.summary;
    },
    getSummaryHistory: async (roomId: string): Promise<ChatSummary[]> => {
        const response = await api.get(`/chat/rooms/${roomId}/ai/history`);
        return response.data;
    },
    askPersona: async (persona: string, question: string): Promise<string> => {
        const response = await api.post(`/chat/rooms/persona-chat`, { persona, question });
        return response.data.answer;
    },
    getChatRooms: async (): Promise<ChatRoomResponse[]> => {
        console.log("Fetching chat rooms from:", API_BASE_URL + "/chat/rooms");
        try {
            const { data } = await api.get<ChatRoomResponse[]>("/chat/rooms");
            console.log("Chat rooms fetched:", data.length);
            return data;
        } catch (error) {
            // 401 is expected when session was revoked on another device/browser.
            // apiClient already handles refresh + clear; avoid noisy error logs.
            if (!axios.isAxiosError(error) || error.response?.status !== 401) {
                console.error("Error fetching chat rooms:", error);
            }
            throw error;
        }
    },

    getChatHistory: async (roomId: string, limit: number = 20, lastKey?: string): Promise<PaginatedMessageResult> => {
        const params: any = { limit };
        if (lastKey) params.lastKey = lastKey;
        const { data } = await api.get<PaginatedMessageResult>(`/chat/history/${roomId}`, { params });
        return data;
    },

    clearChatHistory: async (roomId: string): Promise<void> => {
        await api.delete(`/chat/history/${roomId}`);
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
        type: "TEXT" | "IMAGE" | "FILE" | "VIDEO" | "FOLDER" = "TEXT",
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

    searchMessages: async (
        roomId: string,
        query: string,
        limit: number = 20,
        lastKey?: string,
        filters?: { senderId?: string; fromDate?: string; toDate?: string }
    ): Promise<SearchMessageResponse> => {
        const params: Record<string, string | number> = { limit };
        const tq = (query || "").trim();
        if (tq) params.q = tq;
        if (lastKey) params.lastKey = lastKey;
        if (filters?.senderId) params.senderId = filters.senderId;
        if (filters?.fromDate) params.fromDate = filters.fromDate;
        if (filters?.toDate) params.toDate = filters.toDate;
        const { data } = await api.get<SearchMessageResponse>(`/chat/${roomId}/search`, { params });
        return data;
    },

    getLinkPreview: async (url: string): Promise<LinkPreviewDto> => {
        const { data } = await api.get<LinkPreviewDto>("/link-preview", { params: { url } });
        return data;
    },

    createPrivateRoom: async (userId: string): Promise<ChatRoomResponse> => {
        const { data } = await api.post<ChatRoomResponse>(`/chat/rooms/private/${userId}`);
        return data;
    },

    /** Xóa đoạn chat: xóa toàn bộ tin nhắn + xóa membership của người dùng. */
    deleteRoom: async (roomId: string): Promise<void> => {
        await api.delete(`/chat/rooms/${roomId}`);
    },

    /**
     * Lấy context xung quanh tin nhắn chưa đọc cũ nhất.
     * Dùng cho nút "Tin nhắn chưa đọc" để scroll chính xác bất kể số lượng tin chưa đọc.
     * @returns null nếu không có tin chưa đọc (HTTP 204)
     */
    getUnreadContext: async (
        roomId: string,
        countBefore: number = 5,
        countAfter: number = 15
    ): Promise<UnreadContextResponse | null> => {
        const res = await api.get<UnreadContextResponse>(
            `/chat/${roomId}/unread-context`,
            { params: { countBefore, countAfter } }
        );
        if (res.status === 204 || !res.data) return null;
        return res.data;
    },

    /** Lấy duy nhất tin nhắn chưa đọc cũ nhất */
    getOldestUnreadMessage: async (roomId: string): Promise<MessageDynamo | null> => {
        const ctx = await chatService.getUnreadContext(roomId, 0, 0);
        return ctx?.targetMessage || null;
    },
};

export interface UnreadContextResponse {
    targetMessage: MessageDynamo;
    /** Các tin nhắn MỚI HƠN target – đã đảo ngược, index 0 = gần target nhất */
    messagesAfter: MessageDynamo[];
    /** Các tin nhắn CŨ HƠN target – index 0 = gần target nhất (giảm dần) */
    messagesBefore: MessageDynamo[];
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    /** Index của targetMessage trong mảng FlatList = messagesAfter.length */
    targetIndexInList: number;
}


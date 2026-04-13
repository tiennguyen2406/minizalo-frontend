import { PaginatedMessageResult, SearchMessageResponse, Message } from '../types';
import { api } from "@/shared/services/apiClient";

export const MessageService = {
    getChatHistory: async (roomId: string, limit: number = 20, lastKey?: string): Promise<PaginatedMessageResult> => {
        const response = await api.get<PaginatedMessageResult>(`/chat/history/${roomId}`, {
            params: { limit, lastKey },
        });
        return response.data;
    },

    searchMessages: async (roomId: string, query: string, limit: number = 10, lastKey?: string): Promise<SearchMessageResponse> => {
        const response = await api.get<SearchMessageResponse>(`/chat/${roomId}/search`, {
            params: { q: query, limit, lastKey },
        });
        return response.data;
    },

    recallMessage: async (roomId: string, messageId: string): Promise<void> => {
        await api.post('/messages/recall', { roomId, messageId });
    },

    setReaction: async (roomId: string, messageId: string, emoji: string): Promise<void> => {
        await api.put(`/chat/${roomId}/messages/${messageId}/reactions`, { emoji });
    },

    removeReaction: async (roomId: string, messageId: string): Promise<void> => {
        await api.delete(`/chat/${roomId}/messages/${messageId}/reactions`);
    },

    forwardMessage: async (originalRoomId: string, originalMessageId: string, targetRoomId: string): Promise<Message> => {
        const response = await api.post<Message>('/chat/forward', {
            originalRoomId,
            originalMessageId,
            targetRoomId,
        });
        return response.data;
    },

    uploadFile: async (
        file: File,
        onUploadProgress?: (percent: number) => void,
    ): Promise<{ fileName: string; fileUrl: string; fileType: string; size: number }> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt) => {
                if (!onUploadProgress || !evt.total) return;
                const pct = Math.round((evt.loaded * 100) / evt.total);
                onUploadProgress(Math.min(100, pct));
            },
        });
        return response.data;
    },
};

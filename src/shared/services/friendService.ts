import { api } from "@/shared/services/apiClient";
import type {
    FriendResponseDto,
    MessageResponse,
    SendFriendRequestPayload,
} from "./types";

export const friendService = {
    async sendFriendRequest(payload: SendFriendRequestPayload): Promise<FriendResponseDto> {
        const { data } = await api.post<FriendResponseDto>("/friends/request", payload);
        return data;
    },

    async acceptFriendRequest(requestId: string): Promise<FriendResponseDto> {
        const { data } = await api.post<FriendResponseDto>(
            `/friends/accept/${requestId}`,
            {}
        );
        return data;
    },

    async rejectFriendRequest(requestId: string): Promise<MessageResponse> {
        const { data } = await api.delete<MessageResponse>(
            `/friends/reject/${requestId}`
        );
        return data;
    },

    async deleteFriend(friendId: string): Promise<MessageResponse> {
        const { data } = await api.delete<MessageResponse>(`/friends/${friendId}`);
        return data;
    },

    async getFriends(): Promise<FriendResponseDto[]> {
        const { data } = await api.get<FriendResponseDto[]>("/friends");
        return data;
    },

    async getPendingRequests(): Promise<FriendResponseDto[]> {
        const { data } = await api.get<FriendResponseDto[]>("/friends/requests");
        return data;
    },

    async getSentRequests(): Promise<FriendResponseDto[]> {
        const { data } = await api.get<FriendResponseDto[]>("/friends/requests/sent");
        return data;
    },

    async cancelSentRequest(requestId: string): Promise<MessageResponse> {
        const { data } = await api.delete<MessageResponse>(`/friends/request/${requestId}`);
        return data;
    },

    async blockUser(userId: string): Promise<MessageResponse> {
        const { data } = await api.post<MessageResponse>(
            `/friends/block/${userId}`,
            {}
        );
        return data;
    },

    async unblockUser(userId: string): Promise<MessageResponse> {
        const { data } = await api.delete<MessageResponse>(
            `/friends/block/${userId}`
        );
        return data;
    },

    async getBlockedUsers(): Promise<FriendResponseDto[]> {
        const { data } = await api.get<FriendResponseDto[]>("/friends/blocked");
        return data;
    },

    async checkBlockStatus(userId: string): Promise<{
        blockedByYou: boolean;
        blockedByOther: boolean;
        blockerName: string | null;
    }> {
        const { data } = await api.get(`/friends/block-status/${userId}`);
        return data;
    },
};

export default friendService;



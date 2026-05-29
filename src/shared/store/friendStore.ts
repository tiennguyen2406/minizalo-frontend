import { create } from "zustand";
import friendService, { type AcceptFriendResult } from "@/shared/services/friendService";
import { mapChatRoomResponseToFrontend } from "@/shared/services/chatService";
import { useChatStore } from "@/shared/store/useChatStore";
import type { FriendResponseDto } from "@/shared/services/types";

type FriendState = {
    friends: FriendResponseDto[];
    requests: FriendResponseDto[];
    sentRequests: FriendResponseDto[];
    blockedUsers: FriendResponseDto[];
    /** Web: tín hiệu realtime sau khi chặn/bỏ chặn (để ChatWindow cập nhật ngay). */
    blockSignal: { userId: string; blocked: boolean; nonce: number } | null;
    loading: boolean;
    error: string | null;
    fetchFriends: () => Promise<void>;
    fetchRequests: (opts?: { silent?: boolean }) => Promise<void>;
    fetchSentRequests: () => Promise<void>;
    sendRequest: (
        friendId: string,
        opts?: {
            inviteMessage?: string;
            inviteSource?: string;
            hideMyTimelineFromFriend?: boolean;
        },
    ) => Promise<void>;
    acceptRequest: (requestId: string) => Promise<AcceptFriendResult>;
    rejectRequest: (requestId: string) => Promise<void>;
    cancelSentRequest: (requestId: string) => Promise<void>;
    removeFriend: (friendId: string) => Promise<void>;
    blockUser: (userId: string) => Promise<void>;
    unblockUser: (userId: string) => Promise<void>;
    fetchBlockedUsers: () => Promise<void>;
    clearError: () => void;
    clear: () => void;
};

function extractErrorMessage(e: unknown, fallback: string): string {
    const anyError = e as { response?: { data?: { message?: string } | string } };
    const data = anyError?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (typeof data.message === "string") return data.message;
    return fallback;
}

export const useFriendStore = create<FriendState>((set, get) => ({
    friends: [],
    requests: [],
    sentRequests: [],
    blockedUsers: [],
    blockSignal: null,
    loading: false,
    error: null,

    fetchFriends: async () => {
        set({ loading: true, error: null });
        try {
            const friends = await friendService.getFriends();
            set({ friends, loading: false });
        } catch (e: unknown) {
            set({
                loading: false,
                error: extractErrorMessage(e, "Không tải được danh sách bạn bè."),
            });
        }
    },

    fetchRequests: async (opts?: { silent?: boolean }) => {
        const silent = !!opts?.silent;
        if (!silent) set({ loading: true, error: null });
        try {
            const requests = await friendService.getPendingRequests();
            if (silent) {
                set({ requests });
            } else {
                set({ requests, loading: false });
            }
        } catch (e: unknown) {
            if (!silent) {
                set({
                    loading: false,
                    error: extractErrorMessage(e, "Không tải được lời mời kết bạn."),
                });
            }
        }
    },

    fetchSentRequests: async () => {
        set({ loading: true, error: null });
        try {
            const sentRequests = await friendService.getSentRequests();
            set({ sentRequests, loading: false });
        } catch (e: unknown) {
            set({
                loading: false,
                error: extractErrorMessage(e, "Không tải được các lời mời đã gửi."),
            });
        }
    },

    sendRequest: async (
        friendId: string,
        opts?: {
            inviteMessage?: string;
            inviteSource?: string;
            hideMyTimelineFromFriend?: boolean;
        },
    ) => {
        set({ error: null });
        try {
            const created = await friendService.sendFriendRequest({
                friendId,
                inviteMessage: opts?.inviteMessage,
                inviteSource: opts?.inviteSource,
                hideMyTimelineFromFriend: opts?.hideMyTimelineFromFriend,
            });
            set({
                sentRequests: [...get().sentRequests, created],
            });
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Gửi lời mời kết bạn thất bại."),
            });
            throw e;
        }
    },

    acceptRequest: async (requestId: string) => {
        set({ error: null });
        try {
            const result = await friendService.acceptFriendRequest(requestId);
            set({
                requests: get().requests.filter((r) => r.id !== requestId),
                friends: [...get().friends, result.friendship],
            });
            if (result.chatRoom) {
                const room = mapChatRoomResponseToFrontend(result.chatRoom);
                const chat = useChatStore.getState();
                chat.upsertRoom(room);
                const sender = result.friendship.user;
                const partnerName =
                    sender.displayName?.trim() ||
                    sender.username ||
                    "Bạn bè";
                chat.markFriendshipWelcome(room.id, partnerName);
                chat.setPendingOpenRoomId(room.id);
            }
            return result;
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Chấp nhận lời mời kết bạn thất bại."),
            });
            throw e;
        }
    },

    rejectRequest: async (requestId: string) => {
        set({ error: null });
        try {
            await friendService.rejectFriendRequest(requestId);
            set({
                requests: get().requests.filter((r) => r.id !== requestId),
            });
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Từ chối lời mời kết bạn thất bại."),
            });
            throw e;
        }
    },

    cancelSentRequest: async (requestId: string) => {
        set({ error: null });
        try {
            await friendService.cancelSentRequest(requestId);
            set({
                sentRequests: get().sentRequests.filter((r) => r.id !== requestId),
            });
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Hủy lời mời kết bạn thất bại."),
            });
            throw e;
        }
    },

    removeFriend: async (friendId: string) => {
        set({ error: null });
        try {
            await friendService.deleteFriend(friendId);
            set({
                friends: get().friends.filter(
                    (f) => f.user.id !== friendId && f.friend.id !== friendId
                ),
            });
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Xóa bạn thất bại."),
            });
            throw e;
        }
    },

    blockUser: async (userId: string) => {
        set({ error: null });
        try {
            await friendService.blockUser(userId);
            // Do NOT remove from friends list - friendship is preserved
            // Just reload blocked users list
            try {
                const blockedUsers = await friendService.getBlockedUsers();
                set((state) => ({ blockedUsers, blockSignal: { userId, blocked: true, nonce: (state.blockSignal?.nonce ?? 0) + 1 } }));
            } catch {
                // ignore reload error
                set((state) => ({ blockSignal: { userId, blocked: true, nonce: (state.blockSignal?.nonce ?? 0) + 1 } }));
            }
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Chặn người dùng thất bại."),
            });
            throw e;
        }
    },

    unblockUser: async (userId: string) => {
        set({ error: null });
        try {
            await friendService.unblockUser(userId);
            set((state) => ({
                blockedUsers: state.blockedUsers.filter((f) => f.friend.id !== userId),
                blockSignal: { userId, blocked: false, nonce: (state.blockSignal?.nonce ?? 0) + 1 },
            }));
        } catch (e: unknown) {
            set({
                error: extractErrorMessage(e, "Bỏ chặn người dùng thất bại."),
            });
            throw e;
        }
    },

    fetchBlockedUsers: async () => {
        set({ loading: true, error: null });
        try {
            const blockedUsers = await friendService.getBlockedUsers();
            set({ blockedUsers, loading: false });
        } catch (e: unknown) {
            set({
                loading: false,
                error: extractErrorMessage(e, "Không tải được danh sách chặn."),
            });
        }
    },

    clearError: () => set({ error: null }),

    clear: () => set({
        friends: [],
        requests: [],
        sentRequests: [],
        blockedUsers: [],
        blockSignal: null,
        loading: false,
        error: null,
    }),
}));


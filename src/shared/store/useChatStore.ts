import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types';
import { useAuthStore } from './authStore';

/** Decode JWT payload để lấy user ID (sub) mà không cần import thư viện */
function getMyUserIdFromToken(): string | null {
    try {
        const token = useAuthStore.getState().accessToken;
        if (!token) return null;
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const payload = JSON.parse(json);
        // 'sub' is the user ID in our JWT
        return payload.sub || payload.userId || null;
    } catch {
        return null;
    }
}

function getScopedKey(suffix: string): string {
    const userId = useAuthStore.getState().user?.id || getMyUserIdFromToken() || 'anonymous';
    return `minizalo:${userId}:${suffix}`;
}

const isWeb = Platform.OS === 'web';

const _mobileCache = new Map<string, Set<string>>();

function safeLoadSet(key: string): Set<string> {
    if (isWeb) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return new Set<string>();
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return new Set<string>();
            return new Set(arr.filter((x) => typeof x === 'string' && x.length > 0));
        } catch {
            return new Set<string>();
        }
    }
    return _mobileCache.get(key) || new Set<string>();
}

function safeSaveSet(key: string, value: Set<string>) {
    if (isWeb) {
        try {
            localStorage.setItem(key, JSON.stringify([...value]));
        } catch { /* ignore */ }
    } else {
        _mobileCache.set(key, value);
        AsyncStorage.setItem(key, JSON.stringify([...value])).catch(() => {});
    }
}

function mobileRehydrateSet(key: string): Promise<Set<string>> {
    return AsyncStorage.getItem(key).then((raw) => {
        if (!raw) return new Set<string>();
        try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return new Set<string>();
            const s = new Set(arr.filter((x: unknown) => typeof x === 'string' && (x as string).length > 0));
            _mobileCache.set(key, s);
            return s;
        } catch {
            return new Set<string>();
        }
    }).catch(() => new Set<string>());
}

interface ChatState {
    messages: Record<string, Message[]>; // roomId -> messages
    rooms: import('../types').ChatRoom[];
    typingUsers: Record<string, string[]>; // roomId -> userIds
    currentRoomId: string | null;
    pinnedRooms: Set<string>; // roomIds that are pinned to top
    mutedRooms: Set<string>; // roomIds that are muted
    roomPagination: Record<string, { lastKey: string | null, hasMore: boolean, loading: boolean }>; 

    highlightedMessageId: string | null;

    /** Web: sau accept kết bạn từ Danh bạ → mở tab Tin nhắn đúng phòng. */
    pendingOpenRoomId: string | null;
    /** Web: mở panel Thông tin hội thoại sau khi mở chat từ tìm SĐT (giống Zalo). */
    pendingOpenDirectInfoRoomId: string | null;
    /** roomId → tên hiển thị đối phương cho thẻ chào bạn mới. */
    friendshipWelcomeByRoomId: Record<string, string>;
    /**
     * Mobile: đồng bộ khi server từ chối tin (người lạ) — ChatScreen merge vào state local.
     * Web: cập nhật trực tiếp `messages` trong store, signal chỉ để trigger effect nếu cần.
     */
    strangerRejectionSignal: { roomId: string; text: string; nonce: number } | null;
    uploadProgressByRoom: Record<string, { progress: number; text: string; active: boolean }>;

    // Actions
    setRooms: (rooms: import('../types').ChatRoom[]) => void;
    upsertRoom: (room: import('../types').ChatRoom) => void;
    setCurrentRoom: (roomId: string | null) => void;
    addMessage: (roomId: string, message: Message) => void;
    setMessages: (roomId: string, messages: Message[]) => void;
    prependMessages: (roomId: string, messages: Message[]) => void;
    updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => void;
    setTyping: (roomId: string, userId: string, isTyping: boolean) => void;
    clearTyping: (roomId: string) => void;
    markRoomAsRead: (roomId: string) => void;
    markRoomAsUnread: (roomId: string, count?: number) => void;
    togglePinRoom: (roomId: string) => void;
    toggleMuteRoom: (roomId: string) => void;
    clearConversation: (roomId: string) => Promise<void>;
    setHighlightedMessageId: (messageId: string | null) => void;
    setPendingOpenRoomId: (roomId: string | null) => void;
    setPendingOpenDirectInfoRoomId: (roomId: string | null) => void;
    markFriendshipWelcome: (roomId: string, partnerDisplayName: string) => void;
    clearFriendshipWelcome: (roomId: string) => void;
    /** Gỡ tin optimistic (temp-*) của tôi, thêm dòng SYSTEM (chính sách chỉ bạn bè). */
    applyStrangerMessageRejection: (roomId: string, text: string) => void;
    setUploadProgress: (
        roomId: string,
        payload: { progress: number; text: string; active?: boolean } | null
    ) => void;
    createPrivateRoom: (userId: string) => Promise<import('../types').ChatRoom>;
    deleteRoom: (roomId: string) => Promise<void>;
    setRoomPagination: (roomId: string, paging: { lastKey: string | null, hasMore: boolean, loading?: boolean }) => void;
    loadMoreMessages: (roomId: string) => Promise<void>;
    clear: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: {},
    rooms: [],
    typingUsers: {},
    currentRoomId: null,
    pinnedRooms: safeLoadSet(getScopedKey('pinnedRooms')),
    mutedRooms: safeLoadSet(getScopedKey('mutedRooms')),
    roomPagination: {},
    highlightedMessageId: null,
    pendingOpenRoomId: null,
    pendingOpenDirectInfoRoomId: null,
    friendshipWelcomeByRoomId: {},
    strangerRejectionSignal: null,
    uploadProgressByRoom: {},

    setRooms: (rooms) => set({ rooms }),

    upsertRoom: (room) => set((state) => {
        const existingIndex = state.rooms.findIndex(r => r.id === room.id);
        if (existingIndex >= 0) {
            const newRooms = [...state.rooms];
            newRooms[existingIndex] = { ...newRooms[existingIndex], ...room };
            // Sort by updatedAt desc
            newRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            return { rooms: newRooms };
        } else {
            return { rooms: [room, ...state.rooms] };
        }
    }),

    setCurrentRoom: (roomId) => set((state) => {
        if (!roomId) return { currentRoomId: null };
        const newRooms = state.rooms.map(room => 
            room.id === roomId ? { ...room, unreadCount: 0 } : room
        );
        return { currentRoomId: roomId, rooms: newRooms };
    }),

    addMessage: (roomId, message) => set((state) => {
        const roomMessages = state.messages[roomId] || [];
        // Prevent duplicates by ID
        if (roomMessages.some(m => m.id === message.id)) return state;

        // Bỏ tin nhắn optimistic (temp-*) của sender khi nhận được real message
        let filteredMessages = [...roomMessages];
        if (message.id && !message.id.startsWith('temp-')) {
            const tempIdx = filteredMessages.findIndex(m => m.id && m.id.startsWith('temp-') && m.senderId === message.senderId);
            if (tempIdx !== -1) {
                // Xóa tin nhắn temp đầu tiên tìm thấy
                filteredMessages.splice(tempIdx, 1);
            }
        }

        // Lấy userId từ JWT token (an toàn hơn user?.id có thể null)
        const currentUserId = useAuthStore.getState().user?.id || getMyUserIdFromToken();

        const newRooms = state.rooms.map((room) => {
            if (room.id === roomId) {
                // Chỉ set unreadCount > 0 nếu:
                // 1. Không phải phòng đang mở (currentRoomId)
                // 2. Không phải tin nhắn nháp (temp-)
                // 3. Không phải tin nhắn do chính user gửi
                const isTemp = message.id && message.id.startsWith('temp-');
                const isMine = currentUserId != null && message.senderId === currentUserId;
                const isUnread = state.currentRoomId !== roomId && !isTemp && !isMine;
                
                console.log(`[Store] addMessage room=${roomId} isUnread=${isUnread} | currentRoom=${state.currentRoomId} sender=${message.senderId} me=${currentUserId}`);
                
                return {
                    ...room,
                    lastMessage: message,
                    updatedAt: message.createdAt || new Date().toISOString(),
                    unreadCount: isUnread ? (room.unreadCount || 0) + 1 : room.unreadCount
                };
            }
            return room;
        });

        newRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return {
            messages: {
                ...state.messages,
                [roomId]: [...filteredMessages, message],
            },
            rooms: newRooms,
        };
    }),

    setMessages: (roomId, messages) => set((state) => ({
        messages: {
            ...state.messages,
            [roomId]: messages,
        },
    })),

    prependMessages: (roomId, messages) => set((state) => ({
        messages: {
            ...state.messages,
            [roomId]: [...messages, ...(state.messages[roomId] || [])],
        },
    })),

    updateMessage: (roomId, messageId, updates) => set((state) => {
        const roomMessages = state.messages[roomId] || [];
        const newMessages = roomMessages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
        );
        return {
            messages: {
                ...state.messages,
                [roomId]: newMessages,
            },
        };
    }),

    setTyping: (roomId, userId, isTyping) => set((state) => {
        const currentTyping = state.typingUsers[roomId] || [];
        let newTyping = [...currentTyping];

        if (isTyping) {
            if (!newTyping.includes(userId)) {
                newTyping.push(userId);
            }
        } else {
            newTyping = newTyping.filter(id => id !== userId);
        }

        return {
            typingUsers: {
                ...state.typingUsers,
                [roomId]: newTyping,
            },
        };
    }),

    clearTyping: (roomId) => set((state) => ({
        typingUsers: {
            ...state.typingUsers,
            [roomId]: [],
        },
    })),

    markRoomAsRead: (roomId) => set((state) => {
        const room = state.rooms.find(r => r.id === roomId);
        if (!room || room.unreadCount === 0) return state;
        const newRooms = state.rooms.map(r =>
            r.id === roomId ? { ...r, unreadCount: 0 } : r
        );
        return { rooms: newRooms };
    }),

    markRoomAsUnread: (roomId, count = 1) => set((state) => {
        const newRooms = state.rooms.map((r) => {
            if (r.id !== roomId) return r;
            const nextCount = Math.max(count, r.unreadCount || 0, 1);
            return { ...r, unreadCount: nextCount };
        });
        return { rooms: newRooms };
    }),

    togglePinRoom: (roomId) => set((state) => {
        const next = new Set(state.pinnedRooms);
        if (next.has(roomId)) { next.delete(roomId); } else { next.add(roomId); }
        safeSaveSet(getScopedKey('pinnedRooms'), next);
        return { pinnedRooms: next };
    }),

    toggleMuteRoom: (roomId) => set((state) => {
        const next = new Set(state.mutedRooms);
        if (next.has(roomId)) { next.delete(roomId); } else { next.add(roomId); }
        safeSaveSet(getScopedKey('mutedRooms'), next);
        return { mutedRooms: next };
    }),

    clearConversation: async (roomId) => {
        set((state) => {
            const nextRooms = state.rooms.map((r) => {
                if (r.id !== roomId) return r;
                return { ...r, unreadCount: 0, lastMessage: undefined };
            });
            return {
                messages: { ...state.messages, [roomId]: [] },
                rooms: nextRooms,
            };
        });
        try {
            const { chatService } = await import('../services/chatService');
            await chatService.clearChatHistory(roomId);
        } catch (e) {
            console.error('Failed to clear chat history on server:', e);
        }
    },

    setHighlightedMessageId: (messageId) => set({ highlightedMessageId: messageId }),

    setPendingOpenRoomId: (roomId) => set({ pendingOpenRoomId: roomId }),

    setPendingOpenDirectInfoRoomId: (roomId) =>
        set({ pendingOpenDirectInfoRoomId: roomId }),

    markFriendshipWelcome: (roomId, partnerDisplayName) =>
        set((state) => ({
            friendshipWelcomeByRoomId: {
                ...state.friendshipWelcomeByRoomId,
                [roomId]: partnerDisplayName,
            },
        })),

    clearFriendshipWelcome: (roomId) =>
        set((state) => {
            const next = { ...state.friendshipWelcomeByRoomId };
            delete next[roomId];
            return { friendshipWelcomeByRoomId: next };
        }),

    applyStrangerMessageRejection: (roomId, text) =>
        set((state) => {
            const currentUserId =
                useAuthStore.getState().user?.id || getMyUserIdFromToken();
            const roomMessages = state.messages[roomId] || [];
            const filtered = roomMessages.filter(
                (m) =>
                    !(
                        m.id?.startsWith('temp-') &&
                        currentUserId != null &&
                        m.senderId === currentUserId
                    )
            );
            const systemMsg: Message = {
                id: `sys-stranger-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                senderId: 'system',
                roomId,
                content: text,
                type: 'SYSTEM',
                createdAt: new Date().toISOString(),
            };
            const nextNonce = (state.strangerRejectionSignal?.nonce ?? 0) + 1;
            const newRooms = state.rooms.map((room) => {
                if (room.id !== roomId) return room;
                return {
                    ...room,
                    lastMessage: systemMsg,
                    updatedAt: systemMsg.createdAt,
                };
            });
            newRooms.sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            return {
                messages: { ...state.messages, [roomId]: [...filtered, systemMsg] },
                rooms: newRooms,
                strangerRejectionSignal: { roomId, text, nonce: nextNonce },
            };
        }),

    setUploadProgress: (roomId, payload) =>
        set((state) => {
            const next = { ...state.uploadProgressByRoom };
            if (!payload) {
                delete next[roomId];
                return { uploadProgressByRoom: next };
            }
            next[roomId] = {
                progress: payload.progress,
                text: payload.text,
                active: payload.active ?? true,
            };
            return { uploadProgressByRoom: next };
        }),

    createPrivateRoom: async (userId) => {
        const { chatService } = await import('../services/chatService');
        const room = await chatService.createPrivateRoom(userId);

        const members = (room.members || []) as any[];
        const partnerMember = members.find((m: any) => m.user?.id === userId);
        const pu = partnerMember?.user;
        const resolvedName =
            (typeof room.name === 'string' && room.name.trim()) ||
            (pu?.displayName && String(pu.displayName).trim()) ||
            (pu?.username && String(pu.username).trim()) ||
            'Chat';

        // Map backend ChatRoomResponse to frontend ChatRoom type if needed
        const frontendRoom: import('../types').ChatRoom = {
            id: room.id,
            type: room.type === 'DIRECT' ? 'PRIVATE' : room.type,
            name: resolvedName,
            avatarUrl: room.avatarUrl,
            unreadCount: room.unreadCount || 0,
            updatedAt: new Date().toISOString(), // Fallback
            participants: (room.members || []).map((m: any) => ({
                id: m.user.id,
                username: m.user.username,
                fullName: m.user.displayName,
                avatarUrl: m.user.avatarUrl,
                businessDescription: m.user?.businessDescription ?? undefined,
            }))
        };

        if (room.lastMessage) {
            frontendRoom.lastMessage = {
                id: room.lastMessage.messageId,
                roomId: room.lastMessage.chatRoomId,
                senderId: room.lastMessage.senderId,
                senderName: room.lastMessage.senderName,
                content: room.lastMessage.content,
                attachments: room.lastMessage.attachments,
                type: room.lastMessage.type as any,
                createdAt: room.lastMessage.createdAt,
                isRecall: room.lastMessage.recalled
            };
            frontendRoom.updatedAt = room.lastMessage.createdAt;
        }

        // Đã filter ở ChatListScreen nên cứ upsert bình thường để store có dữ liệu
        get().upsertRoom(frontendRoom);
        return frontendRoom;
    },

    deleteRoom: async (roomId) => {
        // 1. Xóa khỏi store ngay lập tức (optimistic UI)
        set((state) => ({
            rooms: state.rooms.filter((r) => r.id !== roomId),
            messages: Object.fromEntries(
                Object.entries(state.messages).filter(([id]) => id !== roomId)
            ),
        }));
        // 2. Gọi API backend
        try {
            const { chatService } = await import('../services/chatService');
            await chatService.deleteRoom(roomId);
        } catch (e) {
            console.error('Failed to delete chat room on server:', e);
        }
    },

    setRoomPagination: (roomId, paging) => set((state) => ({
        roomPagination: {
            ...state.roomPagination,
            [roomId]: {
                ...state.roomPagination[roomId],
                ...paging,
                loading: paging.loading ?? (state.roomPagination[roomId]?.loading || false)
            }
        }
    })),

    loadMoreMessages: async (roomId) => {
        const state = get();
        const paging = state.roomPagination[roomId] || { lastKey: null, hasMore: true, loading: false };
        
        if (paging.loading || !paging.hasMore) return;
        
        state.setRoomPagination(roomId, { ...paging, loading: true });
        
        try {
            const { chatService } = await import('../services/chatService');
            const result = await chatService.getChatHistory(roomId, 20, paging.lastKey || undefined);
            
            // Convert backend format to frontend format
            const frontendMessages: Message[] = (result.messages || []).map(m => ({
                id: m.messageId,
                roomId: m.chatRoomId,
                senderId: m.senderId,
                senderName: m.senderName,
                content: m.content,
                attachments: m.attachments,
                type: m.type as any,
                createdAt: m.createdAt,
                isRecall: m.recalled
            }));

            // Prepend new (older) messages
            state.prependMessages(roomId, frontendMessages);
            
            state.setRoomPagination(roomId, {
                lastKey: result.lastEvaluatedKey,
                hasMore: result.lastEvaluatedKey != null,
                loading: false
            });
        } catch (error) {
            console.error("Load more messages failed:", error);
            state.setRoomPagination(roomId, { ...paging, loading: false });
        }
    },

    clear: () => set({
        messages: {},
        rooms: [],
        typingUsers: {},
        currentRoomId: null,
        pinnedRooms: safeLoadSet(getScopedKey('pinnedRooms')),
        mutedRooms: safeLoadSet(getScopedKey('mutedRooms')),
        roomPagination: {},
        highlightedMessageId: null,
        pendingOpenRoomId: null,
        pendingOpenDirectInfoRoomId: null,
        friendshipWelcomeByRoomId: {},
        strangerRejectionSignal: null,
        uploadProgressByRoom: {},
    }),
}));

// Khi user/token thay đổi (logout/login), nạp lại pinned/muted theo scope mới.
{
    let prevScope = `${useAuthStore.getState().user?.id || ''}|${useAuthStore.getState().accessToken || ''}`;
    useAuthStore.subscribe((s) => {
        const nextScope = `${s.user?.id || ''}|${s.accessToken || ''}`;
        if (nextScope === prevScope) return;
        prevScope = nextScope;
        if (isWeb) {
            const pinnedRooms = safeLoadSet(getScopedKey('pinnedRooms'));
            const mutedRooms = safeLoadSet(getScopedKey('mutedRooms'));
            useChatStore.setState({ pinnedRooms, mutedRooms });
        } else {
            Promise.all([
                mobileRehydrateSet(getScopedKey('pinnedRooms')),
                mobileRehydrateSet(getScopedKey('mutedRooms')),
            ]).then(([pinnedRooms, mutedRooms]) => {
                useChatStore.setState({ pinnedRooms, mutedRooms });
            });
        }
    });
}

// Mobile: rehydrate ngay khi module load
if (!isWeb) {
    Promise.all([
        mobileRehydrateSet(getScopedKey('pinnedRooms')),
        mobileRehydrateSet(getScopedKey('mutedRooms')),
    ]).then(([pinnedRooms, mutedRooms]) => {
        useChatStore.setState({ pinnedRooms, mutedRooms });
    });
}

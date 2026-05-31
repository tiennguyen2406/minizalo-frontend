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

/** Tránh ghi đè pinned/muted trong RAM bởi đọc AsyncStorage chậm sau khi user vừa bật/tắt (race). */
let lastChatPrefsMutationAt = 0;

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
    hiddenRooms: Set<string>; // roomIds hidden from main chat list
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
    /** Merge rooms từ API, giữ unreadCount cao nhất (tránh race condition WS + poll). */
    mergeRooms: (rooms: import('../types').ChatRoom[]) => void;
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
    toggleHiddenRoom: (roomId: string) => void;
    isRoomHidden: (roomId: string | null | undefined) => boolean;
    /** Phòng có đang tắt thông báo (so khớp id đã chuẩn hóa string). */
    isRoomMuted: (roomId: string | null | undefined) => boolean;
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
    /** Chỉ xóa local (dùng cho realtime ROOM_REMOVED) */
    removeRoomLocal: (roomId: string) => void;
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
    hiddenRooms: safeLoadSet(getScopedKey('hiddenRooms')),
    roomPagination: {},
    highlightedMessageId: null,
    pendingOpenRoomId: null,
    pendingOpenDirectInfoRoomId: null,
    friendshipWelcomeByRoomId: {},
    strangerRejectionSignal: null,
    uploadProgressByRoom: {},
    /** Track IDs of messages already seen per room (max 100) — tạch khỏi messages[] để tránh false duplicate */
    _seenMsgIds: {} as Record<string, Set<string>>,

    setRooms: (rooms) => set({ rooms }),

    /** Merge rooms từ API vào store, giữ unreadCount cao nhất giữa store và server.
     *  Không xóa các room đã có trong store nhưng chưa có trong API (VD: synthetic room từ WebSocket).
     */
    mergeRooms: (newRooms) => set((state) => {
        const apiIds = new Set(newRooms.map((r) => String(r.id)));

        const merged = newRooms.map((r) => {
            const ridStr = String(r.id);
            const existing = state.rooms.find((er) => String(er.id) === ridStr);
            
            let finalUnread = r.unreadCount ?? 0;

            // Nếu đang mở đúng phòng này, ép unreadCount về 0 bất kể server nói gì
            if (state.currentRoomId && String(state.currentRoomId) === ridStr) {
                finalUnread = 0;
            }

            return {
                ...r,
                unreadCount: finalUnread,
            };
        });

        const storeOnlyRooms = state.rooms.filter((r) => !apiIds.has(String(r.id)));
        const all = [...merged, ...storeOnlyRooms];
        all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return { rooms: all };
    }),

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
        if (!roomId) {
            // Khi thoát phòng: xóa messages và seenMsgIds của phòng đó khỏi store.
            // Mobile ChatScreen dùng useState riêng nên không bị ảnh hưởng.
            // Xóa seenMsgIds để đảm bảo lần sau WS message không bị block bởi false duplicate.
            if (state.currentRoomId) {
                const prevRoomId = String(state.currentRoomId);
                const newMessages = { ...state.messages };
                delete newMessages[prevRoomId];
                const newSeen = { ...(state as any)._seenMsgIds };
                delete newSeen[prevRoomId];
                return { currentRoomId: null, messages: newMessages, _seenMsgIds: newSeen };
            }
            return { currentRoomId: null };
        }
        const idNorm = String(roomId);
        const newRooms = state.rooms.map(room =>
            String(room.id) === idNorm ? { ...room, unreadCount: 0 } : room
        );
        return { currentRoomId: roomId, rooms: newRooms };
    }),

    addMessage: (roomId, message) => set((state) => {
        const roomIdNorm = String(roomId);

        // Duplicate check dùng _seenMsgIds (nhẹ và không bị stale sau khi xóa messages)
        const seenMap = (state as any)._seenMsgIds as Record<string, Set<string>>;
        const seenSet: Set<string> = seenMap[roomIdNorm] || new Set<string>();
        const msgId = message.id || '';
        if (msgId && seenSet.has(msgId)) {
            console.log(`[addMessage] DUPLICATE blocked roomId=${roomId} msgId=${msgId}`);
            return state;
        }

        // Update seenMsgIds (giới hạn 100 entries để tránh memory leak)
        const newSeen = new Set(seenSet);
        if (msgId) {
            newSeen.add(msgId);
            if (newSeen.size > 100) {
                // Xóa entry củ nhất
                const firstKey = newSeen.values().next().value;
                if (firstKey) newSeen.delete(firstKey);
            }
        }

        // Bỏ tin nhắn optimistic (temp-*) của sender khi nhận được real message
        const roomMessages = state.messages[roomIdNorm] || state.messages[roomId] || [];
        let filteredMessages = [...roomMessages];
        if (message.id && !message.id.startsWith('temp-')) {
            const tempIdx = filteredMessages.findIndex(m =>
                m.id &&
                m.id.startsWith('temp-') &&
                String(m.senderId) === String(message.senderId),
            );
            if (tempIdx !== -1) {
                // Xóa tin nhắn temp đầu tiên tìm thấy
                filteredMessages.splice(tempIdx, 1);
            }
        }

        // Lấy userId từ JWT token (an toàn hơn user?.id có thể null)
        const currentUserIdRaw = useAuthStore.getState().user?.id || getMyUserIdFromToken();
        const currentUserId = currentUserIdRaw != null ? String(currentUserIdRaw).toLowerCase() : null;
        // Normalize senderId to lowercase for case-insensitive UUID comparison
        const senderNorm = message.senderId != null ? String(message.senderId).toLowerCase() : '';

        const msgTypeUpper = String(message.type || '').toUpperCase();
        const isNoiseMessage =
            msgTypeUpper === 'SYSTEM' ||
            msgTypeUpper === 'PIN_NOTIFICATION' ||
            message.senderId === 'system';

        let newRooms = state.rooms.map((room) => {
            // So khớp id phòng chuẩn hóa string (tránh lệch UUID / nhóm không tăng unread)
            if (String(room.id) !== roomIdNorm) {
                return room;
            }
                // Chỉ set unreadCount > 0 nếu:
                // 1. Không phải phòng đang mở (currentRoomId)
                // 2. Không phải tin nhắn nháp (temp-)
                // 3. Không phải tin nhắn do chính user gửi
                // 4. Không phải tin hệ thống / ghim (không đếm badge)
                const isTemp = message.id && message.id.startsWith('temp-');
                // If currentUserId is null (not yet loaded), treat as NOT mine to avoid missing badge
                const isMine = currentUserId != null && senderNorm !== '' && senderNorm === currentUserId;
                const currentOpen = state.currentRoomId != null ? String(state.currentRoomId) : null;
                const isUnread =
                    currentOpen !== roomIdNorm && !isTemp && !isMine && !isNoiseMessage;
                
                return {
                    ...room,
                    lastMessage: message,
                    updatedAt: message.createdAt || new Date().toISOString(),
                    unreadCount: isUnread ? (room.unreadCount || 0) + 1 : room.unreadCount
                };
        });

        const hadRoom = state.rooms.some((r) => String(r.id) === roomIdNorm);
        if (!hadRoom) {
            const isTemp = message.id && message.id.startsWith('temp-');
            const isMine = currentUserId != null && senderNorm !== '' && senderNorm === currentUserId;
            const currentOpen = state.currentRoomId != null ? String(state.currentRoomId) : null;
            const isUnread =
                currentOpen !== roomIdNorm && !isTemp && !isMine && !isNoiseMessage;
            const synthetic: import('../types').ChatRoom = {
                id: roomIdNorm,
                name: 'Nhóm chat',
                type: 'GROUP',
                lastMessage: message,
                unreadCount: isUnread ? 1 : 0,
                participants: [],
                updatedAt: message.createdAt || new Date().toISOString(),
            };
            newRooms = [...newRooms, synthetic];
        }

        newRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return {
            messages: {
                ...state.messages,
                [roomIdNorm]: [...filteredMessages, message],
            },
            rooms: newRooms,
            _seenMsgIds: {
                ...(state as any)._seenMsgIds,
                [roomIdNorm]: newSeen,
            },
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
        const id = String(roomId);
        const room = state.rooms.find((r) => String(r.id) === id);
        if (!room || room.unreadCount === 0) {
            return {};
        }
        // Cập nhật ngay lập tức count về 0 trong danh sách rooms
        const newRooms = state.rooms.map((r) =>
            String(r.id) === id ? { ...r, unreadCount: 0 } : r
        );
        return { rooms: newRooms };
    }),

    markRoomAsUnread: (roomId, count = 1) => set((state) => {
        const id = String(roomId);
        const newRooms = state.rooms.map((r) => {
            if (String(r.id) !== id) return r;
            const nextCount = Math.max(count, r.unreadCount || 0, 1);
            return { ...r, unreadCount: nextCount };
        });
        return { rooms: newRooms };
    }),

    togglePinRoom: (roomId) => set((state) => {
        lastChatPrefsMutationAt = Date.now();
        const id = String(roomId);
        const next = new Set<string>();
        for (const x of state.pinnedRooms) next.add(String(x));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        safeSaveSet(getScopedKey('pinnedRooms'), next);
        return { pinnedRooms: next };
    }),

    toggleMuteRoom: (roomId) => set((state) => {
        lastChatPrefsMutationAt = Date.now();
        const id = String(roomId);
        const next = new Set<string>();
        for (const x of state.mutedRooms) {
            next.add(String(x));
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        safeSaveSet(getScopedKey('mutedRooms'), next);
        return { mutedRooms: next };
    }),

    toggleHiddenRoom: (roomId) => set((state) => {
        lastChatPrefsMutationAt = Date.now();
        const id = String(roomId);
        const next = new Set<string>();
        for (const x of state.hiddenRooms) next.add(String(x));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        safeSaveSet(getScopedKey('hiddenRooms'), next);
        return { hiddenRooms: next };
    }),

    isRoomMuted: (roomId) => {
        if (roomId == null || roomId === '') return false;
        return get().mutedRooms.has(String(roomId));
    },

    isRoomHidden: (roomId) => {
        if (roomId == null || roomId === '') return false;
        return get().hiddenRooms.has(String(roomId));
    },

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

    removeRoomLocal: (roomId) => {
        set((state) => ({
            rooms: state.rooms.filter((r) => r.id !== roomId),
            messages: Object.fromEntries(
                Object.entries(state.messages).filter(([id]) => id !== roomId)
            ),
            currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
        }));
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
        hiddenRooms: safeLoadSet(getScopedKey('hiddenRooms')),
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
            const hiddenRooms = safeLoadSet(getScopedKey('hiddenRooms'));
            useChatStore.setState({ pinnedRooms, mutedRooms, hiddenRooms });
        } else {
            const fetchStarted = Date.now();
            Promise.all([
                mobileRehydrateSet(getScopedKey('pinnedRooms')),
                mobileRehydrateSet(getScopedKey('mutedRooms')),
                mobileRehydrateSet(getScopedKey('hiddenRooms')),
            ]).then(([pinnedRooms, mutedRooms, hiddenRooms]) => {
                if (lastChatPrefsMutationAt > fetchStarted) return;
                const mutedNorm = new Set([...mutedRooms].map((x) => String(x)));
                const hiddenNorm = new Set([...hiddenRooms].map((x) => String(x)));
                useChatStore.setState({ pinnedRooms, mutedRooms: mutedNorm, hiddenRooms: hiddenNorm });
            });
        }
    });
}

// Mobile: rehydrate ngay khi module load
if (!isWeb) {
    const initialRehydrateStarted = Date.now();
    Promise.all([
        mobileRehydrateSet(getScopedKey('pinnedRooms')),
        mobileRehydrateSet(getScopedKey('mutedRooms')),
        mobileRehydrateSet(getScopedKey('hiddenRooms')),
    ]).then(([pinnedRooms, mutedRooms, hiddenRooms]) => {
        if (lastChatPrefsMutationAt > initialRehydrateStarted) return;
        const mutedNorm = new Set([...mutedRooms].map((x) => String(x)));
        const hiddenNorm = new Set([...hiddenRooms].map((x) => String(x)));
        useChatStore.setState({ pinnedRooms, mutedRooms: mutedNorm, hiddenRooms: hiddenNorm });
    });
}

import { create } from 'zustand';
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

interface ChatState {
    messages: Record<string, Message[]>; // roomId -> messages
    rooms: import('../types').ChatRoom[];
    typingUsers: Record<string, string[]>; // roomId -> userIds
    currentRoomId: string | null;
    pinnedRooms: Set<string>; // roomIds that are pinned to top
    mutedRooms: Set<string>; // roomIds that are muted

    highlightedMessageId: string | null;

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
    togglePinRoom: (roomId: string) => void;
    toggleMuteRoom: (roomId: string) => void;
    setHighlightedMessageId: (messageId: string | null) => void;
    clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: {},
    rooms: [],
    typingUsers: {},
    currentRoomId: null,
    pinnedRooms: new Set<string>(),
    mutedRooms: new Set<string>(),
    highlightedMessageId: null,

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

    togglePinRoom: (roomId) => set((state) => {
        const next = new Set(state.pinnedRooms);
        if (next.has(roomId)) { next.delete(roomId); } else { next.add(roomId); }
        return { pinnedRooms: next };
    }),

    toggleMuteRoom: (roomId) => set((state) => {
        const next = new Set(state.mutedRooms);
        if (next.has(roomId)) { next.delete(roomId); } else { next.add(roomId); }
        return { mutedRooms: next };
    }),

    setHighlightedMessageId: (messageId) => set({ highlightedMessageId: messageId }),

    clear: () => set({
        messages: {},
        rooms: [],
        typingUsers: {},
        currentRoomId: null,
        pinnedRooms: new Set(),
        mutedRooms: new Set(),
        highlightedMessageId: null,
    }),
}));

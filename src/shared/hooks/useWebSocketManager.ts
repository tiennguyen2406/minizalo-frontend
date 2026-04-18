/**
 * useWebSocketManager
 *
 * Hook quản lý toàn bộ vòng đời WebSocket + subscribe các room.
 * Phải được đặt tại tầng layout luôn tồn tại (vd: (tabs)/_layout.tsx)
 * để hoạt động trên mọi trang (contacts, files, v.v...)
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { IMessage } from '@stomp/stompjs';
import { useAuthStore } from '@/shared/store/authStore';
import { useChatStore } from '@/shared/store/useChatStore';
import { chatService, ChatRoomResponse } from '@/shared/services/chatService';
import { webSocketService } from '@/shared/services/WebSocketService';
import { ChatRoom } from '../types';
import axios from 'axios';
import {
    STRANGER_MESSAGES_DEFAULT_TEXT,
    STRANGER_MESSAGES_NOT_ALLOWED,
} from '@/shared/utils/chatErrors';

function mapChatRoomResponsesToStore(
    currentUserId: string | undefined,
    data: ChatRoomResponse[],
    existingRooms: ChatRoom[],
): ChatRoom[] {
    const allRooms: ChatRoom[] = data.map((r) => {
        const existing = existingRooms.find((er) => er.id === r.id);
        let resolvedName = r.name;
        if (r.type === 'DIRECT' && (!resolvedName || resolvedName.trim() === '')) {
            const partner = (r.members || []).find(
                (m: any) => (m.user?.id || m.id) !== currentUserId,
            );
            resolvedName =
                partner?.user?.displayName ||
                partner?.user?.username ||
                partner?.displayName ||
                partner?.username ||
                'Người dùng';
        }
        return {
            id: r.id,
            name: resolvedName || 'Người dùng',
            avatarUrl: r.avatarUrl || undefined,
            type: r.type === 'DIRECT' ? 'PRIVATE' : 'GROUP',
            lastMessage: r.lastMessage
                ? {
                      id: r.lastMessage.messageId,
                      senderId: r.lastMessage.senderId,
                      senderName: r.lastMessage.senderName || undefined,
                      roomId: r.id,
                      content: r.lastMessage.content,
                      type: (r.lastMessage.type as any) || 'TEXT',
                      createdAt: r.lastMessage.createdAt,
                  }
                : undefined,
            unreadCount: Math.max(
                existing ? (existing.unreadCount ?? 0) : 0,
                r.unreadCount || 0,
            ),
            participants: (r.members || []).map((m: any) => ({
                id: m.user?.id || m.id || '',
                username: m.user?.username || m.username || '',
                fullName:
                    m.user?.displayName ||
                    m.user?.fullName ||
                    m.displayName ||
                    m.fullName ||
                    '',
                avatarUrl: m.user?.avatarUrl || m.avatarUrl || undefined,
            })),
            updatedAt: r.lastMessage?.createdAt || r.createdAt || new Date().toISOString(),
        };
    });
    allRooms.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return allRooms;
}

async function fetchRoomsMergeWithStore(): Promise<void> {
    const user = useAuthStore.getState().user;
    const data: ChatRoomResponse[] = await chatService.getChatRooms();
    const existingRooms = useChatStore.getState().rooms;
    useChatStore
        .getState()
        .setRooms(mapChatRoomResponsesToStore(user?.id, data, existingRooms));
}

/** Lỗi gửi chat cá nhân (vd: chỉ bạn bè) — subscribe một lần cho web + mobile. */
function useChatErrorsSubscription() {
    const accessToken = useAuthStore((s) => s.accessToken);

    useEffect(() => {
        if (!accessToken) return;

        webSocketService.activate(accessToken);
        const dest = '/user/queue/chat-errors';
        const handler = (stompMsg: IMessage) => {
            try {
                const raw = stompMsg.body;
                if (raw == null || String(raw).trim() === '') return;
                const payload = JSON.parse(String(raw).trim()) as {
                    code?: string;
                    roomId?: string;
                    text?: string;
                };
                if (
                    payload.code === STRANGER_MESSAGES_NOT_ALLOWED &&
                    payload.roomId != null
                ) {
                    const text =
                        typeof payload.text === 'string' && payload.text.trim()
                            ? payload.text.trim()
                            : STRANGER_MESSAGES_DEFAULT_TEXT;
                    useChatStore
                        .getState()
                        .applyStrangerMessageRejection(String(payload.roomId), text);
                }
            } catch (err) {
                console.error(
                    '[useWebSocketManager] chat-errors parse:',
                    err,
                    'body=',
                    stompMsg.body,
                );
            }
        };

        webSocketService.subscribe(dest, handler);
        return () => webSocketService.unsubscribe(dest);
    }, [accessToken]);
}

/** Realtime cập nhật danh sách phòng (thêm/xóa) — dùng cho web + mobile. */
function useRoomUpdatesSubscription() {
    const accessToken = useAuthStore((s) => s.accessToken);

    useEffect(() => {
        if (!accessToken) return;
        webSocketService.activate(accessToken);
        const dest = '/user/queue/rooms';

        const handler = async (stompMsg: IMessage) => {
            try {
                const raw = String(stompMsg.body || '').trim();
                if (!raw) return;
                let payload: { action?: 'ADDED' | 'REMOVED'; roomId?: string } | null = null;
                try {
                    payload = JSON.parse(raw);
                } catch {
                    // Fallback nếu backend gửi kiểu "action=REMOVED, roomId=..." (phòng hờ)
                    const mAction = raw.match(/action["']?\s*[:=]\s*["']?(ADDED|REMOVED)/i);
                    const mRoom = raw.match(/roomId["']?\s*[:=]\s*["']?([0-9a-fA-F-]{16,})/i);
                    payload = {
                        action: (mAction?.[1]?.toUpperCase() as any) || undefined,
                        roomId: mRoom?.[1],
                    };
                }
                if (!payload?.action || !payload?.roomId) return;

                if (payload.action === 'REMOVED') {
                    useChatStore.getState().removeRoomLocal(payload.roomId);
                    return;
                }

                // ADDED: refetch rooms list so it appears immediately
                await fetchRoomsMergeWithStore();
            } catch (err) {
                console.error('[useWebSocketManager] rooms update parse:', err);
            }
        };

        webSocketService.subscribe(dest, handler);
        return () => webSocketService.unsubscribe(dest);
    }, [accessToken]);
}

export function useWebSocketManager() {
    useChatErrorsSubscription();
    useRoomUpdatesSubscription();

    // Chỉ chạy trên web
    if (Platform.OS !== 'web') return;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    _useWebSocketManagerWeb();
}

function _useWebSocketManagerWeb() {
    const accessToken = useAuthStore((s) => s.accessToken);
    const user = useAuthStore((s) => s.user);
    const rooms = useChatStore((s) => s.rooms);
    const setRooms = useChatStore((s) => s.setRooms);

    const subscribedRoomIds = useRef<Set<string>>(new Set());
    const hasFetched = useRef(false);

    // 1. Fetch danh sách phòng chat khi accessToken thay đổi (login/re-login)
    useEffect(() => {
        if (!accessToken) {
            // Logout → reset để fetch lại khi login lại
            hasFetched.current = false;
            return;
        }
        if (hasFetched.current) return;
        hasFetched.current = true;

        const fetchRooms = async () => {
            try {
                const data: ChatRoomResponse[] = await chatService.getChatRooms();
                const existingRooms = useChatStore.getState().rooms;
                const allRooms: ChatRoom[] = data.map((r) => {
                    const existing = existingRooms.find(er => er.id === r.id);
                    let resolvedName = r.name;
                    if (r.type === 'DIRECT' && (!resolvedName || resolvedName.trim() === '')) {
                        const partner = (r.members || []).find(
                            (m: any) => (m.user?.id || m.id) !== user?.id
                        );
                        resolvedName = partner?.user?.displayName || partner?.user?.username || partner?.displayName || partner?.username || 'Người dùng';
                    }
                    return {
                        id: r.id,
                        name: resolvedName || 'Người dùng',
                        avatarUrl: r.avatarUrl || undefined,
                        type: r.type === 'DIRECT' ? 'PRIVATE' : 'GROUP',
                        lastMessage: r.lastMessage
                            ? {
                                id: r.lastMessage.messageId,
                                senderId: r.lastMessage.senderId,
                                senderName: r.lastMessage.senderName || undefined,
                                roomId: r.id,
                                content: r.lastMessage.content,
                                type: (r.lastMessage.type as any) || 'TEXT',
                                createdAt: r.lastMessage.createdAt,
                            }
                            : undefined,
                        unreadCount: Math.max(
                            existing ? (existing.unreadCount ?? 0) : 0,
                            r.unreadCount || 0
                        ),
                        participants: (r.members || []).map((m: any) => ({
                            id: m.user?.id || m.id || '',
                            username: m.user?.username || m.username || '',
                            fullName: m.user?.displayName || m.user?.fullName || m.displayName || m.fullName || '',
                            avatarUrl: m.user?.avatarUrl || m.avatarUrl || undefined,
                        })),
                        updatedAt: r.lastMessage?.createdAt || r.createdAt || new Date().toISOString(),
                    };
                });
                allRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                setRooms(allRooms);
            } catch (err) {
                if (!axios.isAxiosError(err) || err.response?.status !== 401) {
                    console.error('[useWebSocketManager] Failed to fetch chat rooms:', err);
                }
            }
        };

        fetchRooms();
    }, [accessToken]);

    // 2. Activate WebSocket khi có token, reconnect nếu token thay đổi
    useEffect(() => {
        if (!accessToken) {
            webSocketService.deactivate();
            return;
        }
        webSocketService.activate(accessToken);
    }, [accessToken]);

    // 3. Subscribe tới các phòng mới (chỉ 1 lần mỗi phòng)
    useEffect(() => {
        if (rooms.length === 0) return;

        // Unsubscribe các room đã bị xóa khỏi list (realtime REMOVED)
        const currentIds = new Set(rooms.map(r => r.id));
        subscribedRoomIds.current.forEach((rid) => {
            if (!currentIds.has(rid)) {
                webSocketService.unsubscribe(`/topic/chat/${rid}`);
                subscribedRoomIds.current.delete(rid);
            }
        });

        rooms.forEach((room) => {
            if (subscribedRoomIds.current.has(room.id)) return;

            const topic = `/topic/chat/${room.id}`;
            const roomId = room.id;

            webSocketService.subscribe(topic, (stompMsg) => {
                try {
                    const dynamo = JSON.parse(stompMsg.body);
                    if (dynamo.roomListEvent === 'REMOVED' && dynamo.roomId) {
                        const uid = useAuthStore.getState().user?.id;
                        if (dynamo.forUserId && dynamo.forUserId !== uid) return;
                        useChatStore.getState().removeRoomLocal(String(dynamo.roomId));
                        return;
                    }
                    if (dynamo.roomListEvent === 'ADDED' && dynamo.roomId) {
                        void fetchRoomsMergeWithStore();
                        return;
                    }
                    const attachments = Array.isArray(dynamo.attachments) ? dynamo.attachments : [];
                    const firstAttachment = attachments[0];

                    const incoming = {
                        id: dynamo.messageId,
                        senderId: dynamo.senderId,
                        senderName: dynamo.senderName || dynamo.senderUsername || undefined,
                        roomId,
                        content: dynamo.recalled ? '[Tin nhắn đã thu hồi]' : (dynamo.content || ''),
                        type: (dynamo.type as any) || 'TEXT',
                        createdAt: dynamo.createdAt || dynamo.timestamp,
                        readBy: dynamo.readBy,
                        isRecall: !!dynamo.recalled,
                        pinned: !!dynamo.pinned,
                        reactions: Array.isArray(dynamo.reactions) ? dynamo.reactions : [],
                        replyToId: dynamo.replyToMessageId || undefined,
                        // ── File/media fields ──
                        fileUrl: firstAttachment?.url || undefined,
                        fileName: firstAttachment?.name || firstAttachment?.filename || undefined,
                        fileSize: firstAttachment?.size || undefined,
                        attachments: attachments.map((a: any) => ({
                            url: a.url || '',
                            type: a.type || 'DOCUMENT',
                            name: a.name || a.filename || '',
                            filename: a.filename || a.name || '',
                            size: a.size || 0,
                        })),
                    };

                    // Dùng addMessage để: cập nhật unreadCount, lastMessage, sort rooms, xoá temp-
                    useChatStore.getState().addMessage(roomId, incoming);
                } catch (err) {
                    console.error('[useWebSocketManager] Lỗi parse tin nhắn:', err);
                }
            });

            subscribedRoomIds.current.add(roomId);
        });
    }, [rooms.length]);

    // 4. Cleanup khi unmount hẳn (hiếm gặp - chỉ khi logout hoặc đóng app)
    useEffect(() => {
        return () => {
            subscribedRoomIds.current.forEach(roomId => {
                webSocketService.unsubscribe(`/topic/chat/${roomId}`);
            });
            subscribedRoomIds.current.clear();
            hasFetched.current = false;
        };
    }, []);
}

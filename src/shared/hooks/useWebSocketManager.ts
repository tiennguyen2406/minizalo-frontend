/**
 * useWebSocketManager
 *
 * Hook quản lý toàn bộ vòng đời WebSocket + subscribe các room.
 * Phải được đặt tại tầng layout luôn tồn tại (vd: (tabs)/_layout.tsx)
 * để hoạt động trên mọi trang (contacts, files, v.v...)
 */
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import type { IMessage } from '@stomp/stompjs';
import { useAuthStore } from '@/shared/store/authStore';
import { useChatStore } from '@/shared/store/useChatStore';
import { chatService, ChatRoomResponse } from '@/shared/services/chatService';
import { webSocketService } from '@/shared/services/WebSocketService';
import { ChatRoom } from '../types';
import axios from 'axios';
import {
    formatStrangerPrivacyRejectionMessage,
    STRANGER_MESSAGES_NOT_ALLOWED,
} from '@/shared/utils/chatErrors';
import { addIncomingChatMessageFromStomp } from '@/shared/utils/chatWebSocketInbound';
import { getDirectChatPartnerDisplayName } from '@/shared/utils/strangerChatRooms';

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
                    const roomIdStr = String(payload.roomId);
                    const uid = useAuthStore.getState().user?.id ?? null;
                    const room = useChatStore
                        .getState()
                        .rooms.find((r) => r.id === roomIdStr);
                    const label = getDirectChatPartnerDisplayName(room, uid);
                    const text = formatStrangerPrivacyRejectionMessage(label);
                    useChatStore
                        .getState()
                        .applyStrangerMessageRejection(roomIdStr, text);
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
    const hasFetchedOnLogin = useRef(false);

    /** Đồng bộ danh sách phòng (phòng mới từ mobile / tab khác). */
    const fetchRoomsMerge = async () => {
        try {
            const data: ChatRoomResponse[] = await chatService.getChatRooms();
            const existingRooms = useChatStore.getState().rooms;
            const allRooms: ChatRoom[] = data.map((r) => {
                const existing = existingRooms.find((er) => er.id === r.id);
                let resolvedName = r.name;
                if (r.type === 'DIRECT' && (!resolvedName || resolvedName.trim() === '')) {
                    const partner = (r.members || []).find(
                        (m: any) => (m.user?.id || m.id) !== user?.id,
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
                    updatedAt:
                        r.lastMessage?.createdAt || r.createdAt || new Date().toISOString(),
                };
            });
            allRooms.sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            );
            setRooms(allRooms);
        } catch (err) {
            if (!axios.isAxiosError(err) || err.response?.status !== 401) {
                console.error('[useWebSocketManager] Failed to fetch chat rooms:', err);
            }
        }
    };

    // 1. Fetch danh sách phòng lần đầu sau đăng nhập
    useEffect(() => {
        if (!accessToken) {
            hasFetchedOnLogin.current = false;
            return;
        }
        if (hasFetchedOnLogin.current) return;
        hasFetchedOnLogin.current = true;
        void fetchRoomsMerge();
    }, [accessToken]);

    // 1b. Refetch định kỳ + khi tab active — để có phòng mới / subscribe STOMP kịp (mobile ↔ web)
    useEffect(() => {
        if (!accessToken) return;

        const pollMs = 20000;
        const tick = () => {
            void fetchRoomsMerge();
        };
        const interval = window.setInterval(tick, pollMs);
        const onVis = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [accessToken]);

    // 2. Activate WebSocket khi có token, reconnect nếu token thay đổi
    useEffect(() => {
        if (!accessToken) {
            webSocketService.deactivate();
            return;
        }
        webSocketService.activate(accessToken);
    }, [accessToken]);

    const roomIdsKey = useMemo(
        () =>
            [...rooms]
                .map((r) => r.id)
                .sort()
                .join('|'),
        [rooms],
    );

    // 3. Subscribe tới mọi phòng trong store (khi có roomId mới → phải chạy lại, không chỉ khi đổi length)
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
                const body = stompMsg.body;
                if (body == null) return;
                const raw = String(body);
                try {
                    const dynamo = JSON.parse(raw);
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
                } catch {
                    /* không phải JSON — addIncoming sẽ log nếu cần */
                }
                addIncomingChatMessageFromStomp(roomId, raw);
            });

            subscribedRoomIds.current.add(roomId);
        });
    }, [roomIdsKey]);

    // 4. Cleanup khi unmount hẳn (hiếm gặp - chỉ khi logout hoặc đóng app)
    useEffect(() => {
        return () => {
            subscribedRoomIds.current.forEach(roomId => {
                webSocketService.unsubscribe(`/topic/chat/${roomId}`);
            });
            subscribedRoomIds.current.clear();
            hasFetchedOnLogin.current = false;
        };
    }, []);
}

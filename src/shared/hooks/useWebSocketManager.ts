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
    formatStrangerPrivacyRejectionMessage,
    STRANGER_MESSAGES_NOT_ALLOWED,
} from '@/shared/utils/chatErrors';
import { addIncomingChatMessageFromStomp } from '@/shared/utils/chatWebSocketInbound';
import { getDirectChatPartnerDisplayName } from '@/shared/utils/strangerChatRooms';
import { useInAppNotifStore } from '@/views/mobile/chat/components/InAppNotification';

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
            disbanded: !!r.disbanded,
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
                let payload: { action?: 'ADDED' | 'REMOVED' | 'DISBANDED'; roomId?: string } | null = null;
                try {
                    payload = JSON.parse(raw);
                } catch {
                    // Fallback nếu backend gửi kiểu "action=REMOVED, roomId=..." (phòng hờ)
                    const mAction = raw.match(/action["']?\s*[:=]\s*["']?(ADDED|REMOVED|DISBANDED)/i);
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

                if (payload.action === 'DISBANDED') {
                    await fetchRoomsMergeWithStore();
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

/**
 * Subscribe STOMP `/topic/chat/:roomId` cho mọi phòng trong store (iOS / Android / web).
 * Trước đây chỉ chạy trên web — mobile chỉ subscribe từ ChatList nên mất tin khi rời tab.
 * Dùng `unsubscribe(dest, handler)` để không gỡ listener của ChatScreen cùng topic.
 */
function useGlobalChatTopicSubscriptions() {
    const accessToken = useAuthStore((s) => s.accessToken);
    const roomIdsKey = useChatStore((s) =>
        [...s.rooms]
            .map((r) => r.id)
            .sort()
            .join('|'),
    );
    const handlersRef = useRef<Map<string, (message: IMessage) => void>>(new Map());

    useEffect(() => {
        if (!accessToken) {
            handlersRef.current.forEach((handler, rid) => {
                webSocketService.unsubscribe(`/topic/chat/${rid}`, handler);
            });
            handlersRef.current.clear();
            return;
        }

        webSocketService.activate(accessToken);

        const rooms = useChatStore.getState().rooms;
        const currentIds = new Set(rooms.map((r) => r.id));

        handlersRef.current.forEach((handler, rid) => {
            if (!currentIds.has(rid)) {
                webSocketService.unsubscribe(`/topic/chat/${rid}`, handler);
                handlersRef.current.delete(rid);
            }
        });

        rooms.forEach((room) => {
            const roomId = room.id;
            if (handlersRef.current.has(roomId)) return;

            const handler = (stompMsg: IMessage) => {
                const body = stompMsg.body;
                if (body == null) return;
                const raw = String(body);
                let dynamo: Record<string, unknown> | null = null;
                try {
                    dynamo = JSON.parse(raw) as Record<string, unknown>;
                } catch {
                    dynamo = null;
                }

                if (dynamo && dynamo.roomListEvent === 'REMOVED' && dynamo.roomId) {
                    const uid = useAuthStore.getState().user?.id;
                    if (dynamo.forUserId && dynamo.forUserId !== uid) return;
                    useChatStore.getState().removeRoomLocal(String(dynamo.roomId));
                    return;
                }
                if (dynamo && dynamo.roomListEvent === 'ADDED' && dynamo.roomId) {
                    void fetchRoomsMergeWithStore();
                    return;
                }

                addIncomingChatMessageFromStomp(roomId, raw);

                if (Platform.OS !== 'web' && dynamo) {
                    const curOpen = useChatStore.getState().currentRoomId;
                    const isCurrentlyViewing =
                        curOpen != null && String(curOpen) === String(roomId);
                    const senderId =
                        typeof dynamo.senderId === 'string' ? dynamo.senderId : '';
                    const myId = useAuthStore.getState().user?.id;
                    if (senderId && myId && senderId !== myId && !isCurrentlyViewing) {
                        if (!useChatStore.getState().isRoomMuted(roomId)) {
                            const roomData = useChatStore
                                .getState()
                                .rooms.find((r) => r.id === roomId);
                            const senderLabel =
                                (typeof dynamo.senderName === 'string' && dynamo.senderName) ||
                                (typeof dynamo.senderUsername === 'string' &&
                                    dynamo.senderUsername) ||
                                'Tin nhắn mới';
                            const msgType =
                                typeof dynamo.type === 'string' ? dynamo.type : '';
                            const msgContent =
                                typeof dynamo.content === 'string' ? dynamo.content : '';
                            useInAppNotifStore.getState().show({
                                title: senderLabel,
                                body:
                                    msgType === 'IMAGE'
                                        ? '[Hình ảnh]'
                                        : msgType === 'VIDEO'
                                          ? '[Video]'
                                          : msgType === 'FILE'
                                            ? '[Tập tin]'
                                            : msgType === 'POLL'
                                              ? '[Bình chọn]'
                                            : msgContent || 'Đã gửi một tin nhắn',
                                avatarUrl: roomData?.avatarUrl || undefined,
                                roomId: roomId,
                            });
                        }
                    }
                }
            };

            webSocketService.subscribe(`/topic/chat/${roomId}`, handler);
            handlersRef.current.set(roomId, handler);
        });
    }, [accessToken, roomIdsKey]);

    useEffect(() => {
        return () => {
            handlersRef.current.forEach((handler, rid) => {
                webSocketService.unsubscribe(`/topic/chat/${rid}`, handler);
            });
            handlersRef.current.clear();
        };
    }, []);
}

export function useWebSocketManager() {
    useChatErrorsSubscription();
    useRoomUpdatesSubscription();
    useGlobalChatTopicSubscriptions();

    if (Platform.OS !== 'web') return;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    _useWebSocketManagerWeb();
}

function _useWebSocketManagerWeb() {
    const accessToken = useAuthStore((s) => s.accessToken);
    const user = useAuthStore((s) => s.user);
    const setRooms = useChatStore((s) => s.setRooms);

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
                    disbanded: !!r.disbanded,
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

    // Thông báo riêng cho user (vd: "không thể xem lịch sử") — chạy global trên web
    useEffect(() => {
        if (!accessToken) return;
        const dest = '/user/queue/chat-notices';
        const handler = (stompMsg: IMessage) => {
            try {
                const raw = String(stompMsg.body || '').trim();
                if (!raw) return;
                const payload = JSON.parse(raw) as { roomId?: string };
                const rid = payload?.roomId ? String(payload.roomId) : null;
                if (!rid) return;
                addIncomingChatMessageFromStomp(rid, raw);
            } catch {
                // ignore
            }
        };
        webSocketService.subscribe(dest, handler);
        return () => webSocketService.unsubscribe(dest, handler);
    }, [accessToken]);

    useEffect(() => {
        return () => {
            hasFetchedOnLogin.current = false;
        };
    }, []);
}

import { useChatStore } from '@/shared/store/useChatStore';
import { useGroupStore } from '@/shared/store/useGroupStore';
import { groupService } from '@/shared/services/groupService';
import type { Message } from '@/shared/types';

type MessageReaction = { userId: string; emoji: string };
type RawAttachment = {
    url?: unknown;
    type?: unknown;
    name?: unknown;
    filename?: unknown;
    size?: unknown;
};

function normalizeReactions(value: unknown): MessageReaction[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map((r) => ({
            userId: String(r.userId || ''),
            emoji: String(r.emoji || ''),
        }))
        .filter((r) => r.userId.length > 0 && r.emoji.length > 0);
}

/** Parse payload STOMP `/topic/chat/:roomId` và đưa vào store (dùng chung web manager + ChatWindow). */
export function addIncomingChatMessageFromStomp(roomId: string, rawBody: string): void {
    try {
        const dynamo = JSON.parse(rawBody) as Record<string, unknown> & {
            roomListEvent?: string;
            roomId?: string;
            groupId?: string;
            chatRoomId?: string;
            senderId?: string;
            senderName?: string;
            senderUsername?: string;
            content?: string;
            type?: string;
            recalled?: boolean;
            createdAt?: string;
            timestamp?: string;
            readBy?: string[];
            pinned?: boolean;
            reactions?: unknown[];
            replyToMessageId?: string;
            messageId?: string;
            messageUpdate?: boolean;
        };
        const resolvedRoomId =
            (typeof dynamo.roomId === 'string' && dynamo.roomId.length > 0 && dynamo.roomId) ||
            (typeof dynamo.groupId === 'string' && dynamo.groupId.length > 0 && dynamo.groupId) ||
            (typeof dynamo.chatRoomId === 'string' && dynamo.chatRoomId.length > 0 && dynamo.chatRoomId) ||
            roomId;

        /**
         * BE phát `messageUpdate=true` khi cập nhật in-place 1 tin hiện có (vd: group call
         * STARTED → ENDED). FE phải gọi updateMessage() thay vì addMessage() để không
         * tạo bubble mới và cũng không làm "nhảy" room lên đầu list như tin mới.
         */
        if (dynamo.messageUpdate === true && typeof dynamo.messageId === 'string' && dynamo.messageId) {
            const attachments: RawAttachment[] = Array.isArray(dynamo.attachments)
                ? dynamo.attachments.filter((a): a is RawAttachment => !!a && typeof a === 'object')
                : [];
            const firstAttachment = attachments[0];
            const updates: Partial<Message> = {
                content: dynamo.recalled ? '[Tin nhắn đã thu hồi]' : dynamo.content || '',
                type: (dynamo.type as Message['type']) || 'TEXT',
                isRecall: !!dynamo.recalled,
                pinned: !!dynamo.pinned,
                reactions: normalizeReactions(dynamo.reactions),
                fileUrl: typeof firstAttachment?.url === 'string' ? firstAttachment.url : undefined,
                fileName:
                    typeof firstAttachment?.name === 'string'
                        ? firstAttachment.name
                        : typeof firstAttachment?.filename === 'string'
                            ? firstAttachment.filename
                            : undefined,
                fileSize: typeof firstAttachment?.size === 'number' ? firstAttachment.size : undefined,
                attachments: attachments.map((a) => ({
                    url: (a.url as string) || '',
                    type: (a.type as string) || 'DOCUMENT',
                    name: (a.name as string) || (a.filename as string) || '',
                    filename: (a.filename as string) || (a.name as string) || '',
                    size: (a.size as number) || 0,
                })),
            };
            useChatStore.getState().updateMessage(resolvedRoomId, dynamo.messageId, updates);
            return;
        }
        if (dynamo.roomListEvent === 'DISBANDED') {
            const rid =
                typeof dynamo.roomId === 'string' && dynamo.roomId.length > 0
                    ? dynamo.roomId
                    : roomId;
            const existing = useChatStore.getState().rooms.find((r) => r.id === rid);
            if (existing) {
                useChatStore.getState().upsertRoom({ ...existing, disbanded: true });
            }
            return;
        }
        if (dynamo.roomListEvent === 'PENDING_JOINS_CHANGED') {
            const rid =
                typeof dynamo.roomId === 'string' && dynamo.roomId.length > 0
                    ? dynamo.roomId
                    : roomId;
            const gs = useGroupStore.getState();
            if (gs.currentGroupDetail?.id === rid) {
                void groupService.getGroupDetails(rid).then((d) => gs.setCurrentGroupDetail(d));
            }
            return;
        }
        /**
         * Backend gửi tín hiệu cập nhật danh sách phòng (không có messageId / nội dung).
         * useWebSocketManager đã lọc ADDED, nhưng ChatWindow cũng subscribe /topic/chat → cần bỏ qua
         * để không tạo tin TEXT rỗng (bubble chỉ còn giờ + reaction).
         */
        if (dynamo.roomListEvent === 'ADDED' || dynamo.roomListEvent === 'REMOVED') {
            return;
        }
        const attachments: RawAttachment[] = Array.isArray(dynamo.attachments)
            ? dynamo.attachments.filter((a): a is RawAttachment => !!a && typeof a === 'object')
            : [];
        const firstAttachment = attachments[0];

        const rawId = dynamo.messageId;
        const messageId =
            typeof rawId === 'string' && rawId.length > 0
                ? rawId
                : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const incoming: Message = {
            id: messageId,
            senderId: dynamo.senderId || '',
            senderName: (dynamo.senderName || dynamo.senderUsername) as string | undefined,
            roomId: resolvedRoomId,
            content: dynamo.recalled ? '[Tin nhắn đã thu hồi]' : dynamo.content || '',
            type: (dynamo.type as Message['type']) || 'TEXT',
            createdAt: dynamo.createdAt || dynamo.timestamp || new Date().toISOString(),
            readBy: dynamo.readBy,
            isRecall: !!dynamo.recalled,
            pinned: !!dynamo.pinned,
            reactions: normalizeReactions(dynamo.reactions),
            replyToId: dynamo.replyToMessageId || undefined,
            fileUrl: typeof firstAttachment?.url === 'string' ? firstAttachment.url : undefined,
            fileName:
                typeof firstAttachment?.name === 'string'
                    ? firstAttachment.name
                    : typeof firstAttachment?.filename === 'string'
                        ? firstAttachment.filename
                        : undefined,
            fileSize: typeof firstAttachment?.size === 'number' ? firstAttachment.size : undefined,
            attachments: attachments.map((a) => ({
                url: (a.url as string) || '',
                type: (a.type as string) || 'DOCUMENT',
                name: (a.name as string) || (a.filename as string) || '',
                filename: (a.filename as string) || (a.name as string) || '',
                size: (a.size as number) || 0,
            })),
        };

        useChatStore.getState().addMessage(resolvedRoomId, incoming);

        // Realtime refresh group members list on key system events (left/join/added/removed)
        if (
            incoming.type === 'SYSTEM' &&
            typeof incoming.content === 'string' &&
            (incoming.content.includes('đã rời nhóm') ||
                incoming.content.includes('đã thêm') ||
                incoming.content.includes('tham gia nhóm') ||
                incoming.content.includes('đã bị xóa khỏi nhóm') ||
                // Realtime quyền: phong/xóa phó nhóm, nhường quyền trưởng nhóm
                incoming.content.includes('phó nhóm') ||
                incoming.content.includes('nhường quyền trưởng nhóm'))
        ) {
            const gs = useGroupStore.getState();
            if (gs.currentGroupDetail?.id === resolvedRoomId) {
                void groupService
                    .getGroupDetails(resolvedRoomId)
                    .then((d) => gs.setCurrentGroupDetail(d))
                    .catch(() => {
                        // Người dùng có thể vừa rời/ bị kick khỏi nhóm → backend trả 400/403.
                        // Không để promise unhandled làm crash UI.
                    });
            }
        }
    } catch (err) {
        console.error('[chatWebSocketInbound] parse/add:', err);
    }
}

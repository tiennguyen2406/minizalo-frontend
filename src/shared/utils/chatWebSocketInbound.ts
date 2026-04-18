import { useChatStore } from '@/shared/store/useChatStore';
import type { Message } from '@/shared/types';

/** Parse payload STOMP `/topic/chat/:roomId` và đưa vào store (dùng chung web manager + ChatWindow). */
export function addIncomingChatMessageFromStomp(roomId: string, rawBody: string): void {
    try {
        const dynamo = JSON.parse(rawBody);
        const attachments = Array.isArray(dynamo.attachments) ? dynamo.attachments : [];
        const firstAttachment = attachments[0];

        const rawId = dynamo.messageId;
        const messageId =
            typeof rawId === 'string' && rawId.length > 0
                ? rawId
                : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        const incoming: Message = {
            id: messageId,
            senderId: dynamo.senderId,
            senderName: (dynamo.senderName || dynamo.senderUsername) as string | undefined,
            roomId,
            content: dynamo.recalled ? '[Tin nhắn đã thu hồi]' : dynamo.content || '',
            type: (dynamo.type as Message['type']) || 'TEXT',
            createdAt: dynamo.createdAt || dynamo.timestamp || new Date().toISOString(),
            readBy: dynamo.readBy,
            isRecall: !!dynamo.recalled,
            pinned: !!dynamo.pinned,
            reactions: Array.isArray(dynamo.reactions) ? dynamo.reactions : [],
            replyToId: dynamo.replyToMessageId || undefined,
            fileUrl: firstAttachment?.url || undefined,
            fileName: firstAttachment?.name || firstAttachment?.filename || undefined,
            fileSize: firstAttachment?.size || undefined,
            attachments: attachments.map((a: Record<string, unknown>) => ({
                url: (a.url as string) || '',
                type: (a.type as string) || 'DOCUMENT',
                name: (a.name as string) || (a.filename as string) || '',
                filename: (a.filename as string) || (a.name as string) || '',
                size: (a.size as number) || 0,
            })),
        };

        useChatStore.getState().addMessage(roomId, incoming);
    } catch (err) {
        console.error('[chatWebSocketInbound] parse/add:', err);
    }
}

import type { MessageDynamo } from '@/shared/services/chatService';
import { isImageAttachment } from '@/shared/utils/messageAttachments';

/** Giống web MessageList: gom các tin IMAGE liên tiếp (web gửi từng file một). */
export const MOBILE_IMAGE_GROUP_THRESHOLD_MS = 60_000;

export type MobileChatRow =
    | { kind: 'message'; message: MessageDynamo }
    | { kind: 'imageGroup'; messages: MessageDynamo[] };

function isRecallOrPinNotification(m: MessageDynamo): boolean {
    if (m.recalled) return true;
    if (m.type === 'PIN_NOTIFICATION') return true;
    if (m.senderId === 'system' && m.type !== 'SYSTEM') return true;
    return false;
}

/** Tin chỉ là ảnh (web gửi lẻ từng file — mỗi tin thường 1 attachment ảnh). */
export function isSingleBurstImageMessage(m: MessageDynamo): boolean {
    if (isRecallOrPinNotification(m)) return false;
    const t = (m.type || '').toUpperCase();
    if (t !== 'IMAGE') return false;
    const attachments = m.attachments || [];
    const hasNonImage = attachments.some((a) => !isImageAttachment(a));
    if (hasNonImage) return false;
    const imgs = attachments.filter((a) => isImageAttachment(a));
    return imgs.length >= 1;
}

/**
 * `messages`: thứ tự **mới nhất trước** (giống FlatList inverted của ChatScreen).
 */
export function buildMobileChatRows(messagesNewestFirst: MessageDynamo[]): MobileChatRow[] {
    const rows: MobileChatRow[] = [];
    let i = 0;
    const n = messagesNewestFirst.length;

    while (i < n) {
        const msg = messagesNewestFirst[i];

        if (!isSingleBurstImageMessage(msg)) {
            rows.push({ kind: 'message', message: msg });
            i++;
            continue;
        }

        const group: MessageDynamo[] = [msg];
        let j = i + 1;
        while (j < n) {
            const next = messagesNewestFirst[j];
            if (!isSingleBurstImageMessage(next)) break;
            if (next.senderId !== msg.senderId) break;
            const prev = group[group.length - 1];
            const ta = new Date(prev.createdAt).getTime();
            const tb = new Date(next.createdAt).getTime();
            if (Math.abs(tb - ta) > MOBILE_IMAGE_GROUP_THRESHOLD_MS) break;
            group.push(next);
            j++;
        }

        if (group.length >= 2) {
            rows.push({ kind: 'imageGroup', messages: group });
            i = j;
        } else {
            rows.push({ kind: 'message', message: msg });
            i++;
        }
    }

    return rows;
}

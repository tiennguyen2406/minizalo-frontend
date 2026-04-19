import { isImageAttachment, isVideoAttachment, type AttachmentLike } from '@/shared/utils/messageAttachments';

export type ChatGalleryItem = { url: string; kind: 'image' | 'video' };

/** Tối thiểu trường cần để gom media (Message web, MessageDynamo mobile, …). */
export type ChatGalleryMessageLike = {
    createdAt: string;
    type?: string;
    fileUrl?: string;
    attachments?: AttachmentLike[];
    isRecall?: boolean;
    recalled?: boolean;
};

/** Chuẩn hoá URL để khớp khi nhấp ảnh (host/query có thể khác một chút). */
export function normalizeUrlForGalleryMatch(u: string): string {
    const s = u.trim();
    try {
        const parsed = new URL(s);
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return s;
    }
}

/**
 * Toàn bộ ảnh + video trong phòng chat, thứ tự thời gian (cũ → mới).
 * `resolveUrl`: cùng hàm hiển thị thumbnail (getImageUrl) để index khớp khi mở gallery.
 */
export function buildChatGalleryItems(
    messages: ChatGalleryMessageLike[],
    resolveUrl: (raw: string) => string,
): ChatGalleryItem[] {
    const sorted = [...messages]
        .filter((m) => !m.isRecall && !m.recalled)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const items: ChatGalleryItem[] = [];

    for (const m of sorted) {
        const msgType = String(m.type || '').toUpperCase();

        for (const a of m.attachments || []) {
            const raw = a?.url?.trim();
            if (!raw) continue;
            const url = resolveUrl(raw);
            if (!url) continue;
            if (isVideoAttachment(a)) {
                items.push({ url, kind: 'video' });
            } else if (isImageAttachment(a)) {
                items.push({ url, kind: 'image' });
            } else if (msgType === 'IMAGE' || msgType === 'MEDIA') {
                // URL không có đuôi / MIME lạ — vẫn là tin ảnh (hoặc album hỗn hợp)
                items.push({ url, kind: 'image' });
            } else if (msgType === 'VIDEO' && !isVideoAttachment(a)) {
                // Tin gửi album ảnh+video thường có type VIDEO: mọi attachment không phải video → ảnh
                items.push({ url, kind: 'image' });
            }
        }

        const legacy = m.fileUrl?.trim();
        if (legacy && (!m.attachments || m.attachments.length === 0)) {
            const url = resolveUrl(legacy);
            if (!url) continue;
            const t = String(m.type || '');
            if (t === 'VIDEO' || isVideoAttachment({ url: legacy, type: m.attachments?.[0]?.type })) {
                items.push({ url, kind: 'video' });
            } else if (t === 'IMAGE' || isImageAttachment({ url: legacy, type: m.attachments?.[0]?.type })) {
                items.push({ url, kind: 'image' });
            }
        }
    }

    return items;
}

export function findChatGalleryIndex(
    clickedResolvedUrl: string,
    items: ChatGalleryItem[],
): number {
    if (!clickedResolvedUrl || items.length === 0) return 0;
    const key = normalizeUrlForGalleryMatch(clickedResolvedUrl);
    let idx = items.findIndex((it) => normalizeUrlForGalleryMatch(it.url) === key);
    if (idx >= 0) return idx;
    idx = items.findIndex((it) => it.url === clickedResolvedUrl);
    if (idx >= 0) return idx;
    return 0;
}

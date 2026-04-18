import type { Message } from '@/shared/types';

/**
 * Mọi URL ảnh trong một tin (một tin có thể gửi nhiều ảnh trong `attachments`).
 */
export function getImageAttachmentUrls(message: Message): string[] {
    const raw = message.attachments || [];
    const out: string[] = [];
    for (const a of raw) {
        const u = a?.url?.trim();
        if (!u) continue;
        const mime = (a.type || '').toLowerCase();
        if (mime.startsWith('video/')) continue;
        const isImgMime = mime.startsWith('image/');
        const looksLikeImagePath = /\.(jpe?g|png|gif|webp|bmp)(\?[^#]*)?(#|$)/i.test(u);
        if (isImgMime || looksLikeImagePath) out.push(u);
    }
    const uniq = [...new Set(out)];
    if (uniq.length === 0 && message.fileUrl?.trim()) {
        const u = message.fileUrl.trim();
        const mime0 = (raw[0]?.type || '').toLowerCase();
        if (
            (message.type as string) === 'IMAGE' ||
            mime0.startsWith('image/') ||
            /\.(jpe?g|png|gif|webp)(\?|$)/i.test(u)
        ) {
            uniq.push(u);
        }
    }
    return uniq;
}

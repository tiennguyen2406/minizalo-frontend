import type { Message } from '@/shared/types';

export type AttachmentLike = { type?: string; url?: string; name?: string; filename?: string };

/** Phân loại video — dùng chung web/mobile khi MIME hoặc type string không nhất quán. */
export function isVideoAttachment(a: AttachmentLike | null | undefined): boolean {
    if (!a?.url?.trim()) return false;
    const mime = (a.type || '').toLowerCase();
    // Nếu là audio thì chắc chắn không phải video
    if (mime.startsWith('audio/')) return false;
    
    if (mime.startsWith('video/')) return true;
    if (mime === 'video') return true;
    if (a.type === 'VIDEO') return true;
    if (mime.startsWith('image/') || mime === 'image' || a.type === 'IMAGE') return false;
    const u = a.url.trim();
    return /\.(mp4|webm|mov|m4v|mkv)(\?[^#]*)?(#|$)/i.test(u);
}

/** Phân loại audio/voice. */
export function isAudioAttachment(a: AttachmentLike | null | undefined): boolean {
    if (!a?.url?.trim()) return false;
    const mime = (a.type || '').toLowerCase();
    if (mime.startsWith('audio/')) return true;
    if (mime === 'audio' || a.type === 'VOICE') return true;
    const u = a.url.trim();
    return /\.(mp3|wav|ogg|m4a|aac|webm)(\?[^#]*)?(#|$)/i.test(u) && !isVideoAttachment(a);
}


/** Phân loại ảnh — không gọi cho item đã là video. */
export function isImageAttachment(a: AttachmentLike | null | undefined): boolean {
    if (!a?.url?.trim()) return false;
    if (isVideoAttachment(a)) return false;
    const mime = (a.type || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    if (mime === 'image') return true;
    if (a.type === 'IMAGE') return true;
    const u = a.url.trim();
    return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)(\?[^#]*)?(#|$)/i.test(u);
}

/**
 * Mọi URL ảnh trong một tin (một tin có thể gửi nhiều ảnh trong `attachments`).
 */
export function getImageAttachmentUrls(message: Message): string[] {
    const raw = message.attachments || [];
    const out: string[] = [];
    for (const a of raw) {
        const u = a?.url?.trim();
        if (!u) continue;
        if (!isImageAttachment(a)) continue;
        out.push(u);
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

/**
 * Mọi URL video trong một tin (ảnh + video trong cùng một tin nhắn).
 */
export function getVideoAttachmentUrls(message: Message): string[] {
    const raw = message.attachments || [];
    const out: string[] = [];
    for (const a of raw) {
        const u = a?.url?.trim();
        if (!u) continue;
        if (!isVideoAttachment(a)) continue;
        out.push(u);
    }
    const uniq = [...new Set(out)];
    if (uniq.length === 0 && message.fileUrl?.trim()) {
        const u = message.fileUrl.trim();
        const mime0 = (raw[0]?.type || '').toLowerCase();
        if (
            (message.type as string) === 'VIDEO' ||
            mime0.startsWith('video/') ||
            (/\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(u) && !mime0.startsWith('audio/'))
        ) {
            uniq.push(u);
        }
    }
    return uniq;
}

/**
 * Mọi URL audio trong một tin.
 */
export function getAudioAttachmentUrls(message: Message): string[] {
    const raw = message.attachments || [];
    const out: string[] = [];
    for (const a of raw) {
        const u = a?.url?.trim();
        if (!u) continue;
        if (!isAudioAttachment(a)) continue;
        out.push(u);
    }
    const uniq = [...new Set(out)];
    if (uniq.length === 0 && message.fileUrl?.trim()) {
        const u = message.fileUrl.trim();
        const mime0 = (raw[0]?.type || '').toLowerCase();
        if (
            (message.type as string) === 'VOICE' ||
            mime0.startsWith('audio/') ||
            (/\.(mp3|wav|ogg|m4a|aac|webm)(\?|$)/i.test(u) && (mime0.startsWith('audio/') || (message.type as string) === 'VOICE'))
        ) {
            uniq.push(u);
        }
    }
    return uniq;
}


import { chatService, type Attachment, type MessageDynamo } from "@/shared/services/chatService";

export type CloudStorageBreakdown = {
    totalBytes: number;
    photoBytes: number;
    videoBytes: number;
    fileBytes: number;
};

export const CLOUD_STORAGE_QUOTA_MB = 500;
export const CLOUD_STORAGE_QUOTA_BYTES = CLOUD_STORAGE_QUOTA_MB * 1024 * 1024;

export const EMPTY_CLOUD_STORAGE: CloudStorageBreakdown = {
    totalBytes: 0,
    photoBytes: 0,
    videoBytes: 0,
    fileBytes: 0,
};

function normalizeUrlKey(url: string): string {
    const u = (url || "").trim();
    if (!u) return "";
    try {
        const noQuery = u.split("?")[0] || u;
        return decodeURIComponent(noQuery);
    } catch {
        return u.split("?")[0] || u;
    }
}

/** Phân loại đính kèm để cộng dung lượng (ảnh / video / còn lại gồm file & thoại). */
export function classifyAttachmentStorageKind(att: Pick<Attachment, "type">): "image" | "video" | "file" {
    const t = (att.type || "").toLowerCase();
    if (t.startsWith("image") || t === "image") return "image";
    if (t.startsWith("video") || t === "video" || t.includes("mp4") || t.includes("webm")) return "video";
    if (t.startsWith("audio") || t.includes("mpeg") || t.includes("ogg") || t.includes("m4a") || t === "voice") return "file";
    return "file";
}

/**
 * Cộng dung lượng thực từ field `size` của attachments trong lịch sử phòng Cloud.
 * Trùng URL + loại chỉ tính một lần (tránh đếm trùng khi forward / tin lặp).
 */
export function aggregateCloudStorageFromMessages(messages: Iterable<MessageDynamo>): CloudStorageBreakdown {
    let photoBytes = 0;
    let videoBytes = 0;
    let fileBytes = 0;
    const seen = new Set<string>();

    for (const raw of messages) {
        const m = raw as MessageDynamo & { isRecalled?: boolean };
        if (m.recalled || m.isRecalled) continue;

        const anyM = m as MessageDynamo & { fileUrl?: string; fileSize?: number; size?: number };

        const add = (kind: "image" | "video" | "file", url: string | undefined, rawSize: unknown) => {
            const n =
                typeof rawSize === "number" && Number.isFinite(rawSize)
                    ? Math.max(0, Math.floor(rawSize))
                    : typeof rawSize === "string"
                      ? Math.max(0, Math.floor(Number(rawSize)) || 0)
                      : 0;
            if (!url?.trim() || n <= 0) return;
            const key = `${kind}|${normalizeUrlKey(url)}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (kind === "image") photoBytes += n;
            else if (kind === "video") videoBytes += n;
            else fileBytes += n;
        };

        if (Array.isArray(m.attachments) && m.attachments.length > 0) {
            for (const att of m.attachments) {
                const kind = classifyAttachmentStorageKind(att);
                const a = att as Attachment & { fileSize?: number };
                const rawSz =
                    a.size ??
                    a.fileSize ??
                    (m.attachments!.length === 1 ? anyM.fileSize ?? anyM.size : undefined);
                add(kind, att.url, rawSz);
            }
        } else {
            const mt = String(m.type || "").toUpperCase();
            const c = (m.content || "").trim();
            const fromContent = c.startsWith("http") ? c.split(/\s+/)[0] : "";
            const url = (anyM.fileUrl || fromContent || "").trim();
            if (url.startsWith("http")) {
                const fs = anyM.fileSize ?? anyM.size;
                if (mt === "IMAGE") add("image", url, fs);
                else if (mt === "VIDEO") add("video", url, fs);
                else if (mt === "FILE" || mt === "DOCUMENT" || mt === "VOICE" || mt === "FOLDER") add("file", url, fs);
            }
        }
    }

    return {
        totalBytes: photoBytes + videoBytes + fileBytes,
        photoBytes,
        videoBytes,
        fileBytes,
    };
}

/** Gom tin nhắn qua nhiều trang history (giới hạn trang để tránh vòng lặp quá lâu). */
export async function fetchAllCloudRoomMessages(
    roomId: string,
    opts?: { maxPages?: number; pageSize?: number },
): Promise<MessageDynamo[]> {
    const maxPages = opts?.maxPages ?? 35;
    const pageSize = opts?.pageSize ?? 50;
    const all: MessageDynamo[] = [];
    let lastKey: string | undefined;
    for (let i = 0; i < maxPages; i++) {
        const res = await chatService.getChatHistory(roomId, pageSize, lastKey);
        const batch = res.messages || [];
        all.push(...batch);
        if (!res.lastEvaluatedKey) break;
        lastKey =
            typeof res.lastEvaluatedKey === "string"
                ? res.lastEvaluatedKey
                : JSON.stringify(res.lastEvaluatedKey);
    }
    return all;
}

export function formatMegabytesFromBytes(bytes: number, maxFractionDigits = 1): string {
    const mb = bytes / (1024 * 1024);
    if (!Number.isFinite(mb) || mb <= 0) return "0";
    return mb.toLocaleString("vi-VN", { maximumFractionDigits: maxFractionDigits, minimumFractionDigits: 0 });
}

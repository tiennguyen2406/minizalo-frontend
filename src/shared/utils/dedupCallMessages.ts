/**
 * Dedup các message CALL_VOICE/CALL_VIDEO theo callSessionId.
 *
 * Lý do: BE gửi 2 message cho mỗi phiên cuộc gọi nhóm:
 *   - Message #1 lúc initiate: content.status = "STARTED" → UI hiện nút "Nhấn để tham gia".
 *   - Message #2 lúc end: content.status = "ENDED" | "MISSED" | "REJECTED" | "CANCELLED" + duration.
 *
 * Nếu render cả 2 → người dùng thấy 1 bubble "Tham gia" (sai, session đã chết) + 1 bubble "Đã kết thúc".
 *
 * Giải pháp tạm thời (Cách B) — FE dedup ở tầng render:
 *   - Với mỗi callSessionId, nếu có message status "cuối" (ENDED/MISSED/REJECTED/CANCELLED),
 *     bỏ qua message có status STARTED cùng session → chỉ giữ tin nhắn kết thúc.
 *
 * Cleanest về lâu dài là BE update in-place message STARTED thành ENDED (Cách A), nhưng cần thay schema.
 */

type CallMsgLike = {
    type?: string | null;
    content?: string | null;
};

const FINAL_STATUSES = new Set(["ENDED", "MISSED", "REJECTED", "CANCELLED"]);

/** Parse content JSON của call message. Trả về null nếu không parse được. */
function parseCallPayload(content: string | null | undefined): { status?: string; callSessionId?: string } | null {
    if (!content) return null;
    try {
        const data = JSON.parse(content);
        if (data && typeof data === "object") return data;
    } catch {
        // ignore
    }
    return null;
}

function isCallMessage(m: CallMsgLike): boolean {
    const t = m.type || "";
    return t === "CALL_VOICE" || t === "CALL_VIDEO";
}

/**
 * Loại bỏ message STARTED nếu đã có message ENDED/MISSED/REJECTED/CANCELLED cho cùng callSessionId.
 * Giữ nguyên thứ tự ban đầu.
 */
export function dedupCallMessages<T extends CallMsgLike>(messages: T[]): T[] {
    if (!messages || messages.length === 0) return messages;

    const sessionsEnded = new Set<string>();
    for (const m of messages) {
        if (!isCallMessage(m)) continue;
        const p = parseCallPayload(m.content);
        if (!p?.callSessionId) continue;
        const s = String(p.status || "").toUpperCase();
        if (FINAL_STATUSES.has(s)) {
            sessionsEnded.add(String(p.callSessionId));
        }
    }

    if (sessionsEnded.size === 0) return messages;

    return messages.filter((m) => {
        if (!isCallMessage(m)) return true;
        const p = parseCallPayload(m.content);
        if (!p?.callSessionId) return true;
        const s = String(p.status || "").toUpperCase();
        // Bỏ message STARTED nếu session đã có tin kết thúc.
        if (s === "STARTED" && sessionsEnded.has(String(p.callSessionId))) return false;
        return true;
    });
}

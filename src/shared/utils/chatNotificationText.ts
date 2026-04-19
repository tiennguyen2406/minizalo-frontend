/**
 * Chuẩn hoá tiêu đề + nội dung thông báo đẩy cho tin chat (tránh hiển thị JSON cuộc gọi).
 */

export type ChatMsgLike = {
    type: string;
    content: string;
    senderName?: string;
};

function fmtDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export function getChatNotificationPreview(msg: ChatMsgLike): { title: string; body: string } {
    const rawName = msg.senderName?.trim();
    const title =
        rawName && rawName !== "Nhận"
            ? rawName
            : msg.type?.startsWith("CALL")
              ? "Cuộc gọi"
              : "MiniZalo";

    if (msg.type === "CALL_VOICE" || msg.type === "CALL_VIDEO") {
        try {
            const j = JSON.parse(msg.content || "{}");
            const st = String(j.status ?? "").toUpperCase();
            const kindFromPayload = j.callType === "VIDEO";
            const isVideo = video || kindFromPayload;
            const lab = isVideo ? "video" : "thoại";

            if (st === "ENDED" || st === "END") {
                const dur =
                    typeof j.duration === "number" && j.duration > 0
                        ? ` (${fmtDuration(Math.round(j.duration))})`
                        : "";
                return {
                    title: rawName && rawName !== "Nhận" ? rawName : "Cuộc gọi",
                    body: `Cuộc gọi ${lab} đã kết thúc${dur}`,
                };
            }
            if (st === "MISSED" || st === "REJECTED" || st === "NO_ANSWER" || st === "BUSY") {
                return {
                    title: rawName && rawName !== "Nhận" ? rawName : "Cuộc gọi",
                    body: `Cuộc gọi ${lab} nhỡ`,
                };
            }
            return {
                title: rawName && rawName !== "Nhận" ? rawName : "Cuộc gọi",
                body: `Cuộc gọi ${lab}`,
            };
        } catch {
            return {
                title,
                body: `Cuộc gọi ${msg.type === "CALL_VIDEO" ? "video" : "thoại"}`,
            };
        }
    }

    const c = msg.content?.trim() ?? "";
    if (c.startsWith("{")) {
        try {
            const j = JSON.parse(c);
            if (j.callType != null && j.status != null) {
                const isVideo = j.callType === "VIDEO";
                const lab = isVideo ? "video" : "thoại";
                const st = String(j.status).toUpperCase();
                if (st === "ENDED") {
                    const dur =
                        typeof j.duration === "number" && j.duration > 0
                            ? ` (${fmtDuration(Math.round(j.duration))})`
                            : "";
                    return { title: "Cuộc gọi", body: `Cuộc gọi ${lab} đã kết thúc${dur}` };
                }
                return { title: "Cuộc gọi", body: `Cuộc gọi ${lab}` };
            }
        } catch {
            /* fallthrough */
        }
    }

    if (msg.type === "IMAGE") {
        return { title, body: "[Hình ảnh]" };
    }
    if (msg.type === "STICKER") {
        return { title, body: "[Sticker]" };
    }
    if (msg.type === "VIDEO") {
        return { title, body: "[Video]" };
    }
    if (msg.type === "FILE" || msg.type === "DOCUMENT") {
        return { title, body: "[Tệp đính kèm]" };
    }

    return { title, body: c || "Tin nhắn mới" };
}

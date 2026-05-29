type PreviewMessage = {
    content?: string | null;
    senderName?: string | null;
    type?: string | null;
    recalled?: boolean;
    isRecall?: boolean;
    attachments?: Array<{
        name?: string | null;
        filename?: string | null;
        type?: string | null;
        url?: string | null;
    }> | null;
};

const URL_REGEX = /(https?:\/\/[^\s]+)/i;

function isPhoneLikeName(value?: string | null): boolean {
    const text = String(value || "").trim();
    return !!text && /^[+\d\s().-]{8,}$/.test(text);
}

function getSystemPreviewText(msg: PreviewMessage): string {
    const content = String(msg.content || "").trim();
    const actorName = !isPhoneLikeName(msg.senderName) ? String(msg.senderName || "").trim() : "";

    if (!content || !actorName) return content || "[Thông báo hệ thống]";

    const legacyUpdate = content.match(/^(.+?)\s+đã cập nhật:\s*(.+)$/i);
    if (legacyUpdate && isPhoneLikeName(legacyUpdate[1])) {
        const detail = legacyUpdate[2]
            .replace(/\s+được bật\.?$/i, " thành bật.")
            .replace(/\s+đã tắt\.?$/i, " thành tắt.");
        return `${actorName} đã thay đổi ${detail}`;
    }

    const changedByPhone = content.match(/^(.+?)\s+(đã thay đổi\s+.+)$/i);
    if (changedByPhone && isPhoneLikeName(changedByPhone[1])) {
        return `${actorName} ${changedByPhone[2]}`;
    }

    return content;
}

function attachmentLabel(msg: PreviewMessage): string | null {
    const first = msg.attachments?.[0];
    const t = (msg.type || first?.type || "").toUpperCase();

    if (t === "IMAGE") return "[Hình ảnh]";
    if (t === "VIDEO") return "[Video]";
    if (t === "STICKER") return "[Sticker]";
    if (t === "FOLDER") return "[Thư mục]";
    if (t === "DOCUMENT" || t === "FILE") {
        const rawName = first?.name || first?.filename;
        const name = typeof rawName === "string" ? rawName.trim() : "";
        return name ? `[Tập tin] ${name}` : "[Tập tin]";
    }

    if (first?.url || first?.name || first?.filename) {
        const rawName = first?.name || first?.filename;
        const name = typeof rawName === "string" ? rawName.trim() : "";
        return name ? `[Tập tin] ${name}` : "[Tập tin]";
    }
    return null;
}

export function getChatPreviewText(lastMessage?: PreviewMessage | null): string {
    if (!lastMessage) return "Chưa có tin nhắn";

    const recalled =
        lastMessage.recalled === true ||
        lastMessage.isRecall === true ||
        String(lastMessage.content || "").trim() === "[Tin nhắn đã thu hồi]";
    if (recalled) return "[Tin nhắn đã thu hồi]";

    const byAttachment = attachmentLabel(lastMessage);
    if (byAttachment) return byAttachment;

    const type = String(lastMessage.type || "").toUpperCase();
    if (type === "IMAGE") return "[Hình ảnh]";
    if (type === "VIDEO") return "[Video]";
    if (type === "STICKER") return "[Sticker]";
    if (type === "FOLDER") return "[Thư mục]";
    if (type === "DOCUMENT" || type === "FILE") return "[Tập tin]";
    if (type === "POLL") return "[Bình chọn]";
    if (type === "SYSTEM") return getSystemPreviewText(lastMessage);

    const content = String(lastMessage.content || "").trim();
    if (content.startsWith('{"type":"STORY_QUOTE"')) {
        try {
            const data = JSON.parse(content);
            const text = data.replyText ? `: ${data.replyText}` : "";
            return `[Khoảnh khắc]${text}`;
        } catch {
            return "[Khoảnh khắc]";
        }
    }
    if (URL_REGEX.test(content)) return "[Liên kết]";
    return content || "Chưa có tin nhắn";
}

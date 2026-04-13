type PreviewMessage = {
    content?: string | null;
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
    if (type === "SYSTEM") return String(lastMessage.content || "").trim() || "[Thông báo hệ thống]";

    const content = String(lastMessage.content || "").trim();
    if (URL_REGEX.test(content)) return "[Liên kết]";
    return content || "Chưa có tin nhắn";
}

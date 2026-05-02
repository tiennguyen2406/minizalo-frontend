import type { Message, Poll, User } from "@/shared/types";

/** Dòng xem trước một dòng (thanh ghim / danh sách) */
export function getPinnedBarPreview(
  msg: Message,
  participantMap: Record<string, User>,
  poll?: Poll | null,
): string {
  if (msg.type === "POLL") {
    const q = poll?.question?.trim();
    if (q) return q;
    return "Đang tải bình chọn…";
  }
  const p = participantMap[msg.senderId];
  const name =
    (msg.senderName && msg.senderName.trim()) ||
    p?.fullName?.trim() ||
    p?.username ||
    "Thành viên";
  const t = msg.type;
  if (
    t === "IMAGE" ||
    t === "VIDEO" ||
    t === "FILE" ||
    t === "DOCUMENT" ||
    t === "FOLDER" ||
    t === "VOICE"
  ) {
    const kind =
      t === "IMAGE"
        ? "Hình ảnh"
        : t === "VIDEO"
          ? "Video"
          : t === "VOICE"
            ? "Tin nhắn thoại"
            : "Tệp đính kèm";
    return `${name}: ${kind}`;
  }
  const raw = (msg.content || "").replace(/\s+/g, " ").trim();
  if (!raw) return `${name}: [Tin nhắn]`;
  if (/^https?:\/\//i.test(raw) || /\w+:\/\/\S+/i.test(raw)) {
    const cut = raw.length > 52 ? `${raw.slice(0, 52)}…` : raw;
    return `${name}: 🔗 Link • ${cut}`;
  }
  const max = 70;
  const tail = raw.length > max ? "…" : "";
  return `${name}: ${raw.slice(0, max)}${tail}`;
}

export function pinnedKindLabel(msg: Message): string {
  if (msg.type === "POLL") return "Bình chọn";
  if (msg.type === "VOICE") return "Tin nhắn thoại";
  if (msg.type === "IMAGE") return "Hình ảnh";
  if (msg.type === "VIDEO") return "Video";
  if (msg.type === "FILE" || msg.type === "DOCUMENT" || msg.type === "FOLDER") return "Tệp đính kèm";
  return "Tin nhắn";
}

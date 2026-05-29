import axios from "axios";

export const STRANGER_MESSAGES_NOT_ALLOWED = "STRANGER_MESSAGES_NOT_ALLOWED";

export const STRANGER_MESSAGES_DEFAULT_TEXT =
    "Người này không nhận tin nhắn từ người lạ";

/** Thông báo trong thread khi đối phương chỉ nhận tin từ bạn bè (privacy). */
export function formatStrangerPrivacyRejectionMessage(
    recipientDisplayName: string,
): string {
    const name = recipientDisplayName.trim() || "Người này";
    return `${name} không nhận tin nhắn từ người lạ. Kết bạn ngay để gửi tin nhắn`;
}

export function isStrangerMessagesNotAllowedError(err: unknown): boolean {
    if (!axios.isAxiosError(err)) return false;
    const code = (err.response?.data as { code?: string } | undefined)?.code;
    return err.response?.status === 403 && code === STRANGER_MESSAGES_NOT_ALLOWED;
}

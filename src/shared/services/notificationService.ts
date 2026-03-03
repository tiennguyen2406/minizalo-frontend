/**
 * notificationService — Shared notification logic (Web & Mobile)
 *
 * Quản lý trạng thái mute và format payload thông báo WebSocket.
 * registerPushToken() là stub — cần VAPID key từ backend để hỗ trợ Web Push.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationPayload {
    title: string;
    body: string;
    roomId: string;
    senderId: string;
    senderName?: string;
    avatarUrl?: string;
    type: "MESSAGE" | "MENTION" | "REACTION" | "SYSTEM";
    createdAt: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const MUTE_PREFIX = "mute:";

// ─── Service ─────────────────────────────────────────────────────────────────

export const notificationService = {
    /**
     * Tắt thông báo cho một cuộc trò chuyện trong `durationMs` milliseconds.
     * Truyền durationMs = 0 hoặc không truyền để mute vĩnh viễn.
     */
    async muteConversation(roomId: string, durationMs?: number): Promise<void> {
        const expiresAt = durationMs ? Date.now() + durationMs : 0; // 0 = vĩnh viễn
        await AsyncStorage.setItem(
            `${MUTE_PREFIX}${roomId}`,
            JSON.stringify({ expiresAt })
        );
    },

    /** Bỏ mute cuộc trò chuyện */
    async unmuteConversation(roomId: string): Promise<void> {
        await AsyncStorage.removeItem(`${MUTE_PREFIX}${roomId}`);
    },

    /** Trả về true nếu phòng đang bị mute */
    async isMuted(roomId: string): Promise<boolean> {
        try {
            const raw = await AsyncStorage.getItem(`${MUTE_PREFIX}${roomId}`);
            if (!raw) return false;
            const { expiresAt } = JSON.parse(raw) as { expiresAt: number };
            if (expiresAt === 0) return true; // vĩnh viễn
            if (Date.now() > expiresAt) {
                // Hết hạn → tự cleanup
                await AsyncStorage.removeItem(`${MUTE_PREFIX}${roomId}`);
                return false;
            }
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Chuẩn hóa payload thô từ WebSocket thành NotificationPayload.
     * Nhận `any` vì format backend có thể thay đổi.
     */
    formatNotificationPayload(raw: any): NotificationPayload {
        return {
            title: raw.senderName || raw.senderId || "Tin nhắn mới",
            body: raw.recalled
                ? "[Tin nhắn đã thu hồi]"
                : raw.content || raw.body || "",
            roomId: raw.chatRoomId || raw.roomId || "",
            senderId: raw.senderId || "",
            senderName: raw.senderName || undefined,
            avatarUrl: raw.avatarUrl || undefined,
            type: raw.notificationType || "MESSAGE",
            createdAt: raw.createdAt || new Date().toISOString(),
        };
    },

    /**
     * Đăng ký push token cho thiết bị.
     * TODO: Implement Web Push với VAPID key khi backend hỗ trợ.
     * Trên mobile: sử dụng expo-notifications.
     */
    async registerPushToken(): Promise<string | null> {
        // TODO: implement expo-notifications.getExpoPushTokenAsync() for mobile
        // TODO: implement Web Push serviceWorker registration for web
        console.warn("[notificationService] registerPushToken() — not yet implemented");
        return null;
    },
};

export default notificationService;

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, LogBox } from 'react-native';
import axios from 'axios';
import { useAuthStore } from '@/shared/store/authStore';

// ─── LỖI EXPO GO SDK 53+ ───
// Thư viện expo-notifications đã loại bỏ hỗ trợ Push Notification trên Expo Go.
// Việc import/require thư viện này sẽ gây ra lỗi ERROR đỏ màn hình trên Android.
// Chúng ta sẽ kiểm tra xem có đang chạy trong Expo Go hay không trước khi nạp.

const isExpoGo = Constants.appOwnership === 'expo';

const getNotifications = () => {
    if (isExpoGo) {
        // Trả về null để tránh lỗi crash/đỏ màn hình trên Expo Go
        return null;
    }
    try {
        return require('expo-notifications');
    } catch (e) {
        return null;
    }
};

// ─── Notification handler ───
export function initNotificationHandler() {
    const Notifications = getNotifications();
    if (!Notifications) {
        if (isExpoGo) {
            console.log('[notificationService] Đang trong Expo Go: Tắt hệ thống thông báo để tránh lỗi SDK 53+');
        }
        return;
    }

    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (err) {
        console.log('[notificationService] Lỗi setNotificationHandler:', err);
    }
}

// ─── API base URL ───
const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

/**
 * Send FCM push token to backend
 */
async function sendTokenToBackend(pushToken: string): Promise<void> {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    try {
        await axios.put(`${API_BASE_URL}/users/fcm-token`, pushToken, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'text/plain',
            },
        });
        console.log('[notificationService] FCM token sent to backend');
    } catch (error: any) {
        console.error('[notificationService] Failed to send FCM token:', error?.message);
    }
}

/**
 * Request permission, get Expo Push Token, send to backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
    const Notifications = getNotifications();
    if (!Notifications) return null;

    if (!Device.isDevice) {
        console.log('[notificationService] ⚠️ Push chỉ hoạt động trên thiết bị thật');
        return null;
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') return null;

        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {}).catch(() => null);
        
        if (!tokenData) return null;

        const pushToken = tokenData.data;
        await sendTokenToBackend(pushToken);
        return pushToken;
    } catch (error: any) {
        console.log('[notificationService] Lỗi đăng ký Push:', error?.message);
        return null;
    }
}

/**
 * Hiển thị thông báo cục bộ (Local Notification)
 */
export async function showLocalNotification(title: string, body: string, data?: any) {
    const Notifications = getNotifications();
    if (!Notifications) return;

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
            },
            trigger: null,
        });
    } catch (err) {
        console.log('[notificationService] Lỗi gửi thông báo local:', err);
    }
}

/**
 * Lắng nghe khi người dùng bấm vào thông báo
 */
export function addNotificationResponseReceivedListener(handler: (response: any) => void) {
    const Notifications = getNotifications();
    if (!Notifications) return { remove: () => {} };
    try {
        return Notifications.addNotificationResponseReceivedListener(handler);
    } catch (err) {
        return { remove: () => {} };
    }
}

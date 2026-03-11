import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import { useAuthStore } from '@/shared/store/authStore';

// ─── Notification handler: show alert + sound when app is foreground ───
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ─── API base URL (same pattern as other services) ───
const rawBase =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "")
        : "http://localhost:8080/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

/**
 * Send FCM push token to backend `PUT /api/users/fcm-token`
 */
async function sendTokenToBackend(pushToken: string): Promise<void> {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
        console.warn('[notificationService] No auth token — skipping FCM token upload');
        return;
    }
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
 * Returns the token string or null on failure.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
    console.log('[notificationService] Starting push registration...');
    console.log('[notificationService] Platform:', Platform.OS);
    console.log('[notificationService] Is physical device:', Device.isDevice);

    // Push only works on physical devices
    if (!Device.isDevice) {
        console.log('[notificationService] ⚠️ Not a physical device — push won\'t work');
        return null;
    }

    // Android: create notification channel
    if (Platform.OS === 'android') {
        console.log('[notificationService] Creating Android notification channel...');
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // Check / request permission
    console.log('[notificationService] Checking notification permission...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    console.log('[notificationService] Existing permission status:', existingStatus);

    if (existingStatus !== 'granted') {
        console.log('[notificationService] Requesting permission...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('[notificationService] New permission status:', status);
    }

    if (finalStatus !== 'granted') {
        console.log('[notificationService] ❌ Permission not granted');
        return null;
    }

    console.log('[notificationService] ✅ Permission granted');

    // Get Expo push token
    try {
        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;
        console.log('[notificationService] Project ID:', projectId);

        const tokenData = projectId
            ? await Notifications.getExpoPushTokenAsync({ projectId })
            : await Notifications.getExpoPushTokenAsync();

        const pushToken = tokenData.data;
        console.log('[notificationService] ✅ Push token:', pushToken);

        // Send to backend
        await sendTokenToBackend(pushToken);

        return pushToken;
    } catch (error: any) {
        console.error('[notificationService] ❌ Error getting push token:', error?.message);
        return null;
    }
}

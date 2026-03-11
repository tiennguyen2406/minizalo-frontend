import "../src/shared/styles/global.css";
import { useEffect, useRef } from "react";
import { LogBox, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "@/services/notificationService";
import { useAuthStore } from "@/shared/store/authStore";

// Ẩn cảnh báo SafeAreaView deprecated (app dùng react-native-safe-area-context; cảnh báo từ RN/dependency)
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

export default function RootLayout() {
    const router = useRouter();
    const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

    useEffect(() => {
        // ── Register push notifications ──
        const accessToken = useAuthStore.getState().accessToken;
        console.log('[RootLayout] accessToken exists:', !!accessToken);
        if (accessToken) {
            // Only register if user is logged in
            console.log('[RootLayout] Calling registerForPushNotificationsAsync...');
            registerForPushNotificationsAsync()
                .then((token) => console.log('[RootLayout] Push token result:', token))
                .catch((err) =>
                    console.warn('[RootLayout] Push registration failed:', err)
                );
        } else {
            console.log('[RootLayout] No accessToken — skipping push registration');
        }

        // ── Listen for auth changes to re-register ──
        const unsub = useAuthStore.subscribe((state, prevState) => {
            if (state.accessToken && !prevState.accessToken) {
                // User just logged in → register push
                registerForPushNotificationsAsync().catch((err) =>
                    console.warn("[RootLayout] Push registration after login failed:", err)
                );
            }
        });

        // ── Handle notification tap → navigate to chat ──
        notificationResponseListener.current =
            Notifications.addNotificationResponseReceivedListener((response) => {
                const data = response.notification.request.content.data;
                if (data?.roomId) {
                    router.push({
                        pathname: "/chat/[id]",
                        params: {
                            id: data.roomId as string,
                            name: (data.senderName as string) || "Chat",
                            type: (data.roomType as string) || "DIRECT",
                        },
                    });
                }
            });

        return () => {
            unsub();
            if (notificationResponseListener.current) {
                notificationResponseListener.current.remove();
            }
        };
    }, []);

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
                fullScreenGestureEnabled: true,
            }}
        >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen
                name="chat/[id]"
                options={{
                    animation: "slide_from_right",
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                }}
            />
        </Stack>
    );
}

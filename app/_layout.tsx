import "../src/shared/styles/global.css";
import { useEffect, useRef, useState } from "react";
import { LogBox, Platform, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
    registerForPushNotificationsAsync,
    addNotificationResponseReceivedListener,
    initNotificationHandler
} from "@/services/notificationService";
import { useAuthStore } from "@/shared/store/authStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { InAppNotificationBanner } from "@/views/mobile/chat/components/InAppNotification";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Quyết liệt chặn tất cả các cảnh báo và lỗi liên quan đến expo-notifications trên Expo Go
LogBox.ignoreLogs([
    "SafeAreaView has been deprecated",
    "expo-notifications",
    "Android Push notifications",
    "fully supported in Expo Go",
    "Use a development build instead of Expo Go"
]);

// Nếu vẫn bị hiện bảng đỏ, chúng ta sẽ tạm thời ghi đè console.error 
// cho những thông báo cụ thể này (chỉ dùng khi dev)
if (__DEV__) {
    const originalConsoleError = console.error;
    console.error = (...args) => {
        if (typeof args[0] === 'string' && (
            args[0].includes("expo-notifications") ||
            args[0].includes("Android Push notifications") ||
            args[0].includes("removed from Expo Go")
        )) {
            // Chuyển lỗi này thành log bình thường để không bị hiện bảng đỏ
            console.log("[Suppressed Notification Error]:", ...args);
            return;
        }
        originalConsoleError(...args);
    };
}

export default function RootLayout() {
    const router = useRouter();
    const notificationResponseListener = useRef<{ remove: () => void } | null>(null);
    const [queryClient] = useState(() => new QueryClient());

    useEffect(() => {
        // Khởi tạo handler thông báo (đã được bọc an toàn trong notificationService)
        initNotificationHandler();

        // ── Register push notifications ──
        const accessToken = useAuthStore.getState().accessToken;
        if (accessToken) {
            registerForPushNotificationsAsync()
                .catch((err) => console.log('[RootLayout] Push registration skipped:', err?.message));
        }

        // ── Listen for auth changes to re-register ──
        const unsub = useAuthStore.subscribe((state, prevState) => {
            if (state.accessToken && !prevState.accessToken) {
                registerForPushNotificationsAsync().catch(() => { });
            }
        });

        // ── Handle notification tap → navigate to chat ──
        notificationResponseListener.current = addNotificationResponseReceivedListener((response) => {
            const data = response?.notification?.request?.content?.data;
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

    const isMobile = Platform.OS !== "web";

    return (
        <QueryClientProvider client={queryClient}>
            <View style={{ flex: 1 }}>
                {isMobile && (
                    <InAppNotificationBanner
                        onPress={(roomId) => {
                            if (!roomId) return;
                            const room = useChatStore
                                .getState()
                                .rooms.find((r) => String(r.id) === String(roomId));
                            const t = room?.type === "GROUP" ? "GROUP" : "DIRECT";
                            const nm = encodeURIComponent(room?.name?.trim() || "Chat");
                            router.push(`/chat/${roomId}?name=${nm}&type=${t}`);
                        }}
                    />
                )}
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
                            gestureEnabled: false,
                        }}
                    />
                </Stack>
            </View>
        </QueryClientProvider>
    );
}

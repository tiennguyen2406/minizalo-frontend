import "../src/shared/styles/global.css";
import { useEffect, useRef } from "react";
import { LogBox, Platform, View, StyleSheet } from "react-native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import {
    registerForPushNotificationsAsync,
    addNotificationResponseReceivedListener,
    initNotificationHandler
} from "@/services/notificationService";
import { useAuthStore } from "@/shared/store/authStore";
import { webSocketService } from "@/shared/services/WebSocketService";
import IncomingCallModal from "@/views/mobile/chat/components/IncomingCallModal";
import CallModal from "@/views/mobile/chat/components/CallModal";

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

    useEffect(() => {
        // Khởi tạo handler thông báo (đã được bọc an toàn trong notificationService)
        initNotificationHandler();

        // ── Push Notification & WebSocket ──
        const setupServices = (token: string) => {
            registerForPushNotificationsAsync()
                .catch((err) => console.log('[RootLayout] Push registration skipped:', err?.message));

            // WebSocket activation - call queue subscription is handled
            // automatically inside WebSocketService.onConnect → subscribeCallQueue()
            webSocketService.activate(token);
        };

        const currentAuth = useAuthStore.getState();
        if (currentAuth.accessToken) {
            setupServices(currentAuth.accessToken);
        }

        // ── Listen for auth changes (login, token refresh, logout) ──
        const unsub = useAuthStore.subscribe((state, prevState) => {
            if (state.accessToken && state.accessToken !== prevState.accessToken) {
                setupServices(state.accessToken);
            } else if (!state.accessToken && prevState.accessToken) {
                webSocketService.deactivate();
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

    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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

            <IncomingCallModal />
            <View
                style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}
                pointerEvents="box-none"
            >
                <CallModal />
            </View>
        </SafeAreaProvider>
    );
}

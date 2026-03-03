import { Platform } from "react-native";
import { Slot } from "expo-router";
import { Tabs } from "expo-router/tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthGuard } from "@/shared/guards/AuthGuard";
import WebSidebar from "@/views/web/components/WebSidebar";
import { useWebSocketManager } from "@/shared/hooks/useWebSocketManager";

// Icon tab bar (mobile) - giống Zalo: Tin nhắn (chat), Danh bạ (people), Khám phá (grid), Tường nhà (newspaper), Cá nhân (person)
type IconName = keyof typeof Ionicons.glyphMap;
const TabIcon = ({
    name,
    focused,
    color,
    size = 24,
}: {
    name: IconName;
    focused: boolean;
    color: string;
    size?: number;
}) => (
    <Ionicons
        name={focused ? name : (`${name}-outline` as IconName)}
        size={size}
        color={color}
    />
);

export default function TabsLayout() {
    const isWeb = Platform.OS === "web";

    // Quản lý WebSocket toàn cục — luôn active dù đang ở tab nào
    useWebSocketManager();

    if (isWeb) {
        return (
            <AuthGuard mode="requireAuth">
                <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
                    <WebSidebar />
                    <main style={{ flex: 1, minWidth: 0 }}>
                        <Slot />
                    </main>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard mode="requireAuth">
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: "#0068FF",
                    tabBarInactiveTintColor: "#8e8e93",
                    tabBarStyle: { backgroundColor: "#0d0d0d", borderTopColor: "#2a2a2a" },
                    tabBarLabelStyle: { fontSize: 11 },
                    // Khi bàn phím ảo mở, ẩn thanh tab để tránh bị "đẩy" lên
                    tabBarHideOnKeyboard: true,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "Tin nhắn",
                        tabBarIcon: ({ color, focused }) => (
                            <TabIcon name="chatbubble" focused={focused} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="contacts"
                    options={{
                        title: "Danh bạ",
                        tabBarIcon: ({ color, focused }) => (
                            <TabIcon name="people" focused={focused} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen name="contacts-search" options={{ href: null }} />
                <Tabs.Screen
                    name="explore"
                    options={{
                        title: "Khám phá",
                        tabBarIcon: ({ color, focused }) => (
                            <TabIcon name="grid" focused={focused} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="work"
                    options={{
                        title: "Tường nhà",
                        tabBarIcon: ({ color, focused }) => (
                            <TabIcon name="home" focused={focused} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="account"
                    options={{
                        title: "Cá nhân",
                        tabBarIcon: ({ color, focused }) => (
                            <TabIcon name="person" focused={focused} color={color} />
                        ),
                    }}
                />
                {/* Các màn phụ không xuất hiện trên thanh tab */}
                <Tabs.Screen name="contacts-add" options={{ href: null }} />
                <Tabs.Screen name="contacts-requests" options={{ href: null }} />
                <Tabs.Screen name="contacts-birthdays" options={{ href: null }} />
                <Tabs.Screen name="blocked" options={{ href: null }} />
                <Tabs.Screen name="account-edit" options={{ href: null }} />
                <Tabs.Screen name="settings" options={{ href: null }} />
                <Tabs.Screen name="data" options={{ href: null }} />
                <Tabs.Screen name="files" options={{ href: null }} />
                <Tabs.Screen name="language" options={{ href: null }} />
                <Tabs.Screen name="support" options={{ href: null }} />
                <Tabs.Screen name="zalo-cloud" options={{ href: null }} />
                <Tabs.Screen name="create-group" options={{ href: null }} />
                <Tabs.Screen name="personal-profile" options={{ href: null }} />
                <Tabs.Screen name="profile-settings" options={{ href: null }} />
                <Tabs.Screen name="friend-profile" options={{ href: null }} />
            </Tabs>
        </AuthGuard>
    );
}

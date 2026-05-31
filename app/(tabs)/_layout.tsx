import { Platform, View, Text, TouchableOpacity } from "react-native";
import { Slot, useRouter } from "expo-router";
import { Tabs } from "expo-router/tabs";
import { Ionicons } from "@expo/vector-icons";
import { AuthGuard } from "@/shared/guards/AuthGuard";
import WebSidebar from "@/views/web/components/WebSidebar";
import { useWebSocketManager } from "@/shared/hooks/useWebSocketManager";
import { useThemeColors } from "@/shared/theme/colors";
import { useAuthStore } from "@/shared/store/authStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const impersonatorToken = useAuthStore(state => state.impersonatorToken);
    const restoreImpersonator = useAuthStore(state => state.restoreImpersonator);

    // Quản lý WebSocket toàn cục — luôn active dù đang ở tab nào
    useWebSocketManager();

    const renderImpersonatorBanner = () => {
        if (!impersonatorToken || !isWeb) return null;
        return (
            <View style={{ position: "absolute", top: 24, left: 0, right: 0, alignItems: "center", zIndex: 9999, pointerEvents: "box-none" }}>
                <View style={{
                    backgroundColor: "#ef4444", padding: 8, paddingHorizontal: 14, borderRadius: 30,
                    flexDirection: "row", alignItems: "center", gap: 12,
                    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
                    pointerEvents: "auto"
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="warning" size={18} color="#fff" />
                        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Đang mạo danh</Text>
                    </View>
                    <TouchableOpacity
                        style={{ backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
                        onPress={() => {
                            restoreImpersonator();
                            router.replace("/admin");
                        }}
                    >
                        <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 12 }}>Thoát</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (isWeb) {
        return (
            <AuthGuard mode="requireAuth">
                <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }}>
                    <WebSidebar />
                    <main style={{ flex: 1, minWidth: 0, height: "100vh", overflow: "hidden", position: "relative" }}>
                        {renderImpersonatorBanner()}
                        <Slot />
                    </main>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard mode="requireAuth">
            <Tabs
                backBehavior="history"
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: colors.tabBarActive,
                    tabBarInactiveTintColor: colors.tabBarInactive,
                    tabBarStyle: {
                        backgroundColor: colors.tabBarBg,
                        borderTopColor: colors.tabBarBorder,
                        borderTopWidth: 1,
                        height: Platform.OS === "ios" ? 88 : 60,
                        paddingBottom: Platform.OS === "ios" ? 30 : 10,
                        elevation: 0, // Remove shadow on Android
                        shadowOpacity: 0, // Remove shadow on iOS
                    },
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

                <Tabs.Screen
                    name="explore"
                    options={{
                        href: null,
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
                <Tabs.Screen name="friend-profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
                <Tabs.Screen name="appearance" options={{ href: null }} />
                <Tabs.Screen name="search-sources" options={{ href: null }} />
            </Tabs>
        </AuthGuard>
    );
}

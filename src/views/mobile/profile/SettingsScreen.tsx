import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet, Switch } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { profileStyles } from "./styles";
import { useAuthStore } from "@/shared/store/authStore";
import { useUserStore } from "@/shared/store/userStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { useGroupStore } from "@/shared/store/useGroupStore";
import { useFriendStore } from "@/shared/store/friendStore";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";
import { useNotificationSettingsStore } from "@/shared/store/notificationSettingsStore";
import {
    registerForPushNotificationsAsync,
    unregisterForPushNotificationsAsync,
} from "@/services/notificationService";
import { useInAppNotifStore } from "@/views/mobile/chat/components/InAppNotification";

const createHeaderStyles = (colors: ThemeColors) => StyleSheet.create({
    header: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.headerBg,
        gap: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.headerText,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: colors.card,
        marginHorizontal: 16,
        borderRadius: 12,
        gap: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: "500",
        color: "#ff3b30",
    },
    rowText: {
        fontSize: 16,
        fontWeight: "500",
        color: colors.text,
    },
    rowContent: {
        flex: 1,
    },
    rowSubtitle: {
        marginTop: 3,
        fontSize: 13,
        lineHeight: 18,
        color: colors.textSecondary,
    },
});

export default function SettingsScreen() {
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);
    const colors = useThemeColors();
    const headerStyles = createHeaderStyles(colors);
    const notificationsEnabled = useNotificationSettingsStore((s) => s.enabled);
    const setNotificationsEnabled = useNotificationSettingsStore((s) => s.setEnabled);

    const handleNotificationToggle = (enabled: boolean) => {
        setNotificationsEnabled(enabled);
        if (enabled) {
            void registerForPushNotificationsAsync();
        } else {
            useInAppNotifStore.getState().dismiss();
            void unregisterForPushNotificationsAsync();
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Đăng xuất",
            "Bạn có chắc muốn đăng xuất?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Đăng xuất",
                    style: "destructive",
                    onPress: () => {
                        (async () => {
                            try { await logout(); } catch { /* ignore */ }
                            try {
                                useUserStore.getState().clear();
                                useChatStore.getState().clear();
                                useGroupStore.getState().clear();
                                useFriendStore.getState().clear();
                            } catch { /* ignore */ }
                            router.replace("/(auth)/login");
                        })();
                    },
                },
            ]
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                <View style={[headerStyles.header, { borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5 }]}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ paddingVertical: 8, paddingRight: 8 }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={headerStyles.title}>Cài đặt</Text>
                </View>
            </SafeAreaView>

            {/* Giao diện */}
            <TouchableOpacity
                style={[headerStyles.row, { marginTop: 24 }]}
                onPress={() => router.push("/(tabs)/appearance")}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="color-palette-outline"
                    size={24}
                    color={colors.textSecondary}
                />
                <Text style={headerStyles.rowText}>Giao diện</Text>
            </TouchableOpacity>



            {/* Đăng xuất */}
            <View style={[headerStyles.row, { marginTop: 16 }]}>
                <Ionicons
                    name={notificationsEnabled ? "notifications-outline" : "notifications-off-outline"}
                    size={24}
                    color={colors.textSecondary}
                />
                <View style={headerStyles.rowContent}>
                    <Text style={headerStyles.rowText}>Quản lý thông báo</Text>
                    <Text style={headerStyles.rowSubtitle}>
                        {notificationsEnabled
                            ? "App được phép hiển thị thông báo pop up."
                            : "App sẽ không hiển thị thông báo pop up ra ngoài."}
                    </Text>
                </View>
                <Switch
                    value={notificationsEnabled}
                    onValueChange={handleNotificationToggle}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                    ios_backgroundColor={colors.border}
                />
            </View>

            <TouchableOpacity
                style={[headerStyles.row, { marginTop: 16 }]}
                onPress={handleLogout}
                activeOpacity={0.7}
            >
                <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
                <Text style={headerStyles.logoutText}>Đăng xuất</Text>
            </TouchableOpacity>
        </View>
    );
}

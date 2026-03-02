import React from "react";
import { View, Text, TouchableOpacity, StatusBar, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { profileStyles, PROFILE_COLORS } from "./styles";
import { useAuthStore } from "@/shared/store/authStore";

const headerStyles = {
    header: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: PROFILE_COLORS.border,
        gap: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: "600" as const,
        color: PROFILE_COLORS.text,
    },
    row: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: PROFILE_COLORS.card,
        marginHorizontal: 16,
        borderRadius: 12,
        gap: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: "500" as const,
        color: "#ff3b30",
    },
    rowText: {
        fontSize: 16,
        fontWeight: "500" as const,
        color: PROFILE_COLORS.text,
    },
};

export default function SettingsScreen() {
    const router = useRouter();
    const logout = useAuthStore((s) => s.logout);

    const handleLogout = () => {
        Alert.alert(
            "Đăng xuất",
            "Bạn có chắc muốn đăng xuất?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Đăng xuất",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                        router.replace("/(auth)/login");
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={profileStyles.container} edges={["top"]}>
            <StatusBar barStyle="light-content" backgroundColor={PROFILE_COLORS.background} />

            <View style={headerStyles.header}>
                <TouchableOpacity
                    onPress={() => router.replace("/(tabs)/account")}
                    style={{ padding: 8 }}
                >
                    <Ionicons name="arrow-back" size={24} color={PROFILE_COLORS.text} />
                </TouchableOpacity>
                <Text style={headerStyles.title}>Cài đặt</Text>
            </View>

            {/* Danh sách chặn tin nhắn */}
            <TouchableOpacity
                style={[headerStyles.row, { marginTop: 24 }]}
                onPress={() => router.push("/(tabs)/blocked")}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="ban-outline"
                    size={24}
                    color={PROFILE_COLORS.textSecondary}
                />
                <Text style={headerStyles.rowText}>Danh sách chặn tin nhắn</Text>
            </TouchableOpacity>

            {/* Đăng xuất */}
            <TouchableOpacity
                style={[headerStyles.row, { marginTop: 16 }]}
                onPress={handleLogout}
                activeOpacity={0.7}
            >
                <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
                <Text style={headerStyles.logoutText}>Đăng xuất</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

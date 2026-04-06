import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { UserProfile } from "@/shared/services/types";
import { useThemeColors, ThemeColors } from "@/shared/theme/colors";

interface ProfileSettingsScreenProps {
    user?: UserProfile | null;
}

interface SettingsItemProps {
    label: string;
    onPress?: () => void;
    isHeader?: boolean;
    colors: ThemeColors;
}

function SettingsItem({ label, onPress, isHeader, colors }: SettingsItemProps) {
    if (isHeader) {
        return (
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                }}
            >
                <Text
                    style={{
                        color: colors.primary,
                        fontSize: 15,
                        fontWeight: "600",
                    }}
                >
                    {label}
                </Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            onPress={() => {
                console.log(`SettingsItem pressed: ${label}`);
                alert(`Pressed: ${label}`);
                onPress?.();
            }}
            activeOpacity={0.7}
            style={{
                paddingHorizontal: 16,
                paddingVertical: 20, // Tăng padding để dễ nhấn hơn
                backgroundColor: colors.card,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
                minHeight: 60, // Đảm bảo có chiều cao tối thiểu
            }}
        >
            <Text
                style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: "500", // Tăng đậm để dễ thấy
                }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export default function ProfileSettingsScreen({ user }: ProfileSettingsScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />

            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                {/* Header */}
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace("/(tabs)/personal-profile");
                            }
                        }}
                        style={{ paddingRight: 8, paddingVertical: 4 }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "600",
                            color: colors.headerText,
                            flex: 1,
                        }}
                    >
                        {displayName}
                    </Text>
                </View>
            </SafeAreaView>

            {/* Menu list */}
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Nhóm 1: Thông tin cá nhân */}
                <SettingsItem
                    label="Thông tin"
                    onPress={() => router.push("/(tabs)/account-edit")}
                    colors={colors}
                />
                <SettingsItem label="Đổi ảnh đại diện" colors={colors} />
                <SettingsItem label="Đổi ảnh bìa" colors={colors} />
                <SettingsItem label="Cập nhật giới thiệu bản thân" colors={colors} />
                <SettingsItem label="Ví của tôi" colors={colors} />

                {/* Separator */}
                <View style={{ height: 8, backgroundColor: colors.separator }} />

                {/* Nhóm 2: Cài đặt */}
                <SettingsItem label="Cài đặt" isHeader colors={colors} />
                <SettingsItem label="Mã QR của tôi" colors={colors} />
                <SettingsItem 
                    label="Quyền riêng tư" 
                    onPress={() => {
                        console.log("=== PRIVACY PRESSED ===");
                        alert("Privacy pressed!");
                        router.push("/privacy");
                    }} 
                    colors={colors} 
                />
                <SettingsItem label="Quản lý tài khoản" colors={colors} />
                <SettingsItem label="Cài đặt chung" colors={colors} />

                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

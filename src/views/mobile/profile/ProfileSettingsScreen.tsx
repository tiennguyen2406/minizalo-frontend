import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "./styles";
import type { UserProfile } from "@/shared/services/types";

interface ProfileSettingsScreenProps {
    user?: UserProfile | null;
}

interface SettingsItemProps {
    label: string;
    onPress?: () => void;
    isHeader?: boolean;
}

function SettingsItem({ label, onPress, isHeader }: SettingsItemProps) {
    if (isHeader) {
        return (
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "#2a2a2a",
                }}
            >
                <Text
                    style={{
                        color: PROFILE_COLORS.primary,
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
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: "#2a2a2a",
            }}
        >
            <Text
                style={{
                    color: PROFILE_COLORS.text,
                    fontSize: 15,
                }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export default function ProfileSettingsScreen({ user }: ProfileSettingsScreenProps) {
    const router = useRouter();

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: PROFILE_COLORS.background }}
            edges={["top"]}
        >
            <StatusBar barStyle="light-content" backgroundColor={PROFILE_COLORS.background} />

            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "#2a2a2a",
                }}
            >
                <TouchableOpacity
                    onPress={() => router.navigate("/(tabs)/personal-profile" as any)}
                    style={{ padding: 4, marginRight: 8 }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={24} color={PROFILE_COLORS.text} />
                </TouchableOpacity>
                <Text
                    style={{
                        fontSize: 17,
                        fontWeight: "600",
                        color: PROFILE_COLORS.text,
                        flex: 1,
                    }}
                >
                    {displayName}
                </Text>
            </View>

            {/* Menu list */}
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Nhóm 1: Thông tin cá nhân */}
                <SettingsItem
                    label="Thông tin"
                    onPress={() => router.push("/(tabs)/account-edit")}
                />
                <SettingsItem label="Đổi ảnh đại diện" />
                <SettingsItem label="Đổi ảnh bìa" />
                <SettingsItem label="Cập nhật giới thiệu bản thân" />
                <SettingsItem label="Ví của tôi" />

                {/* Separator */}
                <View style={{ height: 8, backgroundColor: "#1c1c1e" }} />

                {/* Nhóm 2: Cài đặt */}
                <SettingsItem label="Cài đặt" isHeader />
                <SettingsItem label="Mã QR của tôi" />
                <SettingsItem label="Quyền riêng tư" />
                <SettingsItem label="Quản lý tài khoản" />
                <SettingsItem label="Cài đặt chung" />

                <View style={{ height: 48 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

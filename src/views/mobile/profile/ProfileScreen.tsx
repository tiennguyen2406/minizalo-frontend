import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { profileStyles } from "./styles";
import type { UserProfile } from "@/shared/services/types";
import { useThemeColors } from "@/shared/theme/colors";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Icon trong ô vuông xanh (giống Zalo): cloud, sparkles, folder, time, qr-code, shield, lock
const ListIcon = ({ name }: { name: IconName }) => {
    const colors = useThemeColors();
    return (
        <View style={[profileStyles.listItemIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name={name} size={18} color="#fff" />
        </View>
    );
};

interface MenuItemProps {
    icon: IconName;
    title: string;
    subtitle?: string;
    onPress?: () => void;
}

function MenuItem({ icon, title, subtitle, onPress }: MenuItemProps) {
    const colors = useThemeColors();
    return (
        <TouchableOpacity
            style={[
                profileStyles.listItem,
                {
                    backgroundColor: colors.card,
                    borderBottomColor: colors.border
                }
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <ListIcon name={icon} />
            <View style={profileStyles.listItemContent}>
                <Text style={[profileStyles.listItemTitle, { color: colors.text }]}>{title}</Text>
                {subtitle ? (
                    <Text style={[profileStyles.listItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            <Text style={[profileStyles.listItemArrow, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
    );
}

interface ProfileScreenProps {
    user?: UserProfile | null;
}

export default function ProfileScreen({ user }: ProfileScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const [searchQuery, setSearchQuery] = useState("");

    // Tên tài khoản vừa đăng nhập: ưu tiên displayName, rồi username (SĐT/email)
    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";
    const avatarUrl = user?.avatarUrl ?? null;
    const avatarInitial = displayName.charAt(0).toUpperCase() || "U";

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
                {/* Search + Settings */}
                <View
                    style={{
                        height: 52,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            borderRadius: 10,
                            backgroundColor: colors.headerSearchBg,
                            paddingHorizontal: 10,
                            height: 36,
                        }}
                    >
                        <Ionicons name="search" size={18} color={colors.headerIcon} />
                        <TextInput
                            style={{
                                flex: 1,
                                fontSize: 15,
                                color: colors.headerText,
                                marginLeft: 8,
                                paddingVertical: 0,
                            }}
                            placeholder="Tìm kiếm"
                            placeholderTextColor={colors.headerIcon}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            showSoftInputOnFocus={false}
                            onFocus={() => {
                                setSearchQuery("");
                                router.push({
                                    pathname: "/search",
                                    params: { from: "account", t: Date.now() },
                                });
                            }}
                        />
                        {searchQuery ? (
                            <TouchableOpacity
                                onPress={() => setSearchQuery("")}
                                style={{ paddingLeft: 4 }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="close-circle"
                                    size={18}
                                    color={colors.headerIcon}
                                />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        style={{ padding: 4 }}
                        onPress={() => router.push("/(tabs)/settings")}
                    >
                        <Ionicons name="settings-outline" size={24} color={colors.headerIcon} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Profile block */}
            <TouchableOpacity
                style={[profileStyles.profileSection, { backgroundColor: colors.card }]}
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/personal-profile")}
            >
                {avatarUrl ? (
                    <Image
                        source={{ uri: avatarUrl as string }}
                        style={[profileStyles.avatar]}
                    />
                ) : (
                    <View
                        style={[
                            profileStyles.avatar,
                            {
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: colors.avatarBg
                            },
                        ]}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 28,
                                fontWeight: "600",
                            }}
                        >
                            {avatarInitial}
                        </Text>
                    </View>
                )}
                <View style={profileStyles.nameRow}>
                    <Text style={[profileStyles.displayName, { color: colors.text }]}>{displayName}</Text>
                </View>
            </TouchableOpacity>

            {/* Menu list - grouped with separators */}
            <ScrollView style={[profileStyles.list, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
                {/* Thanh phân tách sau profile */}
                <View style={{ height: 8, backgroundColor: colors.separator }} />





                {/* Nhóm 3: Bảo mật & Riêng tư */}
                <MenuItem
                    icon="shield-checkmark"
                    title="Tài khoản và bảo mật"
                    onPress={() => router.push("/account-security")}
                />
                <MenuItem
                    icon="lock-closed"
                    title="Quyền riêng tư"
                    onPress={() => router.push("/privacy")}
                />

                {/* Padding bottom */}
                <View style={{ height: 24 }} />
            </ScrollView>
        </View>
    );
}

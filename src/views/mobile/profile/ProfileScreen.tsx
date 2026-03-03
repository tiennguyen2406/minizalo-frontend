import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { profileStyles, PROFILE_COLORS } from "./styles";
import type { UserProfile } from "@/shared/services/types";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Icon trong ô vuông xanh (giống Zalo): cloud, sparkles, folder, time, qr-code, shield, lock
const ListIcon = ({ name }: { name: IconName }) => (
    <View style={profileStyles.listItemIcon}>
        <Ionicons name={name} size={18} color="#fff" />
    </View>
);

interface MenuItemProps {
    icon: IconName;
    title: string;
    subtitle?: string;
    onPress?: () => void;
}

function MenuItem({ icon, title, subtitle, onPress }: MenuItemProps) {
    return (
        <TouchableOpacity
            style={profileStyles.listItem}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <ListIcon name={icon} />
            <View style={profileStyles.listItemContent}>
                <Text style={profileStyles.listItemTitle}>{title}</Text>
                {subtitle ? (
                    <Text style={profileStyles.listItemSubtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            <Text style={profileStyles.listItemArrow}>›</Text>
        </TouchableOpacity>
    );
}

interface ProfileScreenProps {
    user?: UserProfile | null;
}

export default function ProfileScreen({ user }: ProfileScreenProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    // Tên tài khoản vừa đăng nhập: ưu tiên displayName, rồi username (SĐT/email)
    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";
    const avatarUrl = user?.avatarUrl ?? null;
    const avatarInitial = displayName.charAt(0).toUpperCase() || "U";

    return (
        <SafeAreaView style={profileStyles.container} edges={["top"]}>
            <StatusBar barStyle="light-content" backgroundColor={PROFILE_COLORS.background} />

            {/* Search + Settings */}
            <View style={profileStyles.searchRow}>
                <View style={profileStyles.searchBox}>
                    <Ionicons name="search" size={20} color={PROFILE_COLORS.textSecondary} />
                    <TextInput
                        style={profileStyles.searchInput}
                        placeholder="Tìm kiếm"
                        placeholderTextColor={PROFILE_COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        showSoftInputOnFocus={false}
                        onFocus={() => {
                            setSearchQuery("");
                            router.push({
                                pathname: "/(tabs)/contacts-search",
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
                                color={PROFILE_COLORS.textSecondary}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity
                    style={profileStyles.settingsButton}
                    onPress={() => router.push("/(tabs)/settings")}
                >
                    <Ionicons name="settings-outline" size={24} color={PROFILE_COLORS.text} />
                </TouchableOpacity>
            </View>

            {/* Profile block - nền xám nhạt hơn background */}
            <TouchableOpacity
                style={[profileStyles.profileSection, { backgroundColor: '#1a1a1e' }]}
                activeOpacity={0.8}
                onPress={() => router.push("/(tabs)/personal-profile")}
            >
                {avatarUrl ? (
                    <Image
                        source={{ uri: avatarUrl }}
                        style={[profileStyles.avatar, { borderWidth: 2, borderColor: '#fff' }]}
                    />
                ) : (
                    <View
                        style={[
                            profileStyles.avatar,
                            {
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: '#fff',
                            },
                        ]}
                    >
                        <Text
                            style={{
                                color: PROFILE_COLORS.text,
                                fontSize: 28,
                                fontWeight: "600",
                            }}
                        >
                            {avatarInitial}
                        </Text>
                    </View>
                )}
                <View style={profileStyles.nameRow}>
                    <Text style={profileStyles.displayName}>{displayName}</Text>
                </View>
            </TouchableOpacity>

            {/* Menu list - grouped with gray separators like Zalo */}
            <ScrollView style={profileStyles.list} showsVerticalScrollIndicator={false}>
                {/* Thanh phân tách sau profile */}
                <View style={{ height: 8, backgroundColor: '#1c1c1e' }} />

                {/* Nhóm 1: Cloud & Style */}
                <MenuItem
                    icon="cloud"
                    title="zCloud"
                    subtitle="Không gian lưu trữ dữ liệu trên đám mây"
                />
                <MenuItem
                    icon="sparkles"
                    title="zStyle – Nổi bật trên Zalo"
                    subtitle="Hình nền và nhạc cho cuộc gọi Zalo"
                />

                {/* Thanh phân tách */}
                <View style={{ height: 8, backgroundColor: '#1c1c1e' }} />

                {/* Nhóm 2: Documents & Data */}
                <MenuItem
                    icon="folder"
                    title="My Documents"
                    subtitle="Lưu trữ các tin nhắn quan trọng"
                />
                <MenuItem
                    icon="time"
                    title="Dữ liệu trên máy"
                    subtitle="Quản lý dữ liệu Zalo của bạn"
                />
                <MenuItem
                    icon="qr-code"
                    title="Ví QR"
                    subtitle="Lưu trữ và xuất trình các mã QR quan trọng"
                />

                {/* Thanh phân tách */}
                <View style={{ height: 8, backgroundColor: '#1c1c1e' }} />

                {/* Nhóm 3: Bảo mật & Riêng tư */}
                <MenuItem
                    icon="shield-checkmark"
                    title="Tài khoản và bảo mật"
                />
                <MenuItem
                    icon="lock-closed"
                    title="Quyền riêng tư"
                />

                {/* Padding bottom */}
                <View style={{ height: 24 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

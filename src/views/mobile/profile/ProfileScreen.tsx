import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { profileStyles } from "./styles";
import type { UserProfile } from "@/shared/services/types";
import { useThemeColors } from "@/shared/theme/colors";
import { chatService, mapChatRoomResponseToFrontend } from "@/shared/services/chatService";
import { useChatStore } from "@/shared/store/useChatStore";

type IconName = ComponentProps<typeof Ionicons>["name"];

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
                    borderBottomColor: colors.border,
                },
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
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

interface ProfileScreenProps {
    user?: UserProfile | null;
}

export default function ProfileScreen({ user }: ProfileScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const rooms = useChatStore((s) => s.rooms);
    const mergeRooms = useChatStore((s) => s.mergeRooms);
    const [searchQuery, setSearchQuery] = useState("");

    const displayName =
        (user?.displayName?.trim() || user?.username?.trim() || "").trim() || "Người dùng";
    const avatarUrl = user?.avatarUrl ?? null;
    const avatarInitial = displayName.charAt(0).toUpperCase() || "U";

    const openMyDocuments = async () => {
        try {
            let cloudRoom = rooms.find((room) => room.type === "CLOUD");

            if (!cloudRoom?.id) {
                const apiRooms = await chatService.getChatRooms();
                const mappedRooms = apiRooms.map(mapChatRoomResponseToFrontend);
                mergeRooms(mappedRooms as any);
                cloudRoom = mappedRooms.find((room) => room.type === "CLOUD");
            }

            if (!cloudRoom?.id) {
                Alert.alert("My Documents", "Không tìm thấy Cloud của tôi. Vui lòng thử lại.");
                return;
            }

            router.push(
                `/chat/${cloudRoom.id}?name=${encodeURIComponent("Cloud của tôi")}&type=CLOUD&isStranger=false`,
            );
        } catch (error) {
            console.error("Open My Documents error:", error);
            Alert.alert("Lỗi", "Không thể mở Cloud của tôi. Vui lòng thử lại sau.");
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <SafeAreaView style={{ backgroundColor: colors.headerBg }} edges={["top"]}>
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
                                backgroundColor: colors.avatarBg,
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

            <ScrollView style={[profileStyles.list, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
                <View style={{ height: 8, backgroundColor: colors.separator }} />

                <MenuItem
                    icon="folder"
                    title="My Documents"
                    subtitle="Lưu trữ các tin nhắn quan trọng"
                    onPress={openMyDocuments}
                />

                <View style={{ height: 8, backgroundColor: colors.separator }} />




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

                <MenuItem
                    icon="settings"
                    title="Cài đặt chung"
                    onPress={() => router.push("/(tabs)/settings")}
                />
                <MenuItem
                    icon="help-circle"
                    title="Trung tâm trợ giúp"
                    subtitle="Hướng dẫn sử dụng và hỗ trợ nhanh"
                    onPress={() => router.push("/(tabs)/support")}
                />

                <View style={{ height: 24 }} />
            </ScrollView>
        </View>
    );
}

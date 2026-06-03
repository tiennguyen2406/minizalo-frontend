import React from "react";
import { View, Text, TouchableOpacity, Image, FlatList, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { GroupDetail, GroupMember } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";

interface GroupMembersScreenProps {
    group: GroupDetail;
    currentUserId?: string;
    /** Chủ nhóm hoặc phó nhóm (ADMIN): thêm / xóa thành viên */
    canManage: boolean;
    onClose: () => void;
    onRequestAddMember: () => void;
    onRemoveMember: (memberId: string) => void;
}

export default function GroupMembersScreen({
    group,
    currentUserId,
    canManage,
    onClose,
    onRequestAddMember,
    onRemoveMember,
}: GroupMembersScreenProps) {
    const colors = useThemeColors();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const members = Array.isArray(group.members) ? group.members.filter((m) => m?.userId) : [];

    const confirmRemove = (member: GroupMember) => {
        const displayName = member.fullName || member.username || "thành viên này";
        Alert.alert(
            "Xóa thành viên",
            `Xóa ${displayName} khỏi nhóm?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: () => onRemoveMember(member.userId),
                },
            ],
        );
    };

    const renderMember = ({ item: member }: { item: GroupMember }) => {
        const memberId = String(member.userId);
        const ownerId = String(group.ownerId || "");
        const meId = currentUserId ? String(currentUserId) : "";
        const displayName = member.fullName || member.username || "Người dùng";
        const avatarUri =
            typeof member.avatarUrl === "string" && /^https?:\/\//i.test(member.avatarUrl)
                ? member.avatarUrl
                : "";
        const initials = displayName
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("") || "?";
        const isOwnerMember = memberId === ownerId;
        const isAdminRole = member.role === "ADMIN";
        const isCurrentUser = !!meId && memberId === meId;
        const canRemove =
            canManage && !isOwnerMember && !isCurrentUser;
        const openProfile = () => {
            if (isCurrentUser) {
                router.push("/(tabs)/personal-profile" as any);
                return;
            }
            router.push({
                pathname: "/(tabs)/friend-profile",
                params: {
                    userId: memberId,
                    displayName,
                    avatarUrl: avatarUri,
                },
            } as any);
        };

        return (
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={openProfile}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    backgroundColor: colors.card,
                }}
            >
                {avatarUri ? (
                    <Image
                        source={{ uri: avatarUri }}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            marginRight: 12,
                            backgroundColor: colors.separator,
                        }}
                    />
                ) : (
                    <View
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            marginRight: 12,
                            backgroundColor: colors.primary,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                            {initials}
                        </Text>
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 15, color: colors.text, fontWeight: "500" }} numberOfLines={1}>
                            {displayName}
                        </Text>
                        {isCurrentUser ? (
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>(Bạn)</Text>
                        ) : null}
                    </View>
                </View>
                {isOwnerMember ? (
                    <View
                        style={{
                            backgroundColor: colors.primary + "22",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                            marginRight: canRemove ? 8 : 0,
                        }}
                    >
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Trưởng nhóm</Text>
                    </View>
                ) : isAdminRole ? (
                    <View
                        style={{
                            backgroundColor: colors.primary + "18",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                            marginRight: canRemove ? 8 : 0,
                        }}
                    >
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>Phó nhóm</Text>
                    </View>
                ) : null}
                {canRemove ? (
                    <TouchableOpacity style={{ padding: 6 }} onPress={() => confirmRemove(member)}>
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                ) : null}
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            <View style={{ backgroundColor: colors.headerBg, paddingTop: insets.top }}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 12,
                            minHeight: 52,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                            borderBottomColor: colors.border,
                        }}
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.6}
                            style={{ paddingRight: 8, paddingVertical: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                        </TouchableOpacity>
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: "600",
                                color: colors.headerText,
                                flex: 1,
                            }}
                            numberOfLines={1}
                        >
                            {canManage ? "Quản lý thành viên" : "Thành viên"} ({members.length})
                        </Text>
                        {canManage ? (
                            <TouchableOpacity
                                onPress={() => {
                                    onClose();
                                    setTimeout(onRequestAddMember, 220);
                                }}
                                activeOpacity={0.6}
                                style={{ padding: 6 }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="person-add-outline" size={24} color={colors.headerText} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 36 }} />
                        )}
                    </View>
            </View>

            <FlatList
                data={members}
                keyExtractor={(item) => String(item.userId)}
                renderItem={renderMember}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            />
        </View>
    );
}

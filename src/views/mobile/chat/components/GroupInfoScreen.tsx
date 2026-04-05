import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    StatusBar as RNStatusBar,
    Alert,
    Switch,
    Modal,
    TextInput,
    FlatList,
} from "react-native";
import { SafeAreaView as SafeAreaViewCtx } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { groupService } from "@/shared/services/groupService";
import { friendService } from "@/shared/services/friendService";
import { useAuthStore } from "@/shared/store/authStore";
import { GroupDetail } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";
import { useRouter } from "expo-router";

interface GroupInfoScreenProps {
    roomId: string;
    onClose: () => void;
}

// ─── Add Member Modal ───
interface Friend {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
}

function AddMemberModal({
    visible,
    onClose,
    groupId,
    existingMemberIds,
    onMembersAdded,
}: {
    visible: boolean;
    onClose: () => void;
    groupId: string;
    existingMemberIds: string[];
    onMembersAdded: (newGroup: GroupDetail) => void;
}) {
    const colors = useThemeColors();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        setSelectedIds([]);
        setSearchQuery("");
        friendService
            .getFriends()
            .then((data) => {
                const mapped: Friend[] = (data as any[])
                    .map((f) => ({
                        id: f.friend?.id || f.id || "",
                        username: f.friend?.username || f.username || "",
                        fullName:
                            f.friend?.displayName ||
                            f.friend?.fullName ||
                            f.displayName ||
                            f.fullName ||
                            f.friend?.username ||
                            f.username ||
                            "",
                        avatarUrl: f.friend?.avatarUrl || f.avatarUrl || undefined,
                    }))
                    .filter((f) => !!f.id && !existingMemberIds.includes(f.id));
                setFriends(mapped);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [visible, existingMemberIds]);

    const filtered = friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.fullName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q);
    });

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }, []);

    const handleAdd = async () => {
        if (selectedIds.length === 0) return;
        setSubmitting(true);
        try {
            const updated = await groupService.addMembersToGroup(groupId, selectedIds);
            onMembersAdded(updated);
            onClose();
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Thêm thành viên thất bại.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
                }}
            >
                {/* Header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        height: 52,
                        backgroundColor: colors.headerBg,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                        gap: 12,
                    }}
                >
                    <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 12 }}>
                        <Ionicons name="close" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.headerText }}>
                            Thêm thành viên
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                            Đã chọn: {selectedIds.length}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleAdd}
                        disabled={selectedIds.length === 0 || submitting}
                        style={{
                            backgroundColor: selectedIds.length > 0 ? colors.primary : colors.separator,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 16,
                        }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text
                                style={{
                                    color: selectedIds.length > 0 ? "#fff" : colors.textSecondary,
                                    fontWeight: "600",
                                    fontSize: 14,
                                }}
                            >
                                Thêm
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.card,
                    }}
                >
                    <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Tìm tên bạn bè"
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 4 }}
                    />
                </View>

                {/* List */}
                {loading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : friends.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
                        <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 10, textAlign: "center" }}>
                            Tất cả bạn bè đã trong nhóm
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                            const isSelected = selectedIds.includes(item.id);
                            const avatar =
                                item.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    item.fullName || item.username
                                )}&background=0068FF&color=fff&bold=true`;
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => toggleSelect(item.id)}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        backgroundColor: colors.background,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            borderWidth: 2,
                                            borderColor: isSelected ? colors.primary : colors.textSecondary,
                                            backgroundColor: isSelected ? colors.primary : "transparent",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginRight: 12,
                                        }}
                                    >
                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                    <Image
                                        source={{ uri: avatar }}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            marginRight: 12,
                                            backgroundColor: colors.separator,
                                        }}
                                    />
                                    <Text style={{ fontSize: 15, color: colors.text }} numberOfLines={1}>
                                        {item.fullName || item.username}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}

// ─── Section Row Component ───
function SectionRow({
    icon,
    iconColor,
    label,
    subtitle,
    onPress,
    rightElement,
    showChevron = true,
}: {
    icon: string;
    iconColor?: string;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
}) {
    const colors = useThemeColors();
    return (
        <TouchableOpacity
            activeOpacity={onPress ? 0.7 : 1}
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
            }}
        >
            <Ionicons
                name={icon as any}
                size={22}
                color={iconColor || colors.textSecondary}
                style={{ marginRight: 14, width: 24, textAlign: "center" }}
            />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
                {subtitle && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
                )}
            </View>
            {rightElement}
            {showChevron && !rightElement && (
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
        </TouchableOpacity>
    );
}

// ─── Main GroupInfoScreen ───
export default function GroupInfoScreen({ roomId, onClose }: GroupInfoScreenProps) {
    const router = useRouter();
    const colors = useThemeColors();
    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLeaving, setIsLeaving] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showMembers, setShowMembers] = useState(false);

    const currentUserId = useAuthStore.getState().user?.id;

    useEffect(() => {
        if (!roomId) return;
        setLoading(true);
        groupService
            .getGroupDetails(roomId)
            .then((detail) => setGroup(detail))
            .catch((err) => console.error("Error fetching group:", err))
            .finally(() => setLoading(false));
    }, [roomId]);

    const isOwner = group?.ownerId === currentUserId;
    const currentUserRole = group?.members.find((m) => m.userId === currentUserId)?.role;
    const isAdmin = currentUserRole === "ADMIN";
    const canManageMembers = isOwner || isAdmin;

    const handleRemoveMember = (memberId: string) => {
        Alert.alert("Xóa thành viên", "Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    try {
                        const updated = await groupService.removeMembersFromGroup(roomId, [memberId]);
                        setGroup(updated);
                    } catch (err: any) {
                        Alert.alert("Lỗi", err?.response?.data?.message || "Xóa thành viên thất bại.");
                    }
                },
            },
        ]);
    };

    const handleDisbandGroup = () => {
        Alert.alert("Giải tán nhóm", "Hành động này không thể hoàn tác. Tất cả thành viên và tin nhắn sẽ bị xóa. Bạn có chắc chắn muốn giải tán nhóm này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Giải tán",
                style: "destructive",
                onPress: async () => {
                    setIsLeaving(true);
                    try {
                        await groupService.disbandGroup(roomId);
                        onClose();
                        router.replace("/(tabs)");
                    } catch (err: any) {
                        Alert.alert("Lỗi", err?.response?.data?.message || "Giải tán nhóm thất bại.");
                    } finally {
                        setIsLeaving(false);
                    }
                },
            },
        ]);
    };

    const handleLeaveGroup = () => {
        Alert.alert("Rời nhóm", "Bạn có chắc chắn muốn rời nhóm này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Rời nhóm",
                style: "destructive",
                onPress: async () => {
                    setIsLeaving(true);
                    try {
                        await groupService.leaveGroup(roomId);
                        onClose();
                        router.replace("/(tabs)");
                    } catch (err: any) {
                        Alert.alert("Lỗi", err?.response?.data?.message || "Rời nhóm thất bại.");
                    } finally {
                        setIsLeaving(false);
                    }
                },
            },
        ]);
    };

    // ─── Loading / Error states ───
    if (loading || !group) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
                }}
            >
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    {loading ? (
                        <>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Đang tải...</Text>
                        </>
                    ) : (
                        <Text style={{ color: colors.textSecondary }}>Không tải được thông tin nhóm</Text>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    const avatarUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        group.groupName
    )}&background=0068FF&color=fff&bold=true&size=120`;

    const existingMemberIds = group.members.map((m) => m.userId);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={colors.statusBar} />
            {/* ── Header (giống ChatOptionsScreen – màu xanh phủ tận status bar) ── */}
            <View style={{ backgroundColor: colors.headerBg }}>
                <SafeAreaViewCtx edges={["top"]}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            height: 52,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                            borderBottomColor: colors.border,
                        }}
                    >
                        {/* Left: Back & Title */}
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <TouchableOpacity
                                onPress={onClose}
                                activeOpacity={0.7}
                                style={{ paddingRight: 8, paddingVertical: 4 }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{ color: colors.headerText, fontSize: 17, fontWeight: "600" }}
                                    numberOfLines={1}
                                >
                                    Tuỳ chọn
                                </Text>
                                <Text style={{ color: colors.headerText, fontSize: 11, opacity: 0.7 }}>
                                    Cài đặt trò chuyện
                                </Text>
                            </View>
                        </View>

                        {/* Right: placeholder */}
                        <View style={{ width: 24 }} />
                    </View>
                </SafeAreaViewCtx>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* ── Avatar + Group Name ── */}
                <View style={{ alignItems: "center", paddingVertical: 28, backgroundColor: colors.card }}>
                    <View style={{ position: "relative", marginBottom: 12 }}>
                        <Image
                            source={{ uri: avatarUri }}
                            style={{ width: 80, height: 80, borderRadius: 40 }}
                        />
                        <View
                            style={{
                                position: "absolute",
                                bottom: 0,
                                right: 0,
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                backgroundColor: colors.searchBg,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: colors.card,
                            }}
                        >
                            <Ionicons name="camera" size={13} color={colors.textSecondary} />
                        </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
                            {group.groupName}
                        </Text>
                        <TouchableOpacity activeOpacity={0.6}>
                            <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Quick Actions Row ── */}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-around",
                        paddingHorizontal: 20,
                        paddingBottom: 20,
                        borderBottomWidth: 6,
                        borderBottomColor: colors.separator,
                        backgroundColor: colors.card,
                    }}
                >
                    {[
                        { icon: "search", label: "Tìm\ntin nhắn", onPress: () => router.push(`/search-messages?roomId=${roomId}&name=${encodeURIComponent(group.groupName)}&avatarUrl=${encodeURIComponent(avatarUri)}`) },
                        { icon: "person-add-outline", label: "Thêm\nthành viên", onPress: () => setShowAddMember(true) },
                        { icon: "color-palette-outline", label: "Đổi\nhình nền" },
                        { icon: "notifications-outline", label: "Tắt\nthông báo" },
                    ].map((item, idx) => (
                        <TouchableOpacity
                            key={idx}
                            activeOpacity={0.7}
                            onPress={item.onPress}
                            style={{ alignItems: "center", width: 70 }}
                        >
                            <View
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: colors.searchBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 6,
                                }}
                            >
                                <Ionicons name={item.icon as any} size={20} color={colors.text} />
                            </View>
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                    textAlign: "center",
                                    lineHeight: 15,
                                }}
                            >
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Sections ── */}
                <View style={{ marginTop: 4 }}>
                    <SectionRow
                        icon="information-circle-outline"
                        label="Thêm mô tả nhóm"
                    />
                </View>

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow
                    icon="images-outline"
                    label="Ảnh, file, link"
                />

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow icon="calendar-outline" label="Lịch nhóm" />
                <SectionRow icon="pin-outline" label="Tin nhắn đã ghim" />
                <SectionRow icon="bar-chart-outline" label="Bình chọn" />

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow
                    icon="people-outline"
                    label={`Xem thành viên (${group.members.length})`}
                    onPress={() => setShowMembers(true)}
                />
                <SectionRow
                    icon="link-outline"
                    label="Link nhóm"
                    subtitle="Chưa có link nhóm"
                />

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                <SectionRow
                    icon="pin-outline"
                    label="Ghim trò chuyện"
                    showChevron={false}
                    rightElement={
                        <Switch
                            value={pinned}
                            onValueChange={setPinned}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />
                    }
                />
                <SectionRow icon="eye-off-outline" label="Ẩn trò chuyện" />

                <View style={{ height: 6, backgroundColor: colors.separator }} />

                {/* ── Danger zone ── */}
                <SectionRow
                    icon="alert-circle-outline"
                    label="Báo xấu"
                    showChevron={false}
                />
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomWidth: 0.5,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.card,
                    }}
                >
                    <Ionicons
                        name="trash-outline"
                        size={22}
                        color="#ef4444"
                        style={{ marginRight: 14, width: 24, textAlign: "center" as const }}
                    />
                    <Text style={{ fontSize: 15, color: "#ef4444" }}>Xóa lịch sử trò chuyện</Text>
                </TouchableOpacity>

                {isOwner ? (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleDisbandGroup}
                        disabled={isLeaving}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            backgroundColor: colors.card,
                            opacity: isLeaving ? 0.5 : 1,
                        }}
                    >
                        <Ionicons
                            name="trash-bin-outline"
                            size={22}
                            color="#ef4444"
                            style={{ marginRight: 14, width: 24, textAlign: "center" as const }}
                        />
                        <Text style={{ fontSize: 15, color: "#ef4444" }}>
                            {isLeaving ? "Đang giải tán..." : "Giải tán nhóm"}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleLeaveGroup}
                        disabled={isLeaving}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            backgroundColor: colors.card,
                            opacity: isLeaving ? 0.5 : 1,
                        }}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={22}
                            color="#ef4444"
                            style={{ marginRight: 14, width: 24, textAlign: "center" as const }}
                        />
                        <Text style={{ fontSize: 15, color: "#ef4444" }}>
                            {isLeaving ? "Đang rời..." : "Rời nhóm"}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* ── Add Member Modal ── */}
            <AddMemberModal
                visible={showAddMember}
                onClose={() => setShowAddMember(false)}
                groupId={roomId}
                existingMemberIds={existingMemberIds}
                onMembersAdded={(updated) => setGroup(updated)}
            />

            {/* ── Members List Modal ── */}
            <Modal
                visible={showMembers}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowMembers(false)}
            >
                <SafeAreaView
                    style={{
                        flex: 1,
                        backgroundColor: colors.background,
                        paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 16,
                            height: 52,
                            backgroundColor: colors.headerBg,
                            borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                            borderBottomColor: colors.border,
                            gap: 12,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => setShowMembers(false)}
                            activeOpacity={0.6}
                            style={{ paddingRight: 8, paddingVertical: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: "600", color: colors.headerText, flex: 1 }}>
                            Thành viên ({group.members.length})
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setShowMembers(false);
                                setTimeout(() => setShowAddMember(true), 200);
                            }}
                            activeOpacity={0.6}
                            style={{ padding: 4 }}
                        >
                            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Members list */}
                    <FlatList
                        data={group.members}
                        keyExtractor={(item) => item.userId}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item: member }) => {
                            const memberAvatar =
                                member.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    member.username
                                )}&background=0068FF&color=fff&bold=true`;
                            const isOwnerMember = member.userId === group.ownerId;
                            const isCurrentUser = member.userId === currentUserId;

                            return (
                                <View
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
                                    <Image
                                        source={{ uri: memberAvatar }}
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 24,
                                            marginRight: 12,
                                            backgroundColor: colors.separator,
                                        }}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <Text
                                                style={{ fontSize: 15, color: colors.text, fontWeight: "500" }}
                                                numberOfLines={1}
                                            >
                                                {member.username}
                                            </Text>
                                            {isCurrentUser && (
                                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>(Bạn)</Text>
                                            )}
                                        </View>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                            @{member.username}
                                        </Text>
                                    </View>
                                    {isOwnerMember && (
                                        <View
                                            style={{
                                                backgroundColor: colors.primary + "20",
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 12,
                                                marginRight: canManageMembers && !isOwnerMember && !isCurrentUser ? 8 : 0,
                                            }}
                                        >
                                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>
                                                Quản trị viên
                                            </Text>
                                        </View>
                                    )}
                                    {canManageMembers && !isOwnerMember && !isCurrentUser && (
                                        <TouchableOpacity
                                            style={{ padding: 6 }}
                                            onPress={() => handleRemoveMember(member.userId)}
                                        >
                                            <Ionicons name="trash-outline" size={22} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
}

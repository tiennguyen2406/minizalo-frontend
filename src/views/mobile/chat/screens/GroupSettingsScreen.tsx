import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Switch,
    ActivityIndicator,
    Alert,
    Modal,
    FlatList,
    Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { groupService } from "@/shared/services/groupService";
import type { BlockedMember, GroupMember, GroupSettings } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";
import { useAuthStore } from "@/shared/store/authStore";
import { webSocketService } from "@/shared/services/WebSocketService";
import { useChatStore } from "@/shared/store/useChatStore";
import {
    GroupSettingsRow,
    GroupSettingsSectionLabel,
    ChevronRight,
} from "../components/groupSettings/GroupSettingsRow";
import { RolesManagementSheet } from "../components/groupSettings/RolesManagementSheet";
import { BlockedMembersSheet } from "../components/groupSettings/BlockedMembersSheet";
import {
    MemberActionPickerSheet,
    type MemberActionPickerMode,
} from "../components/groupSettings/MemberActionPickerSheet";

function getScopedKey(suffix: string): string {
    const uid = useAuthStore.getState().user?.id || "anon";
    return `minizalo:${uid}:${suffix}`;
}

function isRemoteImageUri(value?: string | null): value is string {
    return /^https?:\/\//i.test(String(value || ""));
}

interface GroupSettingsScreenProps {
    groupId: string;
    groupName: string;
    members: GroupMember[];
    ownerId: string;
    onClose: () => void;
    /** Open members list after closing the settings overlay. */
    onOpenMembers?: () => void;
    onDisband: () => void;
    /** After ownership/settings changes. */
    onRefreshGroup?: () => void;
}

export default function GroupSettingsScreen({
    groupId,
    groupName,
    members,
    ownerId,
    onClose,
    onOpenMembers,
    onDisband,
    onRefreshGroup,
}: GroupSettingsScreenProps) {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const currentUserId = useAuthStore((s) => s.user?.id);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<Partial<GroupSettings> | null>(null);
    const [highlightAdminMsg, setHighlightAdminMsg] = useState(false);
    const [transferVisible, setTransferVisible] = useState(false);
    const [rolesVisible, setRolesVisible] = useState(false);
    const [blockedVisible, setBlockedVisible] = useState(false);
    const [blockedLoading, setBlockedLoading] = useState(false);
    const [blockedMembers, setBlockedMembers] = useState<BlockedMember[] | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerMode, setPickerMode] = useState<MemberActionPickerMode>("ADD_ADMIN");
    const [pickerBusy, setPickerBusy] = useState(false);
    const [membersState, setMembersState] = useState<GroupMember[]>(members);
    const hiddenRooms = useChatStore((s) => s.hiddenRooms);
    const toggleHiddenRoom = useChatStore((s) => s.toggleHiddenRoom);
    const isConversationHidden = hiddenRooms.has(String(groupId));

    useEffect(() => {
        setMembersState(members);
    }, [members]);

    const highlightKey = `${getScopedKey("groupHighlightAdmin")}:${groupId}`;
    const notesPermKey = `${getScopedKey("groupNotesPerm")}:${groupId}`;
    const [notesPermissionUi, setNotesPermissionUi] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
            AsyncStorage.getItem(highlightKey),
            AsyncStorage.getItem(notesPermKey),
        ])
            .then(([h, n]) => {
                if (!cancelled) {
                    setHighlightAdminMsg(h === "1");
                    setNotesPermissionUi(n === "1");
                }
            })
            .catch(() => {});
        groupService
            .getGroupSettings(groupId)
            .then((data) => {
                if (!cancelled) setSettings(data);
            })
            .catch(() => {
                Alert.alert("Lỗi", "Không tải được cài đặt nhóm.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [groupId, highlightKey, notesPermKey]);

    useEffect(() => {
        if (!groupId) return;
        const settingsTopic = `/topic/chat/${groupId}/settings`;
        const onSettingsChanged = (stompMessage: { body: string }) => {
            try {
                const next = JSON.parse(String(stompMessage.body || "{}")) as GroupSettings;
                setSettings((prev) => ({ ...(prev || {}), ...(next || {}) }));
                onRefreshGroup?.();
            } catch {
                /* ignore */
            }
        };

        webSocketService.subscribe(settingsTopic, onSettingsChanged);
        return () => webSocketService.unsubscribe(settingsTopic, onSettingsChanged);
    }, [groupId, onRefreshGroup]);

    const persistNotesPerm = useCallback(
        async (value: boolean) => {
            setNotesPermissionUi(value);
            try {
                await AsyncStorage.setItem(notesPermKey, value ? "1" : "0");
            } catch {
                /* ignore */
            }
        },
        [notesPermKey],
    );

    const persistHighlight = useCallback(
        async (value: boolean) => {
            setHighlightAdminMsg(value);
            try {
                await AsyncStorage.setItem(highlightKey, value ? "1" : "0");
            } catch {
                /* ignore */
            }
        },
        [highlightKey],
    );

    const patchSettings = async (partial: Partial<GroupSettings>) => {
        // Optimistic update to keep switches stable while the server returns partial fields.
        setSettings((prev) => ({ ...(prev || {}), ...partial }));
        setSaving(true);
        try {
            const next = await groupService.updateGroupSettings({
                groupId,
                ...partial,
            });
            setSettings((prev) => ({ ...(prev || {}), ...(next || {}) }));
            onRefreshGroup?.();
        } catch (e: any) {
            Alert.alert("Lỗi", e?.response?.data?.message || "Cập nhật thất bại.");
            // rollback best-effort: refetch settings từ server
            try {
                const fresh = await groupService.getGroupSettings(groupId);
                setSettings(fresh);
            } catch {
                /* ignore */
            }
        } finally {
            setSaving(false);
        }
    };

    const handleToggleHiddenConversation = () => {
        if (isConversationHidden) {
            toggleHiddenRoom(groupId);
            return;
        }
        Alert.alert(
            "Ẩn trò chuyện",
            "Cuộc trò chuyện sẽ không hiển thị trong danh sách. Bạn vẫn có thể tìm lại bằng tên nhóm.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Ẩn",
                    onPress: () => {
                        toggleHiddenRoom(groupId);
                        onClose();
                    },
                },
            ],
        );
    };

    const openPicker = (mode: MemberActionPickerMode) => {
        setPickerMode(mode);
        setPickerBusy(false);
        setPickerVisible(true);
    };

    const isOwner = currentUserId != null && String(currentUserId) === String(ownerId);
    const isAdmin =
        currentUserId != null &&
        membersState.some((m) => String(m.userId) === String(currentUserId) && m.role === "ADMIN");
    const isOwnerOrAdmin = isOwner || isAdmin;

    const transferCandidates = membersState.filter((m) => m.userId !== ownerId);
    const ownerMember = membersState.find((m) => String(m.userId) === String(ownerId)) || null;
    const adminMembers = membersState.filter(
        (m) => m.role === "ADMIN" && String(m.userId) !== String(ownerId),
    );
    const selectableForAdmin = membersState.filter(
        (m) => String(m.userId) !== String(ownerId) && m.role !== "ADMIN",
    );
    const selectableForBlock = membersState.filter((m) => String(m.userId) !== String(ownerId));

    const fetchBlocked = useCallback(async () => {
        setBlockedLoading(true);
        try {
            const list = await groupService.getBlockedMembers(groupId);
            setBlockedMembers(list);
        } catch {
            setBlockedMembers([]);
        } finally {
            setBlockedLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        if (!blockedVisible) return;
        void fetchBlocked();
    }, [blockedVisible, fetchBlocked]);

    const handleAddAdmin = async (targetUserId: string) => {
        setPickerBusy(true);
        try {
            const updated = await groupService.changeRole(groupId, targetUserId, "ADMIN");
            setMembersState(updated.members);
            Alert.alert("Thành công", "Đã bổ nhiệm phó nhóm.");
            setPickerVisible(false);
            // Refetch from server to keep role/owner state in sync.
            try {
                const fresh = await groupService.getGroupDetails(groupId);
                setMembersState(fresh.members);
            } catch {
                /* ignore */
            }
            onRefreshGroup?.();
        } catch (e: any) {
            Alert.alert("Lỗi", e?.response?.data?.message || "Bổ nhiệm thất bại.");
        } finally {
            setPickerBusy(false);
        }
    };

    const handleRemoveAdmin = async (targetUserId: string) => {
        Alert.alert("Xóa phó nhóm", "Xóa quyền phó nhóm của thành viên này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    setSaving(true);
                    try {
                        const updated = await groupService.changeRole(groupId, targetUserId, "MEMBER");
                        setMembersState(updated.members);
                        try {
                            const fresh = await groupService.getGroupDetails(groupId);
                            setMembersState(fresh.members);
                        } catch {
                            /* ignore */
                        }
                        onRefreshGroup?.();
                    } catch (e: any) {
                        Alert.alert("Lỗi", e?.response?.data?.message || "Thao tác thất bại.");
                    } finally {
                        setSaving(false);
                    }
                },
            },
        ]);
    };

    const handleBlockMember = async (targetUserId: string) => {
        setPickerBusy(true);
        try {
            await groupService.blockMember(groupId, targetUserId);
            Alert.alert("Thành công", "Đã chặn thành viên khỏi nhóm.");
            setPickerVisible(false);
            await fetchBlocked();
            try {
                const fresh = await groupService.getGroupDetails(groupId);
                setMembersState(fresh.members);
            } catch {
                /* ignore */
            }
            onRefreshGroup?.();
        } catch (e: any) {
            Alert.alert("Lỗi", e?.response?.data?.message || "Chặn thất bại.");
        } finally {
            setPickerBusy(false);
        }
    };

    const handleUnblockMember = async (targetUserId: string) => {
        setSaving(true);
        try {
            await groupService.unblockMember(groupId, targetUserId);
            setBlockedMembers((prev) => (prev || []).filter((x) => x.userId !== targetUserId));
            try {
                const fresh = await groupService.getGroupDetails(groupId);
                setMembersState(fresh.members);
            } catch {
                /* ignore */
            }
        } catch (e: any) {
            Alert.alert("Lỗi", e?.response?.data?.message || "Bỏ chặn thất bại.");
        } finally {
            setSaving(false);
        }
    };

    const handleTransfer = async (newOwnerId: string) => {
        Alert.alert(
            "Chuyển quyền trưởng nhóm",
            "Bạn sẽ không còn là chủ nhóm. Tiếp tục?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Chuy?n",
                    onPress: async () => {
                        setSaving(true);
                        try {
                            await groupService.transferOwnership(groupId, newOwnerId);
                            Alert.alert("Thành công", "Đã chuyển quyền trưởng nhóm.");
                            setTransferVisible(false);
                            onRefreshGroup?.();
                            onClose();
                        } catch (e: any) {
                            Alert.alert("Lỗi", e?.response?.data?.message || "Chuyển quyền thất bại.");
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ],
        );
    };

    if (loading && !settings) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const MemberSettingsRow = ({
        icon,
        label,
        subtitle,
        right,
        onPress,
        disabled,
        first,
        last,
    }: {
        icon: keyof typeof Ionicons.glyphMap;
        label: string;
        subtitle?: string;
        right?: React.ReactNode;
        onPress?: () => void;
        disabled?: boolean;
        first?: boolean;
        last?: boolean;
    }) => (
        <TouchableOpacity
            activeOpacity={0.72}
            onPress={onPress}
            disabled={disabled || !onPress}
            style={{
                minHeight: 62,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: colors.card,
                opacity: disabled ? 0.55 : 1,
                borderTopLeftRadius: first ? 14 : 0,
                borderTopRightRadius: first ? 14 : 0,
                borderBottomLeftRadius: last ? 14 : 0,
                borderBottomRightRadius: last ? 14 : 0,
            }}
        >
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary + "14",
                    marginRight: 12,
                }}
            >
                <Ionicons name={icon} size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                <Text style={{ color: colors.text, fontSize: 15.5, fontWeight: "700", lineHeight: 20 }} numberOfLines={1}>
                    {label}
                </Text>
                {subtitle ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginTop: 3 }} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            <View style={{ minWidth: 34, alignItems: "flex-end", justifyContent: "center", marginLeft: 10 }}>
                {right || <ChevronRight />}
            </View>
            {!last ? (
                <View
                    pointerEvents="none"
                    style={{
                        position: "absolute",
                        left: 62,
                        right: 0,
                        bottom: 0,
                        height: 0.5,
                        backgroundColor: colors.border,
                    }}
                />
            ) : null}
        </TouchableOpacity>
    );

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
                    <TouchableOpacity onPress={onClose} style={{ padding: 8 }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 17, fontWeight: "600", color: colors.headerText }} numberOfLines={1}>
                        Cài đặt nhóm
                    </Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                <GroupSettingsSectionLabel title="Thiết lập tin nhắn" />
                <View
                    style={{
                        backgroundColor: colors.card,
                        marginHorizontal: 12,
                        marginTop: 6,
                        borderRadius: 14,
                        overflow: "hidden",
                        borderWidth: 0.5,
                        borderColor: colors.border,
                    }}
                >
                    <GroupSettingsRow
                        label="Làm nổi tin nhắn từ trưởng và phó nhóm"
                        right={
                            <Switch
                                value={highlightAdminMsg}
                                onValueChange={persistHighlight}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        first
                    />
                    <GroupSettingsRow
                        label="Thành viên mới xem được tin gửi gần đây"
                        right={
                            <Switch
                                value={settings?.allowNewMemberReadHistory ?? true}
                                onValueChange={(v) => patchSettings({ allowNewMemberReadHistory: v })}
                                disabled={saving}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        last
                    />
                </View>

                <GroupSettingsSectionLabel title="Thành viên" />
                <View
                    style={{
                        backgroundColor: colors.card,
                        marginHorizontal: 12,
                        marginTop: 6,
                        borderRadius: 14,
                        overflow: "hidden",
                        borderWidth: 0.5,
                        borderColor: colors.border,
                    }}
                >
                    <MemberSettingsRow
                        icon="people-outline"
                        label="Quản lý thành viên"
                        onPress={() => {
                            onClose();
                            setTimeout(() => onOpenMembers?.(), 220);
                        }}
                        first
                    />
                    <MemberSettingsRow
                        icon="person-add-outline"
                        label="Duyệt thành viên"
                        right={
                            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "700", lineHeight: 18 }}>
                                {settings?.requireApproval ? "Đang bật" : "Đã tắt"}
                            </Text>
                        }
                        subtitle={!isOwner ? "Chỉ trưởng nhóm" : undefined}
                        onPress={() => {
                            if (!isOwner) return;
                            void patchSettings({ requireApproval: !settings?.requireApproval });
                        }}
                        disabled={!isOwner}
                    />
                    <MemberSettingsRow
                        icon="shield-checkmark-outline"
                        label="Trưởng và phó nhóm"
                        subtitle={!isOwner ? "Chỉ trưởng nhóm" : undefined}
                        onPress={() => setRolesVisible(true)}
                        disabled={!isOwner}
                    />
                    <MemberSettingsRow
                        icon="ban-outline"
                        label="Chặn khỏi nhóm"
                        subtitle={!isOwnerOrAdmin ? "Chỉ trưởng/phó nhóm" : undefined}
                        onPress={() => setBlockedVisible(true)}
                        disabled={!isOwnerOrAdmin}
                        last={!isOwner}
                    />
                    {isOwner ? (
                        <MemberSettingsRow
                            icon="key-outline"
                            label="Chuyển quyền trưởng nhóm"
                            onPress={() => setTransferVisible(true)}
                            last
                        />
                    ) : null}
                </View>

                <GroupSettingsSectionLabel title="Quyền của thành viên" />
                <View
                    style={{
                        backgroundColor: colors.card,
                        marginHorizontal: 12,
                        marginTop: 6,
                        borderRadius: 14,
                        overflow: "hidden",
                        borderWidth: 0.5,
                        borderColor: colors.border,
                    }}
                >
                    <GroupSettingsRow
                        label="Quyền sửa thông tin nhóm"
                        right={
                            <Switch
                                value={settings?.allowMemberChangeName ?? true}
                                onValueChange={(v) => patchSettings({ allowMemberChangeName: v })}
                                disabled={saving}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        subtitle="Tất cả mọi người"
                        first
                    />
                    <GroupSettingsRow
                        label="Quyền tạo ghi chú, nhắc hẹn"
                        right={
                            <Switch
                                value={notesPermissionUi}
                                onValueChange={persistNotesPerm}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        subtitle="Tất cả mọi người"
                    />
                    <GroupSettingsRow
                        label="Quyền tạo bình chọn"
                        right={
                            <Switch
                                value={settings?.allowMemberCreatePoll ?? true}
                                onValueChange={(v) => patchSettings({ allowMemberCreatePoll: v })}
                                disabled={saving}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        subtitle="Tất cả mọi người"
                    />
                    <GroupSettingsRow
                        label="Quyền ghim tin nhắn"
                        right={
                            <Switch
                                value={settings?.allowMemberPin ?? true}
                                onValueChange={(v) => patchSettings({ allowMemberPin: v })}
                                disabled={saving}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        subtitle="Tất cả mọi người"
                    />
                    <GroupSettingsRow
                        label="Quyền gửi tin nhắn"
                        right={
                            <Switch
                                value={settings?.allowMemberSendMessage ?? true}
                                onValueChange={(v) => patchSettings({ allowMemberSendMessage: v })}
                                disabled={saving}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        subtitle="Tất cả mọi người"
                        last
                    />
                </View>

                <View style={{ height: 14 }} />
                <View
                    style={{
                        backgroundColor: colors.card,
                        marginHorizontal: 12,
                        marginTop: 6,
                        borderRadius: 14,
                        overflow: "hidden",
                        borderWidth: 0.5,
                        borderColor: colors.border,
                    }}
                >
                    <GroupSettingsRow
                        label="Ẩn trò chuyện"
                        subtitle={isConversationHidden ? "Đang ẩn khỏi danh sách tin nhắn" : undefined}
                        right={
                            <Switch
                                value={isConversationHidden}
                                onValueChange={handleToggleHiddenConversation}
                                trackColor={{ false: colors.separator, true: colors.primary }}
                                thumbColor="#fff"
                            />
                        }
                        first
                        last
                    />
                </View>

                {isOwner ? (
                    <>
                        <View style={{ height: 14 }} />
                        <View
                            style={{
                                backgroundColor: colors.card,
                                marginHorizontal: 12,
                                marginTop: 6,
                                borderRadius: 14,
                                overflow: "hidden",
                                borderWidth: 0.5,
                                borderColor: colors.border,
                            }}
                        >
                            <GroupSettingsRow
                                label="Giải tán nhóm"
                                danger
                                first
                                last
                                centerLabel
                                onPress={() => {
                                    Alert.alert("Giải tán nhóm", `Giải tán nhóm \"${groupName}\"?`, [
                                        { text: "Hủy", style: "cancel" },
                                        { text: "Giải tán", style: "destructive", onPress: onDisband },
                                    ]);
                                }}
                            />
                        </View>
                    </>
                ) : null}

                {saving ? (
                    <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 8, fontSize: 12 }}>Đang lưu…</Text>
                ) : null}
            </ScrollView>

            <Modal visible={transferVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTransferVisible(false)}>
                <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
                    <View style={{ backgroundColor: colors.headerBg }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 16,
                                minHeight: 58,
                                borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                                borderBottomColor: colors.border,
                            }}
                        >
                            <TouchableOpacity onPress={() => setTransferVisible(false)} style={{ paddingVertical: 8, minWidth: 64 }}>
                                <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: "700" }}>Hủy</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.headerText }} numberOfLines={1}>Chọn trưởng nhóm mới</Text>
                            <View style={{ width: 64 }} />
                        </View>
                    </View>
                    <FlatList
                        data={transferCandidates}
                        keyExtractor={(item) => item.userId}
                        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 28, flexGrow: 1 }}
                        renderItem={({ item }) => {
                            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.fullName || item.username)}&background=0068FF&color=fff`;
                            const avatar = isRemoteImageUri(item.avatarUrl) ? item.avatarUrl : fallbackAvatar;
                            const isSelf = item.userId === currentUserId;
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.75}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        marginHorizontal: 12,
                                        marginBottom: 8,
                                        paddingHorizontal: 14,
                                        paddingVertical: 13,
                                        backgroundColor: colors.card,
                                        borderRadius: 14,
                                        borderWidth: 0.5,
                                        borderColor: colors.border,
                                        opacity: isSelf ? 0.55 : 1,
                                    }}
                                    onPress={() => !isSelf && handleTransfer(item.userId)}
                                    disabled={isSelf}
                                >
                                    <Image source={{ uri: avatar }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontSize: 16, color: colors.text, fontWeight: "800" }} numberOfLines={1}>
                                            {item.fullName || item.username}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>{item.role}</Text>
                                    </View>
                                    {isSelf ? (
                                        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "700" }}>Bạn</Text>
                                    ) : (
                                        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.searchBg }}>
                                            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
                                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.searchBg, alignItems: "center", justifyContent: "center" }}>
                                    <Ionicons name="key-outline" size={30} color={colors.textSecondary} />
                                </View>
                                <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 14, fontSize: 15, fontWeight: "600" }}>
                                    Không có thành viên khác để chuyển quyền.
                                </Text>
                            </View>
                        }
                    />
                </View>
            </Modal>

            <RolesManagementSheet
                visible={rolesVisible}
                members={membersState}
                ownerId={ownerId}
                canManage={isOwner}
                busy={saving || pickerBusy}
                onClose={() => setRolesVisible(false)}
                onAddAdmin={() => {
                    // Avoid stacking two iOS pageSheet modals before opening the picker.
                    setRolesVisible(false);
                    setTimeout(() => openPicker("ADD_ADMIN"), 220);
                }}
                onRemoveAdmin={(uid) => void handleRemoveAdmin(uid)}
            />

            <BlockedMembersSheet
                visible={blockedVisible}
                loading={blockedLoading}
                members={blockedMembers || []}
                busy={saving || pickerBusy}
                canManage={isOwnerOrAdmin}
                onClose={() => setBlockedVisible(false)}
                onOpenBlockPicker={() => {
                    // Avoid stacking two iOS pageSheet modals before opening the picker.
                    setBlockedVisible(false);
                    setTimeout(() => openPicker("BLOCK"), 220);
                }}
                onUnblock={(uid) => void handleUnblockMember(uid)}
            />

            <MemberActionPickerSheet
                visible={pickerVisible}
                mode={pickerMode}
                members={membersState}
                ownerId={ownerId}
                busy={pickerBusy || saving}
                onClose={() => {
                    setPickerBusy(false);
                    setPickerVisible(false);
                }}
                onPick={(uid) => {
                    if (pickerMode === "ADD_ADMIN") void handleAddAdmin(uid);
                    else void handleBlockMember(uid);
                }}
            />
        </View>
    );
}

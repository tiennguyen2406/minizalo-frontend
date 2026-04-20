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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { groupService } from "@/shared/services/groupService";
import type { BlockedMember, GroupMember, GroupSettings } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";
import { useAuthStore } from "@/shared/store/authStore";
import { webSocketService } from "@/shared/services/WebSocketService";
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

interface GroupSettingsScreenProps {
    groupId: string;
    groupName: string;
    members: GroupMember[];
    ownerId: string;
    onClose: () => void;
    /** Mở danh sách thành viên (đóng overlay cài đặt trước khi gọi) */
    onOpenMembers?: () => void;
    onDisband: () => void;
    /** Sau khi chuyển quyền / cập nhật settings */
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
        // Optimistic update để tránh Switch khác bị nhấp nháy khi server trả thiếu field.
        setSettings((prev) => ({ ...(prev || {}), ...partial }));
        setSaving(true);
        try {
            const next = await groupService.updateGroupSettings({
                groupId,
                ...partial,
            });
            setSettings((prev) => ({ ...(prev || {}), ...(next || {}) }));
            onRefreshGroup?.();

            // Gửi 1 SYSTEM message vào chat để giống web (pill thông báo).
            try {
                const u = useAuthStore.getState().user;
                const me =
                    u?.fullName?.trim() ||
                    (u as any)?.displayName?.trim?.() ||
                    u?.username?.trim() ||
                    "Ai đó";
                const changed: string[] = [];
                if (partial.allowMemberSendMessage != null) {
                    changed.push(
                        `quyền gửi tin nhắn ${partial.allowMemberSendMessage ? "đã bật" : "đã tắt"}`,
                    );
                }
                if (partial.allowMemberCreatePoll != null) {
                    changed.push(
                        `quyền tạo bình chọn ${partial.allowMemberCreatePoll ? "đã bật" : "đã tắt"}`,
                    );
                }
                if (partial.allowMemberPin != null) {
                    changed.push(
                        `quyền ghim tin nhắn ${partial.allowMemberPin ? "đã bật" : "đã tắt"}`,
                    );
                }
                if (partial.requireApproval != null) {
                    changed.push(
                        `duyệt thành viên ${partial.requireApproval ? "đã bật" : "đã tắt"}`,
                    );
                }
                if (partial.allowNewMemberReadHistory != null) {
                    changed.push(
                        `thành viên mới xem lịch sử ${partial.allowNewMemberReadHistory ? "đã bật" : "đã tắt"}`,
                    );
                }
                if (changed.length > 0) {
                    webSocketService.activate();
                    webSocketService.sendChatMessage(
                        groupId,
                        `${me} đã cập nhật: ${changed.join(", ")}.`,
                        "SYSTEM",
                    );
                }
            } catch {
                /* ignore */
            }
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
            try {
                const u = useAuthStore.getState().user;
                const me =
                    u?.fullName?.trim() ||
                    (u as any)?.displayName?.trim?.() ||
                    u?.username?.trim() ||
                    "Ai đó";
                const target = membersState.find((m) => String(m.userId) === String(targetUserId));
                const targetName = target?.fullName?.trim() || target?.username?.trim() || "một thành viên";
                webSocketService.activate();
                webSocketService.sendChatMessage(groupId, `${me} đã phong ${targetName} làm phó nhóm.`, "SYSTEM");
            } catch {
                /* ignore */
            }
            // Refresh lại từ server để đảm bảo đồng bộ role/owner trong mọi trường hợp.
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
            try {
                const u = useAuthStore.getState().user;
                const me =
                    u?.fullName?.trim() ||
                    (u as any)?.displayName?.trim?.() ||
                    u?.username?.trim() ||
                    "Ai đó";
                const target = membersState.find((m) => String(m.userId) === String(targetUserId));
                const targetName = target?.fullName?.trim() || target?.username?.trim() || "một thành viên";
                webSocketService.activate();
                webSocketService.sendChatMessage(groupId, `${me} đã chặn ${targetName} khỏi nhóm.`, "SYSTEM");
            } catch {
                /* ignore */
            }
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
                const u = useAuthStore.getState().user;
                const me =
                    u?.fullName?.trim() ||
                    (u as any)?.displayName?.trim?.() ||
                    u?.username?.trim() ||
                    "Ai đó";
                const target = blockedMembers?.find((m) => String(m.userId) === String(targetUserId));
                const targetName = target?.displayName?.trim() || target?.username?.trim() || "một thành viên";
                webSocketService.activate();
                webSocketService.sendChatMessage(groupId, `${me} đã bỏ chặn ${targetName}.`, "SYSTEM");
            } catch {
                /* ignore */
            }
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
                    text: "Chuyển",
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
                    <GroupSettingsRow
                        label="Quản lý thành viên"
                        right={<ChevronRight />}
                        variant="menu"
                        onPress={() => {
                            onClose();
                            setTimeout(() => onOpenMembers?.(), 220);
                        }}
                        first
                    />
                    <GroupSettingsRow
                        label="Duyệt thành viên"
                        right={
                            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600", lineHeight: 18 }}>
                                {settings?.requireApproval ? "Đang bật" : "Đã tắt"}
                            </Text>
                        }
                        subtitle={!isOwner ? "Chỉ trưởng nhóm" : undefined}
                        variant="menu"
                        onPress={() => {
                            if (!isOwner) return;
                            void patchSettings({ requireApproval: !settings?.requireApproval });
                        }}
                        disabled={!isOwner}
                    />
                    <GroupSettingsRow
                        label="Trưởng và phó nhóm"
                        right={<ChevronRight />}
                        subtitle={!isOwner ? "Chỉ trưởng nhóm" : undefined}
                        variant="menu"
                        onPress={() => setRolesVisible(true)}
                        disabled={!isOwner}
                    />
                    <GroupSettingsRow
                        label="Chặn khỏi nhóm"
                        right={<ChevronRight />}
                        subtitle={!isOwnerOrAdmin ? "Chỉ trưởng/phó nhóm" : undefined}
                        variant="menu"
                        onPress={() => setBlockedVisible(true)}
                        disabled={!isOwnerOrAdmin}
                    />
                    {isOwner ? (
                        <GroupSettingsRow
                            label="Chuyển quyền trưởng nhóm"
                            right={<ChevronRight />}
                            variant="menu"
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
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 0.5,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.card,
                        }}
                    >
                        <TouchableOpacity onPress={() => setTransferVisible(false)}>
                            <Text style={{ color: colors.primary, fontSize: 16 }}>Hủy</Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>Chọn trưởng nhóm mới</Text>
                        <View style={{ width: 48 }} />
                    </View>
                    <FlatList
                        data={transferCandidates}
                        keyExtractor={(item) => item.userId}
                        contentContainerStyle={{ paddingVertical: 8 }}
                        renderItem={({ item }) => {
                            const avatar =
                                item.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=0068FF&color=fff`;
                            const isSelf = item.userId === currentUserId;
                            return (
                                <TouchableOpacity
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        backgroundColor: colors.card,
                                        borderBottomWidth: 0.5,
                                        borderBottomColor: colors.border,
                                    }}
                                    onPress={() => !isSelf && handleTransfer(item.userId)}
                                    disabled={isSelf}
                                >
                                    <Image source={{ uri: avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 16, color: colors.text }}>
                                            {item.fullName || item.username}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.role}</Text>
                                    </View>
                                    {isSelf ? (
                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Bạn</Text>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <Text style={{ textAlign: "center", color: colors.textSecondary, marginTop: 24 }}>
                                Không có thành viên khác để chuyển quyền.
                            </Text>
                        }
                    />
                </SafeAreaView>
            </Modal>

            <RolesManagementSheet
                visible={rolesVisible}
                members={membersState}
                ownerId={ownerId}
                canManage={isOwner}
                busy={saving || pickerBusy}
                onClose={() => setRolesVisible(false)}
                onAddAdmin={() => {
                    // Tránh mở 2 Modal chồng nhau (iOS pageSheet) khiến picker bị "không hiện".
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
                    // Tránh mở 2 Modal chồng nhau (iOS pageSheet) khiến picker bị "không hiện".
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

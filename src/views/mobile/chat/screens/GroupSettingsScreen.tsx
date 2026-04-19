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
import type { GroupMember, GroupSettings } from "@/shared/types";
import { useThemeColors } from "@/shared/theme/colors";
import { useAuthStore } from "@/shared/store/authStore";

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
        if (!settings) return;
        setSaving(true);
        try {
            const next = await groupService.updateGroupSettings({
                groupId,
                ...partial,
            });
            setSettings(next);
            onRefreshGroup?.();
        } catch (e: any) {
            Alert.alert("Lỗi", e?.response?.data?.message || "Cập nhật thất bại.");
        } finally {
            setSaving(false);
        }
    };

    const sectionLabel = (title: string) => (
        <Text
            style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.primary,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
            }}
        >
            {title}
        </Text>
    );

    const row = (
        label: string,
        right?: React.ReactNode,
        subtitle?: string,
        onPress?: () => void,
        first?: boolean,
        danger?: boolean,
    ) => (
        <TouchableOpacity
            activeOpacity={onPress ? 0.7 : 1}
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: colors.card,
                borderTopWidth: first ? 0 : 0.5,
                borderTopColor: colors.border,
            }}
        >
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: danger ? "#ef4444" : colors.text, fontWeight: danger ? "600" : "400" }}>
                    {label}
                </Text>
                {subtitle ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
                ) : null}
            </View>
            {right}
        </TouchableOpacity>
    );

    const isOwner = currentUserId != null && String(currentUserId) === String(ownerId);

    const transferCandidates = members.filter((m) => m.userId !== ownerId);

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
                {sectionLabel("Thiết lập tin nhắn")}
                <View style={{ backgroundColor: colors.card }}>
                    {row(
                        "Làm nổi tin nhắn từ trưởng và phó nhóm",
                        <Switch
                            value={highlightAdminMsg}
                            onValueChange={persistHighlight}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                        undefined,
                        undefined,
                        true,
                    )}
                    {row(
                        "Thành viên mới xem được tin gửi gần đây",
                        <Switch
                            value={!!settings?.allowNewMemberReadHistory}
                            onValueChange={(v) => patchSettings({ allowNewMemberReadHistory: v })}
                            disabled={saving}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                    )}
                </View>

                {sectionLabel("Thành viên")}
                <View style={{ backgroundColor: colors.card }}>
                    {row(
                        "Quản lý thành viên",
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />,
                        undefined,
                        () => {
                            onClose();
                            setTimeout(() => onOpenMembers?.(), 220);
                        },
                        true,
                    )}
                    {row(
                        "Duyệt thành viên",
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                            {settings?.requireApproval ? "Đang bật" : "Đã tắt"}
                        </Text>,
                        undefined,
                        () => patchSettings({ requireApproval: !settings?.requireApproval }),
                    )}
                    {isOwner
                        ? row(
                              "Chuyển quyền trưởng nhóm",
                              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />,
                              undefined,
                              () => setTransferVisible(true),
                          )
                        : null}
                </View>

                {sectionLabel("Quyền của thành viên")}
                <View style={{ backgroundColor: colors.card }}>
                    {row(
                        "Quyền sửa thông tin nhóm",
                        <Switch
                            value={!!settings?.allowMemberChangeName}
                            onValueChange={(v) => patchSettings({ allowMemberChangeName: v })}
                            disabled={saving}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                        "Tất cả mọi người",
                        undefined,
                        true,
                    )}
                    {row(
                        "Quyền tạo ghi chú, nhắc hẹn",
                        <Switch
                            value={notesPermissionUi}
                            onValueChange={persistNotesPerm}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                        "Tất cả mọi người",
                    )}
                    {row(
                        "Quyền tạo bình chọn",
                        <Switch
                            value={!!settings?.allowMemberCreatePoll}
                            onValueChange={(v) => patchSettings({ allowMemberCreatePoll: v })}
                            disabled={saving}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                        "Tất cả mọi người",
                    )}
                    {row(
                        "Quyền ghim tin nhắn",
                        <Switch
                            value={!!settings?.allowMemberPin}
                            onValueChange={(v) => patchSettings({ allowMemberPin: v })}
                            disabled={saving}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                        "Tất cả mọi người",
                    )}
                    {row(
                        "Quyền gửi tin nhắn",
                        <Switch
                            value={!!settings?.allowMemberSendMessage}
                            onValueChange={(v) => patchSettings({ allowMemberSendMessage: v })}
                            disabled={saving}
                            trackColor={{ false: colors.separator, true: colors.primary }}
                            thumbColor="#fff"
                        />,
                        "Tất cả mọi người",
                    )}
                </View>

                {isOwner ? <View style={{ height: 16, backgroundColor: colors.separator }} /> : null}

                {isOwner
                    ? row(
                          "Giải tán nhóm",
                          undefined,
                          undefined,
                          () => {
                              Alert.alert("Giải tán nhóm", `Giải tán nhóm "${groupName}"?`, [
                                  { text: "Hủy", style: "cancel" },
                                  { text: "Giải tán", style: "destructive", onPress: onDisband },
                              ]);
                          },
                          true,
                          true,
                      )
                    : null}

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
        </View>
    );
}

import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Modal,
    FlatList,
    ScrollView,
    StyleSheet,
    Image,
} from "react-native";
import { SafeView as SafeAreaView } from "@/shared/components/SafeView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "@/shared/theme/colors";
import { CallType } from "@/shared/services/callService";
import { useCallStore } from "@/shared/store/useCallStore";
import { useChatStore } from "@/shared/store/useChatStore";
import { useAuthStore } from "@/shared/store/authStore";

interface ChatHeaderProps {
    name: string;
    roomType?: string;
    isStranger?: boolean;
    /** Chỉ nhãn NGƯỜI LẠ dưới tên — nút Kết bạn đặt trên thanh trắng ngay dưới header (ChatScreen). */
    strangerSubtitleRow?: {
        visible: boolean;
    };
    /** Dấu chấm đỏ trên nút menu (vd. có yêu cầu vào nhóm chờ duyệt) */
    showMenuBadge?: boolean;
    onBack?: () => void;
    onMenuPress?: () => void;
    onAiPress?: () => void;
}

const inviteStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 16 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    title: { fontSize: 18, fontWeight: "700", color: "#111" },
    subtitle: { fontSize: 13, color: "#666", marginBottom: 12 },
    memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: "#e5e7eb" },
    memberName: { flex: 1, fontSize: 15, color: "#222" },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#ccc", justifyContent: "center", alignItems: "center" },
    checkboxChecked: { backgroundColor: "#0068FF", borderColor: "#0068FF" },
    actions: { flexDirection: "row", gap: 12, marginTop: 20 },
    selectAllRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    selectAllButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#eef5ff" },
    cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: "#f3f4f6" },
    confirmBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: "#0068FF" },
    confirmBtnDisabled: { backgroundColor: "#aac4e0" },
});

export default function ChatHeader({
    name,
    roomType,
    isStranger,
    strangerSubtitleRow,
    showMenuBadge,
    onBack,
    onMenuPress,
    onAiPress,
}: ChatHeaderProps) {
    const router = useRouter();
    const params = useLocalSearchParams();
    const colors = useThemeColors();

    const { initiateCall, initiateGroupCall } = useCallStore();
    const myId = useAuthStore((s) => s.user?.id || "");

    // --- Group call invite modal state ---
    const [inviteVisible, setInviteVisible] = useState(false);
    const [callTypeForGroup, setCallTypeForGroup] = useState<CallType>("VOICE");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const roomId = React.useMemo(() => {
        if (params.id) return Array.isArray(params.id) ? params.id[0] : params.id;
        return "";
    }, [params.id]);

    const groupMembers = React.useMemo(() => {
        if (roomType !== "GROUP") return [];
        const room = useChatStore.getState().rooms.find((r) => String(r.id) === String(roomId));
        return (room?.participants || []).filter((p: any) => String(p.id) !== String(myId));
    }, [roomType, roomId, myId]);

    const handleStartCall = async (type: CallType) => {
        if (!roomId || roomId === "new") {
            Alert.alert("Lỗi", "Không thể bắt đầu cuộc gọi trong hội thoại chưa khởi tạo.");
            return;
        }

        if (roomType === "GROUP") {
            if (groupMembers.length === 0) {
                Alert.alert("Lỗi", "Không có thành viên để thực hiện cuộc gọi nhóm.");
                return;
            }
            // Chọn sẵn toàn bộ thành viên
            setSelectedIds(new Set(groupMembers.map((p: any) => String(p.id))));
            setCallTypeForGroup(type);
            setInviteVisible(true);
            return;
        }

        // CLOUD: không cho gọi chính mình
        if (roomType === "CLOUD") {
            return;
        }

        // 1-1
        const receiverId = params.receiverId as string;
        if (!receiverId) {
            Alert.alert("Lỗi", "Không tìm thấy thông tin người nhận để thực hiện cuộc gọi.");
            return;
        }
        try {
            await initiateCall(roomId, receiverId, type);
        } catch (error: any) {
            Alert.alert("Cuộc gọi thất bại", error.response?.data?.message || "Đã có lỗi xảy ra");
        }
    };

    const confirmGroupCall = async () => {
        setInviteVisible(false);
        const receiverIds = Array.from(selectedIds);
        if (receiverIds.length === 0) {
            Alert.alert("Lỗi", "Vui lòng chọn ít nhất một người.");
            return;
        }
        try {
            await initiateGroupCall(roomId, receiverIds, callTypeForGroup);
        } catch (error: any) {
            Alert.alert("Cuộc gọi thất bại", error.response?.data?.message || "Đã có lỗi xảy ra");
        }
    };

    const toggleMember = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allMemberIds = React.useMemo(
        () => groupMembers.map((p: any) => String(p.id)),
        [groupMembers],
    );
    const allMembersSelected = groupMembers.length > 0 && selectedIds.size === groupMembers.length;

    const toggleSelectAllMembers = () => {
        setSelectedIds(allMembersSelected ? new Set() : new Set(allMemberIds));
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <View style={{ backgroundColor: colors.headerBg }}>
            {/* Modal chọn thành viên gọi nhóm */}
            <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => setInviteVisible(false)}>
                <View style={inviteStyles.overlay}>
                    <View style={inviteStyles.sheet}>
                        <View style={inviteStyles.header}>
                            <Text style={inviteStyles.title}>
                                {callTypeForGroup === "VIDEO" ? "Gọi video nhóm" : "Gọi thoại nhóm"}
                            </Text>
                            <TouchableOpacity onPress={() => setInviteVisible(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <View style={inviteStyles.selectAllRow}>
                            <Text style={[inviteStyles.subtitle, { marginBottom: 0 }]}>Chọn thành viên tham gia ({selectedIds.size}/{groupMembers.length})</Text>
                            <TouchableOpacity style={inviteStyles.selectAllButton} onPress={toggleSelectAllMembers}>
                                <Ionicons
                                    name={allMembersSelected ? "remove-circle-outline" : "checkmark-circle-outline"}
                                    size={16}
                                    color="#0068FF"
                                />
                                <Text style={{ color: "#0068FF", fontSize: 13, fontWeight: "700", marginLeft: 5 }}>
                                    {allMembersSelected ? "Bỏ chọn" : "Chọn tất cả"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={groupMembers}
                            keyExtractor={(item: any) => String(item.id)}
                            style={{ maxHeight: 360 }}
                            renderItem={({ item }: { item: any }) => {
                                const id = String(item.id);
                                const checked = selectedIds.has(id);
                                // Ưu tiên fullName → displayName.
                                // KHÔNG fallback về username vì username = SĐT đăng nhập → UX tệ (bắt user nhớ số).
                                const rawName =
                                    (item.fullName && String(item.fullName).trim()) ||
                                    (item.displayName && String(item.displayName).trim()) ||
                                    "";
                                const displayName = rawName || "Thành viên";
                                const avatar = item.avatarUrl
                                    ? { uri: item.avatarUrl }
                                    : { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0068FF&color=fff&size=64` };
                                return (
                                    <TouchableOpacity style={inviteStyles.memberRow} onPress={() => toggleMember(id)} activeOpacity={0.7}>
                                        <Image source={avatar} style={inviteStyles.avatar} />
                                        <Text style={inviteStyles.memberName} numberOfLines={1}>{displayName}</Text>
                                        <View style={[inviteStyles.checkbox, checked && inviteStyles.checkboxChecked]}>
                                            {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <View style={inviteStyles.actions}>
                            <TouchableOpacity style={inviteStyles.cancelBtn} onPress={() => setInviteVisible(false)}>
                                <Text style={{ color: "#555", fontWeight: "600" }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[inviteStyles.confirmBtn, selectedIds.size === 0 && inviteStyles.confirmBtnDisabled]}
                                onPress={confirmGroupCall}
                                disabled={selectedIds.size === 0}
                            >
                                <Ionicons name={callTypeForGroup === "VIDEO" ? "videocam" : "call"} size={16} color="#fff" />
                                <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>
                                    Gọi ({selectedIds.size})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <SafeAreaView edges={["top"]}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: strangerSubtitleRow?.visible ? "flex-start" : "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                        paddingTop: strangerSubtitleRow?.visible ? 10 : 14,
                        paddingBottom: strangerSubtitleRow?.visible ? 10 : 14,
                        minHeight: 52,
                        borderBottomWidth: colors.headerBg === "#0068FF" ? 0 : 0.5,
                        borderBottomColor: colors.border,
                    }}
                >
                    {/* Left: Back & Name */}
                    <View style={{ flexDirection: "row", alignItems: strangerSubtitleRow?.visible ? "flex-start" : "center", flex: 1 }}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={{ paddingRight: 8, paddingVertical: 4 }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.headerText} />
                        </TouchableOpacity>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <Text
                                    style={{ color: colors.headerText, fontSize: 17, fontWeight: "600" }}
                                    numberOfLines={1}
                                >
                                    {name}
                                </Text>
                            </View>
                            {strangerSubtitleRow?.visible ? (
                                <View style={{ marginTop: 6 }}>
                                    <View
                                        style={{
                                            alignSelf: "flex-start",
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                            borderRadius: 999,
                                            backgroundColor: "rgba(0,0,0,0.38)",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: "#ffffff",
                                                fontSize: 10,
                                                fontWeight: "900",
                                                letterSpacing: 0.6,
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            Người lạ
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={{ color: colors.headerText, fontSize: 11, opacity: 0.7 }}>
                                    {roomType === "GROUP" ? `Nhóm` : "Vừa mới truy cập"}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingTop: strangerSubtitleRow?.visible ? 2 : 0 }}>
                        <TouchableOpacity onPress={onAiPress}>
                            <Ionicons name="sparkles" size={22} color="#FFD700" />
                        </TouchableOpacity>

                        {roomType !== "CLOUD" ? (
                            <>
                                <TouchableOpacity onPress={() => handleStartCall("VOICE")}>
                                    <Ionicons name="call-outline" size={22} color={colors.headerText} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => handleStartCall("VIDEO")}>
                                    <Ionicons name="videocam-outline" size={24} color={colors.headerText} />
                                </TouchableOpacity>
                            </>
                        ) : null}

                        <TouchableOpacity onPress={onMenuPress} style={{ position: "relative" }}>
                            <Ionicons name="menu-outline" size={24} color={colors.headerText} />
                            {showMenuBadge ? (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: -2,
                                        right: -2,
                                        width: 10,
                                        height: 10,
                                        borderRadius: 5,
                                        backgroundColor: "#ef4444",
                                        borderWidth: 2,
                                        borderColor: colors.headerBg,
                                    }}
                                />
                            ) : null}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}

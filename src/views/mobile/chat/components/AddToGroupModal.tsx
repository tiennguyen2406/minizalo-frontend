import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Modal,
    Alert,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { groupService } from "@/shared/services/groupService";
import { GroupDetail } from "@/shared/types";

interface AddToGroupModalProps {
    visible: boolean;
    memberId: string;
    memberName: string;
    onClose: () => void;
}

export default function AddToGroupModal({ visible, memberId, memberName, onClose }: AddToGroupModalProps) {
    const [groups, setGroups] = useState<GroupDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        groupService
            .getUsersGroups()
            .then((data) => {
                // Lọc nhóm mà memberId chưa tham gia
                const filtered = data.filter(
                    (g) => !g.members.some((m) => m.userId === memberId)
                );
                setGroups(filtered);
            })
            .catch(() => setGroups([]))
            .finally(() => setLoading(false));
    }, [visible, memberId]);

    const handleAdd = async (group: GroupDetail) => {
        setSubmitting(group.id);
        try {
            await groupService.addMembersToGroup(group.id, [memberId]);
            Alert.alert("Thành công", `Đã thêm ${memberName} vào nhóm "${group.groupName}"`);
            onClose();
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Thêm thành viên thất bại.");
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={st.overlay}>
                <View style={st.sheet}>
                    {/* Header */}
                    <View style={st.header}>
                        <Text style={st.title}>Thêm {memberName} vào nhóm</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color="#b0b3b8" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={st.center}>
                            <ActivityIndicator size="large" color="#0068FF" />
                        </View>
                    ) : groups.length === 0 ? (
                        <View style={st.center}>
                            <Ionicons name="people-outline" size={48} color="#555" />
                            <Text style={st.emptyText}>Không có nhóm nào để thêm</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={groups}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isAdding = submitting === item.id;
                                return (
                                    <TouchableOpacity
                                        style={st.groupRow}
                                        activeOpacity={0.7}
                                        disabled={!!submitting}
                                        onPress={() => handleAdd(item)}
                                    >
                                        <View style={st.groupAvatar}>
                                            <Ionicons name="people" size={22} color="#fff" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={st.groupName} numberOfLines={1}>{item.groupName}</Text>
                                            <Text style={st.groupMeta}>{item.members.length} thành viên</Text>
                                        </View>
                                        {isAdding ? (
                                            <ActivityIndicator size="small" color="#0068FF" />
                                        ) : (
                                            <Ionicons name="add-circle-outline" size={24} color="#0068FF" />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const st = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: "#1a1a1a",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: "70%",
        paddingBottom: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: "#333",
    },
    title: { color: "#e4e6eb", fontSize: 16, fontWeight: "600" },
    center: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
    emptyText: { color: "#7f8c8d", fontSize: 14, marginTop: 12 },
    groupRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: "#262626",
    },
    groupAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#2c2c2e",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    groupName: { color: "#e4e6eb", fontSize: 15, fontWeight: "500" },
    groupMeta: { color: "#7f8c8d", fontSize: 12, marginTop: 2 },
});
